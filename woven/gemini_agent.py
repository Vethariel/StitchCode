import json
import re

SYSTEM_PROMPT = """
Eres Hilo, tutor de programación de Stitch Code, una plataforma educativa
para estudiantes universitarios que aprenden a programar por primera vez.

OBJETIVO
Tu meta no es dar respuestas sino guiar al estudiante a descubrirlas.
Usa siempre el contexto del programa que el estudiante tiene abierto.
Sé específico: menciona líneas, variables y valores reales del código del estudiante.
Responde siempre en español.

FORMATO DE RESPUESTA (obligatorio)
Debes responder ÚNICAMENTE con un objeto JSON válido (sin markdown ni texto fuera del JSON):
{
  "chunks": [
    {"text": "Una frase corta y clara.", "emotion": "wink"},
    {"text": "Otra frase sencilla.", "emotion": "neutral"}
  ]
}

Reglas del JSON:
- chunks: entre 2 y 6 frases, en orden conversacional natural.
- text: una sola idea por fragmento; máximo 120 caracteres; sin listas largas ni párrafos.
- emotion: exactamente uno de estos valores:
  happy, smile, kiss, heart_eyes, grin, tongue, sleep, cool, laugh, wink,
  neutral, expressionless, cry, sad, worried, angry
- El estudiante verá un fragmento a la vez; escribe como diálogo oral.

NIVELES DE AYUDA
Cada problema tiene un nivel que avanza si el estudiante sigue atascado.
El nivel se reinicia cuando cambia el problema.

Nivel 1 — Orientación: haz una pregunta que dirija la atención hacia
la zona del problema sin nombrarlo directamente.

Nivel 2 — Pista: menciona la línea, el tipo de construcción
o el concepto involucrado, sin decir qué está mal.

Nivel 3 — Explicación: explica qué está mal y por qué,
sin escribir código corregido.

Nivel 4 — Solución guiada: muestra el código corregido en Woven
con explicación detallada de cada cambio. Solo llega aquí si el
estudiante lleva más de 3 intentos en el mismo problema.

ESTILO PEDAGÓGICO
- Valida el esfuerzo antes de corregir.
- Usa analogías del mundo real antes de términos técnicos.
- Nunca entregues código corregido en niveles 1, 2 o 3.
- Si el estudiante pide directamente la solución, responde con
  una pregunta que lo lleve un paso más cerca.
- Cuando el programa corre bien, celebra brevemente y sugiere
  qué explorar a continuación dentro del mismo concepto.

CONTEXTO DISPONIBLE
Recibirás al inicio de cada turno el estado del programa y el MODO DE VISTA
(texto = código Woven, bloques = editor visual, verboso = bloques en lenguaje
natural). Úsalo siempre: no hables de "líneas de código" si el estudiante está
en bloques; referencia L1, L2… y el nombre del bloque.

PARÁMETROS DE PERFIL (obligatorios en cada turno)
Recibirás tres parámetros del estudiante definidos en el onboarding:
tono (cómo debe hablar Hilo), estilo (cómo explicar) y objetivos
(qué quiere lograr). Adapta el vocabulario, la longitud y el enfoque
de cada fragmento a esos tres valores; no los ignores.

LENGUAJE WOVEN — REFERENCIA COMPLETA

Woven es el lenguaje de programación de Stitch Code. No es Python, Java ni C++.
Es un lenguaje propio con sintaxis de convergencia. Cuando el estudiante escriba
código, siempre debe ser en Woven. Nunca sugieras sintaxis de otro lenguaje.

TIPOS PRIMITIVOS:
  int x = 5
  float y = 3.14
  string s = "hola"
  bool b = true

ASIGNACIÓN (requiere declaración previa con tipo):
  int x = 5
  x = x + 1

CONDICIONAL:
  if x > 1:
      print("mayor")
  else:
      print("menor")

CICLO FOR (estilo C):
  for (int i = 0; i < 5; i = i + 1):
      print(i)

CICLO WHILE:
  while (x > 0):
      x = x - 1

FUNCIÓN:
  function int sumar(int a, int b):
      return a + b

FUNCIÓN SIN RETORNO:
  function void saludar(string nombre):
      print("Hola {nombre}")

LLAMADA A FUNCIÓN:
  int resultado = sumar(3, 4)

CLASE:
  class Animal:
      string nombre
      int edad

      init(string nombre, int edad):
          self.nombre = nombre
          self.edad = edad

      virtual function string describir():
          return "Soy {self.nombre}"

HERENCIA:
  class Perro extends Animal:
      init(string nombre, int edad):
          super(nombre, edad)

      virtual function string describir():
          return "Soy un perro llamado {self.nombre}"

CREAR OBJETO (new obligatorio):
  Animal a = new Animal("Rex", 3)

LISTA:
  list<int> numeros = [1, 2, 3]
  numeros.append(4)
  numeros.remove(0)
  int n = numeros.length
  int x = numeros[0]
  numeros[0] = 99

LISTA DE OBJETOS:
  list<Animal> animales = []
  animales.append(new Animal("Rex", 3))
  animales[0].describir()

OPERADORES LÓGICOS:
  if a > 0 and b > 0:
  if a == 0 or b == 0:
  if !activo:

STRING INTERPOLADO:
  print("El valor es {x}")
  print("Hola {self.nombre}")

PRINT:
  print(x)
  print("mensaje")
  print("valor: {x}")

COMENTARIOS:
  // comentario de línea
  # también válido
  /* bloque */

ERRORES COMUNES A DETECTAR:
  - Usar variable sin declararla con tipo primero
  - Olvidar new al crear un objeto
  - Usar def en lugar de function
  - Usar var o let en lugar del tipo explícito
  - Usar === en lugar de ==
  - Mezclar sintaxis de Python, Java o C++ con Woven

MODO DE VISTA DEL ESTUDIANTE

El contexto incluye el campo MODO DE VISTA que puede ser "woven" o "verboso".

Si MODO DE VISTA es "woven":
- El estudiante ve y escribe código Woven directamente
- Puedes usar sintaxis Woven en tus respuestas
- Señala errores por número de línea
- Sugiere correcciones mostrando sintaxis Woven

Si MODO DE VISTA es "verboso":
- El estudiante está trabajando con bloques en lenguaje natural
- Nunca uses sintaxis de código en tus respuestas
- Refiere los bloques por su texto visible entre comillas:
  "el bloque que dice guardar el valor..."
  "el bloque que dice repetir mientras..."
  "el bloque que dice para crear un objeto..."
- Cuando sugieras un cambio describe qué parte del bloque
  modificar y qué valor poner, sin escribir código nunca
- Usa exclusivamente analogías y lenguaje natural
- Asume que el estudiante no conoce ningún lenguaje de programación
- En este modo los niveles de ayuda usan lenguaje más simple:
  Nivel 1: pregunta sobre el comportamiento esperado del bloque
  Nivel 2: señala en qué bloque está el problema por su texto
  Nivel 3: explica qué hace el bloque mal sin mencionar código
  Nivel 4: describe paso a paso cómo cambiar el placeholder
"""

