/**
 * @param {{ body: HTMLElement }} els
 */
import { esErrorWoven } from "./woven-errors.js";

export function createConsoleController({ body }) {
  function clear() {
    body.innerHTML = "";
  }

  function showEmpty(message = "// Presiona Run para ver el resultado…") {
    clear();
    const span = document.createElement("span");
    span.className = "c-empty";
    span.textContent = message;
    body.appendChild(span);
  }

  /**
   * @param {string} text
   * @param {"output"|"error"|"info"|"muted"|"stderr"} type
   * @param {string} [prefix]
   */
  /**
   * @returns {HTMLElement} fila creada (para quitar líneas transitorias)
   */
  function appendLine(text, type = "output", prefix = "") {
    const empty = body.querySelector(".c-empty");
    if (empty) empty.remove();

    const row = document.createElement("div");
    row.className = `c-line ${type}`;
    if (prefix) {
      row.innerHTML = `<span class="c-prefix">${prefix}</span><span></span>`;
      row.querySelector("span:last-child").textContent = text;
    } else {
      row.textContent = text;
    }
    body.appendChild(row);
    body.scrollTop = body.scrollHeight;
    return row;
  }

  function removeLine(row) {
    row?.remove();
  }

  /** @param {string[]} lines */
  function appendOutputLines(lines) {
    for (const line of lines) {
      const isError = esErrorWoven(line);
      appendLine(line, isError ? "error" : "output", isError ? "!" : ">");
    }
  }

  return { clear, showEmpty, appendLine, removeLine, appendOutputLines };
}
