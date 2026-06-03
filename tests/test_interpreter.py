from pathlib import Path
import sys

from antlr4 import CommonTokenStream, InputStream
from antlr4.error.ErrorListener import ErrorListener


ROOT = Path(__file__).resolve().parents[1]
sys.path.append(str(ROOT / "woven"))

from WovenLexer import WovenLexer  # noqa: E402
from WovenParser import WovenParser  # noqa: E402
from interpreter_visitor import InterpreterVisitor  # noqa: E402


class CollectErrors(ErrorListener):
    def __init__(self):
        super().__init__()
        self.errors = []

    def syntaxError(self, recognizer, offendingSymbol, line, column, msg, e):
        self.errors.append(f"{line}:{column} {msg}")


def run(code: str):
    lexer = WovenLexer(InputStream(code))
    parser = WovenParser(CommonTokenStream(lexer))

    lexer_errors = CollectErrors()
    parser_errors = CollectErrors()
    lexer.removeErrorListeners()
    parser.removeErrorListeners()
    lexer.addErrorListener(lexer_errors)
    parser.addErrorListener(parser_errors)

    tree = parser.program()
    visitor = InterpreterVisitor()
    output = visitor.visit(tree)
    return output, lexer_errors.errors, parser_errors.errors


def test_interpreter_variable_declaration_and_use():
    code = "int x = 5\nprint(x)\n"
    output, lexer_errors, parser_errors = run(code)
    assert not lexer_errors
    assert not parser_errors
    assert output == ["5"]


def test_interpreter_basic_arithmetic_operations():
    code = "\n".join(
        [
            "int a = 2",
            "int b = 3",
            "print(a + b)",
            "print(a * b)",
            "print(b - a)",
        ]
    )
    output, lexer_errors, parser_errors = run(code)
    assert not lexer_errors
    assert not parser_errors
    assert output == ["5", "6", "1"]


def test_interpreter_power_operator():
    code = "\n".join(
        [
            "int x = 5",
            "print(x)",
            "int y = x + 10",
            "print(y)",
            "print(y**2)",
        ]
    )
    output, lexer_errors, parser_errors = run(code)
    assert not lexer_errors
    assert not parser_errors
    assert output == ["5", "15", "225"]


def test_interpreter_power_precedence():
    code = "\n".join(
        [
            "print(2*3**2)",
            "print(2**3**2)",
        ]
    )
    output, lexer_errors, parser_errors = run(code)
    assert not lexer_errors
    assert not parser_errors
    assert output == ["18", "512"]


def test_interpreter_if_executes_correct_branch():
    code = "\n".join(
        [
            "int x = 2",
            "if x > 1:",
            "    print(\"yes\")",
            "else:",
            "    print(\"no\")",
        ]
    )
    output, lexer_errors, parser_errors = run(code)
    assert not lexer_errors
    assert not parser_errors
    assert output == ["yes"]


def test_interpreter_for_iterates_expected_times():
    code = "\n".join(
        [
            "int c = 0",
            "for (int i = 0; i < 3; i = i + 1):",
            "    c = c + 1",
            "print(c)",
        ]
    )
    output, lexer_errors, parser_errors = run(code)
    assert not lexer_errors
    assert not parser_errors
    assert output == ["3"]


def test_interpreter_while_loop():
    code = "\n".join(
        [
            "int i = 0",
            "while (i < 3):",
            "    i = i + 1",
            "print(i)",
        ]
    )
    output, lexer_errors, parser_errors = run(code)
    assert not lexer_errors
    assert not parser_errors
    assert output == ["3"]


def test_interpreter_function_returns_value():
    code = "\n".join(
        [
            "function int add(int a, int b):",
            "    return a + b",
            "print(add(2, 3))",
        ]
    )
    output, lexer_errors, parser_errors = run(code)
    assert not lexer_errors
    assert not parser_errors
    assert output == ["5"]


def test_interpreter_recursive_factorial():
    code = "\n".join(
        [
            "function int fact(int n):",
            "    if n <= 1:",
            "        return 1",
            "    else:",
            "        return n * fact(n - 1)",
            "print(fact(5))",
        ]
    )
    output, lexer_errors, parser_errors = run(code)
    assert not lexer_errors
    assert not parser_errors
    assert output == ["120"]


