import {
  initPyodide,
  isReady,
  lintWoven,
  runWoven,
  setBridgeHandlers,
} from "./bridge/pyodide-bridge.js";
import { createBlocksController } from "./blocks-controller.js";
import { createEditorController } from "./editor-controller.js";
import { createEditorModeController } from "./editor-mode-controller.js";
import { createConsoleController } from "./console-controller.js";
import { createLinterController } from "./linter-controller.js";
import { initResizeController } from "./resize-controller.js";
import { createRuntimeLoader } from "./runtime-loader.js";
import { createGeminiApiKeyController } from "./gemini-api-key-controller.js";
import { createHiloAgentController } from "./hilo-agent-controller.js";

const codeArea = document.getElementById("code-area");
const runBtn = document.getElementById("run-btn");
const clearBtn = document.getElementById("clear-console-btn");

const geminiApiKey = createGeminiApiKeyController({
  dock: document.getElementById("gemini-key-dock"),
  wrap: document.getElementById("gemini-key-wrap"),
  input: document.getElementById("gemini-api-key-input"),
  dot: document.getElementById("gemini-key-dot"),
  hint: document.getElementById("gemini-key-hint"),
  validateBtn: document.getElementById("gemini-api-key-validate"),
  toggleBtn: document.getElementById("gemini-api-key-toggle"),
  clearBtn: document.getElementById("gemini-api-key-clear"),
});

const runtimeLoader = createRuntimeLoader({
  overlay: document.getElementById("runtime-loader"),
  messageEl: document.getElementById("runtime-loader-message"),
  detailEl: document.getElementById("runtime-loader-detail"),
  appShell: document.getElementById("app-shell"),
  codeArea,
  runBtn,
  clearBtn,
});

/** @type {ReturnType<typeof createLinterController>} */
let linter;
/** @type {ReturnType<typeof createEditorModeController>} */
let editorMode;

const editor = createEditorController({
  codeArea,
  lineNumbers: document.getElementById("line-numbers"),
  codeHighlight: document.getElementById("code-highlight"),
  tooltip: document.getElementById("lint-tooltip"),
  onChange: () => {
    if (!editorMode?.isBlockMode()) {
      linter?.scheduleLint();
    }
    hiloAgent?.onExecutionContextChange();
  },
});

const blocksCtl = createBlocksController({
  paletteEl: document.getElementById("blocks-palette"),
  documentEl: document.getElementById("blocks-document"),
  onChange: () => editorMode?.scheduleSyncFromBlocks(),
});

function syncEditorDiagnostics() {
  editor.setDiagnostics(linter.getDiagnosticos());
}

linter = createLinterController({
  getCode: () => editor.getCode(),
  isReady,
  lintFn: lintWoven,
  onUpdate: () => {
    updateRunButton();
    syncEditorDiagnostics();
    syncConsoleWithLinter();
    hiloAgent?.onExecutionContextChange();
  },
});

editorMode = createEditorModeController({
  editorBody: document.getElementById("editor-body"),
  textView: document.getElementById("text-view"),
  modeButtons: document.querySelector(".mode-selector"),
  getCode: () => editor.getCode(),
  setCode: (code) => editor.setCode(code),
  blocks: blocksCtl,
  onLint: () => linter.scheduleLint(),
  onModeError: (msg) => {
    consoleCtl.clear();
    consoleCtl.appendLine(msg, "error", "!");
  },
});

const consoleCtl = createConsoleController({
  body: document.getElementById("console-body"),
});

let isRunning = false;
let consoleShowsLintErrors = false;
/** @type {string[]} */
let lastRunOutput = [];
let lastRunHadError = false;

/** @type {ReturnType<typeof createHiloAgentController>} */
let hiloAgent;

hiloAgent = createHiloAgentController({
  root: document.getElementById("hilo-agent"),
  bubble: document.getElementById("hilo-bubble"),
  bubbleText: document.getElementById("hilo-bubble-text"),
  bubbleHint: document.getElementById("hilo-bubble-hint"),
  avatar: document.getElementById("hilo-avatar"),
  form: document.getElementById("hilo-form"),
  input: document.getElementById("hilo-input"),
  sendBtn: document.getElementById("hilo-send"),
  geminiApiKey,
  isRuntimeReady: isReady,
  getContext: () => {
    const mode = editorMode?.getMode() ?? "text";
    const modo =
      mode === "verbose" ? "verboso" : mode === "blocks" ? "bloques" : "woven";
    const lintErrores = linter?.textosErrores() ?? [];
    const tieneError =
      (linter?.tieneErroresBloqueantes() ?? false) || lastRunHadError;
    return {
      codigo: editor.getCode(),
      output: lastRunOutput,
      errores: lintErrores,
      tieneError,
      modo,
    };
  },
});

