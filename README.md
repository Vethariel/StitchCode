# Stitch Code

## 1) Descripción del proyecto

**Stitch Code** es un entorno educativo para estudiantes universitarios que enfrentan programación por primera vez.  
La idea central no es empezar por “escribir más código”, sino por **leer, entender y diagnosticar** lo que ya existe.

La metáfora del proyecto es el **tejido**: cada instrucción es un hilo, cada bloque es un patrón, y comprender cómo se entrelazan permite detectar errores y construir soluciones con intención.  
La premisa pedagógica es que la IA debe actuar como tutor de pensamiento computacional: guía, pregunta, da pistas progresivas y evita reemplazar el razonamiento del estudiante.

**Hilo** es el tutor conversacional de la plataforma. Tras una configuración inicial (tono, estilo y clave de Gemini opcional), un **tutorial guiado** recorre editor, consola, panel lateral y los “poderes” que puedes pedir por chat: planes de estudio, ejercicios, explicaciones sobre tu código y ejecución paso a paso.

---

## 2) Woven — el lenguaje

**Woven** es un lenguaje propio de Stitch Code: un subconjunto de convergencia sintáctica entre Python, Java y C++.

### Decisiones de diseño

- Tipos obligatorios en variables y parámetros.
- `new` obligatorio para crear objetos.
- Operadores lógicos `and` / `or` / `!` (estilo convergente con legibilidad Python).
- `for` y `while` estilo C: `for (init; condición; update):` y `while (condición):`
- Indentación significativa (estilo Python).

### Palabras clave principales

| Categoría | Palabras clave |
|---|---|
| Tipos | `int`, `float`, `string`, `bool`, `void`, `list<T>` |
| Control | `if`, `else`, `for`, `while`, `return` |
| Funciones | `function` |
| OOP | `class`, `extends`, `init`, `self`, `super`, `virtual`, `new` |
| Lógicos/booleanos | `and`, `or`, `!`, `true`, `false` |
| Aritméticos | `+`, `-`, `*`, `/`, `%`, `**` |
| E/S | `print` |

### Referencia rápida con ejemplos

```woven
int x = 5
float y = 3.14
string s = "hola"
bool ok = true

if x > 1:
    print("mayor")
else:
    print("menor")

for (int i = 0; i < 3; i = i + 1):
    print(i)

while (i < 10):
    i = i + 1

function int sumar(int a, int b):
    return a + b

class Animal:
    string nombre
    init(string nombre):
        self.nombre = nombre
```

---

## 3) Arquitectura técnica

```text
Woven.g4 (ANTLR4)
    -> WovenLexer.py / WovenParser.py (generados)
    -> interpreter_visitor.py
    -> translator_visitor.py (Python, Java, C++)
    -> tracing_visitor.py
    -> verbose_visitor.py + verbose_inverse.py
    -> linter_visitor.py
    -> gemini_agent.py (Hilo: prompts, planes, ejercicios, chat)
    -> index.html + assets/js/ (Pyodide + UI + tutor)
```

**Backend Python (Pyodide):**

| Módulo | Rol |
|---|---|
| `Woven.g4` | Especificación formal del lenguaje |
| `WovenLexer.py` / `WovenParser.py` | Lexer/parser ANTLR generados |
| `interpreter_visitor.py` | Ejecución del AST con tipos, scopes y OOP |
| `translator_visitor.py` | Traducción a Python, Java y C++ |
| `tracing_visitor.py` | Traza de ejecución paso a paso (eventos JSON) |
| `verbose_visitor.py` / `verbose_inverse.py` | Bloques legibles ↔ Woven |
| `linter_visitor.py` | Análisis estático (errores y warnings) |
| `gemini_agent.py` | Tutor Hilo: prompts pedagógicos, planes, ejercicios, redacción y chat |

**Frontend (`assets/js/`):**

| Área | Módulos principales |
|---|---|
| Runtime | `runtime-loader.js`, bridge Pyodide |
| Editor | `editor-controller.js`, `editor-mode-controller.js`, `blocks-controller.js`, `woven-highlighter.js` |
| Consola y linter | `console-controller.js`, `linter-controller.js` |
| Paso a paso | `step-trace.js`, `step-mode-controller.js`, `structure-graph.js` |
| Panel lateral | `side-panel-controller.js`, traducciones y enunciados |
| Hilo | `hilo-agent-controller.js`, `hilo-intent.js`, `hilo-chat.js`, `hilo-response.js` |
| Poderes | `hilo-plan.js`, `hilo-plan-mode.js`, `hilo-learning.js`, `hilo-exercise.js`, `hilo-exercise-correction.js`, `hilo-exercise-mode.js` |
| Tutor UX | `hilo-tutorial.js`, `hilo-focus.js`, `hilo-sprite.js`, `hilo-emotions.js` |
| Progreso | `learning-achievements.js` (`localStorage`) |
| Orquestación | `main.js`, `user-settings.js`, `setup-form.js` |

