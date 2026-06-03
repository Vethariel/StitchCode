import assert from "node:assert/strict";
import test from "node:test";
import {
  buildStudentCodeFromSolution,
  defaultLineasEdicion,
  inferExerciseTipo,
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
    lineas_edicion: [{ linea: 2, modo: "vacio" }],
    criterios: [],
    resumen: "",
    tema_id: "x",
    tema_nombre: "X",
  });
  const p = parseExercisePayload(raw);
  assert.equal(p.tipo_ejercicio, "relleno");
  assert.equal(p.lineas_edicion?.[0].linea, 2);
});

test("defaultLineasEdicion elige líneas con código", () => {
  const code = "class A:\n    int x\n// nota\nprint(1)";
  const slots = defaultLineasEdicion(code, "relleno");
  assert.ok(slots.length >= 1);
  assert.ok(slots.every((s) => s.linea > 0));
});
