"""
Análisis semántico estático con mensajes pedagógicos para el editor.
"""

from __future__ import annotations

import json
import re
from typing import Any, List

from pedagogical_error_listener import (
    _ensamblar_mensaje,
    detectar_anti_patrones,
)
from woven_runtime import collect_syntax_errors
from linter_visitor import lint_woven


# Refinar mensajes crudos del linter
_MENSAJE_MEJORAS: list[tuple[re.Pattern[str], str]] = [
    (
        re.compile(r"Variable '(\w+)' usada sin declarar"),
        r"usas `\1` pero no la declaraste. En Woven escribe antes el tipo: `int \1 = …`",
    ),
    (
        re.compile(r"'(\w+)' no está definido"),
        r"`\1` no existe todavía. ¿La declaraste con un tipo (`int`, `string`, …)?",
    ),
    (
        re.compile(r"Función '(\w+)' no existe"),
        r"no hay ninguna función llamada `\1`. Revisa el nombre o declárala con `function`",
    ),
    (
        re.compile(r"Clase '(\w+)' no definida"),
        r"la clase `\1` no está definida. ¿Falta `class \1:` en tu programa?",
    ),
    (
        re.compile(r"La clase padre '(\w+)' no existe"),
        r"`extends \1` referencia una clase que no existe en este archivo",
    ),
    (
        re.compile(r"break solo puede usarse dentro de un ciclo"),
        "`break` solo tiene sentido dentro de `for` o `while`",
    ),
    (
        re.compile(r"continue solo puede usarse dentro de un ciclo"),
        "`continue` solo tiene sentido dentro de `for` o `while`",
    ),
]


_SYNTAX_LINE = re.compile(r"línea (\d+):\d+")


def _diagnosticos_desde_errores(errores: List[str]) -> List[dict[str, Any]]:
    """Convierte mensajes de sintaxis/léxico en diagnósticos con línea para el editor."""
    out: List[dict[str, Any]] = []
    for err in errores:
        m = _SYNTAX_LINE.search(err)
        if not m:
            continue
        linea = int(m.group(1))
        mensaje = err.split(" — ", 1)[1].split("\n")[0] if " — " in err else err
        out.append(
            {
                "nivel": "error",
                "linea": linea,
                "mensaje": mensaje,
                "texto": err,
            }
        )
    return out


def _mejorar_mensaje(mensaje: str) -> str:
    for patron, reemplazo in _MENSAJE_MEJORAS:
        nuevo = patron.sub(reemplazo, mensaje)
        if nuevo != mensaje:
            return nuevo
    return mensaje


def _formatear_diagnostico(
    diagnostico: dict[str, Any],
    source: str,
) -> str:
    linea = int(diagnostico["linea"])
    nivel = diagnostico["nivel"]
    mensaje = _mejorar_mensaje(str(diagnostico["mensaje"]))

    if nivel == "error":
        cuerpo = f"Error semántico: línea {linea} — {mensaje}"
    else:
        cuerpo = f"Advertencia semántica: línea {linea} — {mensaje}"

    lineas = source.splitlines()
    columna = 0
    if 1 <= linea <= len(lineas):
        limpia = lineas[linea - 1].lstrip()
        if limpia:
            columna = lineas[linea - 1].index(limpia[0])

    return _ensamblar_mensaje(cuerpo, source, linea, columna)


def lint_woven_pedagogico(source: str) -> str:
    """
    Devuelve JSON:
    {
      "parse_ok": bool,
      "diagnosticos": [{ "nivel", "linea", "mensaje", "texto" }, ...],
      "tiene_errores": bool,
      "tiene_advertencias": bool
    }
    """
    if not source.strip():
        return json.dumps(
            {
                "parse_ok": True,
                "diagnosticos": [],
                "tiene_errores": False,
                "tiene_advertencias": False,
            },
            ensure_ascii=False,
        )

    anti = detectar_anti_patrones(source)
    if anti:
        diagnosticos = _diagnosticos_desde_errores(anti)
        return json.dumps(
            {
                "parse_ok": False,
                "diagnosticos": diagnosticos,
                "tiene_errores": bool(diagnosticos),
                "tiene_advertencias": False,
            },
            ensure_ascii=False,
        )

    syntax = collect_syntax_errors(source)
    if syntax:
        diagnosticos = _diagnosticos_desde_errores(syntax)
        return json.dumps(
            {
                "parse_ok": False,
                "diagnosticos": diagnosticos,
                "tiene_errores": bool(diagnosticos),
                "tiene_advertencias": False,
            },
            ensure_ascii=False,
        )

    crudo = json.loads(lint_woven(source))
    diagnosticos: List[dict[str, Any]] = []
    for d in crudo.get("diagnosticos", []):
        texto = _formatear_diagnostico(d, source)
        diagnosticos.append(
            {
                "nivel": d["nivel"],
                "linea": d["linea"],
                "mensaje": d["mensaje"],
                "texto": texto,
            }
        )

    tiene_errores = any(d["nivel"] == "error" for d in diagnosticos)
    tiene_advertencias = any(d["nivel"] == "warning" for d in diagnosticos)

    return json.dumps(
        {
            "parse_ok": True,
            "diagnosticos": diagnosticos,
            "tiene_errores": tiene_errores,
            "tiene_advertencias": tiene_advertencias,
        },
        ensure_ascii=False,
    )
