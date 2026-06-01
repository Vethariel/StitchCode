from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.append(str(ROOT / "woven"))

from woven_runtime import run_woven  # noqa: E402


def test_while_sin_parentesis_mensaje_contextual():
    code = "\n".join(
        [
            "int x = 0",
            "while i < 10:",
            "    x = x + 1",
        ]
    )
    output = run_woven(code)
    assert len(output) >= 1
    msg = output[0]
    assert msg.startswith("Error de sintaxis:")
    assert "while" in msg
    assert "`(`" in msg or "(" in msg
    assert "`i`" in msg
    assert "línea" in msg
    assert "│" in msg
    assert "^" in msg
    assert "Forma esperada:" in msg
    assert not any("x = 1" in line for line in output)


def test_for_sin_parentesis_mensaje_contextual():
    code_bad = "for i < 3:\n    print(i)\n"
    output = run_woven(code_bad)
    assert len(output) >= 1
    assert output[0].startswith("Error de sintaxis:")
    assert "for" in output[0]
    assert "`(`" in output[0] or "(" in output[0]
    assert "│" in output[0]


def test_for_in_estilo_python():
    code = "for i in range(3):\n    print(i)\n"
    output = run_woven(code)
    assert len(output) == 1
    assert "for" in output[0]
    assert "estilo C" in output[0] or "for x in" in output[0]
    assert "│" in output[0]
    assert "Forma esperada:" in output[0]


def test_def_estilo_python():
    code = "def sumar(a, b):\n    return a + b\n"
    output = run_woven(code)
    assert len(output) == 1
    assert "def" in output[0]
    assert "function" in output[0]
    assert "│" in output[0]


def test_let_estilo_javascript():
    code = "let x = 5\nprint(x)\n"
    output = run_woven(code)
    assert len(output) == 1
    assert "let" in output[0]
    assert "int" in output[0]
    assert not any(line == "5" for line in output)


def test_if_con_parentesis():
    code = "int x = 1\nif (x > 0):\n    print(x)\n"
    output = run_woven(code)
    assert len(output) == 1
    assert "if" in output[0]
    assert "paréntesis" in output[0].lower() or "parentesis" in output[0].lower()


def test_error_no_ejecuta_programa_valido_despues():
    code = "\n".join(
        [
            "int a = 1",
            "while i < 2:",
            "    print(a)",
            "print(99)",
        ]
    )
    output = run_woven(code)
    assert any("Error de" in line for line in output)
    assert not any(line == "99" for line in output)
    assert not any(line == "1" for line in output)


def test_indentacion_de_mas_en_nivel_principal():
    code = "\n".join(
        [
            "// Stitch Code · Woven",
            "int x = 5",
            "print(x)",
            "",
            "  int y = x + 10",
            "print(y)",
        ]
    )
    output = run_woven(code)
    assert len(output) == 1
    msg = output[0]
    assert "no hay un bloque abierto" in msg
    assert "print(x)" in msg
    assert "sin indentación" in msg.lower() or "sin espacios" in msg.lower()
    assert "volvió al margen" not in msg
    assert not any(line == "5" for line in output)


def test_falta_indent_tras_dos_puntos():
    code = "\n".join(
        [
            "int x = 0",
            "if x > 0:",
            "print(x)",
        ]
    )
    output = run_woven(code)
    assert len(output) >= 1
    assert any(
        "indent" in line.lower() or "espacios" in line.lower()
        for line in output
    )


def test_cascada_un_error_por_linea():
    code = "def f():\n    pass\n"
    output = run_woven(code)
    # Pre-scan captura def antes del parseo
    assert len(output) == 1
