import assert from "node:assert/strict";
import test from "node:test";
import {
  computeNewLineIndent,
  endsWithBlockColon,
  INDENT_STR,
  stripTrailingComment,
} from "../assets/js/editor-editing.js";

test("endsWithBlockColon ignora strings y comentarios", () => {
  assert.equal(endsWithBlockColon("if x > 0:"), true);
  assert.equal(endsWithBlockColon('print("a:")'), false);
  assert.equal(endsWithBlockColon("if x:  // fin"), true);
  assert.equal(endsWithBlockColon("int x = 0  # no"), false);
});

test("stripTrailingComment", () => {
  assert.equal(stripTrailingComment("a = 1 // x"), "a = 1 ");
  assert.equal(stripTrailingComment('s = "a//b"'), 's = "a//b"');
});

test("computeNewLineIndent tras dos puntos", () => {
  const line = "if x > 0:";
  assert.equal(
    computeNewLineIndent({ lineText: line, cursorCol: line.length }),
    INDENT_STR
  );
  assert.equal(
    computeNewLineIndent({ lineText: "    while i < n:", cursorCol: 16 }),
    "    " + INDENT_STR
  );
  assert.equal(
    computeNewLineIndent({ lineText: "print(x)", cursorCol: 8 }),
    ""
  );
});
