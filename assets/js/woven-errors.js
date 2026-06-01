/** @param {string} text */
export function esErrorWoven(text) {
  return (
    text.startsWith("Error de ") ||
    text.startsWith("Error:") ||
    text.startsWith("Error semántico:")
  );
}

/** @param {string} text */
export function esAdvertenciaSemantica(text) {
  return text.startsWith("Advertencia semántica:");
}
