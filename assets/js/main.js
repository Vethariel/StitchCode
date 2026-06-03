import {
  initPyodide,
  isReady,
  lintWoven,
  runWoven,
  parseBlocks,
  setBridgeHandlers,
  translateWovenAll,
  traceWoven,
} from "./bridge/pyodide-bridge.js";
import { createStepModeController } from "./step-mode-controller.js";
import { createExitStepModeIfActive } from "./step-mode-interactions.js";
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
import {
  deactivateExerciseMode,
  getActiveExercise,
  isExerciseModeActive,
  isGuidedExerciseActive,
} from "./hilo-exercise-mode.js";
import {
  canAdvancePlanActivity,
  getActivePlan,
  getCurrentPlanActivity,
  isCurrentPlanActivityDone,
  isLastPlanActivity,
  isPlanModeActive,
} from "./hilo-plan-mode.js";
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
    if (stepMode?.isActive()) stepMode.exit();
  },
});

const blocksCtl = createBlocksController({
  paletteEl: document.getElementById("blocks-palette"),
  documentEl: document.getElementById("blocks-document"),
  onChange: () => {
    editorMode?.scheduleSyncFromBlocks();
    if (stepMode?.isActive()) stepMode.exit();
  },
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
  onModeChange: () => {
    if (stepMode?.isActive()) stepMode.exit();
  },
});

const consoleCtl = createConsoleController({
  body: document.getElementById("console-body"),
});

const stepModeBtn = document.getElementById("step-mode-btn");

/** @type {ReturnType<typeof createStepModeController> | undefined} */
let stepMode;

const sidePanel = createSidePanelController({
  panel: document.getElementById("right-panel"),
  navToggleBtn: document.getElementById("side-panel-toggle-btn"),
  generateBtn: document.getElementById("generate-translations-btn"),
  translateAll: translateWovenAll,
  getSource: () => editor.getCode(),
  isRuntimeReady: isReady,
});

const exerciseContextBar = document.getElementById("exercise-context-bar");
const exerciseContextText = document.getElementById("exercise-context-text");
const exitExerciseBtn = document.getElementById("exit-exercise-btn");
const planContextBar = document.getElementById("plan-context-bar");
const planContextText = document.getElementById("plan-context-text");
const planNextBtn = document.getElementById("plan-next-activity-btn");
const exitPlanBtn = document.getElementById("exit-plan-btn");

/** @param {boolean} active */
function setExerciseModeUi(active) {
  if (exerciseContextBar) {
    exerciseContextBar.hidden = !active;
    exerciseContextBar.setAttribute("aria-hidden", active ? "false" : "true");
  }
  if (active && exerciseContextText) {
    const ex = getActiveExercise();
    if (ex?.titulo) {
      const tipo =
        ex.tipo_ejercicio === "correccion"
          ? "Corrección"
          : ex.tipo_ejercicio === "relleno"
            ? "Completar"
            : "Ejercicio";
      const lineas =
        isGuidedExerciseActive() && ex.lineas_editables?.length
          ? ` · líneas ${ex.lineas_editables.join(", ")}`
          : "";
      exerciseContextText.innerHTML =
        `<strong>${tipo}:</strong> ${escapeExerciseBarText(ex.titulo)}${lineas} — ` +
        "Hilo te guía con el enunciado del panel. Pulsa Run para recibir feedback.";
    } else {
      exerciseContextText.textContent =
        "Modo ejercicio — Hilo vigila tus ejecuciones según el enunciado del panel lateral.";
    }
  }
  document.body.classList.toggle("exercise-mode-active", active);
}

/** @param {boolean} active */
function setPlanModeUi(active) {
  if (planContextBar) {
    planContextBar.hidden = !active;
    planContextBar.setAttribute("aria-hidden", active ? "false" : "true");
  }
  if (active && planContextText) {
    const plan = getActivePlan();
    const act = getCurrentPlanActivity();
    const idx = plan?.actividades?.findIndex((a) => a.id === act?.id) ?? -1;
    const num = idx >= 0 ? idx + 1 : "?";
    const total = plan?.actividades?.length ?? "?";
    const done = isCurrentPlanActivityDone();
    const last = isLastPlanActivity();
    planContextText.innerHTML = plan
      ? `<strong>Plan:</strong> ${escapeExerciseBarText(plan.titulo)} · ` +
        `Actividad ${num}/${total}: ${escapeExerciseBarText(act?.titulo ?? "—")}` +
        (done
          ? last
            ? " · pulsa Terminar plan para el logro"
            : " · lista para avanzar"
          : "")
      : "Plan de aprendizaje activo.";
  }
  if (planNextBtn) {
    const canAdvance = active && canAdvancePlanActivity();
    planNextBtn.disabled = !canAdvance;
    const finishing = active && isLastPlanActivity();
    planNextBtn.textContent = finishing ? "Terminar plan" : "Siguiente actividad";
    planNextBtn.title = finishing
      ? "Cierra el plan y registra tu logro de aprendizaje"
      : "Pasar a la siguiente actividad del plan";
  }
  document.body.classList.toggle("plan-mode-active", active);
  if (active) {
    editorMode?.setModeSwitchLocked(false);
  }
}

