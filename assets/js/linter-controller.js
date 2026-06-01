/** @typedef {{ nivel: string, linea: number, mensaje: string, texto: string }} Diagnostico */
/** @typedef {{ parse_ok: boolean, diagnosticos: Diagnostico[], tiene_errores: boolean, tiene_advertencias: boolean }} LintResult */

const LINT_DEBOUNCE_MS = 800;
const MAX_VISIBLE = 4;

/**
 * @param {{ panel: HTMLElement, getCode: () => string, isReady: () => boolean, lintFn: (code: string) => Promise<LintResult>, onUpdate?: () => void }} opts
 */
export function createLinterController({ panel, getCode, isReady, lintFn, onUpdate }) {
  /** @type {LintResult} */
  let state = {
    parse_ok: true,
    diagnosticos: [],
    tiene_errores: false,
    tiene_advertencias: false,
  };

  let debounceTimer = null;
  let lintGeneration = 0;

  function render() {
    panel.innerHTML = "";
    panel.hidden = true;
    panel.classList.remove("has-errors");

    if (!isReady() || !state.parse_ok || !state.tiene_errores) {
      return;
    }

    const errores = state.diagnosticos.filter((d) => d.nivel === "error");
    if (!errores.length) {
      return;
    }

    panel.hidden = false;
    panel.classList.add("has-errors");

    const title = document.createElement("div");
    title.className = "linter-panel-title";
    title.textContent = "Errores semánticos";
    panel.appendChild(title);

    const list = document.createElement("div");
    list.className = "linter-list";

    const visible = errores.slice(0, MAX_VISIBLE);
    for (const d of visible) {
      const row = document.createElement("div");
      row.className = "linter-item error";
      row.innerHTML = `
        <span class="linter-item-line">Línea ${d.linea}</span>
        <span class="linter-item-msg"></span>
      `;
      row.querySelector(".linter-item-msg").textContent = d.mensaje;
      list.appendChild(row);
    }

    panel.appendChild(list);

    if (errores.length > MAX_VISIBLE) {
      const more = document.createElement("div");
      more.className = "linter-item-more";
      more.textContent = `+ ${errores.length - MAX_VISIBLE} más…`;
      panel.appendChild(more);
    }
  }

  async function runLint() {
    if (!isReady()) return state;

    const gen = ++lintGeneration;
    const code = getCode();

    try {
      const result = await lintFn(code);
      if (gen !== lintGeneration) return state;
      state = result;
      render();
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
    render,
  };
}
