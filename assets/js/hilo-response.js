import { normalizeSpriteEmotion } from "./hilo-emotions.js";

/** @typedef {{ text: string, emotion: string }} HiloChunk */
/** @typedef {{ chunks: HiloChunk[], texto_completo: string }} HiloTurn */

/**
 * @param {string} raw JSON devuelto por parsear_respuesta_hilo (Python).
 * @returns {HiloTurn}
 */
export function parseHiloTurn(raw) {
  const data = JSON.parse(raw);
  const chunks = (data.chunks ?? []).map((c) => ({
    text: String(c.text ?? "").trim(),
    emotion: normalizeSpriteEmotion(c.emotion),
  })).filter((c) => c.text.length > 0);

  if (!chunks.length) {
    throw new Error("La respuesta de Hilo no trajo fragmentos.");
  }

  return {
    chunks,
    texto_completo:
      data.texto_completo ?? chunks.map((c) => c.text).join(" "),
  };
}

/**
 * @param {HiloChunk[]} chunks
 * @returns {HiloTurn}
 */
export function localHiloTurn(chunks) {
  const normalized = chunks.map((c) => ({
    text: c.text.trim(),
    emotion: normalizeSpriteEmotion(c.emotion),
  }));
  return {
    chunks: normalized,
    texto_completo: normalized.map((c) => c.text).join(" "),
  };
}
