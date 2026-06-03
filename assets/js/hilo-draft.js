/** @typedef {'ejemplo_correcto' | 'ejemplo_para_corregir'} RedaccionObjetivo */
/** @typedef {{
 *   type: 'redaccion',
 *   codigo: string,
 *   objetivo: RedaccionObjetivo,
 *   resumen: string,
 * }} RedaccionResult */
/** @typedef {{
 *   ok: true,
 *   output: string[],
 *   objetivo: RedaccionObjetivo,
 * } | {
 *   ok: false,
 *   reason: string,
 *   detail: string,
 * }} DraftValidation */

/**
 * Objetivo de redacción según el pedido (extensible a más usos).
 * @param {string} mensaje
 * @returns {RedaccionObjetivo}
 */
/**
 * Extrae código Woven plano desde respuestas del modelo (fences, \\n literales).
 * @param {string} raw
 * @returns {string}
 */
export function sanitizeModelWovenCode(raw) {
  let s = String(raw ?? "").trim();
  const fence = s.match(/```(?:woven|python|java|cpp)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  if (s.includes("\\n") && !s.includes("\n")) {
    s = s.replace(/\\n/g, "\n").replace(/\\t/g, "\t");
  }
  return s.trim();
}

export function inferRedaccionObjetivo(mensaje) {
  const t = mensaje.toLowerCase();
  if (
    /\b(?:corregir|corrige|con\s+errores?|para\s+corregir|ejemplo\s+incorrecto|arreglar|falla\s+a\s+prop[oó]sito)\b/i.test(
      t
    )
  ) {
    return "ejemplo_para_corregir";
  }
  return "ejemplo_correcto";
}

/**
 * @param {string} raw JSON de parsear_respuesta_redaccion.
 * @returns {RedaccionResult}
 */
export function parseRedaccionResponse(raw) {
  const data = JSON.parse(raw);
  const objetivo =
    data.objetivo === "ejemplo_para_corregir"
      ? "ejemplo_para_corregir"
      : "ejemplo_correcto";
  const codigo = String(data.codigo ?? "").trim();
  if (!codigo) {
    throw new Error("Hilo no devolvió código Woven en la redacción.");
  }
  return {
    type: "redaccion",
    codigo,
    objetivo,
    resumen: String(data.resumen ?? "").trim(),
  };
}

/**
 * Confirma que el borrador compila y ejecuta (objetivo ejemplo_correcto).
 * @param {string} codigo
 * @param {RedaccionObjetivo} objetivo
 * @param {{
 *   lintWoven: (code: string) => Promise<{ parse_ok: boolean, errores?: { mensaje: string }[] }>,
 *   runWoven: (code: string) => Promise<{ salida: string[], tiene_errores: boolean, diagnosticos?: { mensaje: string }[] }>,
 * }} runtime
 * @returns {Promise<DraftValidation>}
 */
export async function validateWovenDraft(codigo, objetivo, { lintWoven, runWoven }) {
  const lint = await lintWoven(codigo);
  if (!lint.parse_ok) {
    const msgs = (lint.errores ?? []).map((e) => e.mensaje).join("; ");
    return {
      ok: false,
      reason: "sintaxis",
      detail: msgs || "El programa no tiene sintaxis Woven válida.",
    };
  }

  const run = await runWoven(codigo);
  if (run.tiene_errores) {
    const msgs = (run.diagnosticos ?? []).map((d) => d.mensaje).join("; ");
    return {
      ok: false,
      reason: "ejecucion",
      detail: msgs || "El programa falló al ejecutarse.",
    };
  }

  if (objetivo === "ejemplo_correcto" && !run.salida?.length) {
    return {
      ok: false,
      reason: "salida",
      detail:
        "El ejemplo correcto debe producir salida en consola (usa print u otro efecto visible).",
    };
  }

  return { ok: true, output: run.salida ?? [], objetivo };
}
