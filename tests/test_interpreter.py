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
            "while i < 3:",
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
