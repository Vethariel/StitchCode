from pathlib import Path
import sys
import json

ROOT = Path(__file__).resolve().parents[1]
sys.path.append(str(ROOT / "woven"))

from pedagogical_lint import lint_woven_pedagogico  # noqa: E402


def lint(code: str):
    return json.loads(lint_woven_pedagogico(code))


def test_lint_variable_no_declarada_formato_pedagogico():
    resultado = lint("print(x)\n")
    assert resultado["parse_ok"]
    assert resultado["tiene_errores"]
    err = next(d for d in resultado["diagnosticos"] if d["nivel"] == "error")
    assert err["texto"].startswith("Error semántico:")
    assert "│" in err["texto"]
    assert "x" in err["mensaje"]


def test_lint_no_corre_con_sintaxis_invalida():
    resultado = lint("while i < 10:\n    print(i)\n")
    assert not resultado["parse_ok"]
    assert resultado["tiene_errores"]
    assert len(resultado["diagnosticos"]) >= 1
    assert resultado["diagnosticos"][0]["linea"] == 1


def test_lint_advertencia_formato():
    resultado = lint("int x = 5\n")
    assert resultado["parse_ok"]
    assert resultado["tiene_advertencias"]
    warn = next(d for d in resultado["diagnosticos"] if d["nivel"] == "warning")
    assert warn["texto"].startswith("Advertencia semántica:")


def test_lint_codigo_correcto_sin_problemas():
    code = "\n".join(
        [
            "function int add(int a, int b):",
            "    return a + b",
            "int r = add(3, 4)",
            "print(r)",
        ]
    )
    resultado = lint(code)
    assert resultado["parse_ok"]
    assert not resultado["tiene_errores"]