def test_interpreter_print_with_string_interpolation():
    code = "\n".join(
        [
            "int x = 7",
            "print(\"hola {x}\")",
        ]
    )
    output, lexer_errors, parser_errors = run(code)
    assert not lexer_errors
    assert not parser_errors
    assert output == ["hola 7"]


def test_interpreter_error_variable_not_declared():
    output, _, _ = run("print(y)\n")
    assert any("Variable usada sin declarar" in line for line in output)


def test_interpreter_error_incompatible_assignment_type():
    code = "\n".join(
        [
            "int x = 1",
            "x = \"a\"",
        ]
    )
    output, _, _ = run(code)
    assert any("Tipo incompatible en asignacion" in line for line in output)


def test_interpreter_error_division_by_zero():
    output, _, _ = run("print(1 / 0)\n")
    assert any("Division por cero" in line for line in output)


def test_interpreter_error_function_wrong_arity():
    code = "\n".join(
        [
            "function int add(int a, int b):",
            "    return a + b",
            "print(add(1))",
        ]
    )
    output, _, _ = run(code)
    assert any("numero incorrecto de argumentos" in line for line in output)


def test_interpreter_int_division_behavior():
    output, _, _ = run("print(1 / 2)\n")
    assert output == ["0"]  # division entera entre int produce int


def test_interpreter_object_field_access_via_method():
    code = "\n".join(
        [
            "class Counter:",
            "    int value",
            "    init(int v):",
            "        self.value = v",
            "    function int get():",
            "        return self.value",
            "Counter c = new Counter(7)",
            "print(c.get())",
        ]
    )
    output, lexer_errors, parser_errors = run(code)
    assert not lexer_errors
    assert not parser_errors
    assert output == ["7"]


def test_interpreter_method_using_self():
    code = "\n".join(
        [
            "class Box:",
            "    int n",
            "    init(int x):",
            "        self.n = x",
            "    function int inc(int d):",
            "        self.n = self.n + d",
            "        return self.n",
            "Box b = new Box(1)",
            "print(b.inc(4))",
        ]
    )
    output, _, _ = run(code)
    assert output == ["5"]


def test_interpreter_list_primitives_append_access_modify_length():
    code = "\n".join(
        [
            "list<int> nums = [1, 2]",
            "nums.append(3)",
            "nums[0] = 10",
            "print(nums.length)",
            "print(nums[0])",
        ]
    )
    output, _, _ = run(code)
    assert output == ["3", "10"]


def test_interpreter_list_objects_and_method_on_element():
    code = "\n".join(
        [
            "class Item:",
            "    int v",
            "    init(int x):",
            "        self.v = x",
            "    function int get():",
            "        return self.v",
            "list<Item> items = []",
            "items.append(new Item(9))",
            "print(items[0].get())",
        ]
    )
    output, _, _ = run(code)
    assert output == ["9"]


def test_interpreter_inheritance_child_calls_parent_method():
    code = "\n".join(
        [
            "class A:",
            "    function int value():",
            "        return 3",
            "class B extends A:",
            "    init():",
            "        return",
            "B b = new B()",
            "print(b.value())",
        ]
    )
    output, _, _ = run(code)
    assert output == ["3"]


def test_interpreter_override_child_virtual_method():
    code = "\n".join(
        [
            "class A:",
            "    virtual function int value():",
            "        return 3",
            "class B extends A:",
            "    function int value():",
            "        return 8",
            "B b = new B()",
            "print(b.value())",
        ]
    )
    output, _, _ = run(code)
    assert output == ["8"]


def test_interpreter_super_in_child_constructor():
    code = "\n".join(
        [
            "class A:",
            "    int x",
            "    init(int v):",
            "        self.x = v",
            "class B extends A:",
            "    init(int v):",
            "        super(v)",
            "B b = new B(11)",
            "print(b.x)",
        ]
    )
    output, _, _ = run(code)
    assert output == ["11"]


def test_interpreter_new_creates_object():
    code = "\n".join(
        [
            "class Punto:",
            "    int x",
            "    int y",
            "    init(int x, int y):",
            "        self.x = x",
            "        self.y = y",
            "Punto p = new Punto(3, 4)",
            "print(p.x)",
        ]
    )
    output, lexer_errors, parser_errors = run(code)
    assert not lexer_errors
    assert not parser_errors
    assert output == ["3"]


