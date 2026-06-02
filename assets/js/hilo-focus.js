/** @typedef {'editor' | 'console'} HiloFocusPanel */

const PANEL_ELEMENT_IDS = {
  editor: "editor-panel",
  console: "console-panel",
};

/** Margen respecto a la esquina inferior derecha del panel iluminado. */
const PANEL_CORNER_MARGIN = 12;

/**
 * Modo foco: oscurece el workspace y resalta un panel.
 * Hilo se ancla a la esquina inferior derecha del panel activo (coordenadas fijas).
 * @param {{
 *   overlay: HTMLElement,
 *   dock: HTMLElement,
 *   appShell: HTMLElement,
 * }} els
 */
export function createHiloFocusController({ overlay, dock, appShell }) {
  /** @type {HiloFocusPanel | null} */
  let activePanel = null;

  /** @param {HiloFocusPanel} panel */
  function panelEl(panel) {
    const id = PANEL_ELEMENT_IDS[panel];
    return id ? document.getElementById(id) : null;
  }

  function clearDockPosition() {
    dock.style.top = "";
    dock.style.left = "";
    dock.style.right = "";
    dock.style.bottom = "";
  }

  /**
   * Esquina inferior derecha del panel (viewport), por encima del overlay.
   * @param {HiloFocusPanel} panel
   */
  function positionAtPanelCorner(panel) {
    const el = panelEl(panel);
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const m = PANEL_CORNER_MARGIN;

    dock.style.position = "fixed";
    dock.style.top = "auto";
    dock.style.left = "auto";
    dock.style.right = `${Math.max(m, window.innerWidth - rect.right + m)}px`;
    dock.style.bottom = `${Math.max(m, window.innerHeight - rect.bottom + m)}px`;
  }

  /** @param {HiloFocusPanel} panel */
  function enter(panel) {
    activePanel = panel;
    overlay.hidden = false;
    requestAnimationFrame(() => overlay.classList.add("is-active"));
    appShell.classList.add("hilo-focus-active");
    dock.classList.add("hilo-focus-dock");

    for (const key of Object.keys(PANEL_ELEMENT_IDS)) {
      const el = panelEl(/** @type {HiloFocusPanel} */ (key));
      el?.classList.toggle("hilo-focus-illuminated", key === panel);
    }

    positionAtPanelCorner(panel);
  }

  function exit() {
    activePanel = null;
    overlay.classList.remove("is-active");
    overlay.hidden = true;
    appShell.classList.remove("hilo-focus-active");
    dock.classList.remove("hilo-focus-dock");
    clearDockPosition();

    for (const key of Object.keys(PANEL_ELEMENT_IDS)) {
      panelEl(/** @type {HiloFocusPanel} */ (key))?.classList.remove(
        "hilo-focus-illuminated"
      );
    }
  }

  function onResize() {
    if (activePanel) positionAtPanelCorner(activePanel);
  }

  window.addEventListener("resize", onResize);

  return {
    enter,
    exit,
    /** @param {HiloFocusPanel} panel */
    positionNear: positionAtPanelCorner,
    isActive: () => activePanel !== null,
    getActivePanel: () => activePanel,
  };
}
