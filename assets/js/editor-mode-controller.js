import { blocksToSource, lintWoven, parseBlocks } from "./bridge/pyodide-bridge.js";

/** @typedef {'text'|'blocks'|'verbose'} EditorMode */

/**
 * @param {{
 *   editorBody: HTMLElement,
 *   textView: HTMLElement,
 *   modeButtons: HTMLElement,
 *   getCode: () => string,
 *   setCode: (code: string) => void,
 *   blocks: ReturnType<import("./blocks-controller.js").createBlocksController>,
 *   onLint: () => void,
 *   onModeError?: (msg: string) => void,
 *   onModeChange?: (mode: EditorMode) => void,
 * }} opts
 */
export function createEditorModeController({
  editorBody,
  textView,
  modeButtons,
  getCode,
  setCode,
  blocks,
  onLint,
  onModeError,
  onModeChange,
}) {
  /** @type {EditorMode} */
  let mode = "text";
  let syncTimer = null;
  let modeSwitchLocked = false;

  function setActiveButton() {
    modeButtons.querySelectorAll(".mode-btn").forEach((btn) => {
      const active = btn.dataset.mode === mode;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-selected", active ? "true" : "false");
      btn.disabled = modeSwitchLocked;
      btn.title = modeSwitchLocked
        ? "Sal del ejercicio para cambiar entre texto y bloques"
        : "";
    });
    modeButtons.classList.toggle("mode-selector-locked", modeSwitchLocked);
  }

  /** @param {boolean} locked */
  function setModeSwitchLocked(locked) {
    modeSwitchLocked = locked;
    setActiveButton();
  }

  function applyView() {
    const isBlocks = mode === "blocks" || mode === "verbose";
    editorBody.classList.toggle("blocks-active", isBlocks);
    textView.hidden = isBlocks;
    blocks.setViewMode(mode === "verbose" ? "verbose" : "code");
    setActiveButton();
  }

  async function syncBlocksToText() {
    try {
      const source = await blocksToSource(blocks.getDocument());
      setCode(source);
      onLint();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      onModeError?.(msg);
    }
  }

  function scheduleSyncFromBlocks() {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
      syncBlocksToText();
    }, 450);
  }

  /**
   * @param {EditorMode} next
   * @param {{ force?: boolean }} [opts]
   * @returns {Promise<boolean>}
   */
  async function setMode(next, opts = {}) {
    if (next === mode) return true;

    if (!opts.force && modeSwitchLocked) {
      onModeError?.(
        "En modo ejercicio no puedes cambiar entre texto y bloques. Pulsa Salir en la barra azul."
      );
      return false;
    }

    if (next === "blocks" || next === "verbose") {
      if (mode === "text") {
        const lint = await lintWoven(getCode());
        if (!lint.parse_ok) {
          onModeError?.(
            "Corrige los errores de sintaxis antes de cambiar a bloques."
          );
          return false;
        }
        try {
          const doc = await parseBlocks(getCode());
          blocks.setDocument(doc.bloques, next === "verbose" ? "verbose" : "code");
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          onModeError?.(msg);
          return false;
        }
      } else {
        blocks.setViewMode(next === "verbose" ? "verbose" : "code");
      }
      mode = next;
      applyView();
      onModeChange?.(mode);
      return true;
    }

    if (next === "text") {
      await syncBlocksToText();
      mode = "text";
      applyView();
      onModeChange?.(mode);
      return true;
    }

    return false;
  }

  modeButtons.querySelectorAll(".mode-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const next = /** @type {EditorMode} */ (btn.dataset.mode);
      if (!next || next === mode) return;
      const ok = await setMode(next);
      if (!ok) return;
    });
  });

  applyView();

  return {
    getMode: () => mode,
    setMode,
    setModeSwitchLocked,
    isModeSwitchLocked: () => modeSwitchLocked,
    scheduleSyncFromBlocks,
    syncBlocksToText,
    isBlockMode: () => mode === "blocks" || mode === "verbose",
  };
}
