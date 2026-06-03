import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeModelWovenCode } from "../assets/js/hilo-draft.js";

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