def test_interpreter_error_object_creation_without_new():
    code = "\n".join(
        [
            "class Punto:",
            "    int x",
            "    init(int x):",
            "        self.x = x",
            "Punto p = Punto(3)",
        ]
    )
    output, _, _ = run(code)
    assert any("usa new" in line for line in output)


def test_interpreter_append_rejects_incompatible_type():
    code = "\n".join(
        [
            "class Animal:",
            "    init():",
            "        return",
            "class Vehiculo:",
            "    init():",
            "        return",
            "list<Animal> animales = []",
            "animales.append(new Vehiculo())",
        ]
    )
    output, _, _ = run(code)
    assert any("no se puede agregar" in line for line in output)


def test_interpreter_append_accepts_subtype():
    code = "\n".join(
        [
            "class Animal:",
            "    int edad",
            "    init(int edad):",
            "        self.edad = edad",
            "class Perro extends Animal:",
            "    init(int edad):",
            "        super(edad)",
            "list<Animal> animales = []",
            "animales.append(new Perro(3))",
            "print(animales.length)",
        ]
    )
    output, _, _ = run(code)
    assert not any("Error" in line for line in output)
    assert output[-1] == "1"


def test_interpreter_null_literal():
    code = "\n".join([
        "class Animal:",
        "    string nombre",
        "    init(string nombre):",
        "        self.nombre = nombre",
        "Animal a = null",
        "print(a)",
    ])
    output, lexer_errors, parser_errors = run(code)
    assert not lexer_errors
    assert not parser_errors
    assert output == ["null"]


def test_interpreter_null_check():
    code = "\n".join([
        "class Animal:",
        "    string nombre",
        "    init(string nombre):",
        "        self.nombre = nombre",
        "Animal a = null",
        "if a == null:",
        '    print("es null")',
        "else:",
        '    print("no es null")',
    ])
    output, _, _ = run(code)
    assert output == ["es null"]


def test_interpreter_null_access_error():
    code = "\n".join([
        "class Animal:",
        "    string nombre",
        "    init(string nombre):",
        "        self.nombre = nombre",
        "Animal a = null",
        "print(a.nombre)",
    ])
    output, _, _ = run(code)
    assert any("null" in line.lower() for line in output)


def test_interpreter_null_reassign():
    code = "\n".join([
        "class Animal:",
        "    string nombre",
        "    init(string nombre):",
        "        self.nombre = nombre",
        'Animal a = new Animal("Rex")',
        "a = null",
        "print(a)",
    ])
    output, _, _ = run(code)
    assert output == ["null"]


def test_interpreter_primitive_cannot_be_null():
    output, _, _ = run("int x\n")
    assert any("null" in line.lower() or "valor inicial" in line.lower()
               for line in output)


def test_interpreter_string_can_be_null():
    code = "string s\nprint(s)\n"
    output, lexer_errors, parser_errors = run(code)
    assert not lexer_errors
    assert not parser_errors
    assert output == ["null"]


def test_interpreter_list_can_be_null():
    code = "\n".join([
        "list<int> nums",
        "print(nums)",
    ])
    output, lexer_errors, parser_errors = run(code)
    assert not lexer_errors
    assert not parser_errors
    assert output == ["null"]


def test_interpreter_break_exits_while():
    code = "\n".join([
        "int i = 0",
        "while (i < 10):",
        "    if i == 3:",
        "        break",
        "    i = i + 1",
        "print(i)",
    ])
    output, lexer_errors, parser_errors = run(code)
    assert not lexer_errors
    assert not parser_errors
    assert output == ["3"]


def test_interpreter_continue_skips_iteration():
    code = "\n".join([
        "int total = 0",
        "int i = 0",
        "while (i < 5):",
        "    i = i + 1",
        "    if i == 3:",
        "        continue",
        "    total = total + i",
        "print(total)",
    ])
    output, lexer_errors, parser_errors = run(code)
    assert not lexer_errors
    assert not parser_errors
    assert output == ["12"]


def test_interpreter_break_in_for():
    code = "\n".join([
        "int resultado = 0",
        "for (int i = 0; i < 10; i = i + 1):",
        "    if i == 5:",
        "        break",
        "    resultado = resultado + i",
        "print(resultado)",
    ])
    output, lexer_errors, parser_errors = run(code)
    assert not lexer_errors
    assert not parser_errors
    assert output == ["10"]