EXPLANATION_PROMPT = """
PODER: EXPLICACIÓN (modo foco)
El estudiante pidió entender lo que tiene en pantalla.
Responde con type: "explanation" y entre 2 y 6 chunks.

Cada chunk DEBE incluir:
- text, emotion (igual que en conversación)
- panel: según MODO DE VISTA del contexto:
  · modo "texto" → "editor" (líneas del código Woven)
  · modo "bloques" o "verboso" → "blocks" (líneas L1, L2… del programa en bloques)
  · salida de ejecución → "console"
- highlight: { "line": N } — N es la línea en ese panel (1 = primera)

Reglas de la explicación:
- Respeta el MODO DE VISTA: en bloques/verboso habla de bloques y usa panel "blocks";
  en texto habla del código y usa panel "editor". No mezcles sin avisar.
- Una idea por fragmento; el highlight debe corresponder a lo que dices.
- Usa numeración real del contexto (no inventes líneas).
- Si la consola está vacía, no uses panel "console".
- En verboso, usa lenguaje natural del bloque, no sintaxis Woven salvo que ayude.

Ejemplo (modo bloques):
{
  "type": "explanation",
  "chunks": [
    {"text": "El bloque L1 declara x.", "emotion": "smile", "panel": "blocks", "highlight": {"line": 1}},
    {"text": "L2 muestra el valor en consola.", "emotion": "wink", "panel": "console", "highlight": {"line": 1}}
  ]
}
"""

