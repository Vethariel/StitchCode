/** @typedef {'editor' | 'console'} HiloPanelId */
/** @typedef {{ line: number, start?: number, end?: number }} HiloHighlightRange */

/**
 * Resalta líneas en editor y consola durante una explicación.
 * @param {{
 *   codeArea: HTMLTextAreaElement,
 *   lineNumbers: HTMLElement,
 *   codeHighlight: HTMLElement | null,
 *   consoleBody: HTMLElement,
 * }} els
 */
export function createHiloHighlightController({
  codeArea,
  lineNumbers,
  codeHighlight,
  consoleBody,
}) {
  function clearEditor() {
    lineNumbers
      .querySelectorAll(".hilo-highlight-line")
      .forEach((el) => el.classList.remove("hilo-highlight-line"));
    codeHighlight
      ?.querySelectorAll(".hilo-highlight-line")
      .forEach((el) => el.classList.remove("hilo-highlight-line"));
  }

  function clearConsole() {
    consoleBody
      .querySelectorAll(".hilo-highlight-line")
      .forEach((el) => el.classList.remove("hilo-highlight-line"));
  }

  function clear() {
    clearEditor();
    clearConsole();
  }

  /** @param {number} line 1-based */
  function applyEditor(line) {
    clearEditor();
    const total = codeArea.value.split("\n").length;
    const ln = Math.max(1, Math.min(line, total));

    lineNumbers
      .querySelector(`[data-line="${ln}"]`)
      ?.classList.add("hilo-highlight-line");

    const hlLine = codeHighlight?.querySelectorAll(".hl-line")?.[ln - 1];
    hlLine?.classList.add("hilo-highlight-line");

    scrollEditorToLine(ln);
  }

  /** @param {number} line 1-based entre filas .c-line */
  function applyConsole(line) {
    clearConsole();
    const rows = consoleBody.querySelectorAll(".c-line");
    if (!rows.length) return;
    const ln = Math.max(1, Math.min(line, rows.length));
    const row = rows[ln - 1];
    row.classList.add("hilo-highlight-line");
    row.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  /**
   * @param {{ panel?: HiloPanelId, highlight?: HiloHighlightRange }} chunk
   */
  function applyForChunk(chunk) {
    const panel = chunk.panel ?? "editor";
    const line = chunk.highlight?.line ?? 1;
    if (panel === "console") {
      applyConsole(line);
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

  return { clear, applyForChunk, applyEditor, applyConsole };
}
