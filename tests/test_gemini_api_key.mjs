import assert from "node:assert/strict";
import test from "node:test";
import { validateGeminiKeyFormat } from "../assets/js/gemini-api-key.js";

test("validateGeminiKeyFormat rechaza vacío y formato incorrecto", () => {
  assert.equal(validateGeminiKeyFormat("").ok, false);
  assert.equal(validateGeminiKeyFormat("sk-abc").ok, false);
  assert.equal(validateGeminiKeyFormat("AIzaSy").ok, false);
});

test("validateGeminiKeyFormat acepta prefijo AIza", () => {
  const r = validateGeminiKeyFormat("AIzaSyDUMMY_KEY_FOR_UNIT_TEST_12345");
  assert.equal(r.ok, true);
  assert.equal(r.key, "AIzaSyDUMMY_KEY_FOR_UNIT_TEST_12345");
});