EXPLANATION_LEARNING_PROMPT = """
PODER: EXPLICACIÓN DE APRENDIZAJE (modo foco — un solo hilo narrativo)
El estudiante aprende un concepto de programación con un ejemplo Woven en pantalla
y traducciones equivalentes en Python, Java y C++ en el panel lateral.

Responde con UN solo JSON type: "explanation" y entre 7 y 14 chunks, en este orden:

1) Presenta el concepto en una frase clara (panel "editor" o "blocks").
2) Recorre el ejemplo Woven COMPLETO: explica TODAS las líneas del programa en el contexto,
   en orden, sin saltarte ninguna línea significativa (varios chunks en editor/blocks;
   highlight.line = número de línea real que comentas).
3) DESPUÉS de terminar el código, explica la SALIDA DE CONSOLA del contexto:
   si hay output, usa obligatoriamente panel "console" y comenta cada línea de salida
   (qué imprimió, qué demuestra, relación con el concepto). No pases a lenguajes sin
   explicar la consola cuando exista salida.
4) Enlaza con Python, Java y C++ (paneles "python", "java", "cpp") usando las traducciones.
5) Cierra con diferencias prácticas entre los tres lenguajes.

Cada chunk DEBE incluir: text, emotion, panel, highlight: { "line": N }.

Paneles válidos: "editor", "blocks", "console", "python", "java", "cpp"
- Código Woven → "editor" (modo texto) o "blocks" (modo bloques/verboso).
- Salida de ejecución → "console" (solo después de haber explicado el código).
- Python / Java / C++ → panel que nombres en el fragmento.
- No resumas el programa en un solo chunk: el estudiante debe entender cada parte del ejemplo.
- **negritas** para términos clave.
- Usa las TRADUCCIONES del contexto (no inventes código en otros lenguajes).
"""

REDACTION_PROMPT = """
PODER: REDACCIÓN
Genera un programa Woven en texto plano según el pedido del estudiante.

Responde SOLO con JSON válido:
{
  "type": "redaccion",
  "codigo": "programa Woven completo",
  "objetivo": "ejemplo_correcto",
  "resumen": "frase breve del concepto que ilustra"
}

Campo objetivo (obligatorio):
- "ejemplo_correcto": código que compila, ejecuta y demuestra bien el concepto (modo aprendizaje habitual).
- "ejemplo_para_corregir": incluye errores deliberados y pedagógicos para que el estudiante practique corrección.

Reglas del código:
- Solo sintaxis Woven del SYSTEM_PROMPT (nunca Python, Java ni C++).
- Programa corto, claro, acorde al perfil del estudiante.
- Sin markdown ni texto fuera del JSON; codigo es texto plano con saltos de línea.
- Debe ser ejecutable: evita errores de sintaxis y de tipos.
"""

OBJETIVOS_REDACCION_VALIDOS = frozenset({"ejemplo_correcto", "ejemplo_para_corregir"})


def construir_contexto(
    codigo: str,
    output: list,
    errores: list,
    tiene_error: bool,
    modo: str,
    bloques_resumen: str = "",
) -> str:
    modo_norm = (modo or "texto").strip().lower()
    partes = [
        "MODO DE VISTA DEL ESTUDIANTE: "
        f"{modo_norm} — el estudiante está editando en este modo ahora mismo. "
        "Adapta vocabulario, referencias (líneas de código vs líneas L1, L2 de bloques) "
        "y el panel de explicación según este modo."
    ]

    if modo_norm in ("bloques", "verboso") and (bloques_resumen or "").strip():
        partes.append(
            "PROGRAMA EN BLOQUES (numeración visible en pantalla):\n"
            f"```\n{bloques_resumen.strip()}\n```"
        )
        partes.append(
            "CÓDIGO WOVEN EQUIVALENTE (sincronizado con los bloques):\n"
            f"```\n{codigo}\n```"
        )
    else:
        partes.append(f"CÓDIGO WOVEN ACTUAL:\n```\n{codigo}\n```")

    if tiene_error:
        partes.append(f"ERRORES:\n" + "\n".join(errores))
    elif output:
        partes.append(f"OUTPUT:\n" + "\n".join(output))
    else:
        partes.append("El programa no ha sido ejecutado aún.")

    return "\n\n".join(partes)


