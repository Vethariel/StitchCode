"""
Punto de entrada del intérprete Woven para el frontend (Pyodide) y herramientas.
"""

from antlr4 import CommonTokenStream, InputStream

from WovenLexer import WovenLexer
from WovenParser import WovenParser
from interpreter_visitor import InterpreterVisitor
from pedagogical_error_listener import (
    PedagogicalErrorListener,
    detectar_anti_patrones,
    filtrar_errores_cascada,
)


def collect_syntax_errors(source: str) -> list:
    """Errores de sintaxis/léxico, o lista vacía si el parseo es válido."""
    anti = detectar_anti_patrones(source)
    if anti:
        return anti

    lexer = WovenLexer(InputStream(source))
    stream = CommonTokenStream(lexer)
    parser = WovenParser(stream)

    lexer_errors = PedagogicalErrorListener(source)
    parser_errors = PedagogicalErrorListener(source)
    lexer.removeErrorListeners()
    parser.removeErrorListeners()
    lexer.addErrorListener(lexer_errors)
    parser.addErrorListener(parser_errors)

    parser.program()
    return filtrar_errores_cascada(lexer_errors.errors + parser_errors.errors)


def run_woven(source: str) -> list:
    """
    Parsea y ejecuta código Woven.

    Si hay errores de sintaxis o léxico, devuelve solo mensajes pedagógicos
    (sin ejecutar el programa).
    """
    syntax_errors = collect_syntax_errors(source)
    if syntax_errors:
        return syntax_errors

    salida, _ = ejecutar_woven(source)
    return salida


def ejecutar_woven(source: str) -> tuple[list, list]:
    """Ejecuta código ya validado; devuelve (salida, diagnósticos runtime)."""
    lexer = WovenLexer(InputStream(source))
    stream = CommonTokenStream(lexer)
    parser = WovenParser(stream)
    tree = parser.program()

    visitor = InterpreterVisitor(source)
    salida = visitor.visit(tree)
    return salida, visitor.runtime_diagnosticos
