import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.append(str(ROOT / "woven"))

from tracing_visitor import trace_woven  # noqa: E402


def trace(code: str):
    return json.loads(trace_woven(code))


def test_tracer_produce_eventos_linea():
    resultado = trace("int x = 5\nprint(x)\n")
    tipos = [e["tipo"] for e in resultado["eventos"]]
    assert "linea" in tipos


def test_tracer_produce_evento_variable():
    resultado = trace("int x = 5\n")
    vars_ = [e for e in resultado["eventos"] if e["tipo"] == "variable"]
    assert any(e["nombre"] == "x" and e["valor"] == 5 for e in vars_)


def test_tracer_produce_eventos_llamada_y_retorno():
    code = "\n".join(
        [
            "function int doble(int n):",
            "    return n * 2",
            "print(doble(3))",
        ]
    )
    resultado = trace(code)
    tipos = [e["tipo"] for e in resultado["eventos"]]
    assert "llamada" in tipos
    assert "retorno" in tipos


def test_tracer_captura_error_division_por_cero():
    resultado = trace("int x = 1\nint y = 0\nprint(x / y)\n")
    assert not resultado["exito"]
    errores = [e for e in resultado["eventos"] if e["tipo"] == "error"]
    assert len(errores) == 1
    assert "cero" in errores[0]["mensaje"].lower()


def test_tracer_scope_en_evento_variable():
    code = "\n".join(
        [
            "int a = 1",
            "int b = 2",
        ]
    )
    resultado = trace(code)
    vars_ = [e for e in resultado["eventos"] if e["tipo"] == "variable"]
    ultimo = vars_[-1]
    assert "a" in ultimo["scope"]
    assert "b" in ultimo["scope"]


def test_tracer_call_stack_en_llamada():
    code = "\n".join(
        [
            "function int f(int n):",
            "    return n + 1",
            "print(f(5))",
        ]
    )
    resultado = trace(code)
    llamadas = [e for e in resultado["eventos"] if e["tipo"] == "llamada"]
    assert any("f" in e["call_stack"] for e in llamadas)


def test_tracer_error_incluye_scope_al_fallar():
    code = "\n".join(
        [
            "int x = 42",
            "int y = 0",
            "print(x / y)",
        ]
    )
    resultado = trace(code)
    errores = [e for e in resultado["eventos"] if e["tipo"] == "error"]
    assert "x" in errores[0]["scope_al_fallar"]


def test_tracer_produce_evento_clase():
    code = "\n".join(
        [
            "class Animal:",
            "    int edad",
            "    init(int edad):",
            "        self.edad = edad",
            "Animal a = new Animal(3)",
        ]
    )
    resultado = trace(code)
    clases = [e for e in resultado["eventos"] if e["tipo"] == "clase"]
    assert len(clases) == 1
    assert clases[0]["nombre"] == "Animal"
    assert clases[0]["padre"] is None
    assert "edad" in clases[0]["campos"]


def test_tracer_evento_variable_tiene_linea():
    resultado = trace("int x = 5\n")
    vars_ = [e for e in resultado["eventos"] if e["tipo"] == "variable"]
    assert all(e["linea"] is not None for e in vars_)


def test_tracer_if_else_sin_error():
    code = "\n".join(
        [
            "int x = 2",
            "if x > 1:",
            "    print(\"ok\")",
            "else:",
            "    print(\"no\")",
        ]
    )
    resultado = trace(code)
    assert resultado["exito"]
    assert any(e["tipo"] == "linea" for e in resultado["eventos"])


def test_tracer_for_continue_break_sin_error():
    code = "\n".join(
        [
            "int total = 0",
            "for (int i = 0; i < 6; i = i + 1):",
            "    if i == 2:",
            "        continue",
            "    if i == 5:",
            "        break",
            "    total = total + i",
            "print(total)",
        ]
    )
    resultado = trace(code)
    assert resultado["exito"]
    vars_total = [
        e for e in resultado["eventos"]
        if e["tipo"] == "variable" and e.get("nombre") == "total"
    ]
    assert any(e["valor"] == 8 for e in vars_total)


