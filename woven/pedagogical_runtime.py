"""
Mensajes pedagógicos para errores de ejecución (runtime) de Woven.
"""

from __future__ import annotations

import json
import re
from typing import Any, List, Optional, Tuple

from pedagogical_error_listener import (
    _ensamblar_mensaje,
    _ubicacion,
    diagnosticos_desde_mensajes,
    filtrar_errores_cascada,
)
from pedagogical_common import ejemplo_para_mensaje, filtrar_diagnosticos_cascada
from woven_runtime import collect_syntax_errors, ejecutar_woven


_MENSAJE_MEJORAS: list[tuple[re.Pattern[str], str]] = [
    (
        re.compile(r"Variable usada sin declarar: '(\w+)'"),
        r"usas `\1` pero no existe en este punto. Declárala antes, por ejemplo: `int \1 = 0`",
    ),
    (
        re.compile(
            r"Variable '(\w+)' fue declarada dentro de un bloque "
            r"y no es visible aquí"
        ),
        r"`\1` solo existe dentro del bloque donde la creaste. "
        r"Declárala fuera del bloque o pásala como parámetro",
    ),
    (
        re.compile(r"Division por cero"),
        "no puedes dividir entre cero. Revisa el divisor antes de ejecutar",
    ),
    (
        re.compile(r"Indice fuera de rango"),
        "ese índice no existe en la lista. Recuerda: el primer elemento es `[0]`",
    ),
    (
        re.compile(r"Funcion no declarada: '(\w+)'"),
        r"no hay ninguna función `\1`. ¿La definiste con `function`?",
    ),
    (
        re.compile(
            r"Funcion '(\w+)' llamada con numero incorrecto de argumentos: "
            r"esperados (\d+), recibidos (\d+)"
        ),
        r"llamaste a `\1` con `\3` argumento(s), pero declaraste `\2`",
    ),
    (
        re.compile(
            r"Tipo incompatible en asignacion: '(\w+)' es (\w+), se recibio (\w+)"
        ),
        r"no puedes guardar un valor `{3}` en `{1}` (declarada como `{2}`)",
    ),
    (
        re.compile(
            r"Tipo incompatible en parametro '(\w+)' de '(\w+)': "
            r"esperado (\w+), recibido (\w+)"
        ),
        r"el parámetro `\1` de `\2` debe ser `{3}`, pero recibió `{4}`",
    ),
    (
        re.compile(r"No se puede acceder a un objeto null"),
        "intentas usar un objeto `null`. Comprueba que la variable tenga valor antes",
    ),
    (
        re.compile(
            r"la función '(\w+)' debe retornar un valor de tipo (\w+) "
            r"pero no tiene return"
        ),
        r"la función `\1` promete devolver `{2}` pero termina sin `return`",
    ),
    (
        re.compile(r"se esperaba retornar (\w+) pero return no tiene valor"),
        r"esta función debe devolver `{1}`; agrega un valor después de `return`",
    ),
    (
        re.compile(r"se esperaba retornar (\w+) pero se retornó (\w+)"),
        r"debes devolver `{1}`, pero `return` entregó `{2}`",
    ),
    (
        re.compile(r"función void no debe retornar un valor"),
        "esta función es `void` y no debe devolver un valor",
    ),
    (
        re.compile(
            r"no se puede agregar (\w+) a una lista de (\w+)"
        ),
        r"la lista solo acepta `{2}`; intentaste agregar `{1}`",
    ),
]


def _mejorar_mensaje(mensaje: str) -> str:
    for patron, reemplazo in _MENSAJE_MEJORAS:
        nuevo = patron.sub(reemplazo, mensaje)
        if nuevo != mensaje:
            return nuevo
    return mensaje


def _inferir_columna(linea_texto: str, mensaje: str) -> int:
    m = re.search(r"'(\w+)'", mensaje)
    if m:
        nombre = m.group(1)
        idx = linea_texto.find(nombre)
        if idx >= 0:
            return idx
    limpia = linea_texto.lstrip()
    if limpia:
        return linea_texto.index(limpia[0])
    return 0


def formatear_error_ejecucion(
    mensaje: str,
    source: str,
    linea: int,
    columna: Optional[int] = None,
    forma: Optional[str] = None,
    ejemplo: Optional[str] = None,
) -> Tuple[str, dict[str, Any]]:
    mensaje_mejorado = _mejorar_mensaje(mensaje)
    lineas = source.splitlines()
    if columna is None and 1 <= linea <= len(lineas):
        columna = _inferir_columna(lineas[linea - 1], mensaje)
    col = columna or 0

    muestra = ejemplo or forma or ejemplo_para_mensaje(mensaje_mejorado, "runtime")
    cuerpo = f"Error de ejecución: {_ubicacion(linea, col)} — {mensaje_mejorado}"
    texto = _ensamblar_mensaje(cuerpo, source, linea, col, ejemplo=muestra)
    diagnostico = {
        "nivel": "error",
        "linea": linea,
        "mensaje": mensaje_mejorado,
        "texto": texto,
        "tipo": "runtime",
    }
    return texto, diagnostico


def run_woven_pedagogico(source: str) -> str:
    """
    Ejecuta Woven y devuelve JSON:
    {
      "salida": [str, ...],
      "diagnosticos": [{ "nivel", "linea", "mensaje", "texto", "tipo"? }, ...],
      "tiene_errores": bool
    }
    """
    if not source.strip():
        return json.dumps(
            {
                "salida": [],
                "diagnosticos": [],
                "tiene_errores": False,
            },
            ensure_ascii=False,
        )

    syntax = collect_syntax_errors(source)
    if syntax:
        errores = filtrar_errores_cascada(syntax)
        return json.dumps(
            {
                "salida": errores,
                "diagnosticos": filtrar_diagnosticos_cascada(
                    diagnosticos_desde_mensajes(errores)
                ),
                "tiene_errores": True,
            },
            ensure_ascii=False,
        )

    salida, runtime_diagnosticos = ejecutar_woven(source)
    runtime_diagnosticos = filtrar_diagnosticos_cascada(runtime_diagnosticos)
    if runtime_diagnosticos:
        salida_impresa = [
            linea
            for linea in salida
            if not linea.startswith("Error de ejecución:")
            and not linea.startswith("Error:")
        ]
        salida = salida_impresa + [runtime_diagnosticos[0]["texto"]]
    return json.dumps(
        {
            "salida": salida,
            "diagnosticos": runtime_diagnosticos,
            "tiene_errores": bool(runtime_diagnosticos),
        },
        ensure_ascii=False,
    )
