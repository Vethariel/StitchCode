from pathlib import Path
import sys
import json

ROOT = Path(__file__).resolve().parents[1]
sys.path.append(str(ROOT / "woven"))

from verbose_visitor import verbose_woven
from verbose_inverse import inverse_verbose


def bloques(code):
    return json.loads(verbose_woven(code))["bloques"]


def roundtrip(code):
    """Woven -> bloques -> Woven -> bloques: los bloques deben ser iguales."""
    b1 = verbose_woven(code)
    woven_regenerado = inverse_verbose(b1)
    b2 = verbose_woven(woven_regenerado)
    return json.loads(b1), json.loads(b2)


def test_verbose_var_decl():
    b = bloques("int x = 5\n")
    assert b[0]["tipo"] == "var_decl"
    assert b[0]["placeholders"]["nombre"] == "x"
    assert b[0]["placeholders"]["valor"] == "5"
    assert b[0]["placeholders"]["tipo"] == "int"


def test_verbose_if_stmt_con_hijos():
    code = "\n".join(
        [
            "if true:",
            '    print("ok")',
        ]
    )
    b = bloques(code)
    assert b[0]["tipo"] == "if_stmt"
    assert len(b[0]["hijos"]) == 1
    assert b[0]["hijos"][0]["tipo"] == "print_stmt"


def test_verbose_for_stmt_placeholders():
    code = "for (int i = 0; i < 3; i = i + 1):\n    print(i)\n"
    b = bloques(code)
    assert b[0]["tipo"] == "for_stmt"
    p = b[0]["placeholders"]
    assert p["variable"] == "i"
    assert p["inicio"] == "0"
    assert p["condicion"] == "i < 3"


def test_verbose_function_decl_con_hijos():
    code = "\n".join(
        [
            "function int add(int a, int b):",
            "    return a + b",
        ]
    )
    b = bloques(code)
    assert b[0]["tipo"] == "function_decl"
    assert b[0]["placeholders"]["nombre"] == "add"
    assert b[0]["hijos"][0]["tipo"] == "return_stmt"


def test_verbose_class_decl_con_herencia():
    code = "\n".join(
        [
            "class Perro extends Animal:",
            "    int edad",
            "    init(int edad):",
            "        self.edad = edad",
        ]
    )
    b = bloques(code)
    assert b[0]["tipo"] == "class_decl"
    assert b[0]["placeholders"]["nombre"] == "Perro"
    assert b[0]["placeholders"]["padre"] == "Animal"


def test_verbose_roundtrip_var_decl():
    b1, b2 = roundtrip("int x = 5\n")
    assert b1["bloques"][0]["placeholders"] == b2["bloques"][0]["placeholders"]


def test_verbose_roundtrip_for_stmt():
    code = "for (int i = 0; i < 3; i = i + 1):\n    print(i)\n"
    b1, b2 = roundtrip(code)
    assert b1["bloques"][0]["placeholders"] == b2["bloques"][0]["placeholders"]


def test_verbose_roundtrip_function():
    code = "\n".join(
        [
            "function int add(int a, int b):",
            "    return a + b",
        ]
    )
    b1, b2 = roundtrip(code)
    assert b1["bloques"][0]["placeholders"] == b2["bloques"][0]["placeholders"]


def test_inverse_genera_woven_valido():
    code = "\n".join(
        [
            "int x = 5",
            "if x > 1:",
            "    print(x)",
        ]
    )
    b = verbose_woven(code)
    regenerado = inverse_verbose(b)
    assert "int x = 5" in regenerado
    assert "if x > 1:" in regenerado
    assert "print(x)" in regenerado


def test_inverse_placeholder_modificado():
    """Cambiar un placeholder y verificar que el Woven generado refleja el cambio."""
    code = "int x = 5\n"
    data = json.loads(verbose_woven(code))
    data["bloques"][0]["placeholders"]["valor"] = "99"
    regenerado = inverse_verbose(json.dumps(data))
    assert "int x = 99" in regenerado


def test_verbose_placeholders_tipo_legible():
    code = "\n".join(
        [
            "int x = 1",
            "list<string> nombres = []",
            "class Nodo:",
            "    int valor",
        ]
    )
    b = bloques(code)
    assert b[0]["placeholders"]["tipo_legible"] == "entero"
    assert b[1]["placeholders"]["tipo_elemento_legible"] == "texto"
    assert b[2]["hijos"][0]["placeholders"]["tipo_legible"] == "entero"


def test_verbose_new_en_expr_con_espacio():
    b = bloques("Punto p = new Punto(1)\n")
    assert b[0]["placeholders"]["valor"] == "nuevo Punto con 1"


def test_verbose_print_no_duplica_method_call_como_hijo():
    code = "\n".join(
        [
            "class Nodo:",
            "    function int valor():",
            "        return 1",
            "Nodo n = new Nodo()",
            "print(n.valor())",
        ]
    )
    b = bloques(code)
    print_blocks = [blk for blk in b if blk["tipo"] == "print_stmt"]
    assert len(print_blocks) == 1
    assert all(h["tipo"] != "method_call" for h in print_blocks[0]["hijos"])
