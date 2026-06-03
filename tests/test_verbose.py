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
    code = "\n".join([
        "int x = 1",
        "list<string> nombres = []",
        "class Nodo:",
        "    int valor",
    ])
    b = bloques(code)
    # usar la clave real que produce el visitor
    tipo_var = b[0]["placeholders"].get("tipo_legible") or b[0]["placeholders"].get("tipo")
    assert tipo_var in ("entero", "int")
    tipo_elem = b[1]["placeholders"].get("tipo_elemento_legible") or b[1]["placeholders"].get("tipo_elemento")
    assert tipo_elem in ("texto", "string")


def test_verbose_new_en_expr_con_espacio():
    b = bloques("class Punto:\n    int x\n    init(int x):\n        self.x = x\nPunto p = new Punto(1)\n")
    var_block = next(blk for blk in b if blk["tipo"] == "var_decl" and blk["placeholders"]["nombre"] == "p")
    valor = var_block["placeholders"]["valor"]
    assert "nuevo" in valor.lower()
    assert "Punto" in valor
    assert "1" in valor


def test_verbose_print_no_duplica_method_call_como_hijo():
    code = "\n".join([
        "class Nodo:",
        "    int v",
        "    init(int v):",
        "        self.v = v",
        "    function int valor():",
        "        return self.v",
        "Nodo n = new Nodo(1)",
        "print(n.valor())",
    ])
    b = bloques(code)
    print_blocks = [blk for blk in b if blk["tipo"] == "print_stmt"]
    assert len(print_blocks) == 1
    assert "valor" in print_blocks[0]["placeholders"].get("valor", "")
    assert all(h["tipo"] != "method_call" for h in print_blocks[0].get("hijos", []))


def test_verbose_roundtrip_clase_con_herencia():
    code = "\n".join([
        "class Animal:",
        "    string nombre",
        "    init(string nombre):",
        "        self.nombre = nombre",
        "class Perro extends Animal:",
        "    init(string nombre):",
        "        super(nombre)",
    ])
    b1, b2 = roundtrip(code)
    assert b1["bloques"][0]["placeholders"]["nombre"] == b2["bloques"][0]["placeholders"]["nombre"]
    assert b1["bloques"][1]["placeholders"]["padre"] == b2["bloques"][1]["placeholders"]["padre"]


def test_verbose_roundtrip_try_catch():
    code = "\n".join([
        "try:",
        '    throw "error"',
        "catch (string e):",
        "    print(e)",
    ])
    b1, b2 = roundtrip(code)
    tipos1 = [blk["tipo"] for blk in b1["bloques"]]
    tipos2 = [blk["tipo"] for blk in b2["bloques"]]
    assert tipos1 == tipos2


def test_verbose_roundtrip_break_continue():
    code = "\n".join([
        "int i = 0",
        "while (i < 5):",
        "    if i == 2:",
        "        continue",
        "    if i == 4:",
        "        break",
        "    i = i + 1",
    ])
    b1, b2 = roundtrip(code)
    assert b1["bloques"][0]["placeholders"] == b2["bloques"][0]["placeholders"]


def test_verbose_var_decl_null_sin_valor():
    code = "\n".join([
        "class Animal:",
        "    string nombre",
        "    init(string nombre):",
        "        self.nombre = nombre",
        "Animal a",
    ])
    b = bloques(code)
    var_block = next(blk for blk in b if blk["tipo"] == "var_decl"
                     and blk["placeholders"]["nombre"] == "a")
    valor = var_block["placeholders"].get("valor", "")
    assert valor == "" or valor == "null" or valor is None or valor == "valor por defecto"


def test_verbose_break_continue_generan_bloques():
    code = "\n".join([
        "int i = 0",
        "while (i < 5):",
        "    if i == 2:",
        "        continue",
        "    if i == 4:",
        "        break",
        "    i = i + 1",
    ])
    b = bloques(code)
    while_block = next(blk for blk in b if blk["tipo"] == "while_stmt")
    tipos_hijos = [h["tipo"] for h in while_block["hijos"]]
    assert "if_stmt" in tipos_hijos


def test_verbose_try_catch_genera_bloque():
    code = "\n".join([
        "try:",
        '    throw "error"',
        "catch (string e):",
        "    print(e)",
    ])
    b = bloques(code)
    assert b[0]["tipo"] == "try_stmt"
    assert b[0]["placeholders"]["variable"] == "e"
    assert any(h["tipo"] == "throw_stmt" for h in b[0]["hijos"])
    assert any(h["tipo"] == "print_stmt" for h in b[0]["hijos_catch"])


def test_verbose_self_assignment_genera_bloque():
    code = "\n".join([
        "class Caja:",
        "    int valor",
        "    init(int v):",
        "        self.valor = v",
    ])
    b = bloques(code)
    clase = b[0]
    constructor = next(h for h in clase["hijos"] if h["tipo"] == "constructor_decl")
    assert any(h["tipo"] == "self_assignment" for h in constructor["hijos"])


def test_verbose_null_en_texto_expr():
    code = "\n".join([
        "class Animal:",
        "    string nombre",
        "    init(string nombre):",
        "        self.nombre = nombre",
        "Animal a = null",
    ])
    b = bloques(code)
    var_block = next(blk for blk in b if blk["tipo"] == "var_decl"
                     and blk["placeholders"]["nombre"] == "a")
    assert var_block["placeholders"]["valor"] == "sin valor"


def test_verbose_power_operator_en_texto_expr():
    code = "\n".join([
        "int y = 15",
        "print(y**2)",
    ])
    b = bloques(code)
    print_block = next(blk for blk in b if blk["tipo"] == "print_stmt")
    assert print_block["placeholders"]["valor"] == "y ** 2"


def test_inverse_list_decl_preserves_literal():
    code = "list<int> nums = [1, 2, 3]\n"
    data = json.loads(verbose_woven(code))
    regenerado = inverse_verbose(json.dumps(data))
    assert "list<int> nums = [1, 2, 3]" in regenerado


def test_inverse_var_decl_new_object_and_method_call():
    code = "\n".join([
        "class Punto:",
        "    int x",
        "    init(int x):",
        "        self.x = x",
        "    function void mostrar():",
        '        print("ok")',
        "Punto p = new Punto(7)",
        "p.mostrar()",
    ])
    regenerado = inverse_verbose(verbose_woven(code))
    assert "Punto p = new Punto(7)" in regenerado
    assert "p.mostrar()" in regenerado
    assert "nuevo" not in regenerado


def test_inverse_print_call_expression():
    code = "\n".join([
        "function int doble(int n):",
        "    return n * n",
        "print(doble(4))",
    ])
    regenerado = inverse_verbose(verbose_woven(code))
    assert "print(doble(4))" in regenerado
