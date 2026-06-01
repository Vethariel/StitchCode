from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[1]
sys.path.append(str(ROOT / "woven"))

from translator_visitor import translate_woven  # noqa: E402


def run(code: str):
    return {
        "python": translate_woven(code, "python"),
        "java": translate_woven(code, "java"),
        "cpp": translate_woven(code, "cpp"),
    }


def java_main_block(code: str) -> str:
    start = code.index("public static void main(String[] args) {")
    return code[start:]


def cpp_main_block(code: str) -> str:
    start = code.index("int main() {")
    return code[start:]


def test_translator_variable_declaration_three_languages():
    out = run("int x = 5\n")
    assert "x = 5" in out["python"]
    assert "int x = 5;" in java_main_block(out["java"])
    assert "int x = 5;" in cpp_main_block(out["cpp"])


def test_translator_function_with_return_three_languages():
    code = "\n".join(
        [
            "function int add(int a, int b):",
            "    return a + b",
        ]
    )
    out = run(code)
    assert "def add(a, b) -> int:" in out["python"]
    assert "public static int add(int a, int b)" in out["java"]
    assert "int add(int a, int b)" in out["cpp"]
    assert out["java"].index("public static int add(int a, int b)") < out["java"].index(
        "public static void main(String[] args) {"
    )
    assert out["cpp"].index("int add(int a, int b)") < out["cpp"].index("int main() {")


def test_translator_if_else_three_languages():
    code = "\n".join(
        [
            "if true:",
            "    print(\"ok\")",
            "else:",
            "    print(\"no\")",
        ]
    )
    out = run(code)
    assert "if True:" in out["python"]
    assert "if (true) {" in java_main_block(out["java"])
    assert "if (true) {" in cpp_main_block(out["cpp"])
    assert "else:" in out["python"]
    assert "else {" in java_main_block(out["java"])
    assert "else {" in cpp_main_block(out["cpp"])


def test_translator_for_range_inference_python_and_c_style_java_c():
    code = "\n".join(
        [
            "for (int i = 0; i < 3; i = i + 1):",
            "    print(i)",
        ]
    )
    out = run(code)
    assert "for i in range(0, 3):" in out["python"]
    assert "for (int i = 0; i < 3; i = i + 1) {" in java_main_block(out["java"])
    assert "for (int i = 0; i < 3; i = i + 1) {" in cpp_main_block(out["cpp"])


def test_translator_print_literal_expression_and_interp_three_languages():
    code = "\n".join(
        [
            "int x = 3",
            "print(\"hola\")",
            "print(x + 2)",
            "print(\"hola {x}\")",
        ]
    )
    out = run(code)
    assert 'print("hola")' in out["python"]
    assert "print(x + 2)" in out["python"]
    assert 'print(f"hola {x}")' in out["python"]

    assert 'System.out.println("hola");' in java_main_block(out["java"])
    assert "System.out.println(x + 2);" in java_main_block(out["java"])
    assert 'System.out.println(String.format("hola %s", x));' in java_main_block(out["java"])

    assert 'std::cout << "hola" << std::endl;' in out["cpp"]
    assert 'std::cout << x + 2 << std::endl;' in out["cpp"]
    assert 'std::cout << "hola " << x << std::endl;' in out["cpp"]


def test_translator_logical_and_or_java_and_c():
    code = "bool a = true\nbool b = false\nprint(a and b or a)\n"
    out = run(code)
    assert "a && b || a" in java_main_block(out["java"])
    assert "a && b || a" in out["cpp"]


def test_translator_simple_class_three_languages():
    code = "\n".join(
        [
            "class Counter:",
            "    int value",
            "    init(int v):",
            "        self.value = v",
        ]
    )
    out = run(code)
    assert "class Counter:" in out["python"]
    assert "static class Counter" in out["java"]
    assert "class Counter" in out["cpp"]


def test_translator_inheritance_three_languages():
    code = "\n".join(
        [
            "class Base:",
            "    init():",
            "        return",
            "class Child extends Base:",
            "    init():",
            "        super()",
        ]
    )
    out = run(code)
    assert "class Child(Base):" in out["python"]
    assert "class Child extends Base" in out["java"]
    assert "class Child : public Base" in out["cpp"]


