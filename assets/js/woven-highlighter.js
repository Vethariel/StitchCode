/** @typedef {'keyword'|'type'|'operator'|'string'|'number'|'comment'|'function'|'identifier'|'interp-brace'|'interp-expr'} TokenKind */

const KEYWORDS = new Set([
  "function",
  "class",
  "extends",
  "init",
  "self",
  "super",
  "virtual",
  "new",
  "if",
  "else",
  "for",
  "while",
  "return",
  "break",
  "continue",
  "try",
  "catch",
  "throw",
  "and",
  "or",
  "true",
  "false",
  "null",
]);

const TYPES = new Set(["int", "float", "string", "bool", "void", "list"]);

const BUILTINS = new Set(["print"]);

const OPERATORS = [
  "**",
  "<=",
  ">=",
  "==",
  "!=",
  "+",
  "-",
  "*",
  "/",
  "%",
  "<",
  ">",
  "!",
  "=",
  ".",
  ",",
  ";",
  ":",
  "(",
  ")",
  "[",
  "]",
  "{",
  "}",
];

/** Operadores dentro de `{expr}` (sin llaves de interpolación). */
const INTERP_OPERATORS = OPERATORS.filter((op) => op !== "{" && op !== "}");

/**
 * @param {string} text
 */
function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * @param {string} text
 * @param {TokenKind} kind
 */
function span(text, kind) {
  return `<span class="tok-${kind}">${escapeHtml(text)}</span>`;
}

/**
 * @param {string} line
 * @param {boolean} inBlockComment
 */
function classifyIdentifier(word, rest) {
  const trimmed = rest.trimStart();
  if (trimmed.startsWith("(")) {
    if (BUILTINS.has(word)) return "function";
    return "function";
  }
  if (KEYWORDS.has(word)) return "keyword";
  if (TYPES.has(word)) return "type";
  return "identifier";
}

/**
 * @param {string} expr
 */
function highlightInterpExpr(expr) {
  const parts = [];
  let i = 0;
  while (i < expr.length) {
    const ch = expr[i];
    if (ch === " " || ch === "\t") {
      let j = i + 1;
      while (j < expr.length && (expr[j] === " " || expr[j] === "\t")) j += 1;
      parts.push(escapeHtml(expr.slice(i, j)));
      i = j;
      continue;
    }
    if (ch >= "0" && ch <= "9") {
      let j = i + 1;
      while (j < expr.length && /[0-9.eE+-]/.test(expr[j])) j += 1;
      parts.push(span(expr.slice(i, j), "number"));
      i = j;
      continue;
    }
    if (/[a-zA-Z_]/.test(ch)) {
      let j = i + 1;
      while (j < expr.length && /[a-zA-Z0-9_]/.test(expr[j])) j += 1;
      const word = expr.slice(i, j);
      let kind = "interp-expr";
      if (KEYWORDS.has(word)) kind = "keyword";
      else if (TYPES.has(word)) kind = "type";
      else if (word === "self" || word === "super") kind = "keyword";
      parts.push(span(word, kind));
      i = j;
      continue;
    }
    let matched = false;
    for (const op of INTERP_OPERATORS) {
      if (expr.startsWith(op, i)) {
        parts.push(span(op, "operator"));
        i += op.length;
        matched = true;
        break;
      }
    }
    if (matched) continue;
    parts.push(escapeHtml(ch));
    i += 1;
  }
  return parts.join("");
}

/**
 * @param {string} line
 * @param {number} start índice de la comilla de apertura
 * @returns {{ html: string, end: number }}
 */
