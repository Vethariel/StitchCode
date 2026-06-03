import { buildStepView, eventTypeLabel, formatWovenValue } from "./step-trace.js";

/**
 * @param {string} text
 */
function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * @param {{
 *   getCode: () => string,
 *   traceWoven: (code: string) => Promise<import("./step-trace.js").WovenTrace>,
 *   hasLintErrors: () => boolean,
 *   syncBlocksToText?: () => Promise<void>,
 *   isBlockMode?: () => boolean,
 *   getVista?: () => "text" | "blocks" | "verbose",
 *   refreshBlocksFromCode?: () => Promise<void>,
 *   blocks?: {
 *     highlightByWovenLine: (line: number | null) => void,
 *     clearStepHighlight: () => void,
 *     findDisplayLineForWovenLine: (line: number) => string | null,
 *   },
 *   editor?: { setStepLineHighlight: (line: number | null) => void },
 *   console?: {
 *     snapshot: () => { html: string, outputLineCount: number },
 *     restore: (snap: { html: string, outputLineCount: number } | null | undefined) => void,
 *     setStepOutput: (lines: { texto: string, es_error?: boolean }[]) => void,
 *   },
 *   sidePanel?: {
 *     setOpen: (open: boolean) => void,
 *     setActiveTab: (tab: string) => void,
 *     enableStepTab: (on: boolean) => void,
 *   },
 *   elements: {
 *     navBtn: HTMLButtonElement | null,
 *     contextBar: HTMLElement | null,
 *     contextText: HTMLElement | null,
 *     btnPrev: HTMLButtonElement | null,
 *     btnNext: HTMLButtonElement | null,
 *     btnExit: HTMLButtonElement | null,
 *     panelRoot: HTMLElement | null,
 *     panelStepLabel: HTMLElement | null,
 *     panelEvent: HTMLElement | null,
 *     panelContext: HTMLElement | null,
 *     panelVars: HTMLElement | null,
 *     panelEmpty: HTMLElement | null,
 *   },
 *   onModeChange?: (active: boolean) => void,
 * }} opts
 */
