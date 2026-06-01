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
        "    int edad",
        "    init(int edad):",
        "        self.edad = edad",
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
        "list<int> nums = [1, 2, 3]",
        "int primero = nums[0]",
        "print(primero)",
        "try:",
        '    throw "test"',
        "catch (string e):",
        "    print(e)",
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
        "while (i < 5):",
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
        "    // sin statements",
        "catch (string e):",
        "    print(e)",
    ])
    resultado = lint(code)
    warnings = [d for d in resultado["diagnosticos"] if d["nivel"] == "warning"]
    assert any("vacío" in d["mensaje"].lower() for d in warnings)


def test_linter_catch_variable_accessible_in_catch_block():
    # throw fuera de try es sintácticamente válido en Woven
    # produce un error de ejecución que termina el programa
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


def test_linter_break_inside_for_valid():
    code = "\n".join([
        "for (int i = 0; i < 5; i = i + 1):",
        "    if i == 3:",
        "        break",
    ])
    resultado = lint(code)
    errores = [d for d in resultado["diagnosticos"] if d["nivel"] == "error"]
    assert not any("break" in d["mensaje"].lower() for d in errores)


def test_linter_variable_no_usada_en_metodo():
    code = "\n".join([
        "class Caja:",
        "    int valor",
        "    init(int v):",
        "        self.valor = v",
        "    function void procesar():",
        "        int temp = 5",
    ])
    resultado = lint(code)
    warnings = [d for d in resultado["diagnosticos"] if d["nivel"] == "warning"]
    assert any("temp" in d["mensaje"] for d in warnings)


def test_linter_clase_con_herencia_sin_errores():
    code = "\n".join([
        "class Animal:",
        "    string nombre",
        "    init(string nombre):",
        "        self.nombre = nombre",
        "    virtual function string hablar():",
        '        return "..."',
        "class Perro extends Animal:",
        "    init(string nombre):",
        "        super(nombre)",
        "    function string hablar():",
        '        return "Guau"',
        'Perro p = new Perro("Rex")',
        "print(p.hablar())",
    ])
    resultado = lint(code)
    errores = [d for d in resultado["diagnosticos"] if d["nivel"] == "error"]
    assert len(errores) == 0


def test_linter_virtual_method_and_override_valid():
    code = "\n".join([
        "class A:",
        "    virtual function int valor():",
        "        return 1",
        "class B extends A:",
        "    function int valor():",
        "        return 2",
    ])
    resultado = lint(code)
    errores = [d for d in resultado["diagnosticos"] if d["nivel"] == "error"]
    assert len(errores) == 0


def test_linter_super_call_in_child_constructor_valid():
    code = "\n".join([
        "class A:",
        "    int x",
        "    init(int v):",
        "        self.x = v",
        "class B extends A:",
        "    init(int v):",
        "        super(v)",
    ])
    resultado = lint(code)
    errores = [d for d in resultado["diagnosticos"] if d["nivel"] == "error"]
    assert len(errores) == 0


def test_linter_list_remove_length_and_index_read_valid():
    code = "\n".join([
        "list<int> nums = [1, 2, 3]",
        "int primero = nums[0]",
        "int quitado = nums.remove(1)",
        "print(nums.length)",
        "print(primero)",
        "print(quitado)",
    ])
    resultado = lint(code)
    errores = [d for d in resultado["diagnosticos"] if d["nivel"] == "error"]
    assert len(errores) == 0


def test_linter_logical_and_or_not_valid():
    code = "\n".join([
        "bool a = true",
        "bool b = false",
        "if !a or (a and !b):",
        "    print(a)",
        "else:",
        "    print(b)",
    ])
    resultado = lint(code)
    errores = [d for d in resultado["diagnosticos"] if d["nivel"] == "error"]
    assert len(errores) == 0


def test_linter_mod_operator_valid():
    code = "\n".join([
        "int r = 7 % 4",
        "print(r)",
    ])
    resultado = lint(code)
    errores = [d for d in resultado["diagnosticos"] if d["nivel"] == "error"]
    assert len(errores) == 0


def test_linter_float_literal_and_comparison_valid():
    code = "\n".join([
        "float x = 1.5",
        "if x > 1.0:",
        "    print(x)",
        "else:",
        "    print(0)",
    ])
    resultado = lint(code)
    errores = [d for d in resultado["diagnosticos"] if d["nivel"] == "error"]
    assert len(errores) == 0


def test_linter_power_expression_valid():
    code = "\n".join([
        "int y = 15",
        "print(y**2)",
        "print(2**3**2)",
    ])
    resultado = lint(code)
    errores = [d for d in resultado["diagnosticos"] if d["nivel"] == "error"]
    assert len(errores) == 0