def test_translator_virtual_method_cpp_vs_python_java():
    code = "\n".join(
        [
            "class A:",
            "    virtual function int value():",
            "        return 1",
        ]
    )
    out = run(code)
    assert "def value(self) -> int:" in out["python"]
    assert "public int value()" in out["java"]
    assert "virtual int value()" in out["cpp"]


def test_translator_list_primitives_three_languages():
    code = "\n".join(
        [
            "list<int> nums = [1, 2]",
            "nums.append(3)",
            "print(nums.length)",
            "nums.remove(0)",
        ]
    )
    out = run(code)
    assert "nums: list[int] = [1, 2]" in out["python"]  # solo esta forma
    assert "ArrayList<Integer>" in out["java"]
    assert "std::vector<int>" in out["cpp"]
    assert ".add(" in out["java"]
    assert ".push_back(" in out["cpp"]


def test_translator_list_objects_three_languages():
    code = "\n".join(
        [
            "class Item:",
            "    int v",
            "    init(int x):",
            "        self.v = x",
            "list<Item> items = []",
            "items.append(new Item(1))",
        ]
    )
    out = run(code)
    assert "list[Item]" in out["python"] or "items = []" in out["python"]
    assert "ArrayList<Item>" in out["java"]
    assert "std::vector<std::shared_ptr<Item>>" in out["cpp"]


def test_translator_new_object_three_languages():
    code = "\n".join(
        [
            "class Punto:",
            "    int x",
            "    init(int x):",
            "        self.x = x",
            "Punto p = new Punto(5)",
        ]
    )
    out = run(code)
    assert "Punto(5)" in out["python"]        # sin new
    assert "new Punto(5)" in out["java"]
    assert "make_shared<Punto>(5)" in out["cpp"]


def test_translator_null_literal_three_languages():
    code = "\n".join([
        "class Animal:",
        "    string nombre",
        "    init(string nombre):",
        "        self.nombre = nombre",
        "Animal a = null",
    ])
    out = run(code)
    assert "None" in out["python"]
    assert "null" in out["java"]
    assert "nullptr" in out["cpp"]


def test_translator_declaration_without_value_three_languages():
    code = "\n".join([
        "class Animal:",
        "    string nombre",
        "    init(string nombre):",
        "        self.nombre = nombre",
        "Animal a",
    ])
    out = run(code)
    assert "None" in out["python"]
    assert "null" in out["java"]
    assert "nullptr" in out["cpp"]


def test_translator_break_three_languages():
    code = "\n".join([
        "int i = 0",
        "while i < 5:",
        "    if i == 3:",
        "        break",
        "    i = i + 1",
    ])
    out = run(code)
    assert "break" in out["python"]
    assert "break;" in out["java"]
    assert "break;" in out["cpp"]


def test_translator_continue_three_languages():
    code = "\n".join([
        "int i = 0",
        "while i < 5:",
        "    i = i + 1",
        "    if i == 3:",
        "        continue",
    ])
    out = run(code)
    assert "continue" in out["python"]
    assert "continue;" in out["java"]
    assert "continue;" in out["cpp"]


def test_translator_try_catch_three_languages():
    code = "\n".join([
        "try:",
        "    int x = 1 / 0",
        "catch (string e):",
        '    print("Error: {e}")',
    ])
    out = run(code)
    assert "try:" in out["python"]
    assert "except Exception as e:" in out["python"]
    assert "try {" in out["java"]
    assert "catch (Exception" in out["java"]
    assert "try {" in out["cpp"]
    assert "catch (std::exception&" in out["cpp"]


def test_translator_throw_three_languages():
    code = "\n".join([
        "try:",
        '    throw "error de prueba"',
        "catch (string e):",
        "    print(e)",
    ])
    out = run(code)
    assert 'raise Exception("error de prueba")' in out["python"]
    assert 'throw new RuntimeException("error de prueba");' in out["java"]
    assert 'throw std::runtime_error("error de prueba");' in out["cpp"]


def test_translator_not_operator_three_languages():
    code = "\n".join([
        "bool a = false",
        "print(!a)",
    ])
    out = run(code)
    assert "print(not a)" in out["python"]
    assert "System.out.println(!a);" in java_main_block(out["java"])
    assert "std::cout << !a << std::endl;" in out["cpp"]


