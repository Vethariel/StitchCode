import assert from "node:assert/strict";
import test from "node:test";
import { inferRedaccionObjetivo } from "../assets/js/hilo-draft.js";

test("inferRedaccionObjetivo ejemplo para corregir", () => {
  assert.equal(
    inferRedaccionObjetivo("Dame un ejemplo con errores para corregir"),
    "ejemplo_para_corregir"
  );
  assert.equal(
    inferRedaccionObjetivo("Enséñame variables"),
    "ejemplo_correcto"
  );
});
