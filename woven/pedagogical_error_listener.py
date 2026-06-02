"""
Mensajes de error de sintaxis y léxico para estudiantes (Woven / Stitch Code).

Fase A: contexto de tokens, snippet con cursor, anti-patrones frecuentes
(Python/Java/C) e indentación.
"""

from __future__ import annotations

import re
from typing import Any, List, Optional

from pedagogical_common import EJEMPLO_ETIQUETA

from antlr4.Lexer import Lexer
from antlr4.Parser import Parser
from antlr4.Token import Token
from antlr4.error.ErrorListener import ErrorListener
from antlr4.error.Errors import InputMismatchException


# Regla del parser → contexto pedagógico
_RULE_HINTS = {
    "whileStmt": {
        "palabra": "while",
        "forma": "while (condición):",
        "tras_palabra": "después de `while` debe ir `(` para la condición",
    },
    "forStmt": {
        "palabra": "for",
        "forma": "for (int i = 0; i < n; i = i + 1):",
        "tras_palabra": "después de `for` debe ir `(` con inicio; condición; actualización",
    },
    "ifStmt": {
        "palabra": "if",
        "forma": "if condición:",
        "tras_palabra": "en un `if`, escribe la condición y luego `:` (sin paréntesis alrededor)",
    },
    "functionDecl": {
        "palabra": "function",
        "forma": "function int nombre(int parametro):",
        "tras_palabra": "en una función, revisa tipo de retorno, nombre y paréntesis",
    },
    "classDecl": {
        "palabra": "class",
        "forma": "class Nombre:",
        "tras_palabra": "en una clase, revisa el nombre y los dos puntos `:`",
    },
    "constructorDecl": {
        "palabra": "init",
        "forma": "init(parametros):",
        "tras_palabra": "el constructor usa `init`, no el nombre de la clase",
    },
    "tryStmt": {
        "palabra": "try",
        "forma": "try: ... catch (string nombre):",
        "tras_palabra": "en try/catch, revisa `try:`, el bloque y `catch (string nombre):`",
    },
    "printStmt": {
        "palabra": "print",
        "forma": "print(expresión)",
        "tras_palabra": "en `print`, usa paréntesis: print(...)",
    },
    "varDecl": {
        "palabra": None,
        "forma": "int nombre = valor",
        "tras_palabra": "en una declaración, primero el tipo (`int`, `string`, …), luego el nombre",
    },
    "returnStmt": {
        "palabra": "return",
        "forma": "return valor",
        "tras_palabra": "en `return`, escribe el valor a devolver (o solo return en funciones void)",
    },
    "block": {
        "palabra": None,
        "forma": "    línea indentada con 4 espacios",
        "tras_palabra": "el bloque bajo `:` debe ir indentado (4 espacios)",
    },
    "forInit": {
        "palabra": "for",
        "forma": "for (int i = 0; i < n; i = i + 1):",
        "tras_palabra": "dentro del `for`, la inicialización suele ser `int i = 0`",
    },
}

# Palabras de otros lenguajes → guía Woven
_ANTI_PATRONES: list[tuple[re.Pattern[str], str, str, str]] = [
    (
        re.compile(r"^\s*def\s+\w"),
        "sintaxis",
        "En Woven no existe `def`. Declara funciones así: `function int nombre(...):`",
        "function int sumar(int a, int b):",
    ),
    (
        re.compile(r"^\s*fun\s+\w"),
        "sintaxis",
        "En Woven escribe `function`, no `fun`",
        "function int tejer(int n):",
    ),
    (
        re.compile(r"^\s*let\s+\w"),
        "sintaxis",
        "En Woven no existe `let`. Declara con tipo: `int x = 0`",
        "int x = 0",
    ),
    (
        re.compile(r"^\s*var\s+\w"),
        "sintaxis",
        "En Woven no existe `var`. Usa un tipo concreto: `int`, `string`, `bool`, …",
        "int contador = 0",
    ),
    (
        re.compile(r"^\s*const\s+\w"),
        "sintaxis",
        "En Woven no existe `const`. Usa `int`, `float`, etc.",
        "int maximo = 100",
    ),
    (
        re.compile(r"^\s*for\s+\w+\s+in\b"),
        "sintaxis",
        "En Woven el `for` es estilo C, no `for x in ...` como en Python",
        "for (int i = 0; i < n; i = i + 1):",
    ),
    (
        re.compile(r"^\s*if\s*\("),
        "sintaxis",
        "En Woven el `if` no lleva paréntesis alrededor de la condición",
        "if x > 1:",
    ),
    (
        re.compile(r"^\s*elif\b"),
        "sintaxis",
        "En Woven usa `else:` y otro `if`, no `elif`",
        "else:\n    if otra_condicion:",
    ),
    (
        re.compile(r"^\s*elseif\b"),
        "sintaxis",
        "En Woven usa `else:` seguido de un bloque con `if`",
        "else:\n    if otra_condicion:",
    ),
]

