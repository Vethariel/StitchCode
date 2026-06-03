import assert from "node:assert/strict";
import test from "node:test";
import {
  parseLineFromExplanationText,
  resolveHighlightLine,
} from "../assets/js/hilo-highlight-line.js";

test("parseLineFromExplanationText", () => {
  assert.equal(parseLineFromExplanationText("En la línea 3 declaras x.", "editor"), 3);
  assert.equal(parseLineFromExplanationText("El bloque L2 imprime.", "blocks"), 2);
  assert.equal(parseLineFromExplanationText("El bloque L2 imprime.", "editor"), null);
  assert.equal(parseLineFromExplanationText("Hola mundo.", "editor"), null);
});

test("resolveHighlightLine no usa índice de chunk", () => {
  const line = resolveHighlightLine(
    { text: "Segundo fragmento.", highlight: { line: 2 } },
    "editor",
    { codigoLineas: 10 }
  );
  assert.equal(line, 2);
});

test("resolveHighlightLine acota a consola", () => {
  const line = resolveHighlightLine(
    { text: "Salida.", highlight: { line: 9 } },
    "console",
    { consolaLineas: 2 }
  );
  assert.equal(line, 2);
});