PERFIL_CAMPOS = ("tono", "estilo", "objetivos")
DEFAULTS_PERFIL = {
    "tono": "amigable y cercano",
    "estilo": "explicaciones claras paso a paso",
    "objetivos": "aprender a programar en Woven con buenas prácticas",
}


def normalizar_perfil(perfil: dict) -> dict:
    """Parámetros de onboarding/Ajustes que Gemini debe recibir en cada turno."""
    base = perfil if isinstance(perfil, dict) else {}
    out = {}
    for key in PERFIL_CAMPOS:
        val = str(base.get(key) or "").strip()
        out[key] = val or DEFAULTS_PERFIL[key]
    return out


def construir_preferencias_estudiante(perfil_json: str) -> str:
    try:
        perfil = json.loads(perfil_json) if perfil_json else {}
    except json.JSONDecodeError:
        perfil = {}

    p = normalizar_perfil(perfil)

    return (
        "PARÁMETROS DE PERFIL DEL ESTUDIANTE (obligatorios; respétalos en cada fragmento):\n"
        f"- tono: {p['tono']}\n"
        f"- estilo: {p['estilo']}\n"
        f"- objetivos: {p['objetivos']}"
    )


def _es_modo_explicacion(tipo_interaccion: str) -> bool:
    t = (tipo_interaccion or "").strip().lower()
    return t in ("explicacion", "explanation", "explain")


def _es_modo_explicacion_aprendizaje(tipo_interaccion: str) -> bool:
    return (tipo_interaccion or "").strip().lower() in (
        "explicacion_aprendizaje",
        "aprendizaje_explicacion",
    )


def _resaltar_consola_aprendizaje(contexto: str, output: list) -> str:
    if not output:
        return (
            contexto
            + "\n\nCONSOLA: el programa no produjo salida; no uses panel \"console\"."
        )
    lineas = "\n".join(f"  L{i}: {linea}" for i, linea in enumerate(output, 1))
    return (
        contexto
        + f"\n\nCONSOLA ({len(output)} línea(s) — explicar DESPUÉS del código completo, "
        f'panel "console", una idea por línea de salida):\n{lineas}'
    )


def _anexar_traducciones_contexto(contexto: str, traducciones_json: str) -> str:
    try:
        tr = json.loads(traducciones_json) if traducciones_json else {}
    except json.JSONDecodeError:
        tr = {}
    if not isinstance(tr, dict) or not any(tr.get(k) for k in ("python", "java", "cpp")):
        return contexto
    bloques = ["TRADUCCIONES (panel lateral — usa estas líneas para highlight):"]
    for lang in ("python", "java", "cpp"):
        codigo = str(tr.get(lang) or "").strip()
        if codigo:
            bloques.append(f"\n{lang.upper()}:\n```\n{codigo}\n```")
    return contexto + "\n\n" + "\n".join(bloques)


def construir_payload_redaccion(
    mensaje: str,
    codigo: str,
    modo: str,
    perfil_json: str = "{}",
    objetivo_redaccion: str = "ejemplo_correcto",
    bloques_resumen: str = "",
) -> str:
    objetivo = (objetivo_redaccion or "ejemplo_correcto").strip().lower()
    if objetivo not in OBJETIVOS_REDACCION_VALIDOS:
        objetivo = "ejemplo_correcto"

    contexto = construir_contexto(
        codigo, [], [], False, modo, bloques_resumen
    )
    preferencias = construir_preferencias_estudiante(perfil_json)

    system_completo = (
        SYSTEM_PROMPT
        + f"\n\n{REDACTION_PROMPT}"
        + f"\n\n{preferencias}"
        + f"\n\nCONTEXTO (referencia; genera un programa nuevo, no copies sin motivo):\n{contexto}"
        + f"\n\nOBJETIVO DE REDACCIÓN PARA ESTE TURNO: {objetivo}"
        + "\n\nTURNO ACTUAL: el estudiante pidió material para aprender un concepto. "
        'Responde solo con JSON type "redaccion".'
    )

    payload = {
        "system_instruction": {"parts": [{"text": system_completo}]},
        "contents": [{"role": "user", "parts": [{"text": mensaje}]}],
        "generationConfig": {
            "temperature": 0.5,
            "maxOutputTokens": 2048,
            "responseMimeType": "application/json",
        },
    }
    return json.dumps(payload, ensure_ascii=False)