/** @param {string} text */
function escapeExerciseBarText(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** @param {string} code */
async function applyCodeToEditor(code) {
  if (stepMode?.isActive()) stepMode.exit();
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
      const fallback = isExerciseModeActive()
        ? `No pude actualizar los bloques: ${msg}.`
        : `No pude convertir el código a bloques: ${msg}. Cambié a modo texto.`;
      consoleCtl.appendLine(fallback, "error", "!");
      if (!isExerciseModeActive()) {
        await editorMode.setMode("text");
      }
    }
  }
  await linter.runLint();
  syncEditorDiagnostics();
}

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

const hiloInput = document.getElementById("hilo-input");
const hiloBubbleHint = document.getElementById("hilo-bubble-hint");
const HILO_INPUT_PLACEHOLDER_DEFAULT =
  hiloInput?.getAttribute("placeholder") ?? "Pregúntale a Hilo…";

/** @param {boolean} active */
function setHiloStepModeRestrict(active) {
  if (hiloInput) {
    hiloInput.placeholder = active
      ? "Pregunta sobre este paso o di «salir del paso a paso»…"
      : HILO_INPUT_PLACEHOLDER_DEFAULT;
    hiloInput.setAttribute(
      "aria-description",
      active
        ? "Modo paso a paso: solo explicación del paso actual o salir del modo"
        : ""
    );
  }
  document.body.classList.toggle("hilo-step-only", active);
}

stepMode = createStepModeController({
  getCode: () => editor.getCode(),
  traceWoven,
  hasLintErrors: () => linter.tieneErroresBloqueantes(),
  syncBlocksToText: () => editorMode.syncBlocksToText(),
  isBlockMode: () => editorMode.isBlockMode(),
  getVista: () => editorMode.getMode(),
  refreshBlocksFromCode: async () => {
    const vista = editorMode.getMode();
    const doc = await parseBlocks(editor.getCode());
    blocksCtl.setDocument(
      doc.bloques,
      vista === "verbose" ? "verbose" : "code"
    );
  },
  blocks: blocksCtl,
  editor,
  console: consoleCtl,
  sidePanel,
  onModeChange: setHiloStepModeRestrict,
  elements: {
    navBtn: stepModeBtn,
    contextBar: document.getElementById("step-context-bar"),
    contextText: document.getElementById("step-context-text"),
    btnPrev: document.getElementById("step-prev-btn"),
    btnNext: document.getElementById("step-next-btn"),
    btnExit: document.getElementById("exit-step-btn"),
    panelRoot: document.querySelector('[data-tab-panel="paso"]'),
    panelStepLabel: document.getElementById("step-panel-step-label"),
    panelEvent: document.getElementById("step-panel-event"),
    panelContext: document.getElementById("step-panel-context"),
    panelVars: document.getElementById("step-panel-vars"),
    panelEmpty: document.getElementById("step-panel-empty"),
    graphSvg: document.getElementById("structure-graph-svg"),
  },
});

