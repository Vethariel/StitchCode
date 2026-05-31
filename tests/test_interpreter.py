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