---

## 4) Lo implementado

### Lenguaje Woven

- Gramática formal ANTLR4 con indentación significativa.
- Tipos primitivos, funciones, clases, herencia simple, listas tipadas.
- String interpolado, operadores lógicos, `for` estilo C.
- `new` obligatorio para objetos, `self` explícito.

### Motor en el navegador (Pyodide)

- Intérprete con scopes, herencia y polimorfismo.
- Validación de tipos en listas con subtipado.
- Traductor a Python, Java y C++.
- Tracer con eventos JSON de ejecución.
- Visitor verboso en español + generador inverso.
- Linter estático con diagnósticos.
- Agente Gemini (Hilo) con prompts por poder y niveles de ayuda.

### Editor y ejecución

- Tres modos de vista: **Texto** (Woven), **Bloques** (piezas encajables) y **Verboso** (lenguaje natural).
- Ejecución con **Run** / Ctrl+Enter; consola con stdout, stderr y errores.
- Linter en tiempo real (debounce) y resaltado de sintaxis.
- Comodidades de edición en modo texto (indentación, pares, Tab).

### Panel lateral

- Pestaña **Enunciado**: instrucciones del plan, ejercicio o lección activa.
- Pestañas **Python / Java / C++**: traducciones del código actual o de la lección.
- Pestaña **Logros**: competencias dominadas (descripciones de dominio, no solo “completaste el reto”).

### Barra superior

- **Paso a paso**: recorre la traza línea a línea con variables, consola y grafo de estructuras.
- **Generar traducciones** del editor actual.
- **Panel**: mostrar u ocultar el lateral.

### Hilo — tutor y poderes

| Poder | Cómo activarlo (ejemplos) | Qué hace |
|---|---|---|
| **Plan** | «Quiero aprender sobre listas», «hazme un plan para bucles» | Itinerario con actividades: aprendizaje, ejercicio libre, corrección, relleno y reflexión. Barra de plan, avance por actividad, logro al terminar. |
| **Aprendizaje** (dentro del plan o suelto absorbido por plan) | «Enséñame de recursión», «¿Qué es una lista?» | Ejemplo Woven validado, explicación, traducciones y enunciado en el panel. |
| **Ejercicio** | «Dame un ejercicio», «corregir el código», «completar huecos» | Modo ejercicio: vigila **Run**, enunciado alineado. Tipos: **libre**, **corrección** (líneas incorrectas) y **relleno** (huecos). Bloqueo de líneas no editables. |
| **Explicación** | «Explícame mi código», «qué hace esta línea» | Foco en editor o consola con pistas progresivas (sin solución completa de golpe). |
| **Paso a paso** | «modo paso a paso», «línea por línea» | Traza de ejecución interactiva (no es chat narrativo). |

Otros comportamientos de Hilo:

- Detección de intención en cliente (`hilo-intent.js`) antes de llamar a Gemini.
- Validación y saneado de borradores Woven (`hilo-draft.js`) con reintentos y recuperación.
- Paquete único para ejercicios guiados (`hilo-exercise-correction.js`): enunciado, líneas editables y salida esperada alineados.
- Chat con historial de plan (`planHistorial`) y contexto JSON en turnos activos.
- Tutorial post-setup (~20 pasos): editor, consola, panel, poderes y demo de traducciones.
- Configuración persistente: tono, estilo pedagógico y API key de Gemini (opcional; sin clave, respuestas locales limitadas).

### Calidad y pruebas

- **Python:** `pytest` sobre lexer, parser, intérprete, traductor, tracer, verbose, linter y agente (~274 tests).
- **Frontend:** `node --test` sobre intención, planes, ejercicios, tutorial, logros, panel, traza y más (~65 tests en 14 archivos `.mjs`).

---

## 5) Lo que falta

### Alta prioridad

- Edición completa de placeholders en modo verboso (bloques editables estilo Scratch, más allá de la vista actual).
- Persistencia del plan a medias entre sesiones (`localStorage` o backend).
- Herramientas estructuradas para Hilo en runtime: `get_trace`, `get_step`, `get_variables`, `get_structure` (hoy el paso a paso usa la traza del cliente).

### Media prioridad

- Historial de ejercicios para adaptar dificultad (más allá de logros por tema).
- Reflexión guiada más rica al cerrar un plan (chat antes de «Terminar plan»).
- Sincronización más profunda del grafo de estructuras con programas grandes.

### Baja prioridad / futuro

- Capa de bajo nivel (registros/memoria).
- Más estructuras (pilas, colas, árboles).
- Backend serverless para el agente con LangGraph.
- Memoria persistente entre sesiones en servidor (perfil longitudinal del alumno).

---

## 6) Cómo ejecutar

### Requisitos

