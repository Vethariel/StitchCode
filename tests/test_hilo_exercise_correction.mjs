import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAlignedEnunciado,
  buildLineasDetalle,
  buildStudentCodeFromSolution,
  checkGuidedExerciseCompletion,
  defaultLineasEdicion,
  inferExerciseTipo,
  normalizeLineasEdicion,
} from "../assets/js/hilo-exercise-correction.js";
import { parseExercisePayload } from "../assets/js/hilo-exercise.js";
test("inferExerciseTipo distingue correccion y relleno", () => {
  assert.equal(inferExerciseTipo("ejercicio de corrección"), "correccion");
  assert.equal(inferExerciseTipo("completar el código"), "relleno");
  assert.equal(inferExerciseTipo("dame un ejercicio de bucles"), "libre");
});

test("buildStudentCodeFromSolution vacía líneas en relleno", () => {
  const solution = "int x = 1\nprint(x)\nint y = 2";
  const slots = [{ linea: 2, modo: "vacio" }];
  const built = buildStudentCodeFromSolution(solution, slots, "relleno");
  const lines = built.code.split("\n");
  assert.equal(lines[1].trim(), "");
  assert.deepEqual(built.editableLines, [2]);
});

test("buildStudentCodeFromSolution aplica error en correccion", () => {
  const solution = "int x = 1\nprint(x)";
  const slots = [
    { linea: 2, modo: "incorrecto", contenido_erroneo: "print(x + 1)" },
  ];
  const built = buildStudentCodeFromSolution(solution, slots, "correccion");
  assert.equal(built.code.split("\n")[1], "print(x + 1)");
});

test("parseExercisePayload incluye tipo y lineas", () => {
  const raw = JSON.stringify({
    type: "ejercicio",
    tipo_ejercicio: "relleno",
    titulo: "Huecos",
    enunciado: ["Completa."],
    codigo_plantilla: "x",
    codigo_solucion: "int x = 1\nprint(x)",
    lineas_edicion: [{ linea: 2, modo: "vacio", tarea: "Imprime el valor de x." }],
    criterios: [],
    resumen: "",
    tema_id: "x",
    tema_nombre: "X",
  });
  const p = parseExercisePayload(raw);
  assert.equal(p.tipo_ejercicio, "relleno");
  assert.equal(p.lineas_edicion?.[0].linea, 2);
  assert.equal(p.lineas_edicion?.[0].tarea, "Imprime el valor de x.");
});

test("normalizeLineasEdicion descarta líneas fuera del programa", () => {
  const sol = "a\nb\nc";
  const slots = normalizeLineasEdicion(sol, [
    { linea: 2, modo: "vacio" },
    { linea: 99, modo: "vacio" },
  ]);
  assert.equal(slots.length, 1);
  assert.equal(slots[0].linea, 2);
});

test("checkGuidedExerciseCompletion compara solo líneas editables", () => {
  const ref = "list<string> t = [\"A\"]\nprint(t[0])\nprint(t[1])";
  const bad = "list<string> t = [\"A\"]\nprint(t[0])\nprint(t[0])";
  const good = "list<string> t = [\"A\"]\nprint(t[0])\nprint(t[1])";
  assert.equal(checkGuidedExerciseCompletion(bad, ref, [3]), false);
  assert.equal(checkGuidedExerciseCompletion(good, ref, [3]), true);
});

test("buildAlignedEnunciado no repite números de línea contradictorios de Gemini", () => {
  const solution = "a\nb\nc";
  const slots = [
    { linea: 2, modo: "incorrecto", contenido_erroneo: "B", tarea: "Arregla b." },
    { linea: 3, modo: "incorrecto", contenido_erroneo: "C", tarea: "Arregla c." },
  ];
  const lineas_detalle = buildLineasDetalle(solution, slots, "correccion");
  const text = buildAlignedEnunciado({
    tipo: "correccion",
    titulo: "T",
    resumen: "Objetivo del ejercicio.",
    criterios: [],
    lineas_detalle,
    lineas_editables: [2, 3],
    salida_esperada: ["ok"],
  }).join("\n");
  assert.match(text, /Línea 2: Arregla b/);
  assert.match(text, /Línea 3: Arregla c/);
  assert.match(text, /Líneas editables: 2, 3/);
  assert.ok(!/línea 4/i.test(text));
  assert.ok(!/línea 5/i.test(text));
});

test("defaultLineasEdicion elige líneas con código", () => {
  const code = "class A:\n    int x\n// nota\nprint(1)";
  const slots = defaultLineasEdicion(code, "relleno");
  assert.ok(slots.length >= 1);
  assert.ok(slots.every((s) => s.linea > 0));
});
