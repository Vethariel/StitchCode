import { sendHiloMessage } from "./hilo-chat.js";
import { emotionForState } from "./hilo-emotions.js";
import { createHiloFocusController } from "./hilo-focus.js";
import { createHiloHighlightController } from "./hilo-highlight.js";
import { defaultExplanationPanel } from "./hilo-context.js";
import { resolveHighlightLine } from "./hilo-highlight-line.js";
import {
  detectHiloIntent,
  exerciseActiveApiTipo,
  intentToApiTipo,
} from "./hilo-intent.js";
import { runHiloLearning } from "./hilo-learning.js";
import { runHiloExercise } from "./hilo-exercise.js";
import {
  deactivateExerciseMode,
  getActiveExercise,
  getExerciseEnunciadoJson,
  isExerciseModeActive,
} from "./hilo-exercise-mode.js";
import { slugTopicId } from "./learning-achievements.js";
import { localHiloTurn, parseHiloTurn } from "./hilo-response.js";
import {
  getHiloTutorialScript,
  isHiloTutorialComplete,
  markHiloTutorialComplete,
} from "./hilo-tutorial.js";
import {
  applyHiloEmotion,
  getDefaultEmotion,
  loadHiloSpriteAtlas,
} from "./hilo-sprite.js";

/**
 * @typedef {import("./hilo-response.js").HiloTurn} HiloTurn
 * @typedef {import("./hilo-tutorial.js").TutorialChunk} TutorialChunk
 * @typedef {{
 *   chunks: (HiloTurn["chunks"][number] & Partial<TutorialChunk>)[],
 *   index: number,
 *   type: 'conversation' | 'explanation',
 *   explanationComplete: boolean,
 *   isTutorial?: boolean,
 * }} ActiveTurn
 */

/**
 * @param {{
 *   root: HTMLElement,
 *   bubble: HTMLElement,
 *   bubbleText: HTMLElement,
 *   bubbleHint: HTMLElement,
 *   avatar: HTMLElement,
 *   form: HTMLFormElement,
 *   input: HTMLInputElement,
 *   sendBtn: HTMLButtonElement,
 *   geminiApi: { isValid: () => boolean, getActiveKey: () => string },
 *   getPerfilJson: () => string,
 *   isRuntimeReady: () => boolean,
 *   getContext: () => {
 *     codigo: string,
 *     output: string[],
 *     errores: string[],
 *     tieneError: boolean,
 *     modo: string,
 *     vista: 'text' | 'blocks' | 'verbose',
 *     bloquesResumen: string,
 *   },
 *   focus: ReturnType<typeof createHiloFocusController>,
 *   highlight: ReturnType<typeof createHiloHighlightController>,
 *   onTutorialAction?: (action: string) => void | Promise<void>,
 *   onFocusTranslationTab?: (lang: 'python' | 'java' | 'cpp') => void,
 *   learning?: {
 *     lintWoven: (code: string) => Promise<import("./linter-controller.js").LintResult>,
 *     runWoven: (code: string) => Promise<{
 *       salida: string[],
 *       tiene_errores: boolean,
 *       diagnosticos?: { mensaje: string }[],
 *     }>,
 *     applyExample: (code: string) => Promise<void>,
 *     translateAll: (code: string) => Promise<{ python: string, java: string, cpp: string }>,
 *     onEnunciado?: (data: { tag: string, title: string, paragraphs: string[] }) => void,
 *     onTranslations?: (trans: { python: string, java: string, cpp: string }) => void,
 *   },
 *   exercise?: {
 *     applyTemplate: (code: string) => Promise<void>,
 *     onEnunciado?: (data: { tag: string, title: string, paragraphs: string[] }) => void,
 *     onExerciseModeChange?: (active: boolean) => void,
 *     onTopicMastery?: (topic: { id: string, name: string, desc: string, icon?: string }) => void,
 *   },
 *   stepMode?: {
 *     isActive: () => boolean,
 *     enter: () => Promise<void>,
 *     exit: () => void,
 *   },
 * }} opts
 */
