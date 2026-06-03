import assert from "node:assert/strict";
import test from "node:test";
import {
  detectHiloIntent,
  detectLearning,
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

test("detecta aprendizaje — frases clásicas", () => {
  assert.equal(detectHiloIntent("Enséñame qué es un bucle"), "learning");
  assert.equal(detectHiloIntent("Quiero aprender variables en Woven"), "learning");
  assert.equal(intentToApiTipo("learning"), "aprendizaje");
});

test("detecta aprendizaje — listas y temas generales", () => {
  assert.equal(detectHiloIntent("Enséñame de listas"), "learning");
  assert.equal(detectHiloIntent("enséñame sobre listas"), "learning");
  assert.equal(detectHiloIntent("Quiero aprender de arrays"), "learning");
  assert.equal(detectHiloIntent("Háblame de recursión"), "learning");
  assert.equal(detectHiloIntent("¿Qué es una lista?"), "learning");
  assert.equal(detectHiloIntent("¿Qué son los bucles?"), "learning");
  assert.equal(detectHiloIntent("Cómo se usan las listas"), "learning");
  assert.equal(detectHiloIntent("Necesito saber sobre condicionales"), "learning");
  assert.equal(detectHiloIntent("Tutorial de funciones"), "learning");
  assert.equal(detectHiloIntent("que me enseñes listas"), "learning");
  assert.equal(detectHiloIntent("No entiendo las listas"), "learning");
});

test("aprendizaje no roba explicación del código del alumno", () => {
  assert.equal(detectHiloIntent("Explícame mi código"), "explanation");
  assert.equal(detectHiloIntent("Enséñame qué hace mi función"), "explanation");
  assert.equal(detectLearning("Explícame este programa en pantalla"), false);
});