_TOKEN_ES_WOVEN = {
    "def", "fun", "let", "var", "const", "elif", "elseif", "pass", "elif",
}

_SYMBOL_A_TEXTO = {
    "LPAREN": "(",
    "RPAREN": ")",
    "LBRACK": "[",
    "RBRACK": "]",
    "LBRACE": "{",
    "RBRACE": "}",
    "COLON": ":",
    "SEMI": ";",
    "COMMA": ",",
    "ASSIGN": "=",
    "DOT": ".",
    "INDENT": "indentación",
    "DEDENT": "fin de bloque indentado",
}


def _ubicacion(line: int, column: int) -> str:
    return f"línea {line}:{column}"


_LINEA_RE = re.compile(r"línea (\d+):\d+")


def diagnosticos_desde_mensajes(errores: List[str]) -> List[dict[str, Any]]:
    """Convierte mensajes formateados (sintaxis/léxico/runtime) en diagnósticos."""
    out: List[dict[str, Any]] = []
    for err in errores:
        m = _LINEA_RE.search(err)
        if not m:
            continue
        linea = int(m.group(1))
        mensaje = err.split(" — ", 1)[1].split("\n")[0] if " — " in err else err
        out.append(
            {
                "nivel": "error",
                "linea": linea,
                "mensaje": mensaje,
                "texto": err,
            }
        )
    return out


def _texto_token(token: Any) -> str:
    if token is None:
        return "fin de línea"
    text = getattr(token, "text", None) or str(token)
    if text in ("<EOF>", None):
        return "fin del archivo"
    if text == "<missing>":
        return "nada (falta algo)"
    if text in ("INDENT", "DEDENT"):
        return f"`{_SYMBOL_A_TEXTO.get(text, text)}`"
    return f"`{text}`"


def _token_literal_display(parser: Parser, token_type: int) -> Optional[str]:
    if token_type < 0 or token_type >= len(parser.literalNames):
        return None
    literal = parser.literalNames[token_type]
    if literal and literal != "<INVALID>":
        if literal.startswith("'") and literal.endswith("'"):
            return f"`{literal[1:-1]}`"
        return literal
    sym = parser.symbolicNames[token_type]
    if sym in _SYMBOL_A_TEXTO:
        return f"`{_SYMBOL_A_TEXTO[sym]}`"
    if sym and sym != "<INVALID>":
        return f"`{sym.lower()}`"
    return None


def _interval_set_token_types(interval_set) -> List[int]:
    tipos: List[int] = []
    for interval in interval_set.intervals:
        for ttype in range(interval.start, interval.stop + 1):
            tipos.append(ttype)
    return tipos


def _lista_esperados(parser: Parser, e: Exception) -> List[str]:
    if not isinstance(e, InputMismatchException):
        return []
    out: List[str] = []
    seen = set()
    for ttype in _interval_set_token_types(e.getExpectedTokens()):
        label = _token_literal_display(parser, ttype)
        if label and label not in seen:
            seen.add(label)
            out.append(label)
    return out


def _regla_activa(parser: Parser) -> Optional[dict]:
    if not hasattr(parser, "getRuleInvocationStack"):
        return None
    for rule_name in reversed(parser.getRuleInvocationStack()):
        hint = _RULE_HINTS.get(rule_name)
        if hint:
            return {**hint, "regla": rule_name}
    return None


def _token_anterior(parser: Parser) -> Optional[str]:
    stream = parser.getTokenStream()
    if not stream:
        return None
    prev = stream.LT(-1)
    if prev and prev.type != Token.EOF:
        return prev.text
    return None


