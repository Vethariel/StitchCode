from pathlib import Path
import sys

from antlr4 import CommonTokenStream, InputStream, Token


ROOT = Path(__file__).resolve().parents[1]
sys.path.append(str(ROOT / "woven"))

from WovenLexer import WovenLexer  # noqa: E402
from WovenParser import WovenParser  # noqa: E402


def run(code: str):
    lexer = WovenLexer(InputStream(code))
    stream = CommonTokenStream(lexer)
    stream.fill()
    names = []
    for tok in stream.tokens:
        if tok.type == Token.EOF or tok.channel != Token.DEFAULT_CHANNEL:
            continue
        if 0 <= tok.type < len(WovenParser.symbolicNames):
            name = WovenParser.symbolicNames[tok.type]
        else:
            name = str(tok.type)
        names.append(name)
    return names


def test_lexer_variable_declaration_tokens():
    tokens = run("int x = 5\n")
    assert "INT" in tokens
    assert "IDENTIFIER" in tokens
    assert "ASSIGN" in tokens
    assert "INT_LITERAL" in tokens


def test_lexer_all_primitive_types_tokens():
    code = "\n".join(
        [
            "int x = 1",
            "float y = 1.5",
            "string s = \"hi\"",
            "bool ok = true",
        ]
    )
    tokens = run(code)
    for expected in ("INT", "FLOAT", "STRING", "BOOL"):
        assert expected in tokens


def test_lexer_arithmetic_and_comparison_operators_tokens():
    tokens = run("print(1 + 2 - 3 * 4 / 5 % 2 == 1 != 0 < 2 <= 3 > 1 >= 1)\n")
    for expected in ("ADD", "SUB", "MUL", "DIV", "MOD", "EQ", "NE", "LT", "LE", "GT", "GE"):
        assert expected in tokens


def test_lexer_string_literal_and_interpolated_string_tokens():
    plain = run("print(\"hola\")\n")
    interp = run("print(\"hola {x}\")\n")
    assert "STRING_LITERAL" in plain
    assert "STRING_INTERP" not in plain
    assert "STRING_INTERP" in interp


def test_lexer_keywords_tokens():
    code = "\n".join(
        [
            "function void main():",
            "    if true:",
            "        print(\"ok\")",
            "    else:",
            "        for (int i = 0; i < 1; i = i + 1):",
            "            while false:",
            "                return",
        ]
    )
    tokens = run(code)
    for expected in ("FUNCTION", "IF", "ELSE", "FOR", "WHILE", "RETURN", "PRINT"):
        assert expected in tokens


def test_lexer_generates_indent_and_dedent():
    code = "\n".join(
        [
            "if true:",
            "    print(\"a\")",
            "print(\"b\")",
        ]
    )
    tokens = run(code)
    assert "INDENT" in tokens
    assert "DEDENT" in tokens


def test_lexer_ignores_comments_styles():
    code = "\n".join(
        [
            "int x = 1 // comentario",
            "/* bloque",
            "   comentario */",
            "# hash comment",
            "print(x)",
        ]
    )
    tokens = run(code)
    assert "LINE_COMMENT" not in tokens
    assert "BLOCK_COMMENT" not in tokens
    assert "HASH_COMMENT" not in tokens
    assert "PRINT" in tokens


def test_lexer_try_catch_throw_tokens():
    code = "\n".join(
        [
            "try:",
            '    throw "boom"',
            "catch (string e):",
            "    print(e)",
        ]
    )
    tokens = run(code)
    for expected in ("TRY", "CATCH", "THROW", "STRING", "IDENTIFIER"):
        assert expected in tokens
    # THROW debe venir del statement `throw "boom"` dentro del bloque try.
    assert tokens.count("THROW") >= 1


def test_lexer_class_related_tokens():
    code = "\n".join(
        [
            "class Child extends Base:",
            "    int value",
            "    init(int x):",
            "        self.value = x",
            "    virtual function int get():",
            "        return self.value",
        ]
    )
    tokens = run(code)
    for expected in ("CLASS", "EXTENDS", "INIT", "SELF", "VIRTUAL", "FUNCTION", "DOT"):
        assert expected in tokens


def test_lexer_list_new_super_and_brackets_tokens():
    code = "\n".join(
        [
            "class A:",
            "    init():",
            "        return",
            "class B extends A:",
            "    init():",
            "        super()",
            "list<int> xs = [1, 2]",
            "xs.append(new B())",
            "print(xs[0])",
        ]
    )
    tokens = run(code)
    for expected in (
        "LIST",
        "NEW",
        "SUPER",
        "LBRACK",
        "RBRACK",
        "LPAREN",
        "RPAREN",
        "COMMA",
    ):
        assert expected in tokens


def test_lexer_bool_null_and_logical_tokens():
    code = "\n".join(
        [
            "bool a = true",
            "bool b = false",
            "if !a or b and (a == false):",
            "    print(null)",
        ]
    )
    tokens = run(code)
    for expected in ("TRUE", "FALSE", "NULL", "NOT", "OR", "AND"):
        assert expected in tokens


def test_lexer_break_continue_and_semi_tokens():
    code = "\n".join(
        [
            "for (int i = 0; i < 3; i = i + 1):",
            "    if i == 1:",
            "        continue",
            "    if i == 2:",
            "        break",
        ]
    )
    tokens = run(code)
    for expected in ("BREAK", "CONTINUE", "SEMI"):
        assert expected in tokens


def test_lexer_float_literal_and_void_tokens():
    code = "\n".join(
        [
            "function void f():",
            "    float x = 1.25",
            "    print(x)",
        ]
    )
    tokens = run(code)
    assert "VOID" in tokens
    assert "FLOAT_LITERAL" in tokens


def test_lexer_skips_newline_inside_parentheses():
    code = "print((1 +\n2))\n"
    tokens = run(code)
    # el newline dentro de paréntesis no genera INDENT ni DEDENT
    assert "INDENT" not in tokens
    assert "DEDENT" not in tokens
    # solo el newline al final de la línea completa llega al canal default
    assert tokens.count("NEWLINE") <= 1
