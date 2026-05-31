from pathlib import Path
import sys

from antlr4 import CommonTokenStream, InputStream
from antlr4.error.ErrorListener import ErrorListener


ROOT = Path(__file__).resolve().parents[1]
sys.path.append(str(ROOT / "woven"))

from WovenLexer import WovenLexer  # noqa: E402
from WovenParser import WovenParser  # noqa: E402


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
    return tree, parser, lexer_errors.errors, parser_errors.errors


def test_parser_variable_declaration_and_assignment_tree():
    code = "int x = 5\nx = x + 1\n"
    tree, parser, lexer_errors, parser_errors = run(code)
    assert not lexer_errors
    assert not parser_errors
    text = tree.toStringTree(recog=parser)
    assert "(varDecl" in text
    assert "(assignment" in text


def test_parser_function_with_parameters_and_return_tree():
    code = "\n".join(
        [
            "function int add(int a, int b):",
            "    return a + b",
        ]
    )
    tree, parser, lexer_errors, parser_errors = run(code)
    assert not lexer_errors
    assert not parser_errors
    text = tree.toStringTree(recog=parser)
    assert "(functionDecl" in text
    assert "(paramList" in text
    assert "(returnStmt" in text


def test_parser_if_with_else_tree():
    code = "\n".join(
        [
            "if true:",
            "    print(\"a\")",
            "else:",
            "    print(\"b\")",
        ]
    )
    tree, parser, lexer_errors, parser_errors = run(code)
    assert not lexer_errors
    assert not parser_errors
    assert "(ifStmt" in tree.toStringTree(recog=parser)


def test_parser_if_without_else_tree():
    code = "\n".join(
        [
            "if true:",
            "    print(\"a\")",
        ]
    )
    tree, parser, lexer_errors, parser_errors = run(code)
    assert not lexer_errors
    assert not parser_errors
    assert "(ifStmt" in tree.toStringTree(recog=parser)


def test_parser_for_c_style_tree():
    code = "\n".join(
        [
            "for (int i = 0; i < 3; i = i + 1):",
            "    print(i)",
        ]
    )
    tree, parser, lexer_errors, parser_errors = run(code)
    assert not lexer_errors
    assert not parser_errors
    assert "(forStmt" in tree.toStringTree(recog=parser)


def test_parser_while_tree():
    code = "\n".join(
        [
            "while true:",
            "    print(\"x\")",
        ]
    )
    tree, parser, lexer_errors, parser_errors = run(code)
    assert not lexer_errors
    assert not parser_errors
    assert "(whileStmt" in tree.toStringTree(recog=parser)


def test_parser_print_with_literal_and_expression_tree():
    code = "print(\"hola\")\nprint(2 + 3)\n"
    tree, parser, lexer_errors, parser_errors = run(code)
    assert not lexer_errors
    assert not parser_errors
    text = tree.toStringTree(recog=parser)
    assert text.count("(printStmt") == 2


def test_parser_print_with_interpolated_string_tree():
    code = "print(\"hola {x}\")\n"
    lexer = WovenLexer(InputStream(code))
    stream = CommonTokenStream(lexer)
    stream.fill()

    token_types = [t.type for t in stream.tokens]
    assert WovenParser.STRING_INTERP in token_types

    tree, parser, lexer_errors, parser_errors = run(code)
    assert not lexer_errors
    assert not parser_errors
    assert "(printStmt" in tree.toStringTree(recog=parser)


def test_parser_expression_precedence_tree():
    tree, parser, lexer_errors, parser_errors = run("print(2 + 3 * 4)\n")
    assert not lexer_errors
    assert not parser_errors
    text = tree.toStringTree(recog=parser)
    assert "(compExpr (compExpr (atom (literal 2))) + (compExpr (compExpr (atom (literal 3))) * (compExpr (atom (literal 4))))" in text
    assert "*" in text
    assert "+" in text


def test_parser_function_call_with_arguments_tree():
    code = "\n".join(
        [
            "function int add(int a, int b):",
            "    return a + b",
            "print(add(1, 2))",
        ]
    )
    tree, parser, lexer_errors, parser_errors = run(code)
    assert not lexer_errors
    assert not parser_errors
    assert "(atom (atom add) (" in tree.toStringTree(recog=parser)