def _snippet_fuente(source: str, line: int, column: int) -> str:
    """Fragmento de código con cursor bajo la columna del error."""
    lineas = source.splitlines()
    if line < 1 or line > len(lineas):
        return ""
    texto = lineas[line - 1]
    ancho = max(len(str(line)), 2)
    base = f"{line:>{ancho}} │ {texto}"
    # ANTLR usa columna 0-based
    col = max(0, min(column, len(texto)))
    cursor = " " * (ancho + 3 + col) + "^"
    return f"{base}\n{cursor}"


def _ensamblar_mensaje(
    cuerpo: str,
    source: str,
    line: int,
    column: int,
    forma: Optional[str] = None,
    ejemplo: Optional[str] = None,
) -> str:
    partes = [cuerpo, "", _snippet_fuente(source, line, column)]
    muestra = ejemplo or forma
    if muestra:
        partes.extend(["", EJEMPLO_ETIQUETA, muestra])
    return "\n".join(partes)


def _mensaje_tras_palabra_clave(
    palabra: str,
    esperado: str,
    encontrado: str,
    ubic: str,
    tipo: str,
) -> str:
    return (
        f"Error de {tipo}: {ubic} — "
        f"después de `{palabra}` debe ir {esperado}, pero escribiste {encontrado}."
    )


def _intentar_tras_palabra_clave(
    parser: Parser,
    ubic: str,
    tipo: str,
    esperado: str,
    encontrado: str,
    token_esperado: Optional[str] = None,
) -> Optional[str]:
    prev = _token_anterior(parser)
    if not prev:
        return None

    for hint in _RULE_HINTS.values():
        kw = hint.get("palabra")
        if kw and prev == kw:
            esp = esperado
            if token_esperado == "(":
                esp = "`(`"
            elif token_esperado:
                esp = _SYMBOL_A_TEXTO.get(token_esperado, f"`{token_esperado}`")
            return _mensaje_tras_palabra_clave(kw, esp, encontrado, ubic, tipo)

    return None


def _espacios_iniciales(source: str, line: int) -> int:
    lineas = source.splitlines()
    if line < 1 or line > len(lineas):
        return 0
    n = 0
    for c in lineas[line - 1]:
        if c == " ":
            n += 1
        elif c == "\t":
            n += 4
        else:
            break
    return n


def _ultima_linea_significativa(
    source: str, before_line: int
) -> Optional[tuple[int, str]]:
    lineas = source.splitlines()
    for i in range(before_line - 2, -1, -1):
        cruda = lineas[i]
        limpia = cruda.strip()
        if not limpia or limpia.startswith("//"):
            continue
        return i + 1, limpia
    return None


def _mensaje_indentacion(
    source: str,
    line: int,
    offending_text: Optional[str],
    msg: str,
    ubic: str,
    tipo: str,
    regla: Optional[dict],
) -> Optional[tuple[str, Optional[str]]]:
    es_extraneous = "extraneous input" in msg
    es_indent = offending_text == "INDENT" or "INDENT" in msg
    es_dedent = offending_text == "DEDENT" or "DEDENT" in msg

    if es_indent:
        prev = _ultima_linea_significativa(source, line)
        espacios = _espacios_iniciales(source, line)

        if es_extraneous and prev and not prev[1].endswith(":"):
            prev_line, prev_text = prev
            return (
                f"Error de {tipo}: {ubic} — "
                f"hay {espacios} espacio(s) al inicio, pero no hay un bloque abierto: "
                f"la línea {prev_line} (`{prev_text}`) no termina en `:`. "
                "En el nivel principal el código empieza sin indentación.",
                "int x = 0   ← sin espacios al inicio",
            )

        if es_extraneous:
            return (
                f"Error de {tipo}: {ubic} — "
                f"indentación inesperada ({espacios} espacios). "
                "Revisa que la línea anterior termine en `:` si quieres abrir un bloque.",
                "    cuatro espacios solo dentro de if / for / while / function / class",
            )

        return (
            f"Error de {tipo}: {ubic} — "
            "esta línea debería estar indentada (4 espacios) porque pertenece al bloque "
            "del `:` anterior.",
            "    cuatro espacios antes del contenido del bloque",
        )

    if es_dedent:
        if es_extraneous:
            linea_indent_mala = line - 1
            for i in range(line - 1, 0, -1):
                if _espacios_iniciales(source, i) > 0:
                    linea_indent_mala = i
                    break
            return (
                f"Error de {tipo}: {ubic} — "
                f"esta línea volvió al margen izquierdo, pero la indentación en la "
                f"línea {linea_indent_mala} no abrió un bloque válido. "
                "Corrige primero esa indentación.",
                None,
            )

        return (
            f"Error de {tipo}: {ubic} — "
            "terminó un bloque indentado antes de lo esperado. "
            "Revisa que todas las líneas del bloque tengan la misma indentación.",
            "    cuatro espacios antes del contenido del bloque",
        )

    if regla and regla.get("regla") == "block":
        return (
            f"Error de {tipo}: {ubic} — "
            f"{regla['tras_palabra']}.",
            regla["forma"],
        )

    return None


