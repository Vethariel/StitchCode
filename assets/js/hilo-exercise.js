import { callGeminiHilo } from "./hilo-chat.js";
import {
  hiloEstablishExercise,
  hiloParseExercise,
} from "./bridge/pyodide-bridge.js";
import { activateExerciseMode } from "./hilo-exercise-mode.js";
import { slugTopicId } from "./learning-achievements.js";
import { localHiloTurn } from "./hilo-response.js";

/**
 * @typedef {{
 *   titulo: string,
 *   enunciado: string[],
 *   codigo_plantilla: string,
 *   criterios: string[],
 *   resumen: string,
 *   tema_id: string,
 *   tema_nombre: string,
 * }} ExercisePayload
 */

/**
 * @param {string} raw JSON normalizado desde Python.
 * @returns {ExercisePayload}
 */
export function parseExercisePayload(raw) {
  const data = JSON.parse(raw);
  if (String(data.type).toLowerCase() !== "ejercicio") {
    throw new Error("La respuesta no es un ejercicio válido.");
  }
  const parrafos = Array.isArray(data.enunciado)
    ? data.enunciado.map((p) => String(p).trim()).filter(Boolean)
    : [];
  const codigo = String(data.codigo_plantilla ?? data.codigo ?? "").trim();
  if (!codigo) {
    throw new Error("El ejercicio no incluyó código inicial.");
  }
  const titulo = String(data.titulo ?? "Ejercicio").trim() || "Ejercicio";
  const temaNombre = String(data.tema_nombre ?? titulo).trim() || titulo;
  return {
    titulo,
    enunciado: parrafos.length ? parrafos : [titulo],
    codigo_plantilla: codigo,
    criterios: Array.isArray(data.criterios)
      ? data.criterios.map((c) => String(c).trim()).filter(Boolean)
      : [],
    resumen: String(data.resumen ?? "").trim(),
    tema_id: slugTopicId(String(data.tema_id ?? temaNombre)),
    tema_nombre: temaNombre,
  };
}

/**
 * Poder Ejercicio: genera enunciado + plantilla, activa modo global.
 * @param {{
 *   mensaje: string,
 *   apiKey: string,
 *   perfilJson: string,
 *   getContext: () => {
 *     codigo: string,
 *     modo: string,
 *     bloquesResumen: string,
 *   },
 *   applyTemplate: (code: string) => Promise<void>,
 *   onEnunciado?: (data: { tag: string, title: string, paragraphs: string[] }) => void,
 *   onExerciseModeChange?: (active: boolean) => void,
 * }} opts
 */
export async function runHiloExercise({
  mensaje,
  apiKey,
  perfilJson,
  getContext,
  applyTemplate,
  onEnunciado,
  onExerciseModeChange,
}) {
  const ctx = getContext();
  const prep = await hiloEstablishExercise({
    mensaje,
    codigo: ctx.codigo,
    modo: ctx.modo,
    perfilJson,
    bloquesResumen: ctx.bloquesResumen ?? "",
  });

  if (!prep.ok) {
    throw new Error(prep.error ?? "No se pudo preparar el ejercicio.");
  }

  const responseJson = await callGeminiHilo(apiKey, prep.payload);
  const normalized = await hiloParseExercise(responseJson);
  const exercise = parseExercisePayload(normalized);

  const paragraphs = [...exercise.enunciado];
  if (exercise.criterios.length) {
    paragraphs.push(
      "Criterios: " + exercise.criterios.map((c) => `• ${c}`).join(" ")
    );
  }

  onEnunciado?.({
    tag: "Ejercicio",
    title: exercise.titulo,
    paragraphs,
  });

  activateExerciseMode({
    titulo: exercise.titulo,
    enunciado: exercise.enunciado,
    criterios: exercise.criterios,
    resumen: exercise.resumen,
    tema_id: exercise.tema_id,
    tema_nombre: exercise.tema_nombre,
  });
  onExerciseModeChange?.(true);

  await applyTemplate(exercise.codigo_plantilla);

  const intro = exercise.resumen
    ? exercise.resumen
    : `Listo: «${exercise.titulo}». El enunciado está en el panel lateral. Cuando ejecutes (Run) te iré guiando.`;

  return {
    exercise,
    turn: localHiloTurn([
      { text: intro, emotion: "happy" },
      {
        text: "Pregúntame sobre el ejercicio o pulsa Run para que revise tu avance.",
        emotion: "smile",
      },
    ]),
  };
}
