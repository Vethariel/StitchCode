/**
 * @param {{ body: HTMLElement }} els
 */
import { esErrorWoven } from "./woven-errors.js";

export function createConsoleController({ body }) {
  /** Líneas de salida numeradas (solo output/error, sin info/muted). */
  let outputLineCount = 0;

  function clear() {
    body.innerHTML = "";
    outputLineCount = 0;
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
    if (type === "output" || type === "error" || type === "stderr") {
      outputLineCount += 1;
      row.dataset.consoleLine = String(outputLineCount);
    }
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

  function snapshot() {
    return { html: body.innerHTML, outputLineCount };
  }

  /**
   * @param {{ html: string, outputLineCount: number } | null | undefined} snap
   */
  function restore(snap) {
    if (!snap) return;
    body.innerHTML = snap.html;
    outputLineCount = body.querySelectorAll("[data-console-line]").length;
  }

  /**
   * Consola acumulada hasta el paso actual (modo paso a paso).
   * @param {{ texto: string, es_error?: boolean }[]} lines
   */
  function setStepOutput(lines) {
    clear();
    if (!lines.length) {
      showEmpty("// Sin salida en consola hasta este paso…");
      return;
    }
    for (const entry of lines) {
      const isError = entry.es_error || esErrorWoven(entry.texto);
      appendLine(entry.texto, isError ? "error" : "output", isError ? "!" : ">");
    }
  }

  return {
    clear,
    showEmpty,
    appendLine,
    removeLine,
    appendOutputLines,
    snapshot,
    restore,
    setStepOutput,
  };
}