function syncConsoleWithLinter() {
  if (isRunning) return;

  if (linter.tieneErroresBloqueantes()) {
    consoleShowsLintErrors = true;
    consoleCtl.clear();
    consoleCtl.appendLine(
      "Errores semánticos — corrígelos antes de ejecutar.",
      "error",
      "!"
    );
    for (const texto of linter.textosErrores()) {
      consoleCtl.appendLine(texto, "error", "!");
    }
    return;
  }

  if (consoleShowsLintErrors) {
    consoleShowsLintErrors = false;
    consoleCtl.showEmpty("// Errores corregidos. Presiona Run para ejecutar…");
  }
}

function updateRunButton() {
  const blockedByLint = linter.tieneErroresBloqueantes();
  runBtn.disabled = !isReady() || isRunning || blockedByLint;
  runBtn.title = blockedByLint
    ? "Corrige los errores semánticos antes de ejecutar"
    : "Ejecutar (Ctrl+Enter)";
}

async function handleRun() {
  if (!isReady() || isRunning) return;

  if (editorMode.isBlockMode()) {
    await editorMode.syncBlocksToText();
  }
  await linter.runLint();

  if (linter.tieneErroresBloqueantes()) {
    syncConsoleWithLinter();
    return;
  }

  consoleShowsLintErrors = false;
  isRunning = true;
  updateRunButton();
  consoleCtl.clear();
  const runningLine = consoleCtl.appendLine("▶ Ejecutando…", "info");

  const code = editor.getCode();
  const t0 = performance.now();

  try {
    const result = await runWoven(code);
    consoleCtl.removeLine(runningLine);
    const ms = Math.round(performance.now() - t0);

    if (!result.salida.length) {
      consoleCtl.appendLine("Ejecución completada sin salida.", "muted");
    } else {
      consoleCtl.appendOutputLines(result.salida);
    }

    if (result.tiene_errores) {
      editor.setDiagnostics(result.diagnosticos);
    } else {
      syncEditorDiagnostics();
    }

    lastRunOutput = result.salida ?? [];
    lastRunHadError = !!result.tiene_errores;
    hiloAgent?.onExecutionContextChange();

    if (!result.tiene_errores) {
      consoleCtl.appendLine(`✓ Completado en ${ms} ms`, "info");
    }
  } catch (err) {
    consoleCtl.removeLine(runningLine);
    const message = err instanceof Error ? err.message : String(err);
    lastRunHadError = true;
    lastRunOutput = [];
    hiloAgent?.onExecutionContextChange();
    consoleCtl.appendLine(message, "error", "!");
  } finally {
    isRunning = false;
    updateRunButton();
  }
}

runBtn.addEventListener("click", handleRun);
clearBtn.addEventListener("click", () => {
  consoleShowsLintErrors = false;
  consoleCtl.showEmpty("// Consola limpiada…");
});

document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
    e.preventDefault();
    if (!runBtn.disabled) handleRun();
  }
});

initResizeController({
  handle: document.getElementById("resize-handle"),
  editorPanel: document.getElementById("editor-panel"),
  consolePanel: document.getElementById("console-panel"),
});

setBridgeHandlers({
  onStdout: (msg) => consoleCtl.appendLine(msg, "output", ">"),
  onStderr: (msg) => consoleCtl.appendLine(msg, "stderr", "!"),
  onStatus: (text, state) => {
    runtimeLoader.setPhase(text, state);
    if (state === "ready") {
      linter.runLint();
    } else {
      updateRunButton();
    }
  },
});

updateRunButton();

initPyodide().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  runtimeLoader.setPhase("No se pudo cargar el motor", "error", message);
  consoleCtl.showEmpty();
  consoleCtl.appendLine(message, "error", "!");
});
