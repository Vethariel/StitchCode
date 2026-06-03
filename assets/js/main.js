import {
  initPyodide,
  isReady,
  lintWoven,
  runWoven,
  parseBlocks,
  setBridgeHandlers,
  translateWovenAll,
} from "./bridge/pyodide-bridge.js";
import { createSidePanelController } from "./side-panel-controller.js";
import { createBlocksController } from "./blocks-controller.js";
import { createEditorController } from "./editor-controller.js";
import { createEditorModeController } from "./editor-mode-controller.js";
import { createConsoleController } from "./console-controller.js";
import { createLinterController } from "./linter-controller.js";
import { initResizeController } from "./resize-controller.js";
import { createRuntimeLoader } from "./runtime-loader.js";
import { createGeminiApiAccess } from "./gemini-api-state.js";
import { createHiloAgentController } from "./hilo-agent-controller.js";
import { buildHiloContext } from "./hilo-context.js";
import { createHiloFocusController } from "./hilo-focus.js";
import { createHiloHighlightController } from "./hilo-highlight.js";
import {
  createOnboardingController,
  createSettingsModalController,
} from "./setup-form.js";
import { isHiloTutorialComplete } from "./hilo-tutorial.js";
import {
  isOnboardingComplete,
  profileJsonForGemini,
} from "./user-settings.js";

const codeArea = document.getElementById("code-area");
const runBtn = document.getElementById("run-btn");
const clearBtn = document.getElementById("clear-console-btn");
const appShell = document.getElementById("app-shell");

const geminiApi = createGeminiApiAccess();

const runtimeLoader = createRuntimeLoader({
  overlay: document.getElementById("runtime-loader"),
  messageEl: document.getElementById("runtime-loader-message"),
  detailEl: document.getElementById("runtime-loader-detail"),
  appShell,
  codeArea,
  runBtn,
  clearBtn,
});

/** @type {ReturnType<typeof createLinterController>} */
let linter;
/** @type {ReturnType<typeof createEditorModeController>} */
let editorMode;
/** @type {ReturnType<typeof createHiloAgentController>} */
let hiloAgent;

async function syncGeminiFromForm(form) {
  if (form.apiKey.isValid()) {
    geminiApi.setValidated(form.apiKey.getActiveKey());
    return;
  }
  form.apiKey.persistInput();
  await geminiApi.refresh();
}

function unlockApp() {
  appShell.classList.remove("app-shell--locked");
  appShell.removeAttribute("inert");
  runtimeLoader.unlockWorkspace();
  document.getElementById("settings-open-btn").hidden = false;
  updateRunButton();
}

async function maybeStartHiloTutorial() {
  if (isHiloTutorialComplete() || !hiloAgent) return;
  await hiloAgent.startTutorial();
}

function beginAppAfterRuntime() {
  if (!isOnboardingComplete()) {
    onboarding.show();
    return;
  }
  unlockApp();
  void geminiApi.refresh().then(() => {
    linter?.runLint();
    void maybeStartHiloTutorial();
  });
}

const onboarding = createOnboardingController({
  overlay: document.getElementById("setup-overlay"),
  formRoot: document.getElementById("setup-form"),
  steps: document.getElementById("setup-steps"),
  panels: document.querySelectorAll("#setup-form [data-setup-panel]"),
  btnBack: document.getElementById("setup-back"),
  btnNext: document.getElementById("setup-next"),
  btnFinish: document.getElementById("setup-finish"),
  onComplete: async (form) => {
    await syncGeminiFromForm(form);
    unlockApp();
    linter?.runLint();
    await maybeStartHiloTutorial();
  },
});

createSettingsModalController({
  modal: document.getElementById("settings-modal"),
  formRoot: document.getElementById("settings-form"),
  openBtn: document.getElementById("settings-open-btn"),
  closeBtn: document.getElementById("settings-close"),
  backdrop: document.getElementById("settings-backdrop"),
  saveBtn: document.getElementById("settings-save"),
  onSave: syncGeminiFromForm,
});

document.getElementById("settings-open-btn").hidden = !isOnboardingComplete();

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

const sidePanel = createSidePanelController({
  panel: document.getElementById("right-panel"),
  navToggleBtn: document.getElementById("side-panel-toggle-btn"),
  generateBtn: document.getElementById("generate-translations-btn"),
  translateAll: translateWovenAll,
  getSource: () => editor.getCode(),
  isRuntimeReady: isReady,
});

