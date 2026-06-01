import {
  initPyodide,
  isReady,
  lintWoven,
  runWoven,
  setBridgeHandlers,
} from "./bridge/pyodide-bridge.js";
import { createEditorController } from "./editor-controller.js";
import { createConsoleController } from "./console-controller.js";
import { createLinterController } from "./linter-controller.js";
import { initResizeController } from "./resize-controller.js";
import { createRuntimeLoader } from "./runtime-loader.js";
import { esErrorWoven } from "./woven-errors.js";

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

/** @type {ReturnType<typeof createLinterController>} */
let linter;

const editor = createEditorController({
  codeArea,
  lineNumbers: document.getElementById("line-numbers"),
  codeHighlight: document.getElementById("code-highlight"),
  tooltip: document.getElementById("lint-tooltip"),
  onChange: () => linter?.scheduleLint(),
});

function syncEditorDiagnostics() {
  editor.setDiagnostics(linter.getDiagnosticos());
}

linter = createLinterController({
  panel: document.getElementById("linter-panel"),
  getCode: () => editor.getCode(),
  isReady,
  lintFn: lintWoven,
  onUpdate: () => {
    updateRunButton();
    syncEditorDiagnostics();
  },
});

const consoleCtl = createConsoleController({
  body: document.getElementById("console-body"),
});

let isRunning = false;

function updateRunButton() {
  const blockedByLint = linter.tieneErroresBloqueantes();
  runBtn.disabled = !isReady() || isRunning || blockedByLint;
  runBtn.title = blockedByLint
    ? "Corrige los errores semánticos antes de ejecutar"
    : "Ejecutar (Ctrl+Enter)";
}

async function handleRun() {
  if (!isReady() || isRunning) return;

  await linter.runLint();

  if (linter.tieneErroresBloqueantes()) {
    consoleCtl.clear();
    consoleCtl.appendLine(
      "Hay errores semánticos. Corrígelos antes de ejecutar.",
      "error",
      "!"
    );
    for (const texto of linter.textosErrores()) {
      consoleCtl.appendLine(texto, "error", "!");
    }
    return;
  }

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

    const hasError = output.some((line) => esErrorWoven(line));
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
  onStatus: (text, state) => {
    runtimeLoader.setPhase(text, state);
    if (state === "ready") {
      linter.runLint();
    } else {
      linter.render();
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
