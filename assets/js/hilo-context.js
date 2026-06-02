/** @typedef {'text' | 'blocks' | 'verbose'} EditorVista */

/**
 * Contexto unificado para Hilo / Gemini (conversación y explicación).
 * @param {{
 *   vista: EditorVista,
 *   codigo: string,
 *   output: string[],
 *   errores: string[],
 *   tieneError: boolean,
 *   bloquesResumen?: string,
 * }} input
 */
export function buildHiloContext({
  vista,
  codigo,
  output,
  errores,
  tieneError,
  bloquesResumen = "",
}) {
  const modo =
    vista === "verbose" ? "verboso" : vista === "blocks" ? "bloques" : "texto";

  return {
    codigo,
    output,
    errores,
    tieneError,
    modo,
    vista,
    bloquesResumen: vista === "text" ? "" : bloquesResumen,
  };
}

/** Panel de foco por defecto según la vista actual. */
export function defaultExplanationPanel(vista) {
  return vista === "text" ? "editor" : "blocks";
}