const hiloFocus = createHiloFocusController({
  overlay: document.getElementById("hilo-focus-overlay"),
  dock: document.getElementById("floating-dock"),
  appShell: document.getElementById("app-shell"),
  onTranslationPanel: (panel) => {
    sidePanel.setOpen(true);
    sidePanel.setActiveTab(panel);
  },
});

const hiloHighlight = createHiloHighlightController({
  codeArea,
  lineNumbers: document.getElementById("line-numbers"),
  codeHighlight: document.getElementById("code-highlight"),
  blocksDocument: document.getElementById("blocks-document"),
  consoleBody: document.getElementById("console-body"),
  getVista: () => editorMode?.getMode() ?? "text",
  onTranslationHighlight: (lang, line) =>
    sidePanel.applyTranslationHighlight(lang, line),
  clearTranslationHighlights: () => sidePanel.clearTranslationHighlights(),
});

const onFocusTranslationTab = (lang) => {
  sidePanel.setOpen(true);
  sidePanel.setActiveTab(lang);
};

hiloAgent = createHiloAgentController({
  root: document.getElementById("hilo-agent"),
  bubble: document.getElementById("hilo-bubble"),
  bubbleText: document.getElementById("hilo-bubble-text"),
  bubbleHint: document.getElementById("hilo-bubble-hint"),
  avatar: document.getElementById("hilo-avatar"),
  form: document.getElementById("hilo-form"),
  input: document.getElementById("hilo-input"),
  sendBtn: document.getElementById("hilo-send"),
  geminiApi,
  isRuntimeReady: isReady,
  getPerfilJson: () => profileJsonForGemini(),
  focus: hiloFocus,
  highlight: hiloHighlight,
  onFocusTranslationTab,
  onTutorialAction: async (action) => {
    if (!editorMode) return;
    if (action === "mode:text") await editorMode.setMode("text");
    else if (action === "mode:blocks") await editorMode.setMode("blocks");
    else if (action === "mode:verbose") await editorMode.setMode("verbose");
  },
  learning: {
    lintWoven,
    runWoven,
    translateAll: translateWovenAll,
    onEnunciado: (data) => sidePanel.setEnunciado(data),
    onTranslations: (trans) => sidePanel.setTranslations(trans),
    applyExample: async (code) => {
      editor.setCode(code);
      const vista = editorMode?.getMode() ?? "text";
      if (vista === "blocks" || vista === "verbose") {
        try {
          const doc = await parseBlocks(code);
          blocksCtl.setDocument(
            doc.bloques,
            vista === "verbose" ? "verbose" : "code"
          );
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          consoleCtl.clear();
          consoleCtl.appendLine(
            `No pude convertir el ejemplo a bloques: ${msg}. Cambié a modo texto.`,
            "error",
            "!"
          );
          await editorMode.setMode("text");
        }
      }
      await linter.runLint();
      syncEditorDiagnostics();

      if (!linter.tieneErroresBloqueantes()) {
        consoleShowsLintErrors = false;
        consoleCtl.clear();
        const runningLine = consoleCtl.appendLine("▶ Ejecutando ejemplo…", "info");
        try {
          const result = await runWoven(code);
          consoleCtl.removeLine(runningLine);
          if (!result.salida.length) {
            consoleCtl.appendLine("Ejemplo sin salida en consola.", "muted");
          } else {
            consoleCtl.appendOutputLines(result.salida);
          }
          lastRunOutput = result.salida ?? [];
          lastRunHadError = !!result.tiene_errores;
          if (result.tiene_errores) {
            editor.setDiagnostics(result.diagnosticos);
          }
        } catch (err) {
          consoleCtl.removeLine(runningLine);
          const message = err instanceof Error ? err.message : String(err);
          consoleCtl.appendLine(message, "error", "!");
          lastRunHadError = true;
          lastRunOutput = [];
        }
        hiloAgent?.onExecutionContextChange();
      }
    },
  },
  getContext: () =>
    buildHiloContext({
      vista: editorMode?.getMode() ?? "text",
      codigo: editor.getCode(),
      output: lastRunOutput,
      errores: linter?.textosErrores() ?? [],
      tieneError:
        (linter?.tieneErroresBloqueantes() ?? false) || lastRunHadError,
      bloquesResumen: editorMode?.isBlockMode()
        ? blocksCtl.getProgramSummary()
        : "",
    }),
});

let isRunning = false;
let consoleShowsLintErrors = false;
/** @type {string[]} */
let lastRunOutput = [];
let lastRunHadError = false;

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
      sidePanel.syncGenerateButton();
      beginAppAfterRuntime();
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
