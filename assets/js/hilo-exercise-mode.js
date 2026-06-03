/**
 * Estado global del modo ejercicio (Hilo vigila ejecuciones y el mismo enunciado).
 * @typedef {'libre' | 'correccion' | 'relleno'} ExerciseTipo
 * @typedef {{
 *   titulo: string,
 *   enunciado: string[],
 *   criterios: string[],
 *   resumen: string,
 *   tema_id?: string,
 *   tema_nombre?: string,
 *   tipo_ejercicio?: ExerciseTipo,
 *   lineas_editables?: number[],
 *   codigo_referencia?: string,
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

/** @returns {boolean} */
export function isGuidedExerciseActive() {
  const t = activeEnunciado?.tipo_ejercicio;
  return t === "correccion" || t === "relleno";
}

/** @returns {number[] | null} Líneas editables (1-based); null = todo editable. */
export function getExerciseEditableLines() {
  const lines = activeEnunciado?.lineas_editables;
  if (!lines?.length) return null;
  if (!isGuidedExerciseActive()) return null;
  return [...lines];
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
    tema_id: data.tema_id,
    tema_nombre: data.tema_nombre,
    tipo_ejercicio: data.tipo_ejercicio ?? "libre",
    lineas_editables: data.lineas_editables
      ? [...data.lineas_editables]
      : undefined,
    codigo_referencia: data.codigo_referencia,
  };
}

export function deactivateExerciseMode() {
  activeEnunciado = null;
}
