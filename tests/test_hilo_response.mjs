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
  assert.equal(turn.chunks.length, 2);
  assert.equal(turn.chunks[1].emotion, "wink");
});
