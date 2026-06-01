import {
  initPyodide,
  isReady,
  runWoven,
  setBridgeHandlers,
} from "./bridge/pyodide-bridge.js";
import { createEditorController } from "./editor-controller.js";
import { createConsoleController } from "./console-controller.js";
import { initResizeController } from "./resize-controller.js";
import { createRuntimeLoader } from "./runtime-loader.js";

const codeArea = document.getElementById("code-area");
const runBtn = document.getElementById("run-btn");
const clearBtn = document.getElementById("clear-console-btn");

const runtimeLoader = createRuntimeLoader({
  overlay: document.getElementById("runtime-loader"),
  messageEl: document.getElementById("runtime-loader-message"),
  detailEl: document.getElementById("runtime-loader-detail"),
  appShell: document.getElementById("app-shell"),
  codeArea,
  runBtn,
  clearBtn,
});

const editor = createEditorController({
  codeArea,
  lineNumbers: document.getElementById("line-numbers"),
});

const consoleCtl = createConsoleController({
  body: document.getElementById("console-body"),
});

let isRunning = false;

function updateRunButton() {
  runBtn.disabled = !isReady() || isRunning;
}

/**
 * @param {string} text
 * @param {"idle"|"loading"|"ready"|"error"} state
 */
function onRuntimeStatus(text, state) {
  runtimeLoader.setPhase(text, state);
  updateRunButton();
}

async function handleRun() {
  if (!isReady() || isRunning) return;

  isRunning = true;
  updateRunButton();
  consoleCtl.clear();
  const runningLine = consoleCtl.appendLine("▶ Ejecutando…", "info");

  const code = editor.getCode();
  const t0 = performance.now();

  try {
    const output = await runWoven(code);
    consoleCtl.removeLine(runningLine);
    const ms = Math.round(performance.now() - t0);

    if (!output.length) {
      consoleCtl.appendLine("Ejecución completada sin salida.", "muted");
    } else {
      consoleCtl.appendOutputLines(output);
    }

    const hasError = output.some((line) => line.startsWith("Error"));
    if (!hasError) {
      consoleCtl.appendLine(`✓ Completado en ${ms} ms`, "info");
    }
  } catch (err) {
    consoleCtl.removeLine(runningLine);
    const message = err instanceof Error ? err.message : String(err);
    consoleCtl.appendLine(message, "error", "!");
  } finally {
    isRunning = false;
    updateRunButton();
  }
}

runBtn.addEventListener("click", handleRun);
clearBtn.addEventListener("click", () => consoleCtl.showEmpty("// Consola limpiada…"));

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
  onStatus: onRuntimeStatus,
});

updateRunButton();

initPyodide().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  runtimeLoader.setPhase("No se pudo cargar el motor", "error", message);
  consoleCtl.showEmpty();
  consoleCtl.appendLine(message, "error", "!");
});