export function createHiloAgentController({
  root,
  bubble,
  bubbleText,
  bubbleHint,
  avatar,
  form,
  input,
  sendBtn,
  geminiApi,
  isRuntimeReady,
  getPerfilJson,
  getContext,
  focus,
  highlight,
  onTutorialAction,
  onFocusTranslationTab,
  learning,
  exercise,
  stepMode,
}) {
  /** @type {{ role: string, content: string }[]} */
  let historial = [];
  let nivelAyuda = 1;
  let mensajesEnProblema = 0;
  /** @type {ActiveTurn | null} */
  let activeTurn = null;
  let busy = false;
  let tutorialActive = false;
  let spriteReady = false;
  let runFeedbackPending = false;
  function formatBubbleHtml(text) {
    const safe = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    return safe.replace(
      /\*\*(.+?)\*\*/g,
      '<strong class="hilo-emphasis">$1</strong>'
    );
  }

  function isExplaining() {
    return activeTurn?.type === "explanation";
  }

  function setExplainingUi(on) {
    root.classList.toggle("hilo-agent--explaining", on);
    root.classList.toggle("hilo-agent--tutorial", on && tutorialActive);
    avatar.setAttribute(
      "aria-label",
      on
        ? "Hilo — Enter para continuar"
        : "Hilo — clic para continuar o repetir el mensaje"
    );
  }

  function setEmotionState(state) {
    applyHiloEmotion(avatar, emotionForState(state));
  }

  function updateBubbleHint() {
    if (!activeTurn) {
      bubbleHint.hidden = true;
      bubbleHint.textContent = "";
      return;
    }

    const n = activeTurn.chunks.length;
    const i = activeTurn.index + 1;

    if (activeTurn.isTutorial || activeTurn.type === "explanation") {
      if (activeTurn.explanationComplete && !activeTurn.isTutorial) {
        bubbleHint.hidden = false;
        bubbleHint.textContent = "Enter para repetir la explicación";
        return;
      }
      bubbleHint.hidden = false;
      if (activeTurn.index < n - 1) {
        bubbleHint.textContent = `Enter para continuar (${i}/${n})`;
      } else if (activeTurn.isTutorial) {
        bubbleHint.textContent = "Enter para empezar a programar";
      } else {
        bubbleHint.textContent = `Enter para terminar (${i}/${n})`;
      }
      return;
    }

    if (n <= 1) {
      bubbleHint.hidden = true;
      bubbleHint.textContent = "";
      return;
    }
    if (activeTurn.index < n - 1) {
      bubbleHint.hidden = false;
      bubbleHint.textContent = `Clic en Hilo para continuar (${i}/${n})`;
    } else {
      bubbleHint.hidden = false;
      bubbleHint.textContent =
        n > 1
          ? `Clic en Hilo para repetir desde el inicio (${n} mensajes)`
          : "Clic en Hilo para repetir";
    }
  }

  const TRANSLATION_PANELS = new Set(["python", "java", "cpp"]);

  /** @param {string | undefined} raw */
  function resolveExplanationPanel(raw, text = "") {
    const key = (raw ?? "").trim().toLowerCase();
    const aliases = {
      py: "python",
      python3: "python",
      "c++": "cpp",
      cplusplus: "cpp",
    };
    let panel = aliases[key] ?? key;
    if (!panel && text) {
      const t = text.toLowerCase();
      if (/\bjava\b/.test(t) && !/\bjavascript\b/.test(t)) panel = "java";
      else if (/\bc\+\+|cpp\b/.test(t)) panel = "cpp";
      else if (/\bpython\b/.test(t)) panel = "python";
    }
    if (!panel) {
      panel = defaultExplanationPanel(getContext().vista);
    }
    if (!TRANSLATION_PANELS.has(panel)) {
      const vista = getContext().vista;
      if (vista !== "text" && panel === "editor") panel = "blocks";
      if (vista === "text" && panel === "blocks") panel = "editor";
    }
    return panel;
  }

  /** @param {ActiveTurn["chunks"][number]} chunk */
  function applyFocusForChunk(chunk) {
    const panel = resolveExplanationPanel(chunk.panel, chunk.text);
    const limits = highlightLimitsForPanel(panel);
    const line = resolveHighlightLine(chunk, panel, limits);
    const resolved = { ...chunk, panel, highlight: { line } };
    if (TRANSLATION_PANELS.has(panel)) {
      onFocusTranslationTab?.(/** @type {'python' | 'java' | 'cpp'} */ (panel));
    }
    focus.enter(panel);
    focus.positionNear(panel);
    highlight.applyForChunk(resolved);
  }

  function translationLineCount(lang) {
    const id =
      lang === "python"
        ? "trans-python"
        : lang === "java"
          ? "trans-java"
          : "trans-cpp";
    return (
      document.getElementById(id)?.querySelectorAll(".trans-row").length || 1
    );
  }

  function consoleOutputLineCount() {
    const domCount = document
      .getElementById("console-body")
      ?.querySelectorAll("[data-console-line]").length;
    if (domCount && domCount > 0) return domCount;
    return Math.max(0, getContext().output?.length ?? 0);
  }

  function highlightLimitsForPanel(panel) {
    const ctx = getContext();
    const codigoLineas = Math.max(1, (ctx.codigo || "").split("\n").length);
    const consolaLineas = consoleOutputLineCount();
    const bloquesMatches = (ctx.bloquesResumen || "").match(/^L\d+\b/gm);
    const bloquesLineas = Math.max(1, bloquesMatches?.length ?? codigoLineas);
    const limits = {
      codigoLineas,
      consolaLineas: Math.max(1, consolaLineas || 1),
      bloquesLineas,
      tradLineas: 1,
    };
    if (panel === "python" || panel === "java" || panel === "cpp") {
      limits.tradLineas = translationLineCount(panel);
    }
    return limits;
  }

  /** @param {HiloTurn["chunks"]} chunks */
  function normalizeExplanationChunks(chunks) {
    return chunks.map((c) => {
      const panel = resolveExplanationPanel(c.panel, c.text);
      const line = resolveHighlightLine(c, panel, highlightLimitsForPanel(panel));
      return { ...c, panel, highlight: { line } };
    });
  }

  /** @param {number} index */
  async function showChunk(index, { pulse = false } = {}) {
    if (!activeTurn) return;
    const chunk = activeTurn.chunks[index];
    if (!chunk) return;

    if (chunk.action && onTutorialAction) {
      await onTutorialAction(chunk.action);
    }

    activeTurn.index = index;
    applyHiloEmotion(avatar, chunk.emotion);
    if (chunk.text.includes("**")) {
      bubbleText.innerHTML = formatBubbleHtml(chunk.text);
    } else {
      bubbleText.textContent = chunk.text;
    }
    bubble.classList.add("show");
    root.dataset.hiloChunk = String(index + 1);

    const presentation = chunk.presentation ?? "focus";
    if (
      (activeTurn.isTutorial || isExplaining()) &&
      !activeTurn.explanationComplete
    ) {
      if (presentation === "center") {
        highlight.clear();
        focus.enterPresentation();
      } else {
        applyFocusForChunk(chunk);
      }
    }

    updateBubbleHint();

    if (pulse) {
      bubble.classList.remove("hilo-bubble--pulse");
      void bubble.offsetWidth;
      bubble.classList.add("hilo-bubble--pulse");
    }
  }

  /** @param {HiloTurn} turn */
  function queueTurn(turn) {
    activeTurn = {
      chunks: turn.chunks,
      index: 0,
      type: turn.type,
      explanationComplete: false,
    };

    if (turn.type === "explanation") {
      setExplainingUi(true);
      setEmotionState("explaining");
    }

    void showChunk(0, { pulse: true });
  }

  function showStaticMessage(text, emotion = "smile") {
    endExplanationFocus();
    activeTurn = null;
    setExplainingUi(false);
    applyHiloEmotion(avatar, emotion);
    bubbleText.textContent = text;
    bubble.classList.add("show");
    bubbleHint.hidden = true;
    root.dataset.hiloChunk = "";
  }

  function endExplanationFocus() {
    focus.exit();
    highlight.clear();
    setExplainingUi(false);
  }

  function finishTutorial() {
    markHiloTutorialComplete();
    tutorialActive = false;
    document.body.classList.remove("hilo-tutorial-active");
    endExplanationFocus();
    activeTurn = null;
    input.disabled = false;
    applyHiloEmotion(avatar, "smile");
    queueTurn(
      localHiloTurn([
        {
          text: "Cuando quieras, pregúntame o pídeme que te explique tu código.",
          emotion: "wink",
        },
      ])
    );
  }

  async function startTutorial() {
    if (isHiloTutorialComplete() || tutorialActive || busy) return;
    if (!spriteReady) {
      try {
        await loadHiloSpriteAtlas();
        spriteReady = true;
      } catch {
        markHiloTutorialComplete();
        return;
      }
    }

    tutorialActive = true;
    document.body.classList.add("hilo-tutorial-active");
    activeTurn = {
      chunks: getHiloTutorialScript(),
      index: 0,
      type: "explanation",
      explanationComplete: false,
      isTutorial: true,
    };

    input.disabled = true;
    setExplainingUi(true);
    setEmotionState("explaining");
    bubble.classList.add("show");
    await showChunk(0, { pulse: true });
  }

  function setBusy(next) {
    busy = next;
    if (!tutorialActive) {
      input.disabled = next;
    }
    sendBtn.disabled = next;
    root.dataset.busy = next ? "true" : "false";
    avatar.classList.toggle("hilo-avatar--active", next);
  }

  function avanzarNivel() {
    mensajesEnProblema += 1;
    if (mensajesEnProblema > 3 && nivelAyuda < 4) {
      nivelAyuda += 1;
      mensajesEnProblema = 0;
    }
  }

  function reiniciarNivelSiSinError() {
    const ctx = getContext();
    if (!ctx.tieneError) {
      nivelAyuda = 1;
      mensajesEnProblema = 0;
    }
  }

  function replayCurrentTurn() {
    if (!activeTurn?.chunks.length || activeTurn.isTutorial) return;
    if (isExplaining()) {
      activeTurn.explanationComplete = false;
      setExplainingUi(true);
      setEmotionState("explaining");
    }
    void showChunk(0, { pulse: true });
  }

  function advanceTurn() {
    if (!activeTurn?.chunks.length || busy) return;

    const { chunks, index, type, explanationComplete, isTutorial } = activeTurn;

    if (isTutorial) {
      if (index < chunks.length - 1) {
        void showChunk(index + 1, { pulse: true });
        return;
      }
      finishTutorial();
      return;
    }

    if (type === "explanation") {
      if (explanationComplete) {
        replayCurrentTurn();
        return;
      }
      if (index < chunks.length - 1) {
        void showChunk(index + 1, { pulse: true });
        return;
      }
      endExplanationFocus();
      activeTurn.explanationComplete = true;
      updateBubbleHint();
      return;
    }

    if (index < chunks.length - 1) {
      void showChunk(index + 1, { pulse: true });
      return;
    }
    replayCurrentTurn();
  }

  function onAvatarClick() {
    if (busy || tutorialActive) {
      if (tutorialActive) advanceTurn();
      return;
    }
    if (!activeTurn?.chunks.length) {
      bubble.classList.toggle("show", !bubble.classList.contains("show"));
      return;
    }
    advanceTurn();
  }

  function onTutorialKeydown(e) {
    if (busy) return;
    if (!tutorialActive && !isExplaining()) return;
    if (e.key !== "Enter" || e.shiftKey) return;
    if (e.target === input) return;
    e.preventDefault();
    advanceTurn();
  }

  /** Desactiva el modo ejercicio y notifica a la UI (navbar) vía main.js. */
  function deactivateExerciseModeUi() {
    deactivateExerciseMode();
    exercise?.onExerciseModeChange?.(false);
  }

  /**
   * Sale del modo ejercicio. Si keepConversation es true, deja el turno activo
   * (p. ej. celebración tras completar el reto).
   */
  function exitExerciseMode({ announce = true, keepConversation = false } = {}) {
    deactivateExerciseModeUi();
    if (keepConversation) return;
    endExplanationFocus();
    activeTurn = null;
    setExplainingUi(false);
    setEmotionState("idle");
    if (announce) {
      showStaticMessage(
        "Saliste del modo ejercicio. Puedes seguir programando con normalidad.",
        "smile"
      );
    }
  }

  /**
   * @param {import("./hilo-response.js").HiloTurn} turn
   * @param {{ tieneError?: boolean, lastRunHadError?: boolean, errores?: string[] }} ctx
   * @param {{ afterRun?: boolean }} [opts]
   */
  function shouldAcceptExerciseCompletion(turn, ctx, { afterRun = false } = {}) {
    if (!turn.ejercicioCompletado || !isExerciseModeActive()) return false;
    if (afterRun) {
      return !ctx.lastRunHadError;
    }
    return !ctx.tieneError;
  }

  /**
   * @param {import("./hilo-response.js").HiloTurn} turn
   */
  function buildTopicFromExerciseTurn(turn) {
    const active = getActiveExercise();
    const dominio = turn.dominioTema;
    const id = slugTopicId(
      dominio?.id || active?.tema_id || dominio?.nombre || active?.titulo || "tema_woven"
    );
    const name =
      dominio?.nombre?.trim() ||
      active?.tema_nombre?.trim() ||
      active?.titulo?.trim() ||
      "Tema Woven";
    const desc =
      dominio?.descripcion?.trim() ||
      `Completaste el ejercicio «${active?.titulo ?? name}».`;
    const icon = dominio?.icono || "🏆";
    return { id, name, desc, icon };
  }

  /**
   * @param {import("./hilo-response.js").HiloTurn} turn
   * @param {{ tieneError?: boolean, lastRunHadError?: boolean, errores?: string[] }} ctx
   * @param {{ afterRun?: boolean }} [opts]
   */
  function tryCompleteExercise(turn, ctx, { afterRun = false } = {}) {
    if (!shouldAcceptExerciseCompletion(turn, ctx, { afterRun })) return;

    const topic = buildTopicFromExerciseTurn(turn);
    deactivateExerciseModeUi();
    try {
      exercise?.onTopicMastery?.(topic);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Logro de aprendizaje:", msg);
    }
    setEmotionState("happy");
  }

  async function maybeActivateStepModeFromTurn(turn) {
    if (!turn?.activarPasoAPaso || !stepMode || stepMode.isActive()) return;
    try {
      await stepMode.enter();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      showStaticMessage(msg, "worried");
    }
  }

  async function sendExerciseAwareMessage(mensaje, { silentRun = false } = {}) {
    const apiKey = geminiApi.getActiveKey();
    const ctx = getContext();
    const inExercise = isExerciseModeActive();
    const intent = detectHiloIntent(mensaje);
    const tipoInteraccion = inExercise
      ? exerciseActiveApiTipo()
      : intentToApiTipo(intent);

    const raw = await sendHiloMessage({
      mensaje,
      historial,
      codigo: ctx.codigo,
      output: ctx.output,
      errores: ctx.errores,
      tieneError: ctx.tieneError,
      modo: ctx.modo,
      nivelAyuda: inExercise ? nivelAyuda : intent === "explanation" ? 1 : nivelAyuda,
      apiKey,
      perfilJson: getPerfilJson(),
      tipoInteraccion,
      bloquesResumen: ctx.bloquesResumen,
      codigoForParse: ctx.codigo,
      outputJsonForParse: JSON.stringify(ctx.output),
      enunciadoJsonForPrepare: inExercise ? getExerciseEnunciadoJson() : "{}",
    });

    let turn = parseHiloTurn(raw);
    if (intent === "explanation" && !inExercise) {
      turn = {
        ...turn,
        type: "explanation",
        chunks: normalizeExplanationChunks(turn.chunks),
      };
    }

    if (!silentRun) {
      historial.push({ role: "user", content: mensaje });
    } else {
      historial.push({
        role: "user",
        content: "[Ejecución Run] " + mensaje,
      });
    }
    historial.push({ role: "model", content: turn.texto_completo });
    if (turn.type !== "explanation") {
      avanzarNivel();
    }
    queueTurn(turn);
    tryCompleteExercise(turn, ctx, { afterRun: silentRun });
    await maybeActivateStepModeFromTurn(turn);
  }

  async function onAfterRun() {
    if (
      tutorialActive ||
      busy ||
      !isExerciseModeActive() ||
      !isRuntimeReady() ||
      !geminiApi.isValid()
    ) {
      return;
    }
    if (runFeedbackPending) return;
    runFeedbackPending = true;
    setBusy(true);
    setEmotionState("thinking");
    bubbleHint.hidden = true;
    bubble.classList.add("show");
    bubbleText.textContent = "Reviso tu ejecución en el ejercicio…";
    try {
      await sendExerciseAwareMessage(
        "Acabo de pulsar Run. Evalúa con rigor si mi programa cumple TODOS los criterios del " +
          "enunciado (código y salida en consola). Si los cumple, pon ejercicio_completado en true " +
          "y dominio_tema; si no, guíame sin dar la solución completa.",
        { silentRun: true }
      );
    } catch (err) {
      setEmotionState("error");
      const msg = err instanceof Error ? err.message : String(err);
      showStaticMessage(msg, "worried");
    } finally {
      runFeedbackPending = false;
      setBusy(false);
    }
  }

  async function sendUserMessage(mensaje) {
    if (tutorialActive) return;

    if (!isRuntimeReady()) {
      setEmotionState("error");
      showStaticMessage(
        "Espera a que termine de cargar el entorno de Woven.",
        "worried"
      );
      return;
    }

    if (!geminiApi.isValid()) {
      setEmotionState("api_missing");
      showStaticMessage(
        "Necesito una clave de Gemini válida. Ábrela en Ajustes y valida la clave.",
        "sad"
      );
      return;
    }

    const apiKey = geminiApi.getActiveKey();
    const ctx = getContext();
    const intent = detectHiloIntent(mensaje);

    endExplanationFocus();
    setBusy(true);
    setEmotionState("thinking");
    activeTurn = null;
    bubbleHint.hidden = true;
    bubble.classList.add("show");

    if (intent === "exercise") {
      stepMode?.exit();
      if (!exercise) {
        showStaticMessage(
          "El modo ejercicio no está disponible todavía.",
          "worried"
        );
        setBusy(false);
        return;
      }
      bubbleText.textContent = "Preparo tu ejercicio…";
      try {
        const { turn } = await runHiloExercise({
          mensaje,
          apiKey,
          perfilJson: getPerfilJson(),
          getContext,
          applyTemplate: exercise.applyTemplate,
          onEnunciado: exercise.onEnunciado,
          onExerciseModeChange: exercise.onExerciseModeChange,
        });
        historial.push({ role: "user", content: mensaje });
        historial.push({ role: "model", content: turn.texto_completo });
        queueTurn(turn);
      } catch (err) {
        setEmotionState("error");
        const msg = err instanceof Error ? err.message : String(err);
        showStaticMessage(msg, "worried");
      } finally {
        setBusy(false);
      }
      return;
    }

    if (intent === "learning") {
      stepMode?.exit();
      if (!learning) {
        showStaticMessage(
          "El modo aprendizaje no está disponible todavía.",
          "worried"
        );
        setBusy(false);
        return;
      }
      bubbleText.textContent = "Preparo un ejemplo para enseñarte…";
      try {
        const { turn } = await runHiloLearning({
          mensaje,
          apiKey,
          perfilJson: getPerfilJson(),
          getContext,
          lintWoven: learning.lintWoven,
          runWoven: learning.runWoven,
          applyExample: learning.applyExample,
          translateAll: learning.translateAll,
          onEnunciado: learning.onEnunciado,
          onTranslations: learning.onTranslations,
          onPhase: (phase) => {
            if (phase === "redaccion") {
              bubbleText.textContent = "Escribo un ejemplo en Woven…";
            } else if (phase === "validacion") {
              bubbleText.textContent = "Compruebo que el ejemplo funciona…";
            } else if (phase === "traduccion") {
              bubbleText.textContent = "Genero traducciones a otros lenguajes…";
            } else if (phase === "explicacion") {
              bubbleText.textContent = "Te explico el concepto…";
              setEmotionState("explaining");
            }
          },
        });

        historial.push({ role: "user", content: mensaje });
        historial.push({ role: "model", content: turn.texto_completo });

        queueTurn({
          ...turn,
          type: "explanation",
          chunks: normalizeExplanationChunks(turn.chunks),
        });
      } catch (err) {
        setEmotionState("error");
        const msg = err instanceof Error ? err.message : String(err);
        showStaticMessage(msg, "worried");
      } finally {
        setBusy(false);
      }
      return;
    }

    if (intent === "step_trace") {
      if (!stepMode) {
        showStaticMessage(
          "El modo paso a paso no está disponible todavía.",
          "worried"
        );
        setBusy(false);
        return;
      }
      stepMode.exit();
      bubbleText.textContent = "Preparo la ejecución paso a paso…";
      try {
        await stepMode.enter();
        historial.push({ role: "user", content: mensaje });
        historial.push({
          role: "model",
          content:
            "Activé el modo paso a paso. Usa Anterior y Siguiente en la barra azul; " +
            "la consola y las variables se actualizan con cada paso.",
        });
        queueTurn(
          localHiloTurn([
            {
              text: "Listo: modo paso a paso activado.",
              emotion: "wink",
            },
            {
              text: "Recorre la traza con Anterior y Siguiente; la consola muestra cada print hasta ese paso.",
              emotion: "smile",
            },
          ])
        );
      } catch (err) {
        setEmotionState("error");
        const msg = err instanceof Error ? err.message : String(err);
        showStaticMessage(msg, "worried");
      } finally {
        setBusy(false);
      }
      return;
    }

    if (intent === "explanation") {
      stepMode?.exit();
    }

    bubbleText.textContent =
      intent === "explanation"
        ? "Preparo la explicación…"
        : isExerciseModeActive()
          ? "Te apoyo con el ejercicio…"
          : "Déjame pensar…";

    try {
      await sendExerciseAwareMessage(mensaje);
    } catch (err) {
      setEmotionState("error");
      const msg = err instanceof Error ? err.message : String(err);
      showStaticMessage(msg, "worried");
    } finally {
      setBusy(false);
    }
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const mensaje = input.value.trim();
    if (!mensaje || busy || tutorialActive) return;
    input.value = "";
    void sendUserMessage(mensaje);
  });

  avatar.addEventListener("click", onAvatarClick);
  document.addEventListener("keydown", onTutorialKeydown);

  loadHiloSpriteAtlas()
    .then(() => {
      spriteReady = true;
      if (isHiloTutorialComplete()) {
        queueTurn(
          localHiloTurn([
            { text: "¡Hola! Soy Hilo.", emotion: "happy" },
            {
              text: "Pregúntame, pídeme un ejercicio o di «paso a paso» si quieres ver la traza.",
              emotion: "smile",
            },
          ])
        );
      }
    })
    .catch(() => {
      spriteReady = true;
      applyHiloEmotion(avatar, getDefaultEmotion());
      showStaticMessage(
        "No pude cargar mi avatar, pero puedes escribirme igual.",
        "worried"
      );
    });

  return {
    onExecutionContextChange() {
      reiniciarNivelSiSinError();
    },
    onAfterRun,
    exitExerciseMode,
    isExerciseModeActive,
    startTutorial,
    isTutorialActive: () => tutorialActive,
  };
}