def _mensaje_lexico(token_text: Optional[str], ubic: str) -> str:
    if token_text in _TOKEN_ES_WOVEN:
        return (
            f"Error de léxico: {ubic} — "
            f"`{token_text}` no es palabra clave de Woven. "
            "Revisa si copiaste sintaxis de Python, Java o C++."
        )
    if token_text and len(token_text) == 1 and ord(token_text) > 127:
        return (
            f"Error de léxico: {ubic} — "
            f"el carácter `{token_text}` no es válido en Woven. "
            "Usa comillas rectas \" y ' , no comillas tipográficas."
        )
    return (
        f"Error de léxico: {ubic} — "
        f"hay un símbolo que Woven no reconoce ({_texto_token_simple(token_text)}). "
        "Revisa mayúsculas, tildes o caracteres raros en esa posición."
    )


def _texto_token_simple(text: Optional[str]) -> str:
    if not text:
        return "fin de línea"
    return f"`{text}`"


def _parsear_missing(msg: str) -> tuple[Optional[str], Optional[str]]:
    m = re.match(r"missing '([^']+)' at '(.*)'", msg)
    if m:
        return m.group(1), m.group(2)
    m = re.match(r"missing \{([^}]+)\} at '(.*)'", msg)
    if m:
        inner = m.group(1).replace("'", "").split(",")[0].strip()
        return inner, m.group(2)
    return None, None


def _parsear_extraneous(msg: str) -> Optional[str]:
    m = re.search(r"extraneous input '([^']*)'", msg)
    return m.group(1) if m else None


def _parsear_mismatched(msg: str) -> tuple[Optional[str], Optional[str]]:
    m = re.search(r"mismatched input '([^']*)' expecting \{([^}]+)\}", msg)
    if m:
        return m.group(1), m.group(2)
    m = re.search(r"mismatched input '([^']*)' expecting '([^']+)'", msg)
    if m:
        return m.group(1), m.group(2)
    return None, None


def _cuerpo_error(
    recognizer,
    offendingSymbol,
    line: int,
    column: int,
    msg: str,
    e: Exception,
    source: str = "",
) -> tuple[str, Optional[str]]:
    """Devuelve (texto del error, forma esperada opcional)."""
    tipo = "léxico" if isinstance(recognizer, Lexer) else "sintaxis"
    ubic = _ubicacion(line, column)
    encontrado = _texto_token(offendingSymbol)
    offending_text = getattr(offendingSymbol, "text", None)

    if isinstance(recognizer, Lexer):
        return _mensaje_lexico(offending_text, ubic), None

    parser: Parser = recognizer
    regla = _regla_activa(parser)
    forma = regla["forma"] if regla else None
    esperados = _lista_esperados(parser, e)

    indent_result = _mensaje_indentacion(
        source, line, offending_text, msg, ubic, tipo, regla
    )
    if indent_result:
        cuerpo, forma_indent = indent_result
        return cuerpo, forma_indent or forma

    token_faltante, _en_msg = _parsear_missing(msg)
    if token_faltante:
        esperado_h = f"`{token_faltante}`"
        contextual = _intentar_tras_palabra_clave(
            parser, ubic, tipo, esperado_h, encontrado, token_faltante
        )
        if contextual:
            return contextual, forma

        if regla and regla.get("palabra"):
            return (
                f"Error de {tipo}: {ubic} — "
                f"{regla['tras_palabra']}, pero falta {esperado_h} y escribiste {encontrado}."
            ), forma
        return (
            f"Error de {tipo}: {ubic} — "
            f"falta {esperado_h} y en su lugar aparece {encontrado}."
        ), forma

    extra = _parsear_extraneous(msg)
    if extra is not None:
        if regla:
            return (
                f"Error de {tipo}: {ubic} — "
                f"sobra {encontrado} aquí. {regla['tras_palabra']}."
            ), forma
        return (
            f"Error de {tipo}: {ubic} — "
            f"sobra {encontrado}; el parser no esperaba ese token en este lugar."
        ), None

    mal, esperando = _parsear_mismatched(msg)
    if mal is not None:
        esp_txt = esperando.replace("'", "`").replace(", ", " o ") if esperando else ""
        if regla:
            return (
                f"Error de {tipo}: {ubic} — "
                f"escribiste {encontrado}, pero aquí se esperaba {esp_txt or 'otro token'}. "
                f"{regla['tras_palabra']}."
            ), forma
        return (
            f"Error de {tipo}: {ubic} — "
            f"escribiste {encontrado}, pero se esperaba {esp_txt or 'otro token'}."
        ), None

    if "no viable alternative" in msg:
        if regla:
            return (
                f"Error de {tipo}: {ubic} — "
                f"esta secuencia no encaja con la gramática de Woven cerca de {encontrado}. "
                f"{regla['tras_palabra']}."
            ), forma
        return (
            f"Error de {tipo}: {ubic} — "
            f"esta parte del código no encaja con ninguna construcción válida "
            f"(cerca de {encontrado})."
        ), None

    if esperados:
        lista = ", ".join(esperados[:4])
        if regla:
            return (
                f"Error de {tipo}: {ubic} — "
                f"encontré {encontrado}, pero aquí se esperaba uno de: {lista}. "
                f"{regla['tras_palabra']}."
            ), forma
        return (
            f"Error de {tipo}: {ubic} — "
            f"encontré {encontrado}, pero se esperaba uno de: {lista}."
        ), None

    if regla:
        return (
            f"Error de {tipo}: {ubic} — "
            f"{regla['tras_palabra']}. Revisa cerca de {encontrado}."
        ), forma

    return f"Error de {tipo}: {ubic} — {msg}", None


