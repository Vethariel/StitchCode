/** @typedef {"idle"|"loading"|"ready"|"error"} RuntimeStatus */

const PYODIDE_VERSION = "0.27.0";
const WOVEN_BASE = "woven";

const INTERPRETER_FILES = [
  "WovenLexer.py",
  "WovenParser.py",
  "WovenVisitor.py",
  "interpreter_visitor.py",
  "pedagogical_error_listener.py",
  "woven_runtime.py",
  "linter_visitor.py",
  "pedagogical_lint.py",
];

/** @type {import("pyodide").PyodideInterface | null} */
let pyodide = null;
/** @type {((source: string) => import("pyodide").PyProxy) | null} */
let runWovenFn = null;
/** @type {((source: string) => import("pyodide").PyProxy) | null} */
let lintWovenFn = null;
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

from woven_runtime import run_woven
from pedagogical_lint import lint_woven_pedagogico
`);

    runWovenFn = pyodide.globals.get("run_woven");
    lintWovenFn = pyodide.globals.get("lint_woven_pedagogico");
    setStatus("ready", "Listo");
  } catch (err) {
    pyodide = null;
    runWovenFn = null;
    lintWovenFn = null;
    const message = err instanceof Error ? err.message : String(err);
    setStatus("error", "Error al cargar el motor");
    throw new Error(message);
  }
}

function pyResultToString(pyResult) {
  const value = pyResult.toString();
  if (typeof pyResult.destroy === "function") {
    pyResult.destroy();
  }
  return value;
}

/**
 * @param {string} source
 * @returns {Promise<import("../linter-controller.js").LintResult>}
 */
export async function lintWoven(source) {
  if (!pyodide || !lintWovenFn) {
    throw new Error("El analizador semántico aún no está listo.");
  }
  const raw = pyResultToString(lintWovenFn(source));
  return JSON.parse(raw);
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
