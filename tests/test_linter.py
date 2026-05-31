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


def test_linter_primitive_without_initial_value():
    resultado = lint("int x\n")
    errores = [d for d in resultado["diagnosticos"] if d["nivel"] == "error"]
    assert any("int" in d["mensaje"] for d in errores)


def test_linter_null_comparison_on_primitive():
    resultado = lint("int x = 5\nif x == null:\n    print(x)\n")
    warnings = [d for d in resultado["diagnosticos"] if d["nivel"] == "warning"]
    assert any("null" in d["mensaje"].lower() for d in warnings)


def test_linter_nullable_types_without_value_valid():
    code = "\n".join([
        "class Animal:",
        "    string nombre",
        "    init(string nombre):",
        "        self.nombre = nombre",
        "Animal a",
        "string s",
    ])
    resultado = lint(code)
    errores = [d for d in resultado["diagnosticos"] if d["nivel"] == "error"]
    assert len(errores) == 0


def test_linter_break_outside_loop():
    resultado = lint("break\n")
    errores = [d for d in resultado["diagnosticos"] if d["nivel"] == "error"]
    assert any("break" in d["mensaje"].lower() for d in errores)


def test_linter_continue_outside_loop():
    resultado = lint("continue\n")
    errores = [d for d in resultado["diagnosticos"] if d["nivel"] == "error"]
    assert any("continue" in d["mensaje"].lower() for d in errores)


def test_linter_break_inside_loop_valid():
    code = "\n".join([
        "int i = 0",
        "while i < 5:",
        "    break",
    ])
    resultado = lint(code)
    errores = [d for d in resultado["diagnosticos"] if d["nivel"] == "error"]
    assert not any("break" in d["mensaje"].lower() for d in errores)


def test_linter_function_missing_return():
    code = "\n".join([
        "function int doble(int n):",
        "    int x = n * 2",
    ])
    resultado = lint(code)
    errores = [d for d in resultado["diagnosticos"] if d["nivel"] == "error"]
    assert any("return" in d["mensaje"].lower() for d in errores)


def test_linter_void_function_with_return_value():
    code = "\n".join([
        "function void saludar():",
        "    return 5",
    ])
    resultado = lint(code)
    warnings = [d for d in resultado["diagnosticos"] if d["nivel"] == "warning"]
    assert any("void" in d["mensaje"].lower() for d in warnings)


def test_linter_return_without_value_in_non_void():
    code = "\n".join([
        "function int doble(int n):",
        "    return",
    ])
    resultado = lint(code)
    errores = [d for d in resultado["diagnosticos"] if d["nivel"] == "error"]
    assert any("return" in d["mensaje"].lower() for d in errores)


def test_linter_correct_function_no_errors():
    code = "\n".join([
        "function int add(int a, int b):",
        "    return a + b",
    ])
    resultado = lint(code)
    errores = [d for d in resultado["diagnosticos"] if d["nivel"] == "error"]
    assert len(errores) == 0


def test_linter_void_function_no_return_valid():
    code = "\n".join([
        "function void saludar(string nombre):",
        '    print("Hola {nombre}")',
    ])
    resultado = lint(code)
    errores = [d for d in resultado["diagnosticos"] if d["nivel"] == "error"]
    assert len(errores) == 0


def test_linter_variable_used_outside_block_scope():
    code = "\n".join([
        "if true:",
        "    int x = 5",
        "print(x)",
    ])
    resultado = lint(code)
    errores = [d for d in resultado["diagnosticos"] if d["nivel"] == "error"]
    assert any("bloque" in d["mensaje"].lower() or
               "visible" in d["mensaje"].lower()
               for d in errores)


def test_linter_for_variable_outside_scope():
    code = "\n".join([
        "for (int i = 0; i < 3; i = i + 1):",
        "    print(i)",
        "print(i)",
    ])
    resultado = lint(code)
    errores = [d for d in resultado["diagnosticos"] if d["nivel"] == "error"]
    assert any("bloque" in d["mensaje"].lower() or
               "visible" in d["mensaje"].lower()
               for d in errores)


def test_linter_outer_variable_accessible_in_block():
    code = "\n".join([
        "int total = 0",
        "for (int i = 0; i < 3; i = i + 1):",
        "    total = total + i",
        "print(total)",
    ])
    resultado = lint(code)
    errores = [d for d in resultado["diagnosticos"] if d["nivel"] == "error"]
    assert len(errores) == 0


def test_linter_nested_block_scope():
    code = "\n".join([
        "if true:",
        "    int x = 5",
        "    if true:",
        "        print(x)",
    ])
    resultado = lint(code)
    errores = [d for d in resultado["diagnosticos"] if d["nivel"] == "error"]
    assert len(errores) == 0


def test_linter_empty_try_block_warning():
    code = "\n".join([
        "try:",
        "    ",
        "catch (string e):",
        "    print(e)",
    ])
    resultado = lint(code)
    warnings = [d for d in resultado["diagnosticos"] if d["nivel"] == "warning"]
    assert any("vacío" in d["mensaje"].lower() for d in warnings)


def test_linter_catch_variable_accessible_in_catch_block():
    code = "\n".join([
        "try:",
        '    throw "error"',
        "catch (string e):",
        "    print(e)",
    ])
    resultado = lint(code)
    errores = [d for d in resultado["diagnosticos"] if d["nivel"] == "error"]
    assert len(errores) == 0


def test_linter_catch_variable_not_accessible_outside():
    code = "\n".join([
        "try:",
        '    throw "error"',
        "catch (string e):",
        "    print(e)",
        "print(e)",
    ])
    resultado = lint(code)
    errores = [d for d in resultado["diagnosticos"] if d["nivel"] == "error"]
    assert any("e" in d["mensaje"] for d in errores)
