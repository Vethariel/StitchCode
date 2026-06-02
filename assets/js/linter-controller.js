/** @typedef {{ nivel: string, linea: number, mensaje: string, texto: string }} Diagnostico */
/** @typedef {{ parse_ok: boolean, diagnosticos: Diagnostico[], tiene_errores: boolean, tiene_advertencias: boolean }} LintResult */

const LINT_DEBOUNCE_MS = 800;

/**
 * @param {{ getCode: () => string, isReady: () => boolean, lintFn: (code: string) => Promise<LintResult>, onUpdate?: () => void }} opts
 */
export function createLinterController({ getCode, isReady, lintFn, onUpdate }) {
  /** @type {LintResult} */
  let state = {
    parse_ok: true,
    diagnosticos: [],
    tiene_errores: false,
    tiene_advertencias: false,
  };

  let debounceTimer = null;
  let lintGeneration = 0;

  async function runLint() {
    if (!isReady()) return state;

    const gen = ++lintGeneration;
    const code = getCode();

    try {
      const result = await lintFn(code);
      if (gen !== lintGeneration) return state;
      state = result;
      onUpdate?.();
      return state;
    } catch {
      if (gen !== lintGeneration) return state;
      return state;
    }
  }

  function scheduleLint() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      runLint();
    }, LINT_DEBOUNCE_MS);
  }

  function tieneErroresBloqueantes() {
    return state.parse_ok && state.tiene_errores;
  }

  /** @returns {string[]} */
  function textosErrores() {
    return state.diagnosticos
      .filter((d) => d.nivel === "error")
      .map((d) => d.texto);
  }

  function getState() {
    return state;
  }

  function getDiagnosticos() {
    return state.diagnosticos;
  }

  return {
    scheduleLint,
    runLint,
    tieneErroresBloqueantes,
    textosErrores,
    getState,
    getDiagnosticos,
  };
}
