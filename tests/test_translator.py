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
