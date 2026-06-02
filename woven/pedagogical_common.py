"""
Utilidades compartidas para mensajes pedagógicos (Fase D).

- Filtrado de errores en cascada → un error principal
- Ejemplos mínimos consistentes al final de cada mensaje
"""

from __future__ import annotations

import re
from typing import Any, List, Optional

EJEMPLO_ETIQUETA = "Ejemplo mínimo:"

_MAX_ERRORES = 1
_MAX_ADVERTENCIAS = 3

_EJEMPLOS_SEMANTICOS: list[tuple[re.Pattern[str], str]] = [
    (
        re.compile(r"sin declarar|no existe|no la declaraste|no está definido"),
        "int x = 0\nprint(x)",
    ),
    (
        re.compile(r"función|Función"),
        "function int sumar(int a, int b):\n    return a + b",
    ),
    (
        re.compile(r"clase|Clase|extends"),
        "class Contador:\n    init():\n        pass",
    ),
    (
        re.compile(r"break|continue"),
        "while (i < 3):\n    break",
    ),
]

_EJEMPLOS_RUNTIME: list[tuple[re.Pattern[str], str]] = [
    (
        re.compile(r"sin declarar|no existe|Declárala"),
        "int x = 0\nprint(x)",
    ),
    (
        re.compile(r"dividir entre cero|Division por cero"),
        "int n = 2\nprint(10 / n)",
    ),
    (
        re.compile(r"índice|Indice|rango|\[0\]"),
        "list<int> nums = [10, 20]\nprint(nums[0])",
    ),
    (
        re.compile(r"Tipo incompatible|no puedes guardar"),
        "int x = 5\nx = x + 1",
    ),
    (
        re.compile(r"función|Funcion|argumento"),
        "function int doble(int n):\n    return n + n\nprint(doble(4))",
    ),
    (
        re.compile(r"return|devolver|void"),
        "function int uno():\n    return 1",
    ),
    (
        re.compile(r"null"),
        "Animal a = null\nif a != null:\n    print(a)",
    ),
    (
        re.compile(r"bloque|visible"),
        "int x = 0\nif x > 0:\n    print(x)\nprint(x)",
    ),
]


def ejemplo_para_mensaje(mensaje: str, categoria: str = "semantico") -> Optional[str]:
    """Devuelve un ejemplo mínimo Woven acorde al mensaje, si hay uno conocido."""
    tablas = {
        "semantico": _EJEMPLOS_SEMANTICOS,
        "runtime": _EJEMPLOS_RUNTIME,
    }
    for patron, ejemplo in tablas.get(categoria, []):
        if patron.search(mensaje):
            return ejemplo
    return None


def _uno_por_linea(diagnosticos: List[dict[str, Any]]) -> List[dict[str, Any]]:
    vistos: set[int] = set()
    out: List[dict[str, Any]] = []
    for d in diagnosticos:
        linea = int(d.get("linea", 0))
        if linea in vistos:
            continue
        vistos.add(linea)
        out.append(d)
    return out


def filtrar_diagnosticos_cascada(
    diagnosticos: List[dict[str, Any]],
    *,
    max_errores: int = _MAX_ERRORES,
    max_advertencias: int = _MAX_ADVERTENCIAS,
) -> List[dict[str, Any]]:
    """
    Reduce diagnósticos en cascada: un error principal y pocas advertencias.
    """
    errores = _uno_por_linea([d for d in diagnosticos if d.get("nivel") == "error"])
    advertencias = _uno_por_linea(
        [d for d in diagnosticos if d.get("nivel") == "warning"]
    )

    errores.sort(key=lambda d: int(d.get("linea", 0)))
    advertencias.sort(key=lambda d: int(d.get("linea", 0)))

    errores = errores[:max_errores]
    advertencias = advertencias[:max_advertencias]

    return sorted(
        errores + advertencias,
        key=lambda d: (int(d.get("linea", 0)), d.get("nivel") != "error"),
    )
