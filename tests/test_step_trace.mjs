import assert from "node:assert/strict";
import test from "node:test";
import {
  buildStepContextForHilo,
  buildStepView,
  formatWovenValue,
} from "../assets/js/step-trace.js";

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

test("buildStepView acumula salida de consola hasta el paso", () => {
  const trace = {
    exito: true,
    total_pasos: 4,
    eventos: [
      { paso: 0, tipo: "linea", linea: 1, codigo: 'print("a")', call_stack: [] },
      { paso: 1, tipo: "salida", linea: 1, texto: "a", call_stack: [] },
      { paso: 2, tipo: "linea", linea: 2, codigo: 'print("b")', call_stack: [] },
      { paso: 3, tipo: "salida", linea: 2, texto: "b", call_stack: [] },
    ],
  };
  const early = buildStepView(trace, 1);
  assert.deepEqual(early.outputLines, [{ texto: "a", es_error: false, linea: 1 }]);
  const late = buildStepView(trace, 3);
  assert.equal(late.outputLines.length, 2);
  assert.equal(late.outputLines[1].texto, "b");

  const before = buildStepView(trace, 0);
  assert.equal(before.outputLines.length, 0);
});

test("formatWovenValue resuelve ref con heap", () => {
  const heap = {
    o1: {
      kind: "object",
      id: "o1",
      class: "Nodo",
      fields: { valor: 1, siguiente: null },
    },
  };
  assert.equal(
    formatWovenValue({ kind: "ref", id: "o1" }, heap),
    "@o1 → Nodo { valor: 1, siguiente: null }"
  );
});

test("buildStepContextForHilo resume traza y paso actual", () => {
  const trace = {
    exito: true,
    total_pasos: 3,
    eventos: [
      { paso: 0, tipo: "linea", linea: 1, codigo: "int x = 1", call_stack: [] },
      {
        paso: 1,
        tipo: "variable",
        linea: 1,
        nombre: "x",
        scope: { x: { valor: 1, tipo: "int" } },
        call_stack: [],
      },
      { paso: 2, tipo: "salida", linea: 2, texto: "1", call_stack: [] },
    ],
  };
  const ctx = buildStepContextForHilo(trace, 1);
  assert.equal(ctx?.activo, true);
  assert.equal(ctx?.paso_actual, 2);
  assert.equal(ctx?.evento?.tipo, "variable");
  assert.equal(ctx?.variables_visibles?.[0], "x (int) = 1");
  assert.match(ctx?.resumen_traza?.[1] ?? "", /PASO ACTUAL/);
  assert.equal(ctx?.salida_consola_hasta_paso?.length, 0);
  const ctx2 = buildStepContextForHilo(trace, 2);
  assert.deepEqual(ctx2?.salida_consola_hasta_paso, ["1"]);
});
