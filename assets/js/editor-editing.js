/** Comodidades de edición para el textarea Woven (indentación, pares, Tab). */

export const INDENT_STEP = 4;
export const INDENT_STR = " ".repeat(INDENT_STEP);

const OPENERS = new Set(["(", "[", "{", '"', "'"]);
const CLOSERS = {
  "(": ")",
  "[": "]",
  "{": "}",
  '"': '"',
  "'": "'",
};

/**
 * Quita comentarios al final de una línea (//, #).
 * @param {string} line
 */
export function stripTrailingComment(line) {
  let inStr = null;
  let escape = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inStr) {
      if (escape) escape = false;
      else if (c === "\\") escape = true;
      else if (c === inStr) inStr = null;
      continue;
    }
    if (c === '"' || c === "'") {
      inStr = c;
      continue;
    }
    if (c === "/" && line[i + 1] === "/") return line.slice(0, i);
    if (c === "#") return line.slice(0, i);
  }
  return line;
}

/**
 * True si el último carácter significativo (fuera de strings) es ':'.
 * @param {string} line
 */
export function endsWithBlockColon(line) {
  const s = stripTrailingComment(line).trimEnd();
  let inStr = null;
  let escape = false;
  let lastMeaningful = -1;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (escape) escape = false;
      else if (c === "\\") escape = true;
      else if (c === inStr) inStr = null;
      continue;
    }
    if (c === '"' || c === "'") {
      inStr = c;
      continue;
    }
    if (!/\s/.test(c)) lastMeaningful = i;
  }
  return lastMeaningful >= 0 && s[lastMeaningful] === ":";
}

/**
 * @param {string} value
 * @param {number} pos
 */
export function lineIndexAt(value, pos) {
  let line = 0;
  for (let i = 0; i < pos && i < value.length; i++) {
    if (value[i] === "\n") line++;
  }
  return line;
}

/**
 * @param {string} value
 * @param {number} pos
 */
export function lineBoundsAt(value, pos) {
  const start = value.lastIndexOf("\n", pos - 1) + 1;
  const nextNl = value.indexOf("\n", pos);
  const end = nextNl === -1 ? value.length : nextNl;
  return { start, end };
}

/**
 * Indentación que debe llevar una línea nueva al pulsar Enter.
 * @param {{ lineText: string, cursorCol: number }} ctx
 */
export function computeNewLineIndent({ lineText, cursorCol }) {
  const base = (lineText.match(/^\s*/) ?? [""])[0];
  const before = lineText.slice(0, cursorCol);
  const after = lineText.slice(cursorCol);
  const beforeTrim = stripTrailingComment(before).trimEnd();

  if (endsWithBlockColon(beforeTrim)) {
    return base + INDENT_STR;
  }

  if (!after.trim() && endsWithBlockColon(stripTrailingComment(lineText).trimEnd())) {
    return base + INDENT_STR;
  }

  return base;
}

/**
 * @param {string} value
 * @param {number} pos
 */
export function isEscapedAt(value, pos) {
  let n = 0;
  for (let i = pos - 1; i >= 0 && value[i] === "\\"; i--) n++;
  return n % 2 === 1;
}

/**
 * @param {string} value
 * @param {number} pos
 */
export function isInStringAt(value, pos) {
  let inStr = null;
  let escape = false;
  for (let i = 0; i < pos; i++) {
    const c = value[i];
    if (inStr) {
      if (escape) {
        escape = false;
        continue;
      }
      if (c === "\\") {
        escape = true;
        continue;
      }
      if (c === inStr) inStr = null;
      continue;
    }
    if (c === '"' || c === "'") inStr = c;
  }
  return inStr;
}

/**
 * @param {HTMLTextAreaElement} codeArea
 * @param {{ onEdit?: () => void, guardEditRange?: (start: number, end: number) => boolean }} opts
 */
