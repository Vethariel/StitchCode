import json
from pathlib import Path
import sys


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