def test_interpreter_continue_in_for():
    code = "\n".join([
        "int total = 0",
        "for (int i = 0; i < 5; i = i + 1):",
        "    if i == 2:",
        "        continue",
        "    total = total + i",
        "print(total)",
    ])
    output, lexer_errors, parser_errors = run(code)
    assert not lexer_errors
    assert not parser_errors
    assert output == ["8"]


def test_interpreter_nested_break():
    code = "\n".join([
        "int cuenta = 0",
        "int i = 0",
        "while (i < 3):",
        "    int j = 0",
        "    while (j < 3):",
        "        if j == 1:",
        "            break",
        "        cuenta = cuenta + 1",
        "        j = j + 1",
        "    i = i + 1",
        "print(cuenta)",
    ])
    output, _, _ = run(code)
    assert output == ["3"]


def test_interpreter_return_type_correct():
    code = "\n".join([
        "function int doble(int n):",
        "    return n * 2",
        "print(doble(5))",
    ])
    output, lexer_errors, parser_errors = run(code)
    assert not lexer_errors
    assert not parser_errors
    assert output == ["10"]


def test_interpreter_return_type_incompatible():
    code = "\n".join([
        "function int doble(int n):",
        '    return "hola"',
        "print(doble(5))",
    ])
    output, _, _ = run(code)
    assert any("int" in line.lower() or "tipo" in line.lower()
               for line in output)


def test_interpreter_void_with_return_value():
    code = "\n".join([
        "function void saludar():",
        "    return 5",
        "saludar()",
    ])
    output, _, _ = run(code)
    assert any("void" in line.lower() for line in output)


def test_interpreter_non_void_without_return():
    code = "\n".join([
        "function int doble(int n):",
        "    int x = n * 2",
        "print(doble(5))",
    ])
    output, _, _ = run(code)
    assert any("return" in line.lower() for line in output)


def test_interpreter_return_in_conditional_branch():
    code = "\n".join([
        "function int absoluto(int n):",
        "    if n >= 0:",
        "        return n",
        "    else:",
        "        return n * -1",
        "print(absoluto(-3))",
    ])
    output, lexer_errors, parser_errors = run(code)
    assert not lexer_errors
    assert not parser_errors
    assert output == ["3"]


def test_interpreter_block_scope_variable_not_visible_outside_if():
    code = "\n".join([
        "if true:",
        "    int x = 5",
        "print(x)",
    ])
    output, _, _ = run(code)
    assert any("declarada" in line.lower() or
               "no está definido" in line.lower() or
               "visible" in line.lower()
               for line in output)


def test_interpreter_block_scope_variable_visible_inside_if():
    code = "\n".join([
        "if true:",
        "    int x = 5",
        "    print(x)",
    ])
    output, lexer_errors, parser_errors = run(code)
    assert not lexer_errors
    assert not parser_errors
    assert output == ["5"]


def test_interpreter_block_scope_for_variable_not_visible_outside():
    code = "\n".join([
        "for (int i = 0; i < 3; i = i + 1):",
        "    print(i)",
        "print(i)",
    ])
    output, _, _ = run(code)
    assert any("definido" in line.lower() or
               "visible" in line.lower()
               for line in output)


def test_interpreter_block_scope_while_variable_not_visible_outside():
    code = "\n".join([
        "int contador = 0",
        "while (contador < 3):",
        "    int temp = contador * 2",
        "    contador = contador + 1",
        "print(temp)",
    ])
    output, _, _ = run(code)
    assert any("definido" in line.lower() or
               "visible" in line.lower()
               for line in output)


def test_interpreter_outer_variable_visible_inside_block():
    code = "\n".join([
        "int total = 0",
        "for (int i = 0; i < 3; i = i + 1):",
        "    total = total + i",
        "print(total)",
    ])
    output, lexer_errors, parser_errors = run(code)
    assert not lexer_errors
    assert not parser_errors
    assert output == ["3"]


