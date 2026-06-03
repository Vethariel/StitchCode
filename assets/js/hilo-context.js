/** @typedef {'text' | 'blocks' | 'verbose'} EditorVista */

/**
 * Contexto unificado para Hilo / Gemini (conversación y explicación).
 * @param {{
 *   vista: EditorVista,
 *   codigo: string,
 *   output: string[],
 *   errores: string[],
 *   tieneError: boolean,
 *   lastRunHadError?: boolean,
 *   bloquesResumen?: string,
 *   pasoAPaso?: Record<string, unknown> | null,
 * }} input
 */
export function buildHiloContext({
  vista,
  codigo,
  output,
  errores,
  tieneError,
  lastRunHadError = false,
  bloquesResumen = "",
  pasoAPaso = null,
}) {
  const modo =
    vista === "verbose" ? "verboso" : vista === "blocks" ? "bloques" : "texto";

  const enPasoAPaso = !!pasoAPaso?.activo;

  return {
    codigo,
    output: enPasoAPaso ? pasoAPaso.salida_consola_hasta_paso ?? [] : output,
    errores,
    tieneError: enPasoAPaso
      ? !!pasoAPaso.hay_error_en_paso_actual
      : tieneError,
    lastRunHadError,
    modo,
    vista,
    bloquesResumen: vista === "text" ? "" : bloquesResumen,
    pasoAPaso: enPasoAPaso ? pasoAPaso : null,
  };
}

/** Panel de foco por defecto según la vista actual. */
export function defaultExplanationPanel(vista) {
  return vista === "text" ? "editor" : "blocks";
}
