import { normalizeSpriteEmotion } from "./hilo-emotions.js";

/** @typedef {{ line: number, start?: number, end?: number }} HiloHighlight */
/** @typedef {'editor' | 'blocks' | 'console'} HiloPanel */
/** @typedef {{
 *   text: string,
 *   emotion: string,
 *   panel?: HiloPanel,
 *   highlight?: HiloHighlight,
 * }} HiloChunk */
/** @typedef {{
 *   type: 'conversation' | 'explanation',
 *   chunks: HiloChunk[],
 *   texto_completo: string,
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
  if (panel === "editor" || panel === "blocks" || panel === "console") {
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

  const rawType = String(data.type ?? "conversation").toLowerCase();
  const type =
    rawType === "explanation" || rawType === "explicacion"
      ? "explanation"
      : "conversation";

  return {
    type,
    chunks,
    texto_completo:
      data.texto_completo ?? chunks.map((c) => c.text).join(" "),
  };
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
