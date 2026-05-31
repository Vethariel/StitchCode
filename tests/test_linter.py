from pathlib import Path
import sys
import json

ROOT = Path(__file__).resolve().parents[1]
sys.path.append(str(ROOT / "woven"))

from linter_visitor import lint_woven


def lint(code: str):
    return json.loads(lint_woven(code))


def test_linter_variable_no_declarada():
    resultado = lint("print(x)\n")
    errores = [d for d in resultado["diagnosticos"] if d["nivel"] == "error"]
    assert any("x" in d["mensaje"] for d in errores)


def test_linter_variable_no_usada():
    resultado = lint("int x = 5\n")
    warnings = [d for d in resultado["diagnosticos"] if d["nivel"] == "warning"]
    assert any("x" in d["mensaje"] for d in warnings)


def test_linter_funcion_argumentos_incorrectos():
    code = "\n".join([
        "function int add(int a, int b):",
        "    return a + b",
        "print(add(1))",
    ])
    resultado = lint(code)
    errores = [d for d in resultado["diagnosticos"] if d["nivel"] == "error"]
    assert any("add" in d["mensaje"] for d in errores)


def test_linter_clase_no_definida_en_new():
    resultado = lint("Animal a = new Animal(3)\n")
    errores = [d for d in resultado["diagnosticos"] if d["nivel"] == "error"]
    assert any("Animal" in d["mensaje"] for d in errores)


def test_linter_herencia_clase_padre_no_existe():
    code = "\n".join([
        "class Perro extends Animal:",
        "    init():",
        "        pass",
    ])
    resultado = lint(code)
    errores = [d for d in resultado["diagnosticos"] if d["nivel"] == "error"]
    assert any("Animal" in d["mensaje"] for d in errores)


def test_linter_clase_sin_constructor():
    code = "\n".join([
        "class Punto:",
        "    int x",
    ])
    resultado = lint(code)
    warnings = [d for d in resultado["diagnosticos"] if d["nivel"] == "warning"]
    assert any("constructor" in d["mensaje"].lower() for d in warnings)


def test_linter_funcion_sin_return():
    code = "\n".join([
        "function int doble(int n):",
        "    int x = n * 2",
    ])
    resultado = lint(code)
    errores = [d for d in resultado["diagnosticos"] if d["nivel"] == "error"]
    assert any("return" in d["mensaje"].lower() for d in errores)


def test_linter_codigo_correcto_sin_diagnosticos():
    code = "\n".join([
        "function int add(int a, int b):",
        "    return a + b",
        "int resultado = add(3, 4)",
        "print(resultado)",
    ])
    resultado = lint(code)
    errores = [d for d in resultado["diagnosticos"] if d["nivel"] == "error"]
    assert len(errores) == 0


def test_linter_for_variable_en_scope():
    code = "\n".join([
        "for (int j = 0; j < 3; j = j + 1):",
        "    print(j)",
    ])
    resultado = lint(code)
    errores = [d for d in resultado["diagnosticos"] if d["nivel"] == "error"]
    assert len(errores) == 0
