import assert from "node:assert/strict";
import test from "node:test";
import {
  detectHiloIntent,
  intentToApiTipo,
} from "../assets/js/hilo-intent.js";

test("detecta explicación del código", () => {
  assert.equal(detectHiloIntent("Explícame este código"), "explanation");
  assert.equal(detectHiloIntent("¿Qué hace la línea 3?"), "explanation");
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

test("detecta aprendizaje de concepto", () => {
  assert.equal(detectHiloIntent("Enséñame qué es un bucle"), "learning");
  assert.equal(detectHiloIntent("Quiero aprender variables en Woven"), "learning");
  assert.equal(intentToApiTipo("learning"), "aprendizaje");
});

test("intentToApiTipo", () => {
  assert.equal(intentToApiTipo("explanation"), "explicacion");
  assert.equal(intentToApiTipo("conversation"), "conversacion");
});
