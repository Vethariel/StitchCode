import assert from "node:assert/strict";
import test from "node:test";
import {
  detectHiloIntent,
  detectExercise,
  detectLearning,
  detectStepTrace,
  detectExitStepMode,
  stepModeActiveApiTipo,
  exerciseActiveApiTipo,
  intentToApiTipo,
} from "../assets/js/hilo-intent.js";

test("detecta explicación del código", () => {
  assert.equal(detectHiloIntent("Explícame este código"), "explanation");
  assert.equal(detectHiloIntent("¿Qué hace la línea 3?"), "explanation");
  assert.equal(detectHiloIntent("No entiendo mi programa"), "explanation");
});

test("detecta explicación de consola", () => {
  assert.equal(
    detectHiloIntent("¿Qué significa la salida en la consola?"),
    "explanation"
  );
});

test("conversación normal", () => {
  assert.equal(detectHiloIntent("¿Por qué falla mi programa?"), "conversation");
  assert.equal(detectHiloIntent("Ayúdame con el error"), "conversation");
});

test("detecta plan — aprendizaje pasa por plan", () => {
  assert.equal(detectHiloIntent("Enséñame qué es un bucle"), "plan");
  assert.equal(detectHiloIntent("Quiero aprender variables en Woven"), "plan");
  assert.equal(intentToApiTipo("plan"), "plan");
});

test("detecta plan — listas y temas generales", () => {
  assert.equal(detectHiloIntent("Enséñame de listas"), "plan");
  assert.equal(detectHiloIntent("enséñame sobre listas"), "plan");
  assert.equal(detectHiloIntent("Quiero aprender de arrays"), "plan");
  assert.equal(detectHiloIntent("Háblame de recursión"), "plan");
  assert.equal(detectHiloIntent("¿Qué es una lista?"), "plan");
  assert.equal(detectHiloIntent("¿Qué son los bucles?"), "plan");
  assert.equal(detectHiloIntent("Cómo se usan las listas"), "plan");
  assert.equal(detectHiloIntent("Necesito saber sobre condicionales"), "plan");
  assert.equal(detectHiloIntent("Tutorial de funciones"), "plan");
  assert.equal(detectHiloIntent("que me enseñes listas"), "plan");
  assert.equal(detectHiloIntent("No entiendo las listas"), "plan");
});

test("aprendizaje no roba explicación del código del alumno", () => {
  assert.equal(detectHiloIntent("Explícame mi código"), "explanation");
  assert.equal(detectHiloIntent("Enséñame qué hace mi función"), "explanation");
  assert.equal(detectLearning("Explícame este programa en pantalla"), false);
});

test("detecta ejercicio antes que aprendizaje", () => {
  assert.equal(detectHiloIntent("Dame un ejercicio de listas"), "exercise");
  assert.equal(detectHiloIntent("modo ejercicio"), "exercise");
  assert.equal(detectHiloIntent("Quiero un reto de bucles"), "exercise");
  assert.equal(detectHiloIntent("Enséñame un ejercicio de variables"), "exercise");
  assert.equal(intentToApiTipo("exercise"), "ejercicio");
  assert.equal(exerciseActiveApiTipo(), "ejercicio_activo");
  assert.equal(detectExercise("Hazme una práctica de condicionales"), true);
});

test("plan sigue sin confundirse con ejercicio explícito", () => {
  assert.equal(detectHiloIntent("Enséñame de listas"), "plan");
  assert.equal(detectHiloIntent("Quiero aprender arrays"), "plan");
});

test("detecta modo paso a paso del editor", () => {
  assert.equal(detectHiloIntent("activa paso a paso"), "step_trace");
  assert.equal(detectHiloIntent("quiero ver la ejecución paso a paso"), "step_trace");
  assert.equal(detectHiloIntent("línea por línea qué pasa"), "step_trace");
  assert.equal(detectStepTrace("modo paso a paso"), true);
});

test("paso a paso no roba explicación explícita", () => {
  assert.equal(detectHiloIntent("Explícame paso a paso mi código"), "explanation");
  assert.equal(detectHiloIntent("Explícame este código"), "explanation");
});

test("ejercicio sale antes que paso a paso", () => {
  assert.equal(detectHiloIntent("Dame un ejercicio paso a paso"), "exercise");
});

test("detecta salir del modo paso a paso", () => {
  assert.equal(detectExitStepMode("salir del paso a paso"), true);
  assert.equal(detectExitStepMode("cerrar el modo paso a paso"), true);
  assert.equal(detectExitStepMode("explícame esto"), false);
  assert.equal(stepModeActiveApiTipo(), "paso_a_paso_activo");
});
