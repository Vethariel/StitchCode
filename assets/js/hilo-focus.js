/** @typedef {'editor' | 'blocks' | 'console' | 'python' | 'java' | 'cpp' | 'presentation'} HiloFocusPanel */

/** Panel DOM iluminado (editor-panel agrupa texto, bloques y verboso). */
const PANEL_DOM_ID = {
  editor: "editor-panel",
  blocks: "editor-panel",
  console: "console-panel",
  python: "right-panel",
  java: "right-panel",
  cpp: "right-panel",
};

const TRANSLATION_PANELS = new Set(["python", "java", "cpp"]);

/** Margen respecto a la esquina inferior derecha del panel iluminado. */
const PANEL_CORNER_MARGIN = 12;

/**
 * Modo foco: oscurece el workspace y resalta un panel.
 * Hilo se ancla a la esquina inferior derecha del panel activo (coordenadas fijas).
 * @param {{
 *   overlay: HTMLElement,
 *   dock: HTMLElement,
 *   appShell: HTMLElement,
 *   onTranslationPanel?: (panel: 'python' | 'java' | 'cpp') => void,
 * }} els
 */
export function createHiloFocusController({
  overlay,
  dock,
  appShell,
  onTranslationPanel,
}) {
  /** @type {HiloFocusPanel | null} */
  let activePanel = null;

  /** @param {HiloFocusPanel} panel */
  function panelEl(panel) {
    const id = PANEL_DOM_ID[panel] ?? PANEL_DOM_ID.editor;
    return document.getElementById(id);
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
    document.body.classList.remove("hilo-tutorial-presentation");
    dock.classList.add("hilo-focus-dock");
    dock.classList.remove("hilo-tutorial-center");

    const editorOn = panel === "editor" || panel === "blocks";
    const rightOn = TRANSLATION_PANELS.has(panel);
    document
      .getElementById("editor-panel")
      ?.classList.toggle("hilo-focus-illuminated", editorOn);
    document
      .getElementById("console-panel")
      ?.classList.toggle("hilo-focus-illuminated", panel === "console");
    document
      .getElementById("right-panel")
      ?.classList.toggle("hilo-focus-illuminated", rightOn);

    if (rightOn && onTranslationPanel) {
      onTranslationPanel(/** @type {'python' | 'java' | 'cpp'} */ (panel));
    }

    positionAtPanelCorner(panel);
  }

  /** Presentación formal: pantalla oscurecida, Hilo centrado, sin panel iluminado. */
  function enterPresentation() {
    activePanel = "presentation";
    overlay.hidden = false;
    requestAnimationFrame(() => overlay.classList.add("is-active"));
    appShell.classList.add("hilo-focus-active");
    document.body.classList.add("hilo-tutorial-presentation");
    dock.classList.add("hilo-focus-dock", "hilo-tutorial-center");
    clearDockPosition();

    document
      .getElementById("editor-panel")
      ?.classList.remove("hilo-focus-illuminated");
    document
      .getElementById("console-panel")
      ?.classList.remove("hilo-focus-illuminated");
    document
      .getElementById("right-panel")
      ?.classList.remove("hilo-focus-illuminated");
  }

  function exit() {
    activePanel = null;
    overlay.classList.remove("is-active");
    overlay.hidden = true;
    appShell.classList.remove("hilo-focus-active");
    document.body.classList.remove("hilo-tutorial-presentation");
    dock.classList.remove("hilo-focus-dock", "hilo-tutorial-center");
    clearDockPosition();

    document
      .getElementById("editor-panel")
      ?.classList.remove("hilo-focus-illuminated");
    document
      .getElementById("console-panel")
      ?.classList.remove("hilo-focus-illuminated");
    document
      .getElementById("right-panel")
      ?.classList.remove("hilo-focus-illuminated");
  }

  function onResize() {
    if (activePanel && activePanel !== "presentation") {
      positionAtPanelCorner(activePanel);
    }
  }

  window.addEventListener("resize", onResize);

  return {
    enter,
    enterPresentation,
    exit,
    /** @param {HiloFocusPanel} panel */
    positionNear: positionAtPanelCorner,
    isActive: () => activePanel !== null,
    getActivePanel: () => activePanel,
  };
}
