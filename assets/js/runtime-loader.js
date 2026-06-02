/**
 * Pantalla de carga a página completa; bloquea la app hasta runtime listo.
 * @param {{
 *   overlay: HTMLElement,
 *   messageEl: HTMLElement,
 *   detailEl: HTMLElement,
 *   appShell: HTMLElement,
 *   codeArea: HTMLTextAreaElement,
 *   runBtn: HTMLButtonElement,
 *   clearBtn: HTMLButtonElement,
 * }} els
 */
export function createRuntimeLoader(els) {
  const { overlay, messageEl, detailEl, appShell, codeArea, runBtn, clearBtn } = els;

  function setLocked(locked) {
    if (locked) {
      appShell.setAttribute("inert", "");
    } else {
      appShell.removeAttribute("inert");
    }
    codeArea.disabled = locked;
    clearBtn.disabled = locked;
  }

  /**
   * @param {string} text
   * @param {"idle"|"loading"|"ready"|"error"} state
   * @param {string} [detail]
   */
  function setPhase(text, state, detail = "") {
    messageEl.textContent = text;
    detailEl.textContent = detail;

    overlay.classList.toggle("is-error", state === "error");
    overlay.hidden = false;
    overlay.setAttribute("aria-busy", state === "loading" ? "true" : "false");

    if (state === "ready") {
      overlay.classList.add("is-hidden");
      return;
    }

    overlay.classList.remove("is-hidden");
    setLocked(true);
  }

  setPhase("Preparando entorno…", "loading");
  setLocked(true);

  function unlockWorkspace() {
    setLocked(false);
  }

  return { setPhase, unlockWorkspace };
}
