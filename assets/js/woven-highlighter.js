/** @typedef {'keyword'|'type'|'operator'|'string'|'number'|'comment'|'function'|'identifier'} TokenKind */

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
      const quote = ch;
      let j = i + 1;
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
      parts.push(span(line.slice(i, j), "string"));
      i = j;
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
