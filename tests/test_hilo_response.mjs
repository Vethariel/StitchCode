import assert from "node:assert/strict";
import test from "node:test";
import { parseHiloTurn } from "../assets/js/hilo-response.js";

test("parseHiloTurn lee ejercicio completado y dominio tema", () => {
  const raw = JSON.stringify({
    type: "conversation",
    ejercicio_completado: true,
    dominio_tema: {
      id: "listas",
      nombre: "Listas",
      descripcion: "Dominas listas en Woven",
      icono: "📋",
    },
    chunks: [{ text: "¡Excelente!", emotion: "heart_eyes" }],
    texto_completo: "¡Excelente!",
  });
  const turn = parseHiloTurn(raw);
  assert.equal(turn.ejercicioCompletado, true);
  assert.equal(turn.dominioTema?.id, "listas");
  assert.equal(turn.dominioTema?.nombre, "Listas");
});

test("parseHiloTurn lee chunks y emociones", () => {
  const raw = JSON.stringify({
    chunks: [
      { text: "Hola.", emotion: "happy" },
      { text: "¿Listo?", emotion: "wink" },
    ],
    texto_completo: "Hola. ¿Listo?",
  });
  const turn = parseHiloTurn(raw);
  assert.equal(turn.type, "conversation");
  assert.equal(turn.chunks.length, 2);
  assert.equal(turn.chunks[1].emotion, "wink");
});

test("parseHiloTurn lee explicación con panel y highlight", () => {
  const raw = JSON.stringify({
    type: "explanation",
    chunks: [
      {
        text: "Aquí declaras x.",
        emotion: "smile",
        panel: "editor",
        highlight: { line: 2 },
      },
      {
        text: "La consola muestra 5.",
        emotion: "wink",
        panel: "console",
        highlight: { line: 1 },
      },
    ],
  });
  const turn = parseHiloTurn(raw);
  assert.equal(turn.type, "explanation");
  assert.equal(turn.chunks[0].panel, "editor");
  assert.equal(turn.chunks[0].highlight?.line, 2);
  assert.equal(turn.chunks[1].panel, "console");
});

test("parseHiloTurn acepta paneles de traducción", () => {
  const raw = JSON.stringify({
    type: "explanation",
    chunks: [
      {
        text: "En Python usa range.",
        emotion: "smile",
        panel: "python",
        highlight: { line: 2 },
      },
      {
        text: "En Java hay llaves.",
        emotion: "wink",
        panel: "java",
        highlight: { line: 1 },
      },
    ],
  });
  const turn = parseHiloTurn(raw);
  assert.equal(turn.chunks[0].panel, "python");
  assert.equal(turn.chunks[1].panel, "java");
});

test("parseHiloTurn acepta panel blocks", () => {
  const raw = JSON.stringify({
    type: "explanation",
    chunks: [
      {
        text: "El bloque L2 imprime.",
        emotion: "wink",
        panel: "blocks",
        highlight: { line: 2 },
      },
    ],
  });
  const turn = parseHiloTurn(raw);
  assert.equal(turn.chunks[0].panel, "blocks");
  assert.equal(turn.chunks[0].highlight?.line, 2);
});
