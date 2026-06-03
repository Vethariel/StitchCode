import assert from "node:assert/strict";
import test from "node:test";
import { validateGeminiKeyFormat } from "../assets/js/gemini-api-key.js";

test("validateGeminiKeyFormat rechaza vacío", () => {
  assert.equal(validateGeminiKeyFormat("").ok, false);
  assert.equal(validateGeminiKeyFormat("   ").ok, false);
});

test("validateGeminiKeyFormat acepta cualquier clave no vacía", () => {
  const r = validateGeminiKeyFormat("  my-real-gemini-key-xyz  ");
  assert.equal(r.ok, true);
  assert.equal(r.key, "my-real-gemini-key-xyz");
});
