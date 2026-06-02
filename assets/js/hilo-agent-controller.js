import { sendHiloMessage } from "./hilo-chat.js";
import { emotionForState } from "./hilo-emotions.js";
import { localHiloTurn, parseHiloTurn } from "./hilo-response.js";
import {
  applyHiloEmotion,
  getDefaultEmotion,
  loadHiloSpriteAtlas,
} from "./hilo-sprite.js";

/**
 * @typedef {{ chunks: { text: string, emotion: string }[], index: number }} ActiveTurn
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
 *   geminiApiKey: { isValid: () => boolean, getActiveKey: () => string },
 *   isRuntimeReady: () => boolean,
 *   getContext: () => {
 *     codigo: string,
 *     output: string[],
 *     errores: string[],
 *     tieneError: boolean,
 *     modo: string,
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
  geminiApiKey,
  isRuntimeReady,
  getContext,
}) {
  /** @type {{ role: string, content: string }[]} */
  let historial = [];
  let nivelAyuda = 1;
  let mensajesEnProblema = 0;
  /** @type {ActiveTurn | null} */
  let activeTurn = null;
  let busy = false;

  function setEmotionState(state) {
    applyHiloEmotion(avatar, emotionForState(state));
  }

  function updateBubbleHint() {
    if (!activeTurn || activeTurn.chunks.length <= 1) {
      bubbleHint.hidden = true;
      bubbleHint.textContent = "";
      return;
    }
    const n = activeTurn.chunks.length;
    const i = activeTurn.index + 1;
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

  function showChunk(index, { pulse = false } = {}) {
    if (!activeTurn) return;
    const chunk = activeTurn.chunks[index];
    if (!chunk) return;

    activeTurn.index = index;
    applyHiloEmotion(avatar, chunk.emotion);
    bubbleText.textContent = chunk.text;
    bubble.classList.add("show");
    root.dataset.hiloChunk = String(index + 1);
    updateBubbleHint();

    if (pulse) {
      bubble.classList.remove("hilo-bubble--pulse");
      void bubble.offsetWidth;
      bubble.classList.add("hilo-bubble--pulse");
    }
  }

  function queueTurn(turn) {
    activeTurn = { chunks: turn.chunks, index: 0 };
    showChunk(0, { pulse: true });
  }

  function showStaticMessage(text, emotion = "smile") {
    activeTurn = null;
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
    showChunk(0, { pulse: true });
  }

  function onAvatarClick() {
    if (busy) return;

    if (!activeTurn?.chunks.length) {
      bubble.classList.toggle("show", !bubble.classList.contains("show"));
      return;
    }

    const { chunks, index } = activeTurn;
    if (index < chunks.length - 1) {
      showChunk(index + 1, { pulse: true });
      return;
    }
    replayCurrentTurn();
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

    if (!geminiApiKey.isValid()) {
      setEmotionState("api_missing");
      showStaticMessage(
        "Necesito una clave de Gemini válida. Configúrala abajo y pulsa Validar.",
        "sad"
      );
      return;
    }

    const apiKey = geminiApiKey.getActiveKey();
    const ctx = getContext();

    setBusy(true);
    setEmotionState("thinking");
    activeTurn = null;
    bubbleText.textContent = "Déjame pensar…";
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
        nivelAyuda,
        apiKey,
      });

      const turn = parseHiloTurn(raw);
      historial.push({ role: "user", content: mensaje });
      historial.push({ role: "model", content: turn.texto_completo });
      avanzarNivel();
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

  loadHiloSpriteAtlas()
    .then(() => {
      queueTurn(
        localHiloTurn([
          { text: "¡Hola! Soy Hilo.", emotion: "happy" },
          {
            text: "Pregúntame sobre tu código Woven y te guío paso a paso.",
            emotion: "smile",
          },
          { text: "Haz clic en mí para avanzar o repetir cada mensaje.", emotion: "wink" },
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
