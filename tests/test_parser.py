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
    text = tree.toStringTree(recog=parser)
    # Verificar que la llamada anidada está presente en el árbol
    assert "add" in text
    assert "literal 1" in text
    assert "literal 2" in text


def test_parser_try_catch_tree():
    code = "\n".join(
        [
            "try:",
            "    print(1)",
            "catch (string e):",
            "    print(e)",
        ]
    )
    tree, parser, lexer_errors, parser_errors = run(code)
    assert not lexer_errors
    assert not parser_errors
    text = tree.toStringTree(recog=parser)
    assert "(tryStmt" in text
    assert "catch" in text


def test_parser_throw_stmt_tree():
    code = "\n".join(
        [
            "try:",
            '    throw "boom"',
            "catch (string e):",
            "    print(e)",
        ]
    )
    tree, parser, lexer_errors, parser_errors = run(code)
    assert not lexer_errors
    assert not parser_errors
    text = tree.toStringTree(recog=parser)
    assert "(throwStmt" in text


def test_parser_break_continue_tree():
    code = "\n".join(
        [
            "int i = 0",
            "while i < 5:",
            "    i = i + 1",
            "    if i == 2:",
            "        continue",
            "    if i == 4:",
            "        break",
        ]
    )
    tree, parser, lexer_errors, parser_errors = run(code)
    assert not lexer_errors
    assert not parser_errors
    text = tree.toStringTree(recog=parser)
    assert "(continueStmt" in text
    assert "(breakStmt" in text


def test_parser_class_constructor_method_tree():
    code = "\n".join(
        [
            "class Counter:",
            "    int value",
            "    init(int v):",
            "        self.value = v",
            "    function int get():",
            "        return self.value",
        ]
    )
    tree, parser, lexer_errors, parser_errors = run(code)
    assert not lexer_errors
    assert not parser_errors
    text = tree.toStringTree(recog=parser)
    assert "(classDecl" in text
    assert "(constructorDecl" in text
    assert "(methodDecl" in text
    assert "(fieldDecl" in text


def test_parser_class_extends_and_super_call_tree():
    code = "\n".join(
        [
            "class A:",
            "    init(int v):",
            "        return",
            "class B extends A:",
            "    init(int v):",
            "        super(v)",
        ]
    )
    tree, parser, lexer_errors, parser_errors = run(code)
    assert not lexer_errors
    assert not parser_errors
    text = tree.toStringTree(recog=parser)
    assert "(classDecl class B extends A" in text or "extends A" in text
    assert "(atom super (" in text


def test_parser_self_assignment_and_index_assignment_tree():
    code = "\n".join(
        [
            "class Box:",
            "    list<int> nums",
            "    init():",
            "        self.nums = [1, 2]",
            "        self.nums[0] = 3",
            "list<int> xs = [4, 5]",
            "xs[1] = 9",
        ]
    )
    tree, parser, lexer_errors, parser_errors = run(code)
    assert not lexer_errors
    assert not parser_errors
    text = tree.toStringTree(recog=parser)
    assert "(selfAssignment" in text
    assert text.count("(indexAssignment") >= 2


def test_parser_new_and_member_call_tree():
    code = "\n".join(
        [
            "class A:",
            "    init():",
            "        return",
            "A a = new A()",
            "print(a.toString())",
        ]
    )
    tree, parser, lexer_errors, parser_errors = run(code)
    assert not lexer_errors
    assert not parser_errors
    text = tree.toStringTree(recog=parser)
    assert "(atom new A (" in text
    assert "(atom (atom a) . toString ( ))" in text or ". toString (" in text


def test_parser_logical_and_or_not_tree():
    code = "\n".join(
        [
            "bool a = true",
            "bool b = false",
            "print(!a or b and a)",
        ]
    )
    tree, parser, lexer_errors, parser_errors = run(code)
    assert not lexer_errors
    assert not parser_errors
    text = tree.toStringTree(recog=parser)
    assert "(orExpr" in text
    assert "(andExpr" in text
    assert "!" in text


def test_parser_for_with_assignment_init_and_expr_update_tree():
    code = "\n".join(
        [
            "int i = 0",
            "for (i = 0; i < 3; i + 1):",
            "    print(i)",
        ]
    )
    tree, parser, lexer_errors, parser_errors = run(code)
    assert not lexer_errors
    assert not parser_errors
    text = tree.toStringTree(recog=parser)
    assert "(forStmt" in text
    assert "(forInit (assignment" in text
    assert "(forUpdate (expr" in text


def test_parser_for_with_optional_parts_tree():
    code = "\n".join(
        [
            "for (;;):",
            "    break",
        ]
    )
    tree, parser, lexer_errors, parser_errors = run(code)
    assert not lexer_errors
    assert not parser_errors
    text = tree.toStringTree(recog=parser)
    assert "(forStmt for (" in text or "(forStmt" in text
    assert "(breakStmt" in text