def test_tracer_try_catch_throw_no_genera_error():
    code = "\n".join(
        [
            "try:",
            '    throw "boom"',
            "catch (string e):",
            "    print(e)",
        ]
    )
    resultado = trace(code)
    assert resultado["exito"]
    assert not any(e["tipo"] == "error" for e in resultado["eventos"])


def test_tracer_try_catch_index_fuera_de_rango_capturado():
    code = "\n".join(
        [
            "list<int> nums = [1, 2, 3]",
            "try:",
            "    print(nums[10])",
            "catch (string e):",
            '    print("capturado")',
        ]
    )
    resultado = trace(code)
    assert resultado["exito"]
    assert not any(e["tipo"] == "error" for e in resultado["eventos"])


def test_tracer_member_call_produce_evento_llamada():
    code = "\n".join(
        [
            "class Calc:",
            "    int base",
            "    init(int base):",
            "        self.base = base",
            "    function int mult(int n):",
            "        return self.base * n",
            "Calc c = new Calc(4)",
            "print(c.mult(3))",
        ]
    )
    resultado = trace(code)
    llamadas = [e for e in resultado["eventos"] if e["tipo"] == "llamada"]
    assert any(e["nombre"] == "mult" for e in llamadas)


def test_tracer_list_length_remove_index_sin_error():
    code = "\n".join(
        [
            "list<int> nums = [10, 20, 30]",
            "print(nums.length)",
            "print(nums.remove(1))",
            "print(nums[0])",
        ]
    )
    resultado = trace(code)
    assert resultado["exito"]


def test_tracer_evento_clase_con_herencia():
    code = "\n".join([
        "class Animal:",
        "    int edad",
        "    init(int edad):",
        "        self.edad = edad",
        "class Perro extends Animal:",
        "    init(int edad):",
        "        super(edad)",
        "Perro p = new Perro(3)",
    ])
    resultado = trace(code)
    clases = [e for e in resultado["eventos"] if e["tipo"] == "clase"]
    assert len(clases) == 2
    perro = next(c for c in clases if c["nombre"] == "Perro")
    assert perro["padre"] == "Animal"


def test_tracer_evento_retorno_con_valor():
    code = "\n".join([
        "function int doble(int n):",
        "    return n * 2",
        "print(doble(5))",
    ])
    resultado = trace(code)
    retornos = [e for e in resultado["eventos"] if e["tipo"] == "retorno"]
    assert len(retornos) >= 1
    assert any(e["valor"] == 10 for e in retornos)


def test_tracer_variable_objeto_serializado():
    code = "\n".join([
        "class Punto:",
        "    int x",
        "    int y",
        "    init(int x, int y):",
        "        self.x = x",
        "        self.y = y",
        "Punto p = new Punto(3, 4)",
    ])
    resultado = trace(code)
    vars_ = [e for e in resultado["eventos"] if e["tipo"] == "variable"]
    punto_var = next((e for e in vars_ if e["nombre"] == "p"), None)
    assert punto_var is not None
    assert isinstance(punto_var["valor"], dict)
    assert punto_var["valor"].get("clase") == "Punto"
    assert "x" in punto_var["valor"].get("campos", {})
    assert "y" in punto_var["valor"].get("campos", {})


def test_tracer_variable_null_en_traza():
    code = "\n".join([
        "class Animal:",
        "    string nombre",
        "    init(string nombre):",
        "        self.nombre = nombre",
        "Animal a = null",
    ])
    resultado = trace(code)
    vars_ = [e for e in resultado["eventos"] if e["tipo"] == "variable"]
    animal_var = next((e for e in vars_ if e["nombre"] == "a"), None)
    assert animal_var is not None
    assert animal_var["valor"] is None


def test_tracer_power_operator():
    code = "\n".join([
        "int y = 15",
        "print(y**2)",
    ])
    resultado = trace(code)
    assert resultado["exito"] is True
    assert not any(e["tipo"] == "error" for e in resultado["eventos"])
