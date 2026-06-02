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
}) {
  /** @type {EditorMode} */
  let mode = "text";
  let syncTimer = null;

  function setActiveButton() {
    modeButtons.querySelectorAll(".mode-btn").forEach((btn) => {
      const active = btn.dataset.mode === mode;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-selected", active ? "true" : "false");
    });
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
   * @returns {Promise<boolean>}
   */
  async function setMode(next) {
    if (next === mode) return true;

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
      return true;
    }

    if (next === "text") {
      await syncBlocksToText();
      mode = "text";
      applyView();
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
    scheduleSyncFromBlocks,
    syncBlocksToText,
    isBlockMode: () => mode === "blocks" || mode === "verbose",
  };
}
