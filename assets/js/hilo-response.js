import { normalizeSpriteEmotion } from "./hilo-emotions.js";

/** @typedef {{ line: number, start?: number, end?: number }} HiloHighlight */
/** @typedef {'editor' | 'blocks' | 'console' | 'python' | 'java' | 'cpp'} HiloPanel */
/** @typedef {{
 *   text: string,
 *   emotion: string,
 *   panel?: HiloPanel,
 *   highlight?: HiloHighlight,
 * }} HiloChunk */
/** @typedef {{
 *   id: string,
 *   nombre: string,
 *   descripcion: string,
 *   icono: string,
 * }} HiloTopicAchievement */
/** @typedef {{
 *   type: 'conversation' | 'explanation',
 *   chunks: HiloChunk[],
 *   texto_completo: string,
 *   ejercicioCompletado?: boolean,
 *   dominioTema?: HiloTopicAchievement | null,
 * }} HiloTurn */

/**
 * @param {object} c
 * @returns {HiloChunk}
 */
function normalizeChunk(c) {
  /** @type {HiloChunk} */
  const chunk = {
    text: String(c.text ?? "").trim(),
    emotion: normalizeSpriteEmotion(c.emotion),
  };
  const panel = String(c.panel ?? "").toLowerCase();
  if (
    panel === "editor" ||
    panel === "blocks" ||
    panel === "console" ||
    panel === "python" ||
    panel === "java" ||
    panel === "cpp"
  ) {
    chunk.panel = panel;
  }
  if (c.highlight && typeof c.highlight === "object") {
    const line = Number(c.highlight.line);
    if (Number.isFinite(line) && line >= 1) {
      chunk.highlight = { line: Math.floor(line) };
    }
  }
  return chunk;
}

/**
 * @param {string} raw JSON devuelto por parsear_respuesta_hilo (Python).
 * @returns {HiloTurn}
 */
export function parseHiloTurn(raw) {
  const data = JSON.parse(raw);
  const chunks = (data.chunks ?? [])
    .map(normalizeChunk)
    .filter((c) => c.text.length > 0);

  if (!chunks.length) {
    throw new Error("La respuesta de Hilo no trajo fragmentos.");
  }

  const soloJson = chunks.every((c) => /^[\{\}\[\]\s":,]+$/.test(c.text));
  if (soloJson || (chunks.length === 1 && chunks[0].text === "{")) {
    throw new Error(
      "La respuesta de Hilo llegó mal formateada. Intenta enviar el mensaje de nuevo."
    );
  }

  const rawType = String(data.type ?? "conversation").toLowerCase();
  const type =
    rawType === "explanation" || rawType === "explicacion"
      ? "explanation"
      : "conversation";

  /** @type {HiloTurn} */
  const turn = {
    type,
    chunks,
    texto_completo:
      data.texto_completo ?? chunks.map((c) => c.text).join(" "),
  };

  const completado =
    data.ejercicio_completado === true ||
    String(data.ejercicio_completado).toLowerCase() === "true";
  if (completado) {
    turn.ejercicioCompletado = true;
    const t = data.dominio_tema;
    if (t && typeof t === "object") {
      turn.dominioTema = {
        id: String(t.id ?? "").trim(),
        nombre: String(t.nombre ?? "").trim(),
        descripcion: String(t.descripcion ?? "").trim(),
        icono: String(t.icono ?? "🏆").trim() || "🏆",
      };
    }
  }

  return turn;
}

/**
 * @param {HiloChunk[]} chunks
 * @param {'conversation' | 'explanation'} [type]
 * @returns {HiloTurn}
 */
export function localHiloTurn(chunks, type = "conversation") {
  const normalized = chunks.map((c) => normalizeChunk(c));
  return {
    type,
    chunks: normalized,
    texto_completo: normalized.map((c) => c.text).join(" "),
  };
}
