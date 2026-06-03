import {
  fallbackWovenExampleForTopic,
  inferRedaccionObjetivo,
  parseRedaccionResponse,
  sanitizeModelWovenCode,
  validateWovenDraft,
} from "./hilo-draft.js";

const LEARNING_DRAFT_MAX_ATTEMPTS = 4;
import { sendHiloMessage, sendHiloRedaction } from "./hilo-chat.js";
import { parseHiloTurn } from "./hilo-response.js";

/**
 * Poder Aprendizaje: redacción validada → traducciones → ejemplo en editor →
 * una sola explicación integrada (Woven + Python/Java/C++).
 * @param {{
 *   mensaje: string,
 *   apiKey: string,
 *   perfilJson: string,
 *   getContext: () => {
 *     codigo: string,
 *     output: string[],
 *     errores: string[],
 *     tieneError: boolean,
 *     modo: string,
 *     vista: string,
 *     bloquesResumen: string,
 *   },
 *   lintWoven: (code: string) => Promise<import("./linter-controller.js").LintResult>,
 *   runWoven: (code: string) => Promise<{ salida: string[], tiene_errores: boolean, diagnosticos?: { mensaje: string }[] }>,
 *   applyExample: (code: string) => Promise<void>,
 *   translateAll: (code: string) => Promise<{ python: string, java: string, cpp: string }>,
 *   onEnunciado?: (data: { tag: string, title: string, paragraphs: string[] }) => void,
 *   onTranslations?: (trans: { python: string, java: string, cpp: string }) => void,
 *   onPhase?: (phase: 'redaccion' | 'validacion' | 'traduccion' | 'explicacion', detail?: string) => void,
 *   forceEjemploCorrecto?: boolean,
 *   redactionPreamble?: string,
 * }} opts
 */
export async function runHiloLearning({
  mensaje,
  apiKey,
  perfilJson,
  getContext,
  lintWoven,
  runWoven,
  applyExample,
  translateAll,
  onEnunciado,
  onTranslations,
  onPhase,
  forceEjemploCorrecto = false,
  redactionPreamble,
}) {
  const objetivo = inferRedaccionObjetivo(mensaje, {
    forceCorrecto: forceEjemploCorrecto,
  });
  const ctx0 = getContext();

  onPhase?.("redaccion");

  /**
   * @param {string} userPrompt
   * @param {string} [retryDetail]
   */
  function buildRedactionPrompt(userPrompt, retryDetail) {
    const wovenRules =
      "Solo sintaxis Woven (nunca Python). Para listas: list<int> o list<string>, [a, b], x[i], .append(valor). " +
      "Debe compilar y ejecutar con print.";
    const parts = [
      redactionPreamble,
      wovenRules,
      userPrompt,
      retryDetail
        ? `El intento anterior falló: ${retryDetail}. Genera otro programa Woven válido.`
        : "",
    ];
    return parts.filter(Boolean).join("\n\n");
  }

  /** @param {string} prompt */
  async function requestDraft(prompt) {
    const raw = await sendHiloRedaction({
      mensaje: buildRedactionPrompt(prompt),
      codigo: ctx0.codigo,
      modo: ctx0.modo,
      apiKey,
      perfilJson,
      objetivoRedaccion: objetivo,
      bloquesResumen: ctx0.bloquesResumen,
    });
    const draft = parseRedaccionResponse(raw);
    draft.codigo = sanitizeModelWovenCode(draft.codigo);
    return draft;
  }

  const basePrompt = `Prepara un ejemplo Woven corto para enseñar: ${mensaje}`;

  /** @type {import("./hilo-draft.js").RedaccionResult} */
  let draft = await requestDraft(basePrompt);

  onPhase?.("validacion");

  /** @type {import("./hilo-draft.js").DraftValidation} */
  let validation = await validateWovenDraft(draft.codigo, draft.objetivo, {
    lintWoven,
    runWoven,
  });

  for (let attempt = 1; attempt < LEARNING_DRAFT_MAX_ATTEMPTS && !validation.ok; attempt++) {
    if (objetivo !== "ejemplo_correcto") break;
    draft = await requestDraft(
      `${basePrompt}. Objetivo: ${objetivo}.`,
      validation.detail
    );
    validation = await validateWovenDraft(draft.codigo, draft.objetivo, {
      lintWoven,
      runWoven,
    });
  }

  if (!validation.ok && objetivo === "ejemplo_correcto") {
    const fallback = sanitizeModelWovenCode(
      fallbackWovenExampleForTopic(mensaje)
    );
    validation = await validateWovenDraft(fallback, objetivo, {
      lintWoven,
      runWoven,
    });
    if (validation.ok) {
      draft = {
        type: "redaccion",
        codigo: fallback,
        objetivo,
        resumen: draft.resumen || "Ejemplo de respaldo para el tema.",
      };
    }
  }

  if (!validation.ok) {
    throw new Error(
      `No pude preparar un ejemplo válido: ${validation.detail}`
    );
  }

  onPhase?.("traduccion");
  const translations = await translateAll(draft.codigo);
  onTranslations?.(translations);

  onEnunciado?.({
    tag: "Aprendizaje",
    title: mensaje.trim().slice(0, 120) || "Concepto",
    paragraphs: [
      draft.resumen ||
        "Estudia el ejemplo en el editor y compáralo con otras sintaxis.",
      "Sigue la explicación de Hilo: primero el ejemplo Woven y luego Python, Java y C++ en el panel lateral.",
    ],
  });

  await applyExample(draft.codigo);

  onPhase?.("explicacion");

  const ctx1 = getContext();
  const traduccionesJson = JSON.stringify(translations);
  const tieneSalida = ctx1.output.length > 0;
  const lineasCodigo = ctx1.codigo.split("\n").length;
  const promptExplicacion =
    `El estudiante quiere aprender: ${mensaje}. ` +
    `Hay un ejemplo Woven validado en pantalla (${lineasCodigo} líneas de código` +
    `${draft.resumen ? `; ${draft.resumen}` : ""}). ` +
    `Traducciones a Python, Java y C++ en el panel lateral. ` +
    "Da UNA explicación continua en este orden: " +
    "(1) concepto breve, " +
    "(2) recorre TODO el código del ejemplo línea a línea sin omitir partes, " +
    (tieneSalida
      ? "(3) explica DESPUÉS cada línea de la salida en consola (panel console), "
      : "") +
    "(4) comparación con Python, Java y C++. " +
    "Usa highlight.line acorde a la línea que comentas. **negritas** en términos clave.";

  const rawExplain = await sendHiloMessage({
    mensaje: promptExplicacion,
    historial: [],
    codigo: ctx1.codigo,
    output: ctx1.output,
    errores: ctx1.errores,
    tieneError: false,
    modo: ctx1.modo,
    nivelAyuda: 1,
    apiKey,
    perfilJson,
    tipoInteraccion: "explicacion_aprendizaje",
    bloquesResumen: ctx1.bloquesResumen,
    codigoForParse: ctx1.codigo,
    outputJsonForParse: JSON.stringify(ctx1.output),
    traduccionesJsonForParse: traduccionesJson,
    traduccionesJsonForPrepare: traduccionesJson,
  });

  const turn = parseHiloTurn(rawExplain);

  return {
    draft,
    validation,
    translations,
    turn: {
      ...turn,
      type: "explanation",
    },
  };
}
