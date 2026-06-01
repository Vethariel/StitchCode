# Stitch Code

## 1) Descripción del proyecto

**Stitch Code** es un entorno educativo para estudiantes universitarios que enfrentan programación por primera vez.  
La idea central no es empezar por “escribir más código”, sino por **leer, entender y diagnosticar** lo que ya existe.

La metáfora del proyecto es el **tejido**: cada instrucción es un hilo, cada bloque es un patrón, y comprender cómo se entrelazan permite detectar errores y construir soluciones con intención.  
La premisa pedagógica es que la IA debe actuar como tutor de pensamiento computacional: guía, pregunta, da pistas progresivas y evita reemplazar el razonamiento del estudiante.

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
    -> gemini_agent.py
    -> index.html (Pyodide + JS)
```

**Rol de cada módulo (1 línea):**

- `Woven.g4`: especificación formal del lenguaje.
- `WovenLexer.py` / `WovenParser.py`: lexer/parser ANTLR generados para Python.
- `interpreter_visitor.py`: ejecución del AST Woven con tipos, scopes y OOP.
- `translator_visitor.py`: traducción de Woven a Python, Java y C++.
- `tracing_visitor.py`: traza de ejecución paso a paso en eventos JSON.
- `verbose_visitor.py`: representación semántica en bloques legibles.
- `verbose_inverse.py`: reconstrucción de Woven desde bloques.
- `linter_visitor.py`: análisis estático (errores y warnings).
- `gemini_agent.py`: orquestación del tutor Hilo (prompt + payload/parsing Gemini).
- `index.html`: app web estática (Pyodide + UI + consola + vistas + chat).

---

## 4) Lo implementado

### Lenguaje

- Gramática formal ANTLR4 con indentación significativa.
- Tipos primitivos, funciones, clases, herencia simple, listas tipadas.
- String interpolado, operadores lógicos, `for` estilo C.
- `new` obligatorio para objetos, `self` explícito.

### Backend Python en Pyodide

- Intérprete con scopes, herencia y polimorfismo.
- Validación de tipos en listas con subtipado.
- Traductor a Python, Java y C++.
- Tracer con eventos JSON de ejecución.
- Visitor verboso en español + generador inverso.
- Linter estático con errores/warnings.
- Agente Gemini (Hilo) con prompt pedagógico y niveles de ayuda.

### Frontend

- Editor Woven con ejecución vía Pyodide.
- Consola con distinción de stdout/stderr/errores.
- Tres paneles de traducción simultánea.
- Switch entre vista Woven y vista verbosa en bloques.
- Panel de linter con diagnóstico en tiempo real (debounce).
- Chat con Hilo y niveles de ayuda progresivos.

### Calidad

- Suite de tests con pytest: lexer, parser, intérprete, translator, tracer, verbose y linter.
- Más de 80 tests pasando.

---

## 5) Lo que falta

### Alta prioridad

- Edición de placeholders en modo verboso (bloques editables estilo Scratch).
- Visualizador paso a paso con tabla de variables y árbol de llamadas.
- Generación de ejercicios por IA con validación automática.

### Media prioridad

- Grafo de estructuras de datos sincronizado con la traza.
- Historial de ejercicios en `localStorage` para adaptar dificultad.
- Tools para Hilo: `get_trace`, `get_step`, `get_variables`, `get_structure`.
- Modo de diagnóstico de errores con ejercicios intencionalmente rotos.

### Baja prioridad / futuro

- Capa de bajo nivel (registros/memoria).
- Más estructuras (pilas, colas, árboles).
- Backend serverless para el agente con LangGraph.
- Memoria persistente entre sesiones.

---

## 6) Cómo ejecutar

### Requisitos

- [uv](https://docs.astral.sh/uv/) (gestiona Python, dependencias y scripts del repo)

### Inicio rápido (clonar y compilar)

```bash
git clone <repo-url> StitchCode && cd StitchCode
uv sync --all-groups
make test
```

Si modificaste `woven/Woven.g4`, regenera el parser con `make generate` antes de correr tests.

### 1) Instalar dependencias

Desde la raíz del proyecto:

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

Equivalente directo con uv:

```bash
cd woven && uv run antlr4 -Dlanguage=Python3 -visitor Woven.g4
```

> Regenera `woven/WovenLexer.py`, `woven/WovenParser.py`, `woven/WovenVisitor.py` y archivos auxiliares ANTLR.

### 3) Correr tests

```bash
make test
```

O con uv directamente:

```bash
uv run pytest -q
```

```bash
uv run pytest -q tests/test_lexer.py tests/test_parser.py tests/test_interpreter.py
uv run pytest -q tests/test_translator.py tests/test_tracer.py tests/test_verbose.py tests/test_linter.py
```

### 4) Abrir frontend (estático)

El frontend requiere un servidor local (Pyodide y `fetch` de `woven/*.py`):

```bash
python -m http.server 8000
```

Abrir `http://localhost:8000/` (raíz del repo). Los prototipos viven en `refs/`.

---

## 7) Estructura de archivos

```text
StitchCode/
├── pyproject.toml                  # Dependencias y configuración (uv)
├── uv.lock                         # Lockfile reproducible
├── Makefile                        # Atajos: sync, generate, test
├── .python-version                 # Versión de Python para uv
├── index.html                      # App (navbar, editor, consola, Pyodide)
├── assets/
│   ├── css/                        # Estilos (tokens, layout, editor, consola)
│   └── js/                         # Módulos ES (bridge, controladores, main)
├── refs/
│   ├── stitch-code.html            # Prototipo UI / vibe
│   └── index.html                  # Prototipo Pyodide completo
├── woven/
│   ├── Woven.g4                    # Gramática formal de Woven (ANTLR4)
│   ├── WovenLexer.py               # Lexer generado
│   ├── WovenParser.py              # Parser generado
│   ├── WovenVisitor.py             # Visitor base generado
│   ├── interpreter_visitor.py      # Intérprete runtime de Woven
│   ├── translator_visitor.py       # Traductor a Python/Java/C++
│   ├── tracing_visitor.py          # Trazas de ejecución JSON
│   ├── verbose_visitor.py          # Conversión AST -> bloques legibles
│   ├── verbose_inverse.py          # Conversión bloques -> código Woven
│   ├── linter_visitor.py           # Linter estático con diagnósticos
│   ├── gemini_agent.py             # Tutor Hilo (prompt + payload/parsing Gemini)
│   └── example.wv                  # Ejemplo de programa Woven
└── tests/
    ├── test_lexer.py               # Pruebas del lexer
    ├── test_parser.py              # Pruebas del parser
    ├── test_interpreter.py         # Pruebas del intérprete
    ├── test_translator.py          # Pruebas del traductor
    ├── test_tracer.py              # Pruebas del tracer
    ├── test_verbose.py             # Pruebas visitor verboso + inverso
    └── test_linter.py              # Pruebas del linter
```