export function createStepModeController({
  getCode,
  traceWoven,
  hasLintErrors,
  syncBlocksToText,
  isBlockMode,
  getVista,
  refreshBlocksFromCode,
  blocks,
  editor,
  console: consoleCtl,
  sidePanel,
  elements,
  onModeChange,
}) {
  /** @type {import("./step-trace.js").WovenTrace | null} */
  let trace = null;
  let stepIndex = 0;
  let active = false;
  let busy = false;
  /** @type {{ html: string, outputLineCount: number } | null} */
  let consoleSnapshot = null;

  /** @param {number | null | undefined} wovenLine */
  function applyStepHighlight(wovenLine) {
    const vista = getVista?.() ?? "text";
    if (vista === "text") {
      blocks?.clearStepHighlight?.();
      editor?.setStepLineHighlight?.(wovenLine ?? null);
      return;
    }
    editor?.setStepLineHighlight?.(null);
    blocks?.highlightByWovenLine?.(wovenLine ?? null);
  }

  /** @param {number | null | undefined} wovenLine */
  function formatLineMeta(wovenLine) {
    if (wovenLine == null) return "—";
    if (!isBlockMode?.()) return `Línea ${wovenLine}`;
    const display = blocks?.findDisplayLineForWovenLine?.(wovenLine);
    return display
      ? `Línea ${wovenLine} (bloque L${display})`
      : `Línea ${wovenLine}`;
  }

  function setContextBarVisible(on) {
    if (elements.contextBar) {
      elements.contextBar.hidden = !on;
      elements.contextBar.setAttribute("aria-hidden", on ? "false" : "true");
    }
    document.body.classList.toggle("step-mode-active", on);
    elements.navBtn?.classList.toggle("active", on);
  }

  function renderPanel() {
    if (!trace || !elements.panelRoot) return;
    const view = buildStepView(trace, stepIndex);
    const n = view.total ? view.index + 1 : 0;
    const total = view.total;

    if (elements.panelStepLabel) {
      elements.panelStepLabel.textContent =
        total > 0 ? `Paso ${n} de ${total}` : "Sin pasos";
    }

    if (elements.contextText) {
      elements.contextText.textContent =
        total > 0
          ? `Paso ${n} de ${total} — usa Anterior / Siguiente o revisa variables en el panel`
          : "Ejecución paso a paso";
    }

    if (elements.btnPrev) elements.btnPrev.disabled = view.index <= 0;
    if (elements.btnNext) {
      elements.btnNext.disabled = view.total === 0 || view.index >= view.total - 1;
    }

    if (elements.panelEvent) {
      const ev = view.event;
      if (!ev) {
        elements.panelEvent.innerHTML =
          '<p class="step-panel-muted">No hay eventos en la traza.</p>';
      } else {
        const line = formatLineMeta(ev.linea);
        const code = view.code
          ? `<pre class="step-code-line">${escapeHtml(view.code)}</pre>`
          : "";
        const salida =
          ev.tipo === "salida" && ev.texto !== undefined
            ? `<pre class="step-code-line step-salida-preview">${escapeHtml(String(ev.texto))}</pre>`
            : "";
        elements.panelEvent.innerHTML = `
          <div class="step-event-type">${escapeHtml(eventTypeLabel(ev.tipo))}</div>
          <div class="step-event-meta">${escapeHtml(line)}</div>
          ${code}${salida}`;
      }
    }

    if (elements.panelContext) {
      elements.panelContext.textContent = view.contextLabel;
    }

    const vars = Object.entries(view.scope);
    if (elements.panelEmpty) {
      elements.panelEmpty.hidden = vars.length > 0;
    }
    if (elements.panelVars) {
      if (!vars.length) {
        elements.panelVars.innerHTML = "";
      } else {
        elements.panelVars.innerHTML = `
          <table class="step-vars-table">
            <thead>
              <tr><th>Variable</th><th>Tipo</th><th>Valor</th></tr>
            </thead>
            <tbody>
              ${vars
                .sort(([a], [b]) => a.localeCompare(b))
                .map(
                  ([name, info]) => `
                <tr>
                  <td class="step-var-name">${escapeHtml(name)}</td>
                  <td class="step-var-type">${escapeHtml(info.tipo ?? "?")}</td>
                  <td class="step-var-value">${escapeHtml(formatWovenValue(info.valor))}</td>
                </tr>`
                )
                .join("")}
            </tbody>
          </table>`;
      }
    }

    if (view.hasError && elements.panelEvent) {
      elements.panelEvent.innerHTML += `<p class="step-panel-error">${escapeHtml(view.errorMessage ?? "Error en ejecución")}</p>`;
    }

    applyStepHighlight(view.line ?? null);
    consoleCtl?.setStepOutput?.(view.outputLines ?? []);
  }

  function goToStep(next) {
    if (!trace) return;
    const max = Math.max(0, trace.eventos.length - 1);
    stepIndex = Math.min(Math.max(0, next), max);
    renderPanel();
  }

  function exitStepMode() {
    active = false;
    trace = null;
    stepIndex = 0;
    busy = false;
    setContextBarVisible(false);
    sidePanel?.enableStepTab?.(false);
    applyStepHighlight(null);
    consoleCtl?.restore?.(consoleSnapshot);
    consoleSnapshot = null;
    onModeChange?.(false);
  }

  async function enterStepMode() {
    if (busy || active) return;
    if (hasLintErrors()) {
      throw new Error("Corrige los errores semánticos antes de la ejecución paso a paso.");
    }
    if (isBlockMode?.()) {
      await syncBlocksToText?.();
      await refreshBlocksFromCode?.();
    }
    const code = getCode().trim();
    if (!code) {
      throw new Error("Escribe código Woven antes de iniciar el modo paso a paso.");
    }

    busy = true;
    elements.navBtn && (elements.navBtn.disabled = true);
    try {
      trace = await traceWoven(code);
      if (!trace.eventos?.length) {
        throw new Error("La traza no generó pasos. Revisa que el programa tenga sentencias ejecutables.");
      }
      consoleSnapshot = consoleCtl?.snapshot?.() ?? null;
      stepIndex = 0;
      active = true;
      setContextBarVisible(true);
      sidePanel?.enableStepTab?.(true);
      sidePanel?.setOpen?.(true);
      sidePanel?.setActiveTab?.("paso");
      onModeChange?.(true);
      renderPanel();
    } finally {
      busy = false;
      if (elements.navBtn) elements.navBtn.disabled = false;
    }
  }

  elements.navBtn?.addEventListener("click", () => {
    if (active) return;
    void enterStepMode().catch((err) => {
      const msg = err instanceof Error ? err.message : String(err);
      window.alert(msg);
    });
  });

  elements.btnPrev?.addEventListener("click", () => goToStep(stepIndex - 1));
  elements.btnNext?.addEventListener("click", () => goToStep(stepIndex + 1));
  elements.btnExit?.addEventListener("click", () => exitStepMode());

  return {
    isActive: () => active,
    enter: enterStepMode,
    exit: exitStepMode,
    goToStep,
    refreshTrace: async () => {
      if (!active) return;
      await enterStepMode();
    },
  };
}