export function createEditorKeydownHandler(codeArea, { onEdit, guardEditRange } = {}) {
  function applyEdit(start, end, text, selStart, selEnd = selStart) {
    if (guardEditRange && !guardEditRange(start, end)) return;
    const v = codeArea.value;
    codeArea.value = v.slice(0, start) + text + v.slice(end);
    codeArea.selectionStart = selStart;
    codeArea.selectionEnd = selEnd;
    onEdit?.();
  }

  function selectedLinesRange() {
    const v = codeArea.value;
    const start = codeArea.selectionStart;
    const end = codeArea.selectionEnd;
    const lineStart = v.lastIndexOf("\n", start - 1) + 1;
    const lineEndIdx = v.indexOf("\n", end);
    const lineEnd = lineEndIdx === -1 ? v.length : lineEndIdx;
    return { lineStart, lineEnd, start, end };
  }

  function handleTab(event) {
    if (event.key !== "Tab") return false;
    event.preventDefault();

    const v = codeArea.value;
    const selStart = codeArea.selectionStart;
    const selEnd = codeArea.selectionEnd;

    if (selStart !== selEnd) {
      const { lineStart, lineEnd } = selectedLinesRange();
      const block = v.slice(lineStart, lineEnd);
      const lines = block.split("\n");

      if (event.shiftKey) {
        const out = lines
          .map((ln) => {
            if (ln.startsWith(INDENT_STR)) return ln.slice(INDENT_STEP);
            if (ln.startsWith("\t")) return ln.slice(1);
            if (ln.startsWith(" ")) return ln.replace(/^ +/, "");
            return ln;
          })
          .join("\n");
        applyEdit(lineStart, lineEnd, out, lineStart, lineStart + out.length);
      } else {
        const out = lines.map((ln) => INDENT_STR + ln).join("\n");
        applyEdit(lineStart, lineEnd, out, lineStart, lineStart + out.length);
      }
      return true;
    }

    if (event.shiftKey) {
      const { start, end } = lineBoundsAt(v, selStart);
      const line = v.slice(start, end);
      let remove = 0;
      if (line.startsWith(INDENT_STR)) remove = INDENT_STEP;
      else if (line.startsWith("\t")) remove = 1;
      else if (line.startsWith(" ")) remove = 1;
      if (remove) {
        applyEdit(start, start + remove, "", selStart - Math.min(remove, selStart - start));
      }
      return true;
    }

    applyEdit(selStart, selEnd, INDENT_STR, selStart + INDENT_STR.length);
    return true;
  }

  function handleEnter(event) {
    if (event.key !== "Enter") return false;
    if (event.ctrlKey || event.metaKey || event.altKey) return false;

    event.preventDefault();
    const v = codeArea.value;
    const pos = codeArea.selectionStart;
    const end = codeArea.selectionEnd;
    const { start: lineStart, end: lineEnd } = lineBoundsAt(v, pos);
    const lineText = v.slice(lineStart, lineEnd);
    const cursorCol = pos - lineStart;

    const indent = computeNewLineIndent({ lineText, cursorCol });
    const insert = `\n${indent}`;
    applyEdit(pos, end, insert, pos + insert.length);
    return true;
  }

  function handleBackspace(event) {
    if (event.key !== "Backspace") return false;
    const v = codeArea.value;
    const pos = codeArea.selectionStart;
    if (pos !== codeArea.selectionEnd || pos < 1) return false;

    const open = v[pos - 1];
    const close = v[pos];
    if (OPENERS.has(open) && CLOSERS[open] === close) {
      event.preventDefault();
      applyEdit(pos - 1, pos + 1, "", pos - 1);
      return true;
    }
    return false;
  }

  function handleAutoClose(event) {
    if (event.ctrlKey || event.metaKey || event.altKey) return false;
    const ch = event.key;
    if (!OPENERS.has(ch)) return false;

    const v = codeArea.value;
    const start = codeArea.selectionStart;
    const end = codeArea.selectionEnd;
    const closer = CLOSERS[ch];

    if (isInStringAt(v, start) && ch !== '"' && ch !== "'") return false;

    if (ch === '"' || ch === "'") {
      if (v[start] === ch && !isEscapedAt(v, start)) {
        event.preventDefault();
        applyEdit(start, start + 1, "", start + 1);
        return true;
      }
      if (start === end) {
        event.preventDefault();
        applyEdit(start, end, ch + closer, start + 1);
        return true;
      }
      return false;
    }

    if (start !== end) {
      event.preventDefault();
      const sel = v.slice(start, end);
      applyEdit(start, end, ch + sel + closer, start + 1, end + 1);
      return true;
    }

    if (closer && v[start] === closer) {
      event.preventDefault();
      applyEdit(start, start + 1, "", start + 1);
      return true;
    }

    event.preventDefault();
    applyEdit(start, end, ch + closer, start + 1);
    return true;
  }

  function handleSkipCloser(event) {
    const ch = event.key;
    if (!Object.values(CLOSERS).includes(ch)) return false;
    const v = codeArea.value;
    const pos = codeArea.selectionStart;
    if (pos !== codeArea.selectionEnd) return false;
    if (v[pos] === ch && !isInStringAt(v, pos)) {
      event.preventDefault();
      applyEdit(pos, pos + 1, "", pos + 1);
      return true;
    }
    return false;
  }

  /**
   * @param {number} start
   * @param {number} end
   */
  function rangeAllowed(start, end) {
    if (!guardEditRange) return true;
    return guardEditRange(start, end);
  }

  function handleGuardedInput(event) {
    if (!guardEditRange) return;
    const start = codeArea.selectionStart;
    const end = codeArea.selectionEnd;
    if (!rangeAllowed(start, end)) {
      event.preventDefault();
    }
  }

  codeArea.addEventListener("beforeinput", handleGuardedInput);

  return function handleEditorKeydown(event) {
    if (guardEditRange) {
      const start = codeArea.selectionStart;
      const end = codeArea.selectionEnd;
      if (
        event.key.length === 1 ||
        event.key === "Backspace" ||
        event.key === "Delete" ||
        event.key === "Enter"
      ) {
        if (!rangeAllowed(start, end)) {
          event.preventDefault();
          return;
        }
      }
    }
    if (handleTab(event)) return;
    if (handleSkipCloser(event)) return;
    if (handleBackspace(event)) return;
    if (handleEnter(event)) return;
    if (handleAutoClose(event)) return;
  };
}
