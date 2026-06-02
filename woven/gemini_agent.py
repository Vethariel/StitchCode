import json

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
- El estudiante verá un fragmento a la vez y avanzará con clic; escribe como diálogo oral.

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
Recibirás al inicio de cada conversación el estado actual del programa:
código Woven, output de consola, errores si los hay, y el modo de vista
(código o verboso). Úsalo siempre para personalizar tu respuesta.

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


def construir_contexto(codigo: str, output: list, errores: list, tiene_error: bool, modo: str) -> str:
    partes = [f"CÓDIGO WOVEN ACTUAL:\n```\n{codigo}\n```"]

    if tiene_error:
        partes.append(f"ERRORES:\n" + "\n".join(errores))
    elif output:
        partes.append(f"OUTPUT:\n" + "\n".join(output))
    else:
        partes.append("El programa no ha sido ejecutado aún.")

    partes.append(f"MODO DE VISTA: {modo}")
    return "\n\n".join(partes)


def construir_payload_hilo(
    mensaje: str,
    historial_json: str,
    codigo: str,
    output_json: str,
    errores_json: str,
    tiene_error: bool,
    modo: str,
    nivel_ayuda: int = 1
) -> str:
    historial = json.loads(historial_json)
    output = json.loads(output_json)
    errores = json.loads(errores_json)

    contexto = construir_contexto(codigo, output, errores, tiene_error, modo)

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

    system_completo = (
        SYSTEM_PROMPT
        + f"\n\nCONTEXTO DEL PROGRAMA:\n{contexto}"
        + f"\n\nNIVEL ACTUAL: {nivel_instruccion}"
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

    payload = {
        "system_instruction": {"parts": [{"text": system_completo}]},
        "contents": mensajes,
        "generationConfig": {
            "temperature": 0.7,
            "maxOutputTokens": 1024,
            "responseMimeType": "application/json",
        }
    }

    return json.dumps(payload, ensure_ascii=False)


EMOCIONES_VALIDAS = {
    "happy", "smile", "kiss", "heart_eyes", "grin", "tongue", "sleep", "cool",
    "laugh", "wink", "neutral", "expressionless", "cry", "sad", "worried", "angry",
}


def _limpiar_json_crudo(texto: str) -> str:
    t = texto.strip()
    if t.startswith("```"):
        t = t.split("\n", 1)[-1]
        if t.endswith("```"):
            t = t.rsplit("```", 1)[0]
    return t.strip()


def _fallback_chunks(texto: str) -> list:
    import re
    partes = re.split(r"(?<=[.!?…])\s+|\n+", texto.strip())
    chunks = []
    for p in partes:
        p = p.strip()
        if not p:
            continue
        if len(p) > 120:
            sub = re.split(r"(?<=[,;])\s+", p)
            for s in sub:
                s = s.strip()
                if s:
                    chunks.append({"text": s, "emotion": "neutral"})
        else:
            chunks.append({"text": p, "emotion": "neutral"})
    if not chunks:
        chunks = [{"text": texto.strip() or "…", "emotion": "neutral"}]
    return chunks[:6]


def normalizar_respuesta_hilo(texto_modelo: str) -> dict:
    crudo = _limpiar_json_crudo(texto_modelo)
    chunks = None
    try:
        data = json.loads(crudo)
        if isinstance(data, dict) and isinstance(data.get("chunks"), list):
            chunks = []
            for item in data["chunks"]:
                if not isinstance(item, dict):
                    continue
                text = str(item.get("text", "")).strip()
                if not text:
                    continue
                emo = str(item.get("emotion", "neutral")).strip().lower()
                if emo not in EMOCIONES_VALIDAS:
                    emo = "neutral"
                chunks.append({"text": text[:120], "emotion": emo})
    except json.JSONDecodeError:
        chunks = None

    if not chunks:
        chunks = _fallback_chunks(crudo or texto_modelo)

    if len(chunks) == 1:
        extra = _fallback_chunks(texto_modelo)
        if len(extra) > 1:
            chunks = extra

    texto_completo = " ".join(c["text"] for c in chunks)
    return {"chunks": chunks, "texto_completo": texto_completo}


def parsear_respuesta_hilo(response_json: str) -> str:
    data = json.loads(response_json)
    raw = data["candidates"][0]["content"]["parts"][0]["text"]
    return json.dumps(normalizar_respuesta_hilo(raw), ensure_ascii=False)


def hilo_chat(mensaje, historial_json, codigo, output_json, errores_json, tiene_error, modo, nivel_ayuda):
    try:
        payload = construir_payload_hilo(
            mensaje, historial_json, codigo, output_json,
            errores_json, tiene_error, modo, nivel_ayuda
        )
        return json.dumps({
            "ok": True,
            "payload": payload
        })
    except Exception as e:
        return json.dumps({"ok": False, "error": str(e)})
