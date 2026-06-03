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

/**
 * @param {{ mensaje: string, forceCorrecto?: boolean }} opts
 * @returns {RedaccionObjetivo}
 */
export function inferRedaccionObjetivo(mensaje, opts = {}) {
  if (opts.forceCorrecto) return "ejemplo_correcto";
  const t = mensaje.toLowerCase();
  if (
    /\b(?:corregir|corrige|con\s+errores?|para\s+corregir|ejemplo\s+incorrecto|falla\s+a\s+prop[oó]sito)\b/i.test(
      t
    )
  ) {
    return "ejemplo_para_corregir";
  }
  return "ejemplo_correcto";
}

/**
 * @param {{ parse_ok?: boolean, diagnosticos?: { mensaje?: string, texto?: string }[], errores?: { mensaje?: string }[] }} lint
 */
export function lintMessagesFromResult(lint) {
  const items = lint.diagnosticos ?? lint.errores ?? [];
  return items
    .map((e) => e.mensaje || e.texto || "")
    .filter(Boolean)
    .join("; ");
}

/** Ejemplo mínimo válido cuando el modelo insiste con sintaxis inválida (listas). */
export function fallbackWovenExampleForTopic(mensaje) {
  const t = mensaje.toLowerCase();
  if (/\blistas?\b|\barrays?\b|\bappend\b|\b[ií]ndice/i.test(t)) {
    return (
      'list<string> tareas = ["Estudiar", "Practicar"]\n' +
      "print(tareas[0])\n" +
      'tareas.append("Repasar")\n' +
      "print(tareas[2])"
    );
  }
  if (/\bbucles?\b|\bfor\b|\biteraci/i.test(t)) {
    return "for int i = 0; i < 3; i++:\n    print(i)";
  }
  return 'list<int> nums = [10, 20]\nprint(nums[0])';
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
  const codigo = sanitizeModelWovenCode(String(data.codigo ?? ""));
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
  const clean = sanitizeModelWovenCode(codigo);
  const lint = await lintWoven(clean);
  if (!lint.parse_ok) {
    const msgs = lintMessagesFromResult(lint);
    return {
      ok: false,
      reason: "sintaxis",
      detail:
        msgs ||
        (lint.tiene_errores
          ? "El programa no tiene sintaxis Woven válida."
          : "El motor Woven no está listo. Espera a que cargue el intérprete e inténtalo de nuevo."),
    };
  }

  const run = await runWoven(clean);
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