def test_translator_mod_operator_three_languages():
    code = "print(7 % 4)\n"
    out = run(code)
    assert "print(7 % 4)" in out["python"]
    assert "System.out.println(7 % 4);" in java_main_block(out["java"])
    assert "std::cout << 7 % 4 << std::endl;" in out["cpp"]


def test_translator_float_literal_three_languages():
    code = "\n".join([
        "float x = 1.5",
        "print(x + 0.5)",
    ])
    out = run(code)
    assert "x = 1.5" in out["python"]
    assert "double x = 1.5;" in java_main_block(out["java"])
    assert "double x = 1.5;" in cpp_main_block(out["cpp"])


def test_translator_index_read_three_languages():
    code = "\n".join([
        "list<int> nums = [1, 2, 3]",
        "print(nums[0])",
    ])
    out = run(code)
    assert "print(nums[0])" in out["python"]
    assert "System.out.println(nums.get(0));" in java_main_block(out["java"])
    assert "std::cout << nums[0] << std::endl;" in out["cpp"]


def test_translator_self_call_three_languages():
    code = "\n".join([
        "class Calc:",
        "    int base",
        "    init(int base):",
        "        self.base = base",
        "    function int mult(int n):",
        "        return self.base * n",
        "    function int triple():",
        "        return self.mult(3)",
        "Calc c = new Calc(4)",
        "print(c.triple())",
    ])
    out = run(code)
    assert "return self.mult(3)" in out["python"]
    assert "return this.mult(3);" in out["java"]
    assert "return this->mult(3);" in out["cpp"]


def test_translator_for_assignment_init_three_languages():
    code = "\n".join([
        "int i = 0",
        "for (i = 0; i < 3; i = i + 1):",
        "    print(i)",
    ])
    out = run(code)
    assert "i = 0" in out["python"]
    assert "while i < 3:" in out["python"]
    assert "for (i = 0; i < 3; i = i + 1) {" in java_main_block(out["java"])
    assert "for (i = 0; i < 3; i = i + 1) {" in cpp_main_block(out["cpp"])


def test_translator_for_expr_update_three_languages():
    code = "\n".join([
        "int i = 0",
        "function void tick():",
        "    i = i + 1",
        "for (; i < 3; tick()):",
        "    print(i)",
    ])
    out = run(code)
    assert "while i < 3:" in out["python"]
    assert "tick()" in out["python"]
    assert "for (; i < 3; tick()) {" in java_main_block(out["java"])
    assert "for (; i < 3; tick()) {" in cpp_main_block(out["cpp"])


def test_translator_for_all_optional_parts_three_languages():
    code = "\n".join([
        "for (;;):",
        "    break",
    ])
    out = run(code)
    assert "while True:" in out["python"]
    assert "for (; ; ) {" in java_main_block(out["java"])
    assert "for (; ; ) {" in cpp_main_block(out["cpp"])


def test_translator_throw_inside_method_three_languages():
    code = "\n".join([
        "class Validador:",
        "    function void validar(int x):",
        '        throw "valor invalido"',
    ])
    out = run(code)
    assert 'raise Exception("valor invalido")' in out["python"]
    assert 'throw new RuntimeException("valor invalido");' in out["java"]
    assert 'throw std::runtime_error("valor invalido");' in out["cpp"]


def test_translator_break_continue_in_for_three_languages():
    code = "\n".join([
        "for (int i = 0; i < 5; i = i + 1):",
        "    if i == 2:",
        "        continue",
        "    if i == 4:",
        "        break",
    ])
    out = run(code)
    assert "continue" in out["python"]
    assert "break" in out["python"]
    assert "continue;" in out["java"]
    assert "break;" in out["java"]
    assert "continue;" in out["cpp"]
    assert "break;" in out["cpp"]


def test_translator_null_as_initial_value_three_languages():
    code = "\n".join([
        "class Nodo:",
        "    int valor",
        "    init(int valor):",
        "        self.valor = valor",
        "Nodo siguiente = null",
        "string texto = null",
    ])
    out = run(code)
    assert "None" in out["python"]
    assert out["python"].count("None") >= 2
    assert out["java"].count("null") >= 2
    assert out["cpp"].count("nullptr") >= 2
