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
  "pedagogical_common.py",
  "pedagogical_runtime.py",
  "verbose_visitor.py",
  "verbose_inverse.py",
  "gemini_agent.py",
];

/** @type {import("pyodide").PyodideInterface | null} */
let pyodide = null;
/** @type {((source: string) => import("pyodide").PyProxy) | null} */
let runWovenFn = null;
/** @type {((source: string) => import("pyodide").PyProxy) | null} */
let lintWovenFn = null;
/** @type {((source: string) => import("pyodide").PyProxy) | null} */
let verboseWovenFn = null;
/** @type {((json: string) => import("pyodide").PyProxy) | null} */
let inverseVerboseFn = null;
/** @type {import("pyodide").PyProxy | null} */
let hiloChatFn = null;
/** @type {import("pyodide").PyProxy | null} */
let hiloRedactFn = null;
/** @type {import("pyodide").PyProxy | null} */
let parseHiloResponseFn = null;
/** @type {import("pyodide").PyProxy | null} */
let parseHiloRedactFn = null;
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
from pedagogical_runtime import run_woven_pedagogico
from verbose_visitor import verbose_woven
from verbose_inverse import inverse_verbose
from gemini_agent import hilo_chat, hilo_redactar, parsear_respuesta_hilo, parsear_respuesta_redaccion
`);

    runWovenFn = pyodide.globals.get("run_woven_pedagogico");
    lintWovenFn = pyodide.globals.get("lint_woven_pedagogico");
    verboseWovenFn = pyodide.globals.get("verbose_woven");
    inverseVerboseFn = pyodide.globals.get("inverse_verbose");
    hiloChatFn = pyodide.globals.get("hilo_chat");
    hiloRedactFn = pyodide.globals.get("hilo_redactar");
    parseHiloResponseFn = pyodide.globals.get("parsear_respuesta_hilo");
    parseHiloRedactFn = pyodide.globals.get("parsear_respuesta_redaccion");
    setStatus("ready", "Listo");
  } catch (err) {
    pyodide = null;
    runWovenFn = null;
    lintWovenFn = null;
    verboseWovenFn = null;
    inverseVerboseFn = null;
    hiloChatFn = null;
    hiloRedactFn = null;
    parseHiloResponseFn = null;
    parseHiloRedactFn = null;
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
 * @returns {Promise<{ salida: string[], diagnosticos: import("../linter-controller.js").Diagnostico[], tiene_errores: boolean }>}
 */
export async function runWoven(source) {
  if (!pyodide || !runWovenFn) {
    throw new Error("El motor Woven aún no está listo.");
  }

  const raw = pyResultToString(runWovenFn(source));
  return JSON.parse(raw);
}

/** @typedef {{ id: string, tipo: string, texto: string, placeholders: Record<string, string>, linea: number, hijos?: object[], hijos_else?: object[], hijos_catch?: object[] }} Bloque */

/**
 * @param {string} source
 * @returns {Promise<{ bloques: Bloque[] }>}
 */
export async function parseBlocks(source) {
  if (!pyodide || !verboseWovenFn) {
    throw new Error("El convertidor a bloques aún no está listo.");
  }
  const raw = pyResultToString(verboseWovenFn(source));
  return JSON.parse(raw);
}

/**
 * @param {{ bloques: Bloque[] }} doc
 * @returns {Promise<string>}
 */
export async function blocksToSource(doc) {
  if (!pyodide || !inverseVerboseFn) {
    throw new Error("El convertidor a código aún no está listo.");
  }
  return pyResultToString(inverseVerboseFn(JSON.stringify(doc)));
}

/**
 * @param {{
 *   mensaje: string,
 *   historialJson: string,
 *   codigo: string,
 *   outputJson: string,
 *   erroresJson: string,
 *   tieneError: boolean,
 *   modo: string,
 *   nivelAyuda: number,
 *   perfilJson: string,
 *   tipoInteraccion?: string,
 *   bloquesResumen?: string,
 * }} args
 */
export async function hiloPrepareMessage(args) {
  if (!hiloChatFn) {
    return { ok: false, error: "Hilo aún no está listo." };
  }
  const raw = pyResultToString(
    hiloChatFn(
      args.mensaje,
      args.historialJson,
      args.codigo,
      args.outputJson,
      args.erroresJson,
      args.tieneError,
      args.modo,
      args.nivelAyuda,
      args.perfilJson ?? "{}",
      args.tipoInteraccion ?? "conversacion",
      args.bloquesResumen ?? ""
    )
  );
  return JSON.parse(raw);
}

/**
 * @param {string} responseJson
 * @param {{
 *   codigo?: string,
 *   outputJson?: string,
 *   bloquesResumen?: string,
 *   modo?: string,
 * }} [ctx]
 */
export async function hiloParseResponse(responseJson, ctx = {}) {
  if (!parseHiloResponseFn) {
    throw new Error("Hilo aún no está listo.");
  }
  return pyResultToString(
    parseHiloResponseFn(
      responseJson,
      ctx.codigo ?? "",
      ctx.outputJson ?? "[]",
      ctx.bloquesResumen ?? "",
      ctx.modo ?? "texto"
    )
  );
}

/**
 * @param {{
 *   mensaje: string,
 *   codigo: string,
 *   modo: string,
 *   perfilJson: string,
 *   objetivoRedaccion?: string,
 *   bloquesResumen?: string,
 * }} args
 */
export async function hiloPrepareRedaction(args) {
  if (!hiloRedactFn) {
    return { ok: false, error: "Hilo aún no está listo." };
  }
  const raw = pyResultToString(
    hiloRedactFn(
      args.mensaje,
      args.codigo,
      args.modo,
      args.perfilJson ?? "{}",
      args.objetivoRedaccion ?? "ejemplo_correcto",
      args.bloquesResumen ?? ""
    )
  );
  return JSON.parse(raw);
}

/** @param {object} responseJson Respuesta cruda de Gemini. */
export async function hiloParseRedaction(responseJson) {
  if (!parseHiloRedactFn) {
    throw new Error("Hilo aún no está listo.");
  }
  return pyResultToString(parseHiloRedactFn(JSON.stringify(responseJson)));
}
