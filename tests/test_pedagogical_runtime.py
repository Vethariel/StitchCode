from pathlib import Path
import sys
import json

ROOT = Path(__file__).resolve().parents[1]
sys.path.append(str(ROOT / "woven"))

from pedagogical_runtime import run_woven_pedagogico  # noqa: E402


def run(code: str):
    return json.loads(run_woven_pedagogico(code))


def test_runtime_variable_no_declarada():
    resultado = run("print(z)\n")
    assert resultado["tiene_errores"]
    diag = resultado["diagnosticos"][0]
    assert diag["linea"] == 1
    assert diag["tipo"] == "runtime"
    assert "z" in diag["mensaje"]
    assert resultado["salida"][0].startswith("Error de ejecución:")
    assert "│" in resultado["salida"][0]
    assert "^" in resultado["salida"][0]


def test_runtime_division_por_cero():
    resultado = run("print(1 / 0)\n")
    assert resultado["tiene_errores"]
    assert any("dividir" in d["mensaje"] for d in resultado["diagnosticos"])


def test_runtime_indice_fuera_de_rango():
    code = "\n".join(
        [
            "list<int> nums = [1]",
            "print(nums[3])",
        ]
    )
    resultado = run(code)
    assert resultado["tiene_errores"]
    assert resultado["diagnosticos"][0]["linea"] == 2


def test_runtime_codigo_correcto_sin_errores():
    code = "\n".join(
        [
            "int x = 5",
            "print(x)",
        ]
    )
    resultado = run(code)
    assert not resultado["tiene_errores"]
    assert resultado["diagnosticos"] == []
    assert resultado["salida"] == ["5"]


def test_runtime_sintaxis_devuelve_diagnosticos():
    resultado = run("while i < 10:\n    print(i)\n")
    assert resultado["tiene_errores"]
    assert resultado["diagnosticos"][0]["linea"] == 1
    assert resultado["salida"][0].startswith("Error de sintaxis:")