def normalizar_respuesta_redaccion(texto_modelo: str) -> dict:
    crudo = _limpiar_json_crudo(texto_modelo)
    try:
        data = json.loads(crudo)
        if isinstance(data, dict):
            codigo = str(data.get("codigo", "")).strip()
            objetivo = str(data.get("objetivo", "ejemplo_correcto")).strip().lower()
            if objetivo not in OBJETIVOS_REDACCION_VALIDOS:
                objetivo = "ejemplo_correcto"
            resumen = str(data.get("resumen", "")).strip()[:200]
            if codigo:
                return {
                    "type": "redaccion",
                    "codigo": codigo,
                    "objetivo": objetivo,
                    "resumen": resumen,
                }
    except json.JSONDecodeError:
        pass

    if crudo:
        return {
            "type": "redaccion",
            "codigo": crudo.strip(),
            "objetivo": "ejemplo_correcto",
            "resumen": "",
        }
    raise ValueError("La redacción no incluyó código Woven.")


def parsear_respuesta_redaccion(response_json: str) -> str:
    data = json.loads(response_json)
    raw = data["candidates"][0]["content"]["parts"][0]["text"]
    return json.dumps(normalizar_respuesta_redaccion(raw), ensure_ascii=False)


def hilo_redactar(
    mensaje,
    codigo,
    modo,
    perfil_json="{}",
    objetivo_redaccion="ejemplo_correcto",
    bloques_resumen="",
):
    """Prepara payload Gemini para el poder Redacción (fase 1 de Aprendizaje)."""
    try:
        payload = construir_payload_redaccion(
            mensaje,
            codigo,
            modo,
            perfil_json,
            objetivo_redaccion,
            bloques_resumen,
        )
        return json.dumps({"ok": True, "payload": payload})
    except Exception as e:
        return json.dumps({"ok": False, "error": str(e)})


def construir_payload_hilo(
    mensaje: str,
    historial_json: str,
    codigo: str,
    output_json: str,
    errores_json: str,
    tiene_error: bool,
    modo: str,
    nivel_ayuda: int = 1,
    perfil_json: str = "{}",
    tipo_interaccion: str = "conversacion",
    bloques_resumen: str = "",
    traducciones_json: str = "{}",
) -> str:
    historial = json.loads(historial_json)
    output = json.loads(output_json)
    errores = json.loads(errores_json)

    contexto = construir_contexto(
        codigo, output, errores, tiene_error, modo, bloques_resumen
    )
    if _es_modo_explicacion_aprendizaje(tipo_interaccion):
        contexto = _anexar_traducciones_contexto(contexto, traducciones_json)
        contexto = _resaltar_consola_aprendizaje(contexto, output)

    if not tiene_error:
        nivel_instruccion = (
            "El estudiante está explorando o aprendiendo, no tiene un error activo. "
            "Tu rol es explicar y guiar la comprensión. No asumas que hay un problema "
            "que resolver. No avances niveles. No muestres código corregido a menos "
            "que el estudiante pida explícitamente una alternativa."
        )
    else:
        nivel_instruccion = {
            1: "Estás en Nivel 1. Responde solo con una pregunta orientadora.",
            2: "Estás en Nivel 2. Da una pista concreta sin revelar el problema.",
            3: "Estás en Nivel 3. Explica qué está mal y por qué, sin código.",
            4: "Estás en Nivel 4. Muestra la corrección en Woven con explicación.",
        }.get(nivel_ayuda, "")

    preferencias = construir_preferencias_estudiante(perfil_json)
    modo_aprendizaje = _es_modo_explicacion_aprendizaje(tipo_interaccion)
    modo_explicacion = _es_modo_explicacion(tipo_interaccion) or modo_aprendizaje

    explicacion_extra = ""
    if modo_aprendizaje:
        explicacion_extra = EXPLANATION_LEARNING_PROMPT
    elif modo_explicacion:
        explicacion_extra = EXPLANATION_PROMPT

    system_completo = (
        SYSTEM_PROMPT
        + (f"\n\n{explicacion_extra}" if explicacion_extra else "")
        + f"\n\n{preferencias}"
        + f"\n\nCONTEXTO DEL PROGRAMA:\n{contexto}"
        + ("" if modo_explicacion else f"\n\nNIVEL ACTUAL: {nivel_instruccion}")
    )
    if modo_aprendizaje:
        system_completo += (
            "\n\nTURNO ACTUAL: EXPLICACIÓN DE APRENDIZAJE integrada (Woven + lenguajes). "
            'Un solo JSON type "explanation" con todos los chunks en orden.'
        )
    elif modo_explicacion:
        system_completo += (
            "\n\nTURNO ACTUAL: el estudiante pidió una EXPLICACIÓN. "
            'Responde solo con JSON type "explanation".'
        )

    mensajes = []
    for h in historial:
        mensajes.append({
            "role": h["role"],
            "parts": [{"text": h["content"]}]
        })
    mensajes.append({
        "role": "user",
        "parts": [{"text": mensaje}]
    })

    max_tokens = 3072 if modo_aprendizaje else 1024
    payload = {
        "system_instruction": {"parts": [{"text": system_completo}]},
        "contents": mensajes,
        "generationConfig": {
            "temperature": 0.7,
            "maxOutputTokens": max_tokens,
            "responseMimeType": "application/json",
        }
    }

    return json.dumps(payload, ensure_ascii=False)


