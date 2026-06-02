import { sendHiloMessage } from "./hilo-chat.js";
import { emotionForState } from "./hilo-emotions.js";
import { createHiloFocusController } from "./hilo-focus.js";
import { createHiloHighlightController } from "./hilo-highlight.js";
import { defaultExplanationPanel } from "./hilo-context.js";
import { detectHiloIntent, intentToApiTipo } from "./hilo-intent.js";
import { localHiloTurn, parseHiloTurn } from "./hilo-response.js";
import {
  applyHiloEmotion,
  getDefaultEmotion,
  loadHiloSpriteAtlas,
} from "./hilo-sprite.js";

/**
 * @typedef {import("./hilo-response.js").HiloTurn} HiloTurn
 * @typedef {{
 *   chunks: HiloTurn["chunks"],
 *   index: number,
 *   type: 'conversation' | 'explanation',
 *   explanationComplete: boolean,
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
}) {
  /** @type {{ role: string, content: string }[]} */
  let historial = [];
  let nivelAyuda = 1;
  let mensajesEnProblema = 0;
  /** @type {ActiveTurn | null} */
  let activeTurn = null;
  let busy = false;

  function isExplaining() {
    return activeTurn?.type === "explanation";
  }

  function setExplainingUi(on) {
    root.classList.toggle("hilo-agent--explaining", on);
    avatar.setAttribute(
      "aria-label",
      on
        ? "Hilo — Enter para continuar la explicación"
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

    if (activeTurn.type === "explanation") {
      if (activeTurn.explanationComplete) {
        bubbleHint.hidden = false;
        bubbleHint.textContent = "Enter para repetir la explicación";
        return;
      }
      bubbleHint.hidden = false;
      if (activeTurn.index < n - 1) {
        bubbleHint.textContent = `Enter para continuar (${i}/${n})`;
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

  /** @param {number} index */
  function applyExplanationFocus(index) {
    const chunk = activeTurn?.chunks[index];
    if (!chunk) return;
    const ctx = getContext();
    const panel = chunk.panel ?? defaultExplanationPanel(ctx.vista);
    focus.enter(panel);
    focus.positionNear(panel);
    highlight.applyForChunk(chunk);
  }

  function endExplanationFocus() {
    focus.exit();
    highlight.clear();
    setExplainingUi(false);
  }

  /** @param {number} index */
  function showChunk(index, { pulse = false } = {}) {
    if (!activeTurn) return;
    const chunk = activeTurn.chunks[index];
    if (!chunk) return;

    activeTurn.index = index;
    applyHiloEmotion(avatar, chunk.emotion);
    bubbleText.textContent = chunk.text;
    bubble.classList.add("show");
    root.dataset.hiloChunk = String(index + 1);

    if (
      isExplaining() &&
      !activeTurn.explanationComplete
    ) {
      applyExplanationFocus(index);
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

    showChunk(0, { pulse: true });
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

  function setBusy(next) {
    busy = next;
    input.disabled = next;
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
    if (!activeTurn?.chunks.length) return;
    if (isExplaining()) {
      activeTurn.explanationComplete = false;
      setExplainingUi(true);
      setEmotionState("explaining");
    }
    showChunk(0, { pulse: true });
  }

  function advanceTurn() {
    if (!activeTurn?.chunks.length || busy) return;

    const { chunks, index, type, explanationComplete } = activeTurn;

    if (type === "explanation") {
      if (explanationComplete) {
        replayCurrentTurn();
        return;
      }
      if (index < chunks.length - 1) {
        showChunk(index + 1, { pulse: true });
        return;
      }
      endExplanationFocus();
      activeTurn.explanationComplete = true;
      updateBubbleHint();
      return;
    }

    if (index < chunks.length - 1) {
      showChunk(index + 1, { pulse: true });
      return;
    }
    replayCurrentTurn();
  }

  function onAvatarClick() {
    if (busy) return;
    if (!activeTurn?.chunks.length) {
      bubble.classList.toggle("show", !bubble.classList.contains("show"));
      return;
    }
    advanceTurn();
  }

  function onExplanationKeydown(e) {
    if (busy || !isExplaining()) return;
    if (e.key !== "Enter" || e.shiftKey) return;
    if (e.target === input) return;
    e.preventDefault();
    advanceTurn();
  }

  async function sendUserMessage(mensaje) {
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
    bubbleText.textContent =
      intent === "explanation" ? "Preparo la explicación…" : "Déjame pensar…";
    bubbleHint.hidden = true;
    bubble.classList.add("show");

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
    if (!mensaje || busy) return;
    input.value = "";
    void sendUserMessage(mensaje);
  });

  avatar.addEventListener("click", onAvatarClick);
  document.addEventListener("keydown", onExplanationKeydown);

  loadHiloSpriteAtlas()
    .then(() => {
      queueTurn(
        localHiloTurn([
          { text: "¡Hola! Soy Hilo.", emotion: "happy" },
          {
            text: "Pregúntame sobre tu código o pídeme que te lo explique.",
            emotion: "smile",
          },
          {
            text: "En una explicación uso modo foco: resalto el código o la consola.",
            emotion: "wink",
          },
          {
            text: "Clic en mí para avanzar; en explicaciones, usa Enter.",
            emotion: "neutral",
          },
        ])
      );
    })
    .catch(() => {
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
  };
}
