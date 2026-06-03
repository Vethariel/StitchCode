import { sendHiloMessage } from "./hilo-chat.js";
import { emotionForState } from "./hilo-emotions.js";
import { createHiloFocusController } from "./hilo-focus.js";
import { createHiloHighlightController } from "./hilo-highlight.js";
import { defaultExplanationPanel } from "./hilo-context.js";
import { detectHiloIntent, intentToApiTipo } from "./hilo-intent.js";
import { runHiloLearning } from "./hilo-learning.js";
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
  learning,
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
  /** @type {HiloTurn | null} */
  let pendingFollowUpTurn = null;

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

  /** @param {ActiveTurn["chunks"][number]} chunk */
  function applyFocusForChunk(chunk) {
    const panel = chunk.panel ?? defaultExplanationPanel(getContext().vista);
    focus.enter(panel);
    focus.positionNear(panel);
    highlight.applyForChunk(chunk);
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
      if (pendingFollowUpTurn) {
        const next = pendingFollowUpTurn;
        pendingFollowUpTurn = null;
        queueTurn(next);
      }
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

    if (intent === "learning") {
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
        const { wovenTurn, languagesTurn } = await runHiloLearning({
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
              bubbleText.textContent = "Te explico el concepto en Woven…";
              setEmotionState("explaining");
            } else if (phase === "explicacion_lenguajes") {
              bubbleText.textContent = "Comparo Python, Java y C++…";
              setEmotionState("explaining");
            }
          },
        });

        historial.push({ role: "user", content: mensaje });
        historial.push({
          role: "model",
          content: `${wovenTurn.texto_completo} ${languagesTurn.texto_completo}`,
        });

        const defaultPanel = defaultExplanationPanel(getContext().vista);
        const langDefault = (c, i) => ({
          ...c,
          panel: c.panel ?? defaultPanel,
          highlight: c.highlight ?? { line: i + 1 },
        });
        const langChunks = languagesTurn.chunks.map((c, i) => ({
          ...c,
          panel: c.panel ?? "python",
          highlight: c.highlight ?? { line: i + 1 },
        }));

        pendingFollowUpTurn = {
          ...languagesTurn,
          type: "explanation",
          chunks: langChunks,
        };

        queueTurn({
          ...wovenTurn,
          type: "explanation",
          chunks: wovenTurn.chunks.map(langDefault),
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

    bubbleText.textContent =
      intent === "explanation" ? "Preparo la explicación…" : "Déjame pensar…";

    try {
      const raw = await sendHiloMessage({
        mensaje,
        historial,
        codigo: ctx.codigo,
        output: ctx.output,
        errores: ctx.errores,
        tieneError: ctx.tieneError,
        modo: ctx.modo,
        nivelAyuda: intent === "explanation" ? 1 : nivelAyuda,
        apiKey,
        perfilJson: getPerfilJson(),
        tipoInteraccion: intentToApiTipo(intent),
        bloquesResumen: ctx.bloquesResumen,
        codigoForParse: ctx.codigo,
        outputJsonForParse: JSON.stringify(ctx.output),
      });

      let turn = parseHiloTurn(raw);
      const defaultPanel = defaultExplanationPanel(ctx.vista);
      if (intent === "explanation") {
        turn = {
          ...turn,
          type: "explanation",
          chunks: turn.chunks.map((c, i) => ({
            ...c,
            panel: c.panel ?? defaultPanel,
            highlight: c.highlight ?? { line: i + 1 },
          })),
        };
      }

      historial.push({ role: "user", content: mensaje });
      historial.push({ role: "model", content: turn.texto_completo });
      if (turn.type !== "explanation") {
        avanzarNivel();
      }
      queueTurn(turn);
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
              text: "Pregúntame sobre tu código o pídeme que te lo explique.",
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
    startTutorial,
    isTutorialActive: () => tutorialActive,
  };
}
