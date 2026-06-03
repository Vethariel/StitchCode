import {
  geminiGenerateContentUrl,
  geminiErrorMessage,
} from "./gemini-api-key.js";
import {
  hiloParseRedaction,
  hiloParseResponse,
  hiloPrepareMessage,
  hiloPrepareRedaction,
} from "./bridge/pyodide-bridge.js";

/**
 * @param {string} apiKey
 * @param {string} payloadJson
 */
export async function callGeminiHilo(apiKey, payloadJson) {
  const response = await fetch(geminiGenerateContentUrl(apiKey), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payloadJson,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(await geminiErrorMessage(response, body));
  }

  return response.json();
}

/**
 * @param {{
 *   mensaje: string,
 *   historial: { role: string, content: string }[],
 *   codigo: string,
 *   output: string[],
 *   errores: string[],
 *   tieneError: boolean,
 *   modo: string,
 *   nivelAyuda: number,
 *   apiKey: string,
 *   perfilJson: string,
 *   tipoInteraccion?: string,
 *   codigoForParse?: string,
 *   outputJsonForParse?: string,
 *   bloquesResumen?: string,
 *   traduccionesJsonForParse?: string,
 *   traduccionesJsonForPrepare?: string,
 *   enunciadoJsonForPrepare?: string,
 * }} ctx
 */
export async function sendHiloMessage(ctx) {
  const prep = await hiloPrepareMessage({
    mensaje: ctx.mensaje,
    historialJson: JSON.stringify(ctx.historial),
    codigo: ctx.codigo,
    outputJson: JSON.stringify(ctx.output),
    erroresJson: JSON.stringify(ctx.errores),
    tieneError: ctx.tieneError,
    modo: ctx.modo,
    nivelAyuda: ctx.nivelAyuda,
    perfilJson: ctx.perfilJson,
    tipoInteraccion: ctx.tipoInteraccion ?? "conversacion",
    bloquesResumen: ctx.bloquesResumen ?? "",
    traduccionesJson: ctx.traduccionesJsonForPrepare ?? "{}",
    enunciadoJson: ctx.enunciadoJsonForPrepare ?? "{}",
  });

  if (!prep.ok) {
    throw new Error(prep.error ?? "No se pudo preparar el mensaje para Hilo.");
  }

  const responseJson = await callGeminiHilo(ctx.apiKey, prep.payload);
  const parsed = await hiloParseResponse(JSON.stringify(responseJson), {
    codigo: ctx.codigoForParse ?? ctx.codigo,
    outputJson: ctx.outputJsonForParse ?? JSON.stringify(ctx.output),
    bloquesResumen: ctx.bloquesResumen ?? "",
    modo: ctx.modo,
    traduccionesJson: ctx.traduccionesJsonForParse ?? "{}",
  });
  return parsed;
}

/**
 * @param {{
 *   mensaje: string,
 *   codigo: string,
 *   modo: string,
 *   apiKey: string,
 *   perfilJson: string,
 *   objetivoRedaccion?: string,
 *   bloquesResumen?: string,
 * }} ctx
 */
export async function sendHiloRedaction(ctx) {
  const prep = await hiloPrepareRedaction({
    mensaje: ctx.mensaje,
    codigo: ctx.codigo,
    modo: ctx.modo,
    perfilJson: ctx.perfilJson,
    objetivoRedaccion: ctx.objetivoRedaccion ?? "ejemplo_correcto",
    bloquesResumen: ctx.bloquesResumen ?? "",
  });

  if (!prep.ok) {
    throw new Error(prep.error ?? "No se pudo preparar la redacción.");
  }

  const responseJson = await callGeminiHilo(ctx.apiKey, prep.payload);
  return hiloParseRedaction(responseJson);
}