EMOCIONES_VALIDAS = {
    "happy", "smile", "kiss", "heart_eyes", "grin", "tongue", "sleep", "cool",
    "laugh", "wink", "neutral", "expressionless", "cry", "sad", "worried", "angry",
}
PANELES_VALIDOS = frozenset({"editor", "blocks", "console", "python", "java", "cpp"})
PANELES_TRADUCCION = frozenset({"python", "java", "cpp"})


def _normalizar_highlight(panel: str, highlight: object, max_line: int = 999) -> dict:
    hl = highlight if isinstance(highlight, dict) else {}
    try:
        line = int(hl.get("line") or 1)
    except (TypeError, ValueError):
        line = 1
    line = max(1, min(line, max_line))
    out = {"line": line}
    if panel == "editor":
        for key in ("start", "end"):
            if key in hl:
                try:
                    out[key] = max(0, int(hl[key]))
                except (TypeError, ValueError):
                    pass
    return out


def _contar_lineas_bloques(bloques_resumen: str) -> int:
    import re

    count = len(re.findall(r"(?m)^L\d+\s*·", bloques_resumen or ""))
    return max(count, 1)


def _lineas_traduccion(traducciones: dict, lang: str) -> int:
    texto = str(traducciones.get(lang) or "")
    return max(1, len(texto.split("\n")) if texto else 1)


def _normalizar_chunk(
    item: dict,
    tipo: str,
    codigo_lineas: int,
    consola_lineas: int,
    bloques_lineas: int,
    modo_vista: str,
    traducciones: dict | None = None,
) -> dict | None:
    text = str(item.get("text", "")).strip()
    if not text:
        return None
    emo = str(item.get("emotion", "neutral")).strip().lower()
    if emo not in EMOCIONES_VALIDAS:
        emo = "neutral"
    limite = 400 if tipo == "explanation" else 120
    chunk = {"text": text[:limite], "emotion": emo}
    if tipo != "explanation":
        return chunk

    panel = str(item.get("panel", "editor")).strip().lower()
    traducciones = traducciones if isinstance(traducciones, dict) else {}
    if panel not in PANELES_VALIDOS:
        panel = "editor"
    if panel in PANELES_TRADUCCION:
        max_line = _lineas_traduccion(traducciones, panel)
    elif modo_vista in ("bloques", "verboso") and panel == "editor":
        panel = "blocks"
        max_line = bloques_lineas
    elif modo_vista == "texto" and panel == "blocks":
        panel = "editor"
        max_line = codigo_lineas
    elif panel == "console" and consola_lineas < 1:
        panel = "blocks" if modo_vista in ("bloques", "verboso") else "editor"
        max_line = bloques_lineas if panel == "blocks" else codigo_lineas
    elif panel == "blocks":
        max_line = bloques_lineas
    elif panel == "console":
        max_line = max(consola_lineas, 1)
    else:
        max_line = codigo_lineas
    chunk["panel"] = panel
    chunk["highlight"] = _normalizar_highlight(panel, item.get("highlight"), max_line)
    return chunk


