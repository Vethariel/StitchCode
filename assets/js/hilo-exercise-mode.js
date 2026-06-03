/**
 * Estado global del modo ejercicio (Hilo vigila ejecuciones y el mismo enunciado).
 * @typedef {{
 *   titulo: string,
 *   enunciado: string[],
 *   criterios: string[],
 *   resumen: string,
 * }} ExerciseEnunciado
 */

/** @type {ExerciseEnunciado | null} */
let activeEnunciado = null;

export function isExerciseModeActive() {
  return activeEnunciado !== null;
}

/** @returns {ExerciseEnunciado | null} */
export function getActiveExercise() {
  return activeEnunciado;
}

/** @returns {string} JSON para Gemini (ejercicio_activo). */
export function getExerciseEnunciadoJson() {
  if (!activeEnunciado) return "{}";
  return JSON.stringify(activeEnunciado);
}

/**
 * @param {ExerciseEnunciado} data
 */
export function activateExerciseMode(data) {
  activeEnunciado = {
    titulo: data.titulo,
    enunciado: [...data.enunciado],
    criterios: [...(data.criterios ?? [])],
    resumen: data.resumen ?? "",
  };
}

export function deactivateExerciseMode() {
  activeEnunciado = null;
}
