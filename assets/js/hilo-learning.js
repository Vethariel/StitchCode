import { inferRedaccionObjetivo, parseRedaccionResponse, validateWovenDraft } from "./hilo-draft.js";
import { sendHiloMessage, sendHiloRedaction } from "./hilo-chat.js";
import { parseHiloTurn } from "./hilo-response.js";

/**
 * Poder Aprendizaje: redacción validada → traducciones → reemplazar editor →
 * explicación Woven → explicación comparativa Python/Java/C++.
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
 *   onPhase?: (phase: 'redaccion' | 'validacion' | 'traduccion' | 'explicacion' | 'explicacion_lenguajes', detail?: string) => void,
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
}) {
  const objetivo = inferRedaccionObjetivo(mensaje);
  const ctx0 = getContext();

  onPhase?.("redaccion");

  /** @param {string} prompt */
  async function requestDraft(prompt) {
    const raw = await sendHiloRedaction({
      mensaje: prompt,
      codigo: ctx0.codigo,
      modo: ctx0.modo,
      apiKey,
      perfilJson,
      objetivoRedaccion: objetivo,
      bloquesResumen: ctx0.bloquesResumen,
    });
    return parseRedaccionResponse(raw);
  }

  let draft = await requestDraft(
    `Prepara un ejemplo Woven para enseñar: ${mensaje}. Objetivo: ${objetivo}.`
  );

  onPhase?.("validacion");

  let validation = await validateWovenDraft(draft.codigo, draft.objetivo, {
    lintWoven,
    runWoven,
  });

  if (!validation.ok && objetivo === "ejemplo_correcto") {
    draft = await requestDraft(
      `El código anterior no fue válido (${validation.detail}). ` +
        `Genera otro ejemplo Woven correcto para: ${mensaje}.`
    );
    validation = await validateWovenDraft(draft.codigo, draft.objetivo, {
      lintWoven,
      runWoven,
    });
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
      "Revisa las pestañas Python, Java y C++ en el panel lateral cuando termine la explicación de Woven.",
    ],
  });

  await applyExample(draft.codigo);

  onPhase?.("explicacion");

  const ctx1 = getContext();
  const promptExplicacion =
    `El estudiante quiere aprender: ${mensaje}. ` +
    `Ya hay un ejemplo validado en pantalla${draft.resumen ? ` (${draft.resumen})` : ""}. ` +
    "Explica el concepto paso a paso usando ese ejemplo (modo foco).";

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
    tipoInteraccion: "explicacion",
    bloquesResumen: ctx1.bloquesResumen,
    codigoForParse: ctx1.codigo,
    outputJsonForParse: JSON.stringify(ctx1.output),
  });

  const wovenTurn = parseHiloTurn(rawExplain);

  onPhase?.("explicacion_lenguajes");

  const traduccionesJson = JSON.stringify(translations);
  const promptLenguajes =
    `El estudiante aprendió: ${mensaje}. ` +
    `Ya vio el ejemplo en Woven y su explicación. ` +
    "Explica particularidades del mismo concepto en Python, Java y C++ " +
    "usando las traducciones del contexto (panel lateral). " +
    "Resalta términos clave con **negritas**.\n\n" +
    `PYTHON:\n${translations.python}\n\n` +
    `JAVA:\n${translations.java}\n\n` +
    `C++:\n${translations.cpp}`;

  const rawLang = await sendHiloMessage({
    mensaje: promptLenguajes,
    historial: [],
    codigo: ctx1.codigo,
    output: ctx1.output,
    errores: [],
    tieneError: false,
    modo: ctx1.modo,
    nivelAyuda: 1,
    apiKey,
    perfilJson,
    tipoInteraccion: "explicacion_lenguajes",
    bloquesResumen: ctx1.bloquesResumen,
    codigoForParse: ctx1.codigo,
    outputJsonForParse: JSON.stringify(ctx1.output),
    traduccionesJsonForParse: traduccionesJson,
  });

  const languagesTurn = parseHiloTurn(rawLang);

  return {
    draft,
    validation,
    translations,
    wovenTurn: {
      ...wovenTurn,
      type: "explanation",
    },
    languagesTurn: {
      ...languagesTurn,
      type: "explanation",
    },
  };
}