def _limpiar_json_crudo(texto: str) -> str:
    t = texto.strip()
    if t.startswith("```"):
        t = t.split("\n", 1)[-1]
        if t.endswith("```"):
            t = t.rsplit("```", 1)[0]
    return t.strip()


def _decodificar_string_json(s: str) -> str:
    try:
        return json.loads(f'"{s}"')
    except json.JSONDecodeError:
        return s.replace("\\n", "\n").replace('\\"', '"').replace("\\\\", "\\")


def _extraer_chunks_de_json_roto(crudo: str) -> list | None:
    """Recupera fragmentos cuando Gemini devuelve JSON truncado o mal cerrado."""
    if '"chunks"' not in crudo and '"text"' not in crudo:
        return None

    tipo = "explanation" if re.search(
        r'"type"\s*:\s*"(?:explanation|explicacion)"', crudo
    ) else "conversation"

    items = []
    patron = re.compile(
        r'\{\s*"text"\s*:\s*"((?:\\.|[^"\\])*)"\s*,\s*"emotion"\s*:\s*"([^"]*)"'
        r'(?:\s*,\s*"panel"\s*:\s*"([^"]*)")?'
        r'(?:\s*,\s*"highlight"\s*:\s*\{\s*"line"\s*:\s*(\d+)\s*\})?',
        re.DOTALL,
    )
    for m in patron.finditer(crudo):
        text = _decodificar_string_json(m.group(1)).strip()
        if len(text) < 2 or text in ("{", "}", "[", "]"):
            continue
        item = {
            "text": text,
            "emotion": m.group(2) or "neutral",
        }
        if m.group(3):
            item["panel"] = m.group(3).strip().lower()
        if m.group(4):
            item["highlight"] = {"line": int(m.group(4))}
        items.append(item)

    if items:
        return items

    solo_texto = []
    for m in re.finditer(r'"text"\s*:\s*"((?:\\.|[^"\\])*)"', crudo):
        text = _decodificar_string_json(m.group(1)).strip()
        if len(text) >= 2 and text not in ("{", "}", "[", "]"):
            solo_texto.append({"text": text, "emotion": "neutral"})

    return solo_texto if solo_texto else None


def _es_fragmento_json_basura(texto: str) -> bool:
    t = texto.strip()
    if len(t) < 2:
        return True
    if t in ("{", "}", "[", "]", ":", ",", '"'):
        return True
    if re.match(r'^[\s\{\}\[\]",:]+$', t):
        return True
    if t.startswith('"type"') or t.startswith('"chunks"'):
        return True
    return False


def _fallback_chunks(texto: str) -> list:
    recuperados = _extraer_chunks_de_json_roto(texto)
    if recuperados:
        return recuperados[:14]

    partes = re.split(r"(?<=[.!?…])\s+|\n+", texto.strip())
    chunks = []
    for p in partes:
        p = p.strip()
        if not p or _es_fragmento_json_basura(p):
            continue
        if len(p) > 280:
            sub = re.split(r"(?<=[,;])\s+", p)
            for s in sub:
                s = s.strip()
                if s and not _es_fragmento_json_basura(s):
                    chunks.append({"text": s[:400], "emotion": "neutral"})
        else:
            chunks.append({"text": p[:400], "emotion": "neutral"})
    if not chunks:
        limpio = re.sub(r'[\{\}\[\]"]', " ", texto)
        limpio = re.sub(
            r"\b(type|chunks|explanation|explicacion|emotion|panel|highlight)\b",
            " ",
            limpio,
            flags=re.I,
        )
        limpio = re.sub(r"\s+", " ", limpio).strip()
        if len(limpio) >= 12 and not _es_fragmento_json_basura(limpio):
            chunks = [{"text": limpio[:400], "emotion": "neutral"}]
        else:
            chunks = [
                {
                    "text": "No pude leer bien mi respuesta. Intenta de nuevo.",
                    "emotion": "worried",
                }
            ]
    elif _es_fragmento_json_basura(chunks[0].get("text", "")):
        chunks = [
            {
                "text": "No pude leer bien mi respuesta. Intenta de nuevo.",
                "emotion": "worried",
            }
        ]
    return chunks[:14]


