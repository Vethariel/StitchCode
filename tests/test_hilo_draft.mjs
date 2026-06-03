import assert from "node:assert/strict";
import test from "node:test";
import {
  fallbackWovenExampleForTopic,
  lintMessagesFromResult,
  sanitizeModelWovenCode,
} from "../assets/js/hilo-draft.js";

test("lintMessagesFromResult lee diagnosticos del linter", () => {
  const msg = lintMessagesFromResult({
    parse_ok: false,
    diagnosticos: [{ mensaje: "Falta tipo en lista", texto: "L1" }],
  });
  assert.match(msg, /Falta tipo/);
});

test("fallbackWovenExampleForTopic devuelve listas válidas", () => {
  const code = fallbackWovenExampleForTopic("aprender listas");
  assert.match(code, /list</);
});

test("sanitizeModelWovenCode quita fences y \\n literales", () => {
  const fenced = "```woven\nlist<int> x = [1]\nprint(x[0])\n```";
  assert.equal(
    sanitizeModelWovenCode(fenced),
    "list<int> x = [1]\nprint(x[0])"
  );
  assert.equal(
    sanitizeModelWovenCode("list<int> a = [1]\\nprint(a[0])"),
    "list<int> a = [1]\nprint(a[0])"
  );
});
