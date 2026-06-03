/** @typedef {'editor' | 'blocks' | 'console' | 'python' | 'java' | 'cpp'} HiloPanelId */
/** @typedef {'text' | 'blocks' | 'verbose'} EditorVista */
/** @typedef {{ line: number, start?: number, end?: number }} HiloHighlightRange */

/**
 * Resalta líneas en editor de texto, bloques o consola durante una explicación.
 * @param {{
 *   codeArea: HTMLTextAreaElement,
 *   lineNumbers: HTMLElement,
 *   codeHighlight: HTMLElement | null,
 *   blocksDocument: HTMLElement,
 *   consoleBody: HTMLElement,
 *   getVista: () => EditorVista,
 *   onTranslationHighlight?: (lang: 'python' | 'java' | 'cpp', line: number) => void,
 *   clearTranslationHighlights?: () => void,
 * }} els
 */
export function createHiloHighlightController({
  codeArea,
  lineNumbers,
  codeHighlight,
  blocksDocument,
  consoleBody,
  getVista,
  onTranslationHighlight,
  clearTranslationHighlights,
}) {
  function clearEditor() {
    lineNumbers
      .querySelectorAll(".hilo-highlight-line")
      .forEach((el) => el.classList.remove("hilo-highlight-line"));
    codeHighlight
      ?.querySelectorAll(".hilo-highlight-line")
      .forEach((el) => el.classList.remove("hilo-highlight-line"));
  }

  function clearBlocks() {
    blocksDocument
      .querySelectorAll(".hilo-highlight-line")
      .forEach((el) => el.classList.remove("hilo-highlight-line"));
  }

  function clearConsole() {
    consoleBody
      .querySelectorAll(".hilo-highlight-line")
      .forEach((el) => el.classList.remove("hilo-highlight-line"));
  }

  function clear() {
    clearEditor();
    clearBlocks();
    clearConsole();
    clearTranslationHighlights?.();
  }

  /** @param {number} line 1-based */
  function applyEditor(line) {
    clear();
    const total = codeArea.value.split("\n").length;
    const ln = Math.max(1, Math.min(line, total));

    lineNumbers
      .querySelector(`[data-line="${ln}"]`)
      ?.classList.add("hilo-highlight-line");

    codeHighlight
      ?.querySelector(`[data-line="${ln}"]`)
      ?.classList.add("hilo-highlight-line");

    scrollEditorToLine(ln);
  }

  /** @param {number} line 1-based (L1, L2… en la cuadrícula de bloques) */
  function applyBlocks(line) {
    clear();
    const nodes = blocksDocument.querySelectorAll(
      `[data-hilo-line="${line}"]`
    );
    nodes.forEach((el) => el.classList.add("hilo-highlight-line"));
    blocksDocument
      .querySelector(`.blocks-line-num[data-hilo-line="${line}"]`)
      ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  /** @param {number} line 1-based entre filas de salida (data-console-line) */
  function applyConsole(line) {
    clear();
    let row = consoleBody.querySelector(`[data-console-line="${line}"]`);
    if (!row) {
      const rows = consoleBody.querySelectorAll("[data-console-line]");
      if (!rows.length) return;
      const ln = Math.max(1, Math.min(line, rows.length));
      row = rows[ln - 1];
    }
    row.classList.add("hilo-highlight-line");
    row.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  /**
   * @param {{ panel?: HiloPanelId, highlight?: HiloHighlightRange }} chunk
   */
  function applyForChunk(chunk) {
    const vista = getVista();
    let panel = chunk.panel;
    if (!panel) {
      panel = vista === "text" ? "editor" : "blocks";
    }
    if (vista !== "text" && panel === "editor") {
      panel = "blocks";
    }
    if (vista === "text" && panel === "blocks") {
      panel = "editor";
    }

    const line = chunk.highlight?.line ?? 1;

    if (panel === "python" || panel === "java" || panel === "cpp") {
      clearEditor();
      clearBlocks();
      clearConsole();
      onTranslationHighlight?.(panel, line);
      return;
    }

    if (panel === "console") {
      applyConsole(line);
    } else if (panel === "blocks") {
      applyBlocks(line);
    } else {
      applyEditor(line);
    }
  }

  /** @param {number} line */
  function scrollEditorToLine(line) {
    const lines = codeArea.value.split("\n");
    let pos = 0;
    for (let i = 0; i < line - 1 && i < lines.length; i++) {
      pos += lines[i].length + 1;
    }
    codeArea.setSelectionRange(pos, pos);

    const styles = getComputedStyle(codeArea);
    const lineHeight = parseFloat(styles.lineHeight) || 20;
    const padTop = parseFloat(styles.paddingTop) || 0;
    const target = (line - 1) * lineHeight;
    codeArea.scrollTop = Math.max(0, target - codeArea.clientHeight * 0.3 + padTop);
    codeArea.dispatchEvent(new Event("scroll"));
  }

  return { clear, applyForChunk, applyEditor, applyBlocks, applyConsole };
}