def normalizar_respuesta_hilo(
    texto_modelo: str,
    codigo: str = "",
    output_json: str = "[]",
    bloques_resumen: str = "",
    modo_vista: str = "texto",
    traducciones_json: str = "{}",
) -> dict:
    crudo = _limpiar_json_crudo(texto_modelo)
    codigo_lineas = max(1, len((codigo or "").split("\n")))
    try:
        output = json.loads(output_json) if output_json else []
    except json.JSONDecodeError:
        output = []
    consola_lineas = len(output) if isinstance(output, list) else 0
    modo_norm = (modo_vista or "texto").strip().lower()
    bloques_lineas = _contar_lineas_bloques(bloques_resumen)
    try:
        traducciones = json.loads(traducciones_json) if traducciones_json else {}
    except json.JSONDecodeError:
        traducciones = {}
    if not isinstance(traducciones, dict):
        traducciones = {}

    chunks = None
    tipo = "conversation"
    try:
        data = json.loads(crudo)
        if isinstance(data, dict) and isinstance(data.get("chunks"), list):
            raw_type = str(data.get("type", "conversation")).strip().lower()
            if raw_type in ("explanation", "explicacion"):
                tipo = "explanation"
            chunks = []
            for item in data["chunks"]:
                if not isinstance(item, dict):
                    continue
                norm = _normalizar_chunk(
                    item,
                    tipo,
                    codigo_lineas,
                    consola_lineas,
                    bloques_lineas,
                    modo_norm,
                    traducciones,
                )
                if norm:
                    chunks.append(norm)
    except json.JSONDecodeError:
        chunks = None

    if not chunks:
        chunks = _fallback_chunks(crudo or texto_modelo)
        if re.search(r'"type"\s*:\s*"(?:explanation|explicacion)"', crudo or ""):
            tipo = "explanation"
        else:
            tipo = "conversation"

    if len(chunks) == 1:
        extra = _fallback_chunks(texto_modelo)
        if len(extra) > 1:
            chunks = extra

    if tipo == "explanation":
        default_panel = "blocks" if modo_norm in ("bloques", "verboso") else "editor"
        default_max = bloques_lineas if default_panel == "blocks" else codigo_lineas
        for ch in chunks:
            if "panel" not in ch:
                ch["panel"] = default_panel
            if "highlight" not in ch:
                ch["highlight"] = {"line": 1}

    texto_completo = " ".join(c["text"] for c in chunks)
    return {"type": tipo, "chunks": chunks, "texto_completo": texto_completo}


def parsear_respuesta_hilo(
    response_json: str,
    codigo: str = "",
    output_json: str = "[]",
    bloques_resumen: str = "",
    modo_vista: str = "texto",
    traducciones_json: str = "{}",
) -> str:
    data = json.loads(response_json)
    raw = data["candidates"][0]["content"]["parts"][0]["text"]
    return json.dumps(
        normalizar_respuesta_hilo(
            raw,
            codigo=codigo,
            output_json=output_json,
            bloques_resumen=bloques_resumen,
            modo_vista=modo_vista,
            traducciones_json=traducciones_json,
        ),
        ensure_ascii=False,
    )


def hilo_chat(
    mensaje,
    historial_json,
    codigo,
    output_json,
    errores_json,
    tiene_error,
    modo,
    nivel_ayuda,
    perfil_json="{}",
    tipo_interaccion="conversacion",
    bloques_resumen="",
    traducciones_json="{}",
):
    """
    Prepara el payload de Gemini. perfil_json: tono, estilo, objetivos.
    tipo_interaccion: "conversacion" | "explicacion" | "explicacion_aprendizaje".
    bloques_resumen: programa L1… cuando modo es bloques o verboso.
    traducciones_json: {python, java, cpp} para explicación de aprendizaje.
    """
    try:
        payload = construir_payload_hilo(
            mensaje,
            historial_json,
            codigo,
            output_json,
            errores_json,
            tiene_error,
            modo,
            nivel_ayuda,
            perfil_json,
            tipo_interaccion,
            bloques_resumen,
            traducciones_json,
        )
        return json.dumps({
            "ok": True,
            "payload": payload
        })
    except Exception as e:
        return json.dumps({"ok": False, "error": str(e)})