def test_interpreter_nested_blocks_scope():
    code = "\n".join([
        "int resultado = 0",
        "if true:",
        "    int x = 10",
        "    if true:",
        "        int y = 5",
        "        resultado = x + y",
        "print(resultado)",
    ])
    output, lexer_errors, parser_errors = run(code)
    assert not lexer_errors
    assert not parser_errors
    assert output == ["15"]


def test_interpreter_try_catch_division_by_zero():
    code = "\n".join([
        "try:",
        "    print(1 / 0)",
        "catch (string e):",
        '    print("Error capturado: {e}")',
    ])
    output, lexer_errors, parser_errors = run(code)
    assert not lexer_errors
    assert not parser_errors
    assert any("capturado" in line.lower() for line in output)


def test_interpreter_try_catch_null_access():
    code = "\n".join([
        "class Animal:",
        "    string nombre",
        "    init(string nombre):",
        "        self.nombre = nombre",
        "Animal a = null",
        "try:",
        "    print(a.nombre)",
        "catch (string e):",
        '    print("Error: {e}")',
    ])
    output, lexer_errors, parser_errors = run(code)
    assert not lexer_errors
    assert not parser_errors
    assert any("error" in line.lower() for line in output)


def test_interpreter_try_no_error_executes_normally():
    code = "\n".join([
        "try:",
        "    int x = 10",
        "    print(x)",
        "catch (string e):",
        '    print("Error: {e}")',
    ])
    output, lexer_errors, parser_errors = run(code)
    assert not lexer_errors
    assert not parser_errors
    assert output == ["10"]


def test_interpreter_throw_caught_by_catch():
    code = "\n".join([
        "try:",
        '    throw "algo salio mal"',
        "catch (string e):",
        "    print(e)",
    ])
    output, lexer_errors, parser_errors = run(code)
    assert not lexer_errors
    assert not parser_errors
    assert output == ["algo salio mal"]


def test_interpreter_throw_with_expression():
    code = "\n".join([
        "int x = 5",
        "try:",
        '    throw "valor invalido: {x}"',
        "catch (string e):",
        "    print(e)",
    ])
    output, lexer_errors, parser_errors = run(code)
    assert not lexer_errors
    assert not parser_errors
    assert output == ["valor invalido: 5"]


def test_interpreter_nested_try_catch():
    code = "\n".join([
        "try:",
        "    try:",
        '        throw "error interno"',
        "    catch (string e1):",
        '        print("interno: {e1}")',
        '        throw "error externo"',
        "catch (string e2):",
        '    print("externo: {e2}")',
    ])
    output, lexer_errors, parser_errors = run(code)
    assert not lexer_errors
    assert not parser_errors
    assert output == ["interno: error interno", "externo: error externo"]


def test_interpreter_logical_and_not():
    code = "\n".join([
        "bool a = true",
        "bool b = false",
        "if !b and a:",
        '    print("ok")',
        "else:",
        '    print("no")',
    ])
    output, lexer_errors, parser_errors = run(code)
    assert not lexer_errors
    assert not parser_errors
    assert output == ["ok"]


def test_interpreter_mod_operator():
    output, lexer_errors, parser_errors = run("print(7 % 4)\n")
    assert not lexer_errors
    assert not parser_errors
    assert output == ["3"]


def test_interpreter_float_literal_and_operations():
    code = "\n".join([
        "float x = 1.5",
        "print(x + 0.5)",
    ])
    output, lexer_errors, parser_errors = run(code)
    assert not lexer_errors
    assert not parser_errors
    assert output == ["2.0"]


def test_interpreter_list_remove():
    code = "\n".join([
        "list<int> nums = [10, 20, 30]",
        "print(nums.remove(1))",
        "print(nums.length)",
    ])
    output, lexer_errors, parser_errors = run(code)
    assert not lexer_errors
    assert not parser_errors
    # remove(i) elimina y retorna el elemento en el índice i
    assert output == ["20", "2"]  # remove retorna el elemento, length disminuye


def test_interpreter_self_index_assignment():
    code = "\n".join([
        "class Caja:",
        "    list<int> nums",
        "    init():",
        "        self.nums = [1, 2]",
        "        self.nums[1] = 7",
        "    function int segundo():",
        "        return self.nums[1]",
        "Caja c = new Caja()",
        "print(c.segundo())",
    ])
    output, lexer_errors, parser_errors = run(code)
    assert not lexer_errors
    assert not parser_errors
    assert output == ["7"]


