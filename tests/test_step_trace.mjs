import assert from "node:assert/strict";
import test from "node:test";
import { buildStepView, formatWovenValue } from "../assets/js/step-trace.js";

test("formatWovenValue serializa objetos y listas", () => {
  assert.equal(formatWovenValue(5), "5");
  assert.equal(formatWovenValue(null), "null");
  assert.match(
    formatWovenValue({ clase: "Punto", campos: { x: 1 } }),
    /Punto/
  );
});

test("buildStepView acumula scope y contexto", () => {
  const trace = {
    exito: true,
    total_pasos: 3,
    eventos: [
      { paso: 0, tipo: "linea", linea: 1, codigo: "int a = 1", call_stack: [] },
      {
        paso: 1,
        tipo: "variable",
        linea: 1,
        nombre: "a",
        scope: { a: { valor: 1, tipo: "int" } },
        call_stack: [],
      },
      {
        paso: 2,
        tipo: "llamada",
        linea: 3,
        nombre: "f",
        scope_previo: { a: { valor: 1, tipo: "int" } },
        call_stack: ["f"],
      },
    ],
  };
  const view = buildStepView(trace, 2);
  assert.equal(view.index, 2);
  assert.equal(view.contextLabel, "f");
  assert.equal(view.scope.a.valor, 1);
  assert.equal(view.event?.tipo, "llamada");
});
