from pathlib import Path
import sys
import json

ROOT = Path(__file__).resolve().parents[1]
sys.path.append(str(ROOT / "woven"))

from pedagogical_common import (  # noqa: E402
    EJEMPLO_ETIQUETA,
    filtrar_diagnosticos_cascada,
)
from pedagogical_error_listener import filtrar_errores_cascada  # noqa: E402
from pedagogical_lint import lint_woven_pedagogico  # noqa: E402
from pedagogical_runtime import run_woven_pedagogico  # noqa: E402
from woven_runtime import run_woven  # noqa: E402


def test_filtrar_errores_sintaxis_uno_principal():
    errores = [
        "Error de sintaxis: línea 1:1 — primero\n\n 1 │ a\n   ^",
        "Error de sintaxis: línea 2:1 — segundo\n\n 2 │ b\n   ^",
    ]
    assert len(filtrar_errores_cascada(errores)) == 1


def test_filtrar_diagnosticos_semanticos_un_error():
    diagnosticos = [
        {"nivel": "error", "linea": 1, "mensaje": "a"},
        {"nivel": "error", "linea": 3, "mensaje": "b"},
        {"nivel": "warning", "linea": 2, "mensaje": "c"},
        {"nivel": "warning", "linea": 4, "mensaje": "d"},
        {"nivel": "warning", "linea": 5, "mensaje": "e"},
    ]
    filtrados = filtrar_diagnosticos_cascada(diagnosticos)
    assert sum(1 for d in filtrados if d["nivel"] == "error") == 1
    assert sum(1 for d in filtrados if d["nivel"] == "warning") == 3
    assert filtrados[0]["linea"] == 1


def test_lint_multiples_errores_uno_principal():
    code = "\n".join(
        [
            "print(a)",
            "print(b)",
            "print(c)",
        ]
    )
    resultado = json.loads(lint_woven_pedagogico(code))
    errores = [d for d in resultado["diagnosticos"] if d["nivel"] == "error"]
    assert len(errores) == 1
    assert EJEMPLO_ETIQUETA in errores[0]["texto"]


def test_runtime_incluye_ejemplo_minimo():
    resultado = json.loads(run_woven_pedagogico("print(z)\n"))
    assert resultado["tiene_errores"]
    assert EJEMPLO_ETIQUETA in resultado["diagnosticos"][0]["texto"]


def test_sintaxis_incluye_ejemplo_minimo():
    output = run_woven("while i < 10:\n    print(i)\n")
    assert len(output) == 1
    assert EJEMPLO_ETIQUETA in output[0]
