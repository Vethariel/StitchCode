import assert from "node:assert/strict";
import test from "node:test";
import { highlightLine } from "../assets/js/woven-highlighter.js";

test("cadenas interpoladas resaltan llaves y expresión", () => {
  const { html } = highlightLine(
    'print("El primer elemento es {primero}")',
    { inBlockComment: false }
  );
  assert.match(html, /tok-interp-brace/);
  assert.match(html, /tok-interp-expr/);
  assert.match(html, />primero</);
});

test("cadenas simples sin llaves siguen siendo tok-string", () => {
  const { html } = highlightLine('print("hola")', { inBlockComment: false });
  assert.match(html, /tok-string/);
  assert.doesNotMatch(html, /tok-interp-brace/);
});