/** @type {() => void} */
let exitStepModeIfActive = () => {};

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
    if (isExerciseModeActive() || isPlanModeActive()) return;
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
      await applyCodeToEditor(code);

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
  stepMode,
  plan: {
    onEnunciado: (data) => sidePanel.setEnunciado(data),
    onPlanModeChange: (active) => {
      setPlanModeUi(active);
      if (active) {
        stepMode?.exit();
      }
    },
    onTopicMastery: (topic) => {
      try {
        sidePanel.recordTopicMastery(topic);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        consoleCtl.appendLine(`Logro: ${msg}`, "info");
      }
    },
    lintWoven,
    runWoven,
    applyExample: async (code) => {
      await applyCodeToEditor(code);
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
        } catch (err) {
          consoleCtl.removeLine(runningLine);
          lastRunHadError = true;
          lastRunOutput = [];
        }
        hiloAgent?.onExecutionContextChange();
      }
    },
    translateAll: translateWovenAll,
    onTranslations: (trans) => sidePanel.setTranslations(trans),
    applyTemplate: async (code, opts) => {
      await applyCodeToEditor(code);
      editor.setExerciseEditableLines(opts?.editableLines ?? null);
      blocksCtl.setExerciseEditableLines(opts?.editableLines ?? null);
    },
    onExerciseModeChange: (active) => {
      setExerciseModeUi(active);
      if (active) setPlanModeUi(isPlanModeActive());
    },
  },
  exercise: {
    onEnunciado: (data) => sidePanel.setEnunciado(data),
    onExerciseModeChange: (active) => {
      setExerciseModeUi(active);
      editorMode?.setModeSwitchLocked(active);
      if (active) {
        stepMode?.exit();
      } else {
        editor.clearExerciseEditableLines();
        blocksCtl.clearExerciseEditableLines();
      }
    },
    onTopicMastery: (topic) => {
      try {
        sidePanel.recordTopicMastery(topic);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        consoleCtl.appendLine(`Logro: ${msg}`, "info");
      }
    },
    lintWoven: (code) => linter.runLintOnCode(code),
    runWoven: async (code) => {
      const prev = editor.getCode();
      editor.setCode(code);
      await linter.runLint();
      if (linter.tieneErroresBloqueantes()) {
        editor.setCode(prev);
        return {
          salida: [],
          tiene_errores: true,
          diagnosticos: linter.getDiagnosticos().map((d) => ({
            mensaje: d.mensaje,
          })),
        };
      }
      const result = await runWoven(code);
      editor.setCode(prev);
      return {
        salida: result.salida ?? [],
        tiene_errores: Boolean(result.tiene_errores),
        diagnosticos: result.diagnosticos,
      };
    },
    applyTemplate: async (code, opts = {}) => {
      await applyCodeToEditor(code);
      const locks = opts.editableLines?.length ? opts.editableLines : null;
      editor.setExerciseEditableLines(locks);
      blocksCtl.setExerciseEditableLines(locks);
      if (locks?.length && editorMode?.isBlockMode()) {
        try {
          const lint = await lintWoven(code);
          if (lint.parse_ok) {
            const doc = await parseBlocks(code);
            const vista = editorMode.getMode();
            blocksCtl.setDocument(
              doc.bloques,
              vista === "verbose" ? "verbose" : "code"
            );
          }
        } catch {
          /* sin bloques si el parse falla */
        }
      }
      consoleShowsLintErrors = false;
      const hint = opts.editableLines?.length
        ? `// Ejercicio: edita solo las líneas ${opts.editableLines.join(", ")}. Pulsa Run…`
        : "// Ejercicio cargado. Pulsa Run cuando quieras probar tu solución…";
      consoleCtl.showEmpty(hint);
      lastRunOutput = [];
      lastRunHadError = false;
      hiloAgent?.onExecutionContextChange();
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
      lastRunHadError,
      bloquesResumen: editorMode?.isBlockMode()
        ? blocksCtl.getProgramSummary()
        : "",
      pasoAPaso: stepMode?.getHiloContext?.() ?? null,
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
  if (stepModeBtn) {
    stepModeBtn.disabled = !isReady() || blockedByLint || stepMode?.isActive();
  }
}

exitStepModeIfActive = createExitStepModeIfActive(stepMode);

async function handleRun() {
  if (!isReady() || isRunning) return;
  exitStepModeIfActive();

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
    void hiloAgent?.onAfterRun();

    if (!result.tiene_errores) {
      consoleCtl.appendLine(`✓ Completado en ${ms} ms`, "info");
    }
  } catch (err) {
    consoleCtl.removeLine(runningLine);
    const message = err instanceof Error ? err.message : String(err);
    lastRunHadError = true;
    lastRunOutput = [];
    hiloAgent?.onExecutionContextChange();
    void hiloAgent?.onAfterRun();
    consoleCtl.appendLine(message, "error", "!");
  } finally {
    isRunning = false;
    updateRunButton();
  }
}

runBtn.addEventListener("click", handleRun);

exitExerciseBtn?.addEventListener("click", () => {
  if (hiloAgent) {
    hiloAgent.exitExerciseMode();
  } else {
    deactivateExerciseMode();
    editor.clearExerciseEditableLines();
    blocksCtl.clearExerciseEditableLines();
    editorMode?.setModeSwitchLocked(false);
  }
  setExerciseModeUi(false);
});

exitPlanBtn?.addEventListener("click", () => {
  hiloAgent?.exitPlanMode();
  setPlanModeUi(false);
  setExerciseModeUi(false);
});

planNextBtn?.addEventListener("click", () => {
  void hiloAgent?.goToNextPlanActivity();
});

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
