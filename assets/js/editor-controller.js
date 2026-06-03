/** @typedef {{ nivel: string, linea: number, mensaje: string, texto?: string }} Diagnostico */

import { createEditorKeydownHandler, lineIndexAt } from "./editor-editing.js";
import { highlightSourceLines } from "./woven-highlighter.js";

/**
 * @param {{ codeArea: HTMLTextAreaElement, lineNumbers: HTMLElement, codeHighlight?: HTMLElement, tooltip?: HTMLElement, onChange?: () => void }} els
 */
export function createEditorController({
  codeArea,
  lineNumbers,
  codeHighlight,
  tooltip,
  onChange,
}) {
  /** @type {Diagnostico[]} */
  let diagnosticos = [];
  /** @type {number | null} Línea resaltada en modo paso a paso (1-based). */
  let stepHighlightLine = null;
  /** @type {Set<number> | null} Líneas editables en ejercicio guiado (1-based). */
  let exerciseEditableLines = null;

  function escapeHtml(text) {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function diagsPorLinea() {
    /** @type {Map<number, Diagnostico[]>} */
    const map = new Map();
    for (const d of diagnosticos) {
      const line = d.linea;
      if (!map.has(line)) map.set(line, []);
      map.get(line).push(d);
    }
    return map;
  }

  function severidadLinea(lineNum, byLine) {
    const ds = byLine.get(lineNum);
    if (!ds?.length) return null;
    if (ds.some((d) => d.nivel === "error")) return "error";
    if (ds.some((d) => d.nivel === "warning")) return "warning";
    return null;
  }

  function renderHighlight() {
    if (!codeHighlight) return;

    const byLine = diagsPorLinea();
    const lines = codeArea.value.split("\n");
    const highlighted = highlightSourceLines(codeArea.value);

    codeHighlight.innerHTML = lines
      .map((_, i) => {
        const num = i + 1;
        const sev = severidadLinea(num, byLine);
        const stepMark = stepHighlightLine === num ? " hl-step-current" : "";
        const exMark = exerciseLineClass(num);
        const lineCls = (sev ? `hl-line hl-${sev}` : "hl-line") + stepMark + exMark;
        const inner = highlighted[i] ?? " ";
        return `<span class="${lineCls}" data-line="${num}">${inner}</span>`;
      })
      .join("");
  }

  function updateLines() {
    const byLine = diagsPorLinea();
    const n = codeArea.value.split("\n").length;
    lineNumbers.innerHTML = Array.from({ length: n }, (_, i) => {
      const num = i + 1;
      const sev = severidadLinea(num, byLine);
      const stepMark = stepHighlightLine === num ? " ln-step-current" : "";
      const exMark = exerciseLineClass(num).replace(" hl-", " ln-");
      const cls = (sev ? ` lint-${sev}` : "") + stepMark + exMark;
      return `<span id="ln${num}" class="${cls.trim()}" data-line="${num}">${num}</span>`;
    }).join("");
    updateActiveLine();
    renderHighlight();
  }

  function syncScroll() {
    lineNumbers.scrollTop = codeArea.scrollTop;
    lineNumbers.scrollLeft = codeArea.scrollLeft;
    if (codeHighlight) {
      codeHighlight.scrollTop = codeArea.scrollTop;
      codeHighlight.scrollLeft = codeArea.scrollLeft;
    }
  }

  function updateActiveLine() {
    const cur = codeArea.value.substring(0, codeArea.selectionStart).split("\n").length;
    lineNumbers.querySelectorAll("span").forEach((el, i) => {
      el.classList.toggle("active", i + 1 === cur);
    });
  }

  /**
   * @param {number} lineNum 1-based
   */
  function exerciseLineClass(lineNum) {
    if (!exerciseEditableLines) return "";
    return exerciseEditableLines.has(lineNum)
      ? " hl-exercise-editable"
      : " hl-exercise-locked";
  }

  /**
   * @param {number} start
   * @param {number} end
   */
  function guardEditRange(start, end) {
    if (!exerciseEditableLines) return true;
    const v = codeArea.value;
    const s = Math.max(0, Math.min(start, v.length));
    const e = Math.max(s, Math.min(end, v.length));
    for (let pos = s; pos < e; pos++) {
      const line = lineIndexAt(v, pos) + 1;
      if (!exerciseEditableLines.has(line)) return false;
    }
    return true;
  }

  const handleEditorKeydown = createEditorKeydownHandler(codeArea, {
    onEdit: () => {
      updateLines();
      onChange?.();
    },
    guardEditRange,
  });

  function onInput() {
    updateLines();
    onChange?.();
  }

  function getLineFromMouse(clientY) {
    const rect = codeArea.getBoundingClientRect();
    const styles = getComputedStyle(codeArea);
    const lineHeight = parseFloat(styles.lineHeight);
    const padTop = parseFloat(styles.paddingTop);
    const scrollTop = codeArea.scrollTop;
    const y = clientY - rect.top + scrollTop - padTop;
    const line = Math.floor(y / lineHeight) + 1;
    const total = codeArea.value.split("\n").length;
    return Math.max(1, Math.min(line, total));
  }

  function hideTooltip() {
    if (tooltip) tooltip.hidden = true;
  }

  function showTooltip(clientX, clientY, line) {
    if (!tooltip) return;

    const ds = diagsPorLinea().get(line);
    if (!ds?.length) {
      hideTooltip();
      return;
    }

    tooltip.hidden = false;
    tooltip.innerHTML = ds
      .map((d) => {
        const kind = d.nivel === "error" ? "Error" : "Advertencia";
        return `<div class="lint-tooltip-item lint-${d.nivel}"><strong>${kind}</strong> ${escapeHtml(d.mensaje)}</div>`;
      })
      .join("");

    const stack = codeArea.closest(".code-editor-stack");
    if (!stack) return;

    const stackRect = stack.getBoundingClientRect();
    const left = Math.min(clientX - stackRect.left + 12, stackRect.width - 24);
    const top = clientY - stackRect.top + 16;
    tooltip.style.left = `${Math.max(8, left)}px`;
    tooltip.style.top = `${top}px`;
  }

  function handleEditorMouseMove(event) {
    showTooltip(event.clientX, event.clientY, getLineFromMouse(event.clientY));
  }

  function handleLineNumbersMouseMove(event) {
    const span = event.target.closest("span[data-line]");
    if (!span) {
      hideTooltip();
      return;
    }
    showTooltip(event.clientX, event.clientY, Number(span.dataset.line));
  }

  /** @param {Diagnostico[]} next */
  function setDiagnostics(next) {
    diagnosticos = next ?? [];
    updateLines();
  }

  /** @param {number | null} lineNum */
  function setStepLineHighlight(lineNum) {
    stepHighlightLine =
      lineNum != null && Number.isFinite(lineNum) && lineNum >= 1
        ? Math.floor(lineNum)
        : null;
    updateLines();
  }

  /** @param {number[] | null} lines 1-based; null = sin restricción */
  function setExerciseEditableLines(lines) {
    exerciseEditableLines = lines?.length ? new Set(lines) : null;
    updateLines();
  }

  function clearExerciseEditableLines() {
    exerciseEditableLines = null;
    updateLines();
  }

  codeArea.addEventListener("input", onInput);
  codeArea.addEventListener("scroll", syncScroll);
  codeArea.addEventListener("click", updateActiveLine);
  codeArea.addEventListener("keyup", updateActiveLine);
  codeArea.addEventListener("keydown", handleEditorKeydown);
  codeArea.addEventListener("mousemove", handleEditorMouseMove);
  codeArea.addEventListener("mouseleave", hideTooltip);

  lineNumbers.addEventListener("mousemove", handleLineNumbersMouseMove);
  lineNumbers.addEventListener("mouseleave", hideTooltip);

  updateLines();

  return {
    getCode() {
      return codeArea.value;
    },
    setCode(code) {
      codeArea.value = code;
      updateLines();
    },
    setDiagnostics,
    setStepLineHighlight,
    setExerciseEditableLines,
    clearExerciseEditableLines,
  };
}
