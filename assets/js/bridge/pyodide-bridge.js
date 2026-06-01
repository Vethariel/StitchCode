/** @typedef {"idle"|"loading"|"ready"|"error"} RuntimeStatus */

const PYODIDE_VERSION = "0.27.0";
const WOVEN_BASE = "woven";

const INTERPRETER_FILES = [
  "WovenLexer.py",
  "WovenParser.py",
  "WovenVisitor.py",
  "interpreter_visitor.py",
];

/** @type {import("pyodide").PyodideInterface | null} */
let pyodide = null;
/** @type {((source: string) => import("pyodide").PyProxy) | null} */
let runWovenFn = null;
/** @type {RuntimeStatus} */
let status = "idle";

/** @type {(msg: string) => void} */
let onStdout = () => {};
/** @type {(msg: string) => void} */
let onStderr = () => {};
/** @type {(text: string, state: RuntimeStatus) => void} */
let onStatusChange = () => {};

export function getRuntimeStatus() {
  return status;
}

export function isReady() {
  return status === "ready";
}

/**
 * @param {{ onStdout?: (msg: string) => void, onStderr?: (msg: string) => void, onStatus?: (text: string, state: RuntimeStatus) => void }} handlers
 */
export function setBridgeHandlers(handlers) {
  if (handlers.onStdout) onStdout = handlers.onStdout;
  if (handlers.onStderr) onStderr = handlers.onStderr;
  if (handlers.onStatus) onStatusChange = handlers.onStatus;
}

function setStatus(next, text) {
  status = next;
  onStatusChange(text, next);
}

async function loadWovenModules() {
  for (const fileName of INTERPRETER_FILES) {
    const url = `${WOVEN_BASE}/${fileName}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`No se pudo cargar ${url}`);
    }
    const content = await response.text();
    pyodide.FS.writeFile(fileName, content);
  }
}

export async function initPyodide() {
  if (status === "loading") return;
  if (status === "ready") return;

  try {
    setStatus("loading", "Iniciando Pyodide…");

    if (typeof loadPyodide !== "function") {
      throw new Error("Pyodide no está cargado. Revisa el script del CDN.");
    }

    pyodide = await loadPyodide({
      indexURL: `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`,
    });

    pyodide.setStdout({ batched: (msg) => onStdout(msg) });
    pyodide.setStderr({ batched: (msg) => onStderr(msg) });

    setStatus("loading", "Instalando ANTLR…");
    await pyodide.loadPackage("micropip");
    await pyodide.runPythonAsync(`
import micropip
await micropip.install("antlr4-python3-runtime==4.13.2")
`);

    setStatus("loading", "Cargando intérprete Woven…");
    await loadWovenModules();

    await pyodide.runPythonAsync(`
import sys
if "." not in sys.path:
    sys.path.append(".")

def run_woven(source: str) -> list:
    from antlr4 import CommonTokenStream, InputStream
    from WovenLexer import WovenLexer
    from WovenParser import WovenParser
    from interpreter_visitor import InterpreterVisitor

    lexer = WovenLexer(InputStream(source))
    stream = CommonTokenStream(lexer)
    parser = WovenParser(stream)
    tree = parser.program()
    visitor = InterpreterVisitor()
    return visitor.visit(tree)
`);

    runWovenFn = pyodide.globals.get("run_woven");
    setStatus("ready", "Listo");
  } catch (err) {
    pyodide = null;
    runWovenFn = null;
    const message = err instanceof Error ? err.message : String(err);
    setStatus("error", "Error al cargar el motor");
    throw new Error(message);
  }
}

/**
 * @param {string} source
 * @returns {Promise<string[]>}
 */
export async function runWoven(source) {
  if (!pyodide || !runWovenFn) {
    throw new Error("El motor Woven aún no está listo.");
  }

  const outputProxy = runWovenFn(source);
  try {
    return outputProxy.toJs().map((line) => String(line));
  } finally {
    if (typeof outputProxy.destroy === "function") {
      outputProxy.destroy();
    }
  }
}
