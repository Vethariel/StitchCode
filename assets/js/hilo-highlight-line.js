/** @typedef {'editor' | 'blocks' | 'console' | 'python' | 'java' | 'cpp'} HiloPanelId */

/**
 * @param {string} text
 * @param {HiloPanelId} [panel]
 */
export function parseLineFromExplanationText(text, panel) {
  const t = text ?? "";
  const patterns = [
    /\b(?:l[ií]nea|linea)\s*#?\s*(\d+)\b/i,
    /\bline\s*(\d+)\b/i,
    /\bfila\s*(\d+)\b/i,
  ];
  if (panel === "blocks" || panel === "console") {
    patterns.unshift(/\bL(\d+)\b/);
  }
  for (const re of patterns) {
    const m = t.match(re);
    if (m) {
      const n = parseInt(m[1], 10);
      if (Number.isFinite(n) && n >= 1) return n;
    }
  }
  return null;
}

/**
 * @param {{ highlight?: { line?: number }, text?: string }} chunk
 * @param {HiloPanelId} panel
 * @param {{ codigoLineas?: number, bloquesLineas?: number, consolaLineas?: number, tradLineas?: number }} limits
 */
export function resolveHighlightLine(chunk, panel, limits = {}) {
  let line = chunk.highlight?.line;
  if (typeof line === "number" && line >= 1) {
    line = Math.floor(line);
  } else {
    line = parseLineFromExplanationText(chunk.text ?? "", panel) ?? 1;
  }

  let max = 999;
  if (panel === "console") max = Math.max(1, limits.consolaLineas ?? 1);
  else if (panel === "blocks") max = Math.max(1, limits.bloquesLineas ?? 1);
  else if (panel === "python" || panel === "java" || panel === "cpp") {
    max = Math.max(1, limits.tradLineas ?? 1);
  } else max = Math.max(1, limits.codigoLineas ?? 1);

  return Math.max(1, Math.min(line, max));
}
