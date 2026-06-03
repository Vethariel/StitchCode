/**
 * Reglas de convivencia del modo paso a paso con el resto de Stitch Code.
 *
 * Sale del modo cuando:
 * - El código cambia (texto o bloques)
 * - Run ejecuta el programa completo
 * - Hilo inicia ejercicio, aprendizaje, explicación foco o carga código nuevo
 * - Cambia la vista texto / bloques / verboso
 *
 * Entra al modo cuando:
 * - El usuario pulsa «Paso a paso» en la barra
 * - Hilo detecta intención paso_a_paso o Gemini devuelve activar_paso_a_paso
 */

/** @typedef {() => boolean} IsActiveFn */
/** @typedef {() => void} ExitFn */

/**
 * @param {{ isActive: IsActiveFn, exit: ExitFn }} stepMode
 * @returns {() => void}
 */
export function createExitStepModeIfActive(stepMode) {
  return () => {
    if (stepMode.isActive()) stepMode.exit();
  };
}