def test_interpreter_member_assignment():
    code = "\n".join([
        "class Nodo:",
        "    int valor",
        "    Nodo siguiente",
        "    init(int valor):",
        "        self.valor = valor",
        "        self.siguiente = null",
        "Nodo a = new Nodo(1)",
        "Nodo b = new Nodo(2)",
        "a.siguiente = b",
        "print(a.siguiente.valor)",
    ])
    output, lexer_errors, parser_errors = run(code)
    assert not lexer_errors
    assert not parser_errors
    assert output == ["2"]


def test_interpreter_for_with_assignment_init():
    code = "\n".join([
        "int i = 0",
        "for (i = 0; i < 3; i = i + 1):",
        "    print(i)",
    ])
    output, lexer_errors, parser_errors = run(code)
    assert not lexer_errors
    assert not parser_errors
    assert output == ["0", "1", "2"]


def test_interpreter_for_with_expr_update():
    code = "\n".join([
        "int i = 0",
        "function void bump():",
        "    i = i + 1",
        "for (; i < 3; bump()):",
        "    print(i)",
    ])
    # bump() accede y modifica 'i' del scope externo
    # verifica que funciones pueden leer y escribir variables del scope que las llama
    output, lexer_errors, parser_errors = run(code)
    assert not lexer_errors
    assert not parser_errors
    assert output == ["0", "1", "2"]


def test_interpreter_for_with_all_optional_parts():
    code = "\n".join([
        "for (;;):",
        '    print("once")',
        "    break",
    ])
    output, lexer_errors, parser_errors = run(code)
    assert not lexer_errors
    assert not parser_errors
    assert output == ["once"]


def test_interpreter_throw_outside_try_produces_error():
    output, lexer_errors, parser_errors = run('throw "fatal"\n')
    assert not lexer_errors
    assert not parser_errors
    assert any("fatal" in line.lower() for line in output)


def test_interpreter_try_does_not_catch_undeclared_variable_error():
    code = "\n".join([
        "try:",
        "    print(y)",
        "catch (string e):",
        '    print("capturado: {e}")',
    ])
    # Decisión de diseño: errores de compilación/análisis estático como
    # "variable no declarada" no son capturables por try/catch.
    # Solo errores de ejecución (división por cero, null access, throw) son capturables.
    output, lexer_errors, parser_errors = run(code)
    assert not lexer_errors
    assert not parser_errors
    assert any("variable usada sin declarar" in line.lower() for line in output)
    assert not any("capturado" in line.lower() for line in output)


def test_interpreter_self_method_call_in_return():
    code = "\n".join([
        "class Calc:",
        "    int valor",
        "    init(int valor):",
        "        self.valor = valor",
        "    function int doble():",
        "        return self.valor * 2",
        "    function int resultado():",
        "        return self.doble()",
        "Calc c = new Calc(5)",
        "print(c.resultado())",
    ])
    output, lexer_errors, parser_errors = run(code)
    assert not lexer_errors
    assert not parser_errors
    assert output == ["10"]


def test_interpreter_self_method_call_with_args():
    code = "\n".join([
        "class Calc:",
        "    int base",
        "    init(int base):",
        "        self.base = base",
        "    function int multiplicar(int n):",
        "        return self.base * n",
        "    function int triple():",
        "        return self.multiplicar(3)",
        "Calc c = new Calc(4)",
        "print(c.triple())",
    ])
    output, lexer_errors, parser_errors = run(code)
    assert not lexer_errors
    assert not parser_errors
    assert output == ["12"]


def test_interpreter_try_catch_index_out_of_range():
    code = "\n".join([
        "list<int> nums = [1, 2, 3]",
        "try:",
        "    print(nums[10])",
        "catch (string e):",
        '    print("Error capturado")',
    ])
    output, lexer_errors, parser_errors = run(code)
    assert not lexer_errors
    assert not parser_errors
    assert any("capturado" in line.lower() for line in output)


def test_interpreter_method_return_type_mismatch():
    code = "\n".join([
        "class Calc:",
        "    function int valor():",
        '        return "no soy un int"',
        "Calc c = new Calc()",
        "print(c.valor())",
    ])
    output, _, _ = run(code)
    assert any("int" in line.lower() or "tipo" in line.lower()
               for line in output)
