import assert from "node:assert/strict";
import test from "node:test";
import { parseHiloTurn } from "../assets/js/hilo-response.js";

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