def formatear_error_pedagogico(
    recognizer,
    offendingSymbol,
    line: int,
    column: int,
    msg: str,
    e: Exception,
    source: str = "",
) -> str:
    cuerpo, forma = _cuerpo_error(
        recognizer, offendingSymbol, line, column, msg, e, source
    )
    if source:
        return _ensamblar_mensaje(cuerpo, source, line, column, forma)
    if forma:
        return f"{cuerpo}\n\n{EJEMPLO_ETIQUETA}\n{forma}"
    return cuerpo


def detectar_anti_patrones(source: str) -> List[str]:
    """Detecta sintaxis de otros lenguajes antes del parseo."""
    errores: List[str] = []
    for num_linea, linea in enumerate(source.splitlines(), start=1):
        for patron, tipo, explicacion, forma in _ANTI_PATRONES:
            if not patron.search(linea):
                continue
            col = patron.search(linea).start()  # type: ignore[union-attr]
            cuerpo = f"Error de {tipo}: {_ubicacion(num_linea, col)} — {explicacion}"
            errores.append(_ensamblar_mensaje(cuerpo, source, num_linea, col, forma))
            break
    return errores


def filtrar_errores_cascada(errores: List[str]) -> List[str]:
    """Un error principal por línea; evita inundar al estudiante."""
    vistos: set[str] = set()
    filtrados: List[str] = []
    for err in errores:
        m = re.search(r"línea (\d+):", err)
        clave = m.group(1) if m else err
        if clave in vistos:
            continue
        vistos.add(clave)
        filtrados.append(err)

    if not filtrados:
        return errores[:1]

    # DEDENT en cascada tras indentación inválida en nivel principal
    hay_indent_invalida = any(
        "no hay un bloque abierto" in e or "no abrió un bloque válido" in e
        for e in filtrados
    )
    if hay_indent_invalida:
        filtrados = [
            e
            for e in filtrados
            if "volvió al margen izquierdo" not in e
        ] or filtrados[:1]

    # Fase D: un error principal (el primero por línea)
    if len(filtrados) > 1:
        return filtrados[:1]

    return filtrados


class PedagogicalErrorListener(ErrorListener):
    """Recoge errores con mensajes pedagógicos en español."""

    def __init__(self, source: str = "") -> None:
        self.source = source
        self.errors: List[str] = []

    def syntaxError(self, recognizer, offendingSymbol, line, column, msg, e) -> None:
        self.errors.append(
            formatear_error_pedagogico(
                recognizer,
                offendingSymbol,
                line,
                column,
                msg,
                e,
                self.source,
            )
        )
