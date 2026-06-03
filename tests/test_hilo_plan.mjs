import assert from "node:assert/strict";
import test from "node:test";
import { parsePlanPayload, buildPlanEnunciado } from "../assets/js/hilo-plan.js";
import {
  activatePlanMode,
  canAdvancePlanActivity,
  deactivatePlanMode,
  getPlanContextJson,
  isPlanModeActive,
  markCurrentPlanActivityComplete,
} from "../assets/js/hilo-plan-mode.js";
import { detectHiloIntent } from "../assets/js/hilo-intent.js";

test("detectHiloIntent enruta aprendizaje a plan", () => {
  assert.equal(detectHiloIntent("quiero aprender sobre listas"), "plan");
  assert.equal(detectHiloIntent("hazme un plan para estudiar bucles"), "plan");
});

test("parsePlanPayload normaliza actividades", () => {
  const raw = JSON.stringify({
    type: "plan",
    titulo: "Listas",
    eje_tematico: "listas",
    tema_id: "listas",
    tema_nombre: "Listas",
    resumen: "Recorrido por listas.",
    logro_descripcion: "Domina listas e índices.",
    actividades: [
      {
        id: "a1",
        titulo: "Intro",
        tipo: "aprendizaje",
        objetivo: "Concepto",
        mensaje_inicio: "Enséñame listas",
      },
      {
        id: "a2",
        titulo: "Reto",
        tipo: "ejercicio_libre",
        objetivo: "Practicar",
        mensaje_inicio: "Ejercicio de listas",
      },
    ],
  });
  const plan = parsePlanPayload(raw);
  assert.equal(plan.actividades.length, 2);
  assert.equal(plan.actividades[0].tipo, "aprendizaje");
});

test("plan mode: siguiente actividad tras completar", () => {
  const plan = parsePlanPayload(
    JSON.stringify({
      type: "plan",
      titulo: "T",
      eje_tematico: "x",
      tema_id: "x",
      tema_nombre: "X",
      resumen: "r",
      logro_descripcion: "d",
      actividades: [
        {
          id: "1",
          titulo: "A",
          tipo: "reflexion",
          objetivo: "o",
          mensaje_inicio: "m",
        },
        {
          id: "2",
          titulo: "B",
          tipo: "reflexion",
          objetivo: "o2",
          mensaje_inicio: "m2",
        },
      ],
    })
  );
  activatePlanMode(plan);
  assert.equal(isPlanModeActive(), true);
  markCurrentPlanActivityComplete();
  assert.equal(canAdvancePlanActivity(), true);
  const ctx = JSON.parse(getPlanContextJson());
  assert.equal(ctx.actividades[0].estado, "completada");
  assert.equal(ctx.actividades[1].estado, "pendiente");
  deactivatePlanMode();
  assert.equal(isPlanModeActive(), false);
});

test("buildPlanEnunciado lista actividades", () => {
  const text = buildPlanEnunciado({
    titulo: "P",
    resumen: "Resumen",
    actividades: [{ id: "1", titulo: "A", tipo: "aprendizaje", objetivo: "O", mensaje_inicio: "m" }],
  }).paragraphs.join("\n");
  assert.match(text, /Aprendizaje/);
});