- [uv](https://docs.astral.sh/uv/) (Python, dependencias y scripts del repo)
- [Node.js](https://nodejs.org/) 18+ (tests del frontend en `tests/*.mjs`)
- Clave de [Google AI Studio](https://aistudio.google.com/apikey) (opcional; necesaria para respuestas de Hilo con Gemini en el navegador)

### Inicio rápido (clonar y compilar)

```bash
git clone <repo-url> StitchCode && cd StitchCode
uv sync --all-groups
make test
node --test tests/*.mjs
```

Si modificaste `woven/Woven.g4`, regenera el parser con `make generate` antes de correr tests.

### 1) Instalar dependencias

```bash
uv sync --all-groups
```

O con Make:

```bash
make sync
```

### 2) Generar lexer/parser desde la gramática

Tras cambiar `woven/Woven.g4`:

```bash
make generate
```

Equivalente directo:

```bash
cd woven && uv run antlr4 -Dlanguage=Python3 -visitor Woven.g4
```

> Regenera `woven/WovenLexer.py`, `woven/WovenParser.py`, `woven/WovenVisitor.py` y archivos auxiliares ANTLR.

### 3) Correr tests

Backend (Python):

```bash
make test
```

O:

```bash
uv run pytest -q
```

Frontend (Node):

```bash
node --test tests/*.mjs
```

Ejemplos por área:

```bash
uv run pytest -q tests/test_lexer.py tests/test_parser.py tests/test_interpreter.py
uv run pytest -q tests/test_translator.py tests/test_tracer.py tests/test_verbose.py tests/test_linter.py
uv run pytest -q tests/test_gemini_agent.py
node --test tests/test_hilo_plan.mjs tests/test_hilo_tutorial.mjs tests/test_learning_achievements.mjs
```

### 4) Abrir la aplicación

El frontend requiere un servidor local (Pyodide y `fetch` de `woven/*.py`):

```bash
python -m http.server 8000
```

Abrir `http://localhost:8000/`. Completa el asistente de configuración; al entrar, Hilo inicia el tutorial (si no lo completaste antes).

Para repetir el tutorial en el navegador:

```js
localStorage.removeItem('stitch_hilo_tutorial_complete')
```

Los prototipos históricos de UI viven en `refs/`.

### 5) Sprites de Hilo (opcional)

Si cambias los frames del avatar:

```bash
make hilo-frames
```

---

## 7) Estructura de archivos

```text
StitchCode/
├── LICENSE                         # Propiedad de Vethariel — todos los derechos reservados
├── pyproject.toml                  # Dependencias y configuración (uv)
├── uv.lock
├── Makefile                        # sync, generate, test, hilo-frames
├── .python-version
├── index.html                      # App: setup, editor, consola, panel, Hilo
├── assets/
│   ├── css/                        # Layout, editor, consola, plan, Hilo, tutorial
│   └── js/                         # Módulos ES (ver tabla en §3)
├── refs/
│   ├── stitch-code.html            # Prototipo UI
│   └── index.html                  # Prototipo Pyodide
├── scripts/
│   └── build_hilo_frames.py        # Generación de sprites del tutor
├── woven/
│   ├── Woven.g4
│   ├── WovenLexer.py / WovenParser.py / WovenVisitor.py
│   ├── interpreter_visitor.py
│   ├── translator_visitor.py
│   ├── tracing_visitor.py
│   ├── verbose_visitor.py
│   ├── verbose_inverse.py
│   ├── linter_visitor.py
│   ├── gemini_agent.py             # Hilo: chat, plan, ejercicio, redacción
│   └── example.wv
└── tests/
    ├── test_*.py                   # Motor Woven y agente
    └── test_*.mjs                  # Hilo, panel, editor, logros, tutorial
```

---

## 8) Uso rápido de Hilo (referencia)

| Objetivo | Ejemplo en el chat |
|---|---|
| Plan de estudio | «Quiero aprender sobre funciones» |
| Ejercicio libre | «Dame un ejercicio sobre condicionales» |
| Corregir código | «Ejercicio de corrección sobre bucles» |
| Completar huecos | «Rellenar líneas en un programa de listas» |
| Lección puntual | «Enséñame qué es la recursión» |
| Tu código | «Explícame la línea 5» / «No entiendo mi programa» |
| Traza | «Modo paso a paso» o botón **Paso a paso** en la barra |

Con **Gemini** configurado, Hilo genera enunciados, código de ejemplo y planes validados contra el linter Woven en el cliente. Sin clave, parte del flujo usa respuestas locales o mensajes que indican configurar la API en **Ajustes**.

---

## 9) Licencia

Copyright © 2026 **Vethariel**. Todos los derechos reservados.

El proyecto es **propiedad de Vethariel**. No está bajo una licencia de código abierto permisiva: la copia, distribución, uso comercial o creación de obras derivadas requiere **autorización expresa** del propietario.

Uso local permitido para aprendizaje personal y evaluación según los términos del archivo [LICENSE](LICENSE).

Para permisos de uso, distribución o licencias alternativas, contacta a **Vethariel**.