function highlightQuotedString(line, start) {
  const quote = line[start];
  if (quote !== '"') {
    let j = start + 1;
    while (j < line.length) {
      if (line[j] === "\\" && j + 1 < line.length) {
        j += 2;
        continue;
      }
      if (line[j] === quote) {
        j += 1;
        break;
      }
      j += 1;
    }
    return { html: span(line.slice(start, j), "string"), end: j };
  }

  const parts = [span('"', "string")];
  let i = start + 1;
  while (i < line.length) {
    if (line[i] === "\\" && i + 1 < line.length) {
      parts.push(span(line.slice(i, i + 2), "string"));
      i += 2;
      continue;
    }
    if (line[i] === '"') {
      parts.push(span('"', "string"));
      return { html: parts.join(""), end: i + 1 };
    }
    if (line[i] === "{") {
      parts.push(span("{", "interp-brace"));
      i += 1;
      let j = i;
      while (j < line.length && line[j] !== "}") {
        if (line[j] === "\\" && j + 1 < line.length) {
          j += 2;
          continue;
        }
        j += 1;
      }
      const inner = line.slice(i, j);
      if (inner) parts.push(highlightInterpExpr(inner));
      if (j < line.length && line[j] === "}") {
        parts.push(span("}", "interp-brace"));
        i = j + 1;
      } else {
        i = j;
      }
      continue;
    }
    let j = i;
    while (
      j < line.length &&
      line[j] !== "{" &&
      line[j] !== '"' &&
      line[j] !== "\\"
    ) {
      j += 1;
    }
    if (j > i) parts.push(span(line.slice(i, j), "string"));
    i = j;
  }
  parts.push(span(line.slice(start + 1), "string"));
  return { html: parts.join(""), end: line.length };
}

/**
 * @param {string} line
 * @param {{ inBlockComment: boolean }} state
 * @returns {{ html: string, state: { inBlockComment: boolean } }}
 */
export function highlightLine(line, state) {
  let { inBlockComment } = state;
  const parts = [];
  let i = 0;

  if (inBlockComment) {
    const end = line.indexOf("*/");
    if (end === -1) {
      return { html: span(line || " ", "comment"), state: { inBlockComment: true } };
    }
    parts.push(span(line.slice(0, end + 2), "comment"));
    i = end + 2;
    inBlockComment = false;
  }

  while (i < line.length) {
    const ch = line[i];
    const next = line[i + 1];

    if (ch === "/" && next === "/") {
      parts.push(span(line.slice(i), "comment"));
      break;
    }

    if (ch === "#") {
      parts.push(span(line.slice(i), "comment"));
      break;
    }

    if (ch === "/" && next === "*") {
      const end = line.indexOf("*/", i + 2);
      if (end === -1) {
        parts.push(span(line.slice(i), "comment"));
        inBlockComment = true;
        break;
      }
      parts.push(span(line.slice(i, end + 2), "comment"));
      i = end + 2;
      continue;
    }

    if (ch === '"' || ch === "'") {
      const highlighted = highlightQuotedString(line, i);
      parts.push(highlighted.html);
      i = highlighted.end;
      continue;
    }

    if (ch >= "0" && ch <= "9") {
      let j = i + 1;
      while (j < line.length && /[0-9.eE+-]/.test(line[j])) j += 1;
      parts.push(span(line.slice(i, j), "number"));
      i = j;
      continue;
    }

    if (/[a-zA-Z_]/.test(ch)) {
      let j = i + 1;
      while (j < line.length && /[a-zA-Z0-9_]/.test(line[j])) j += 1;
      const word = line.slice(i, j);
      const kind = classifyIdentifier(word, line.slice(j));
      parts.push(span(word, kind));
      i = j;
      continue;
    }

    let matched = false;
    for (const op of OPERATORS) {
      if (line.startsWith(op, i)) {
        parts.push(span(op, "operator"));
        i += op.length;
        matched = true;
        break;
      }
    }
    if (matched) continue;

    parts.push(escapeHtml(ch));
    i += 1;
  }

  const html = parts.length ? parts.join("") : " ";
  return { html, state: { inBlockComment } };
}

/**
 * @param {string} source
 * @returns {string[]}
 */
export function highlightSourceLines(source) {
  const lines = source.split("\n");
  /** @type {{ inBlockComment: boolean }} */
  let state = { inBlockComment: false };
  const out = [];
  for (const line of lines) {
    const result = highlightLine(line, state);
    state = result.state;
    out.push(result.html);
  }
  return out;
}
