import assert from "node:assert/strict";
import test from "node:test";
import {
  getHiloTutorialScript,
  isHiloTutorialComplete,
  markHiloTutorialComplete,
  TUTORIAL_STORAGE_KEY,
} from "../assets/js/hilo-tutorial.js";

test("tutorial tiene presentación centrada y recorrido con foco", () => {
  const script = getHiloTutorialScript();
  assert.ok(script.length >= 8);
  const intro = script.filter((c) => c.presentation === "center");
  const tour = script.filter((c) => c.presentation === "focus");
  assert.ok(intro.length >= 4);
  assert.ok(tour.length >= 4);
  assert.ok(tour.some((c) => c.action === "mode:blocks"));
  assert.ok(tour.some((c) => c.action === "mode:verbose"));
  assert.ok(tour.some((c) => c.panel === "console"));
});

test("marcar tutorial completo en storage", () => {
  const prev = globalThis.localStorage?.getItem(TUTORIAL_STORAGE_KEY);
  try {
    if (globalThis.localStorage) {
      globalThis.localStorage.removeItem(TUTORIAL_STORAGE_KEY);
      assert.equal(isHiloTutorialComplete(), false);
      markHiloTutorialComplete();
      assert.equal(isHiloTutorialComplete(), true);
    }
  } finally {
    if (globalThis.localStorage) {
      if (prev == null) globalThis.localStorage.removeItem(TUTORIAL_STORAGE_KEY);
      else globalThis.localStorage.setItem(TUTORIAL_STORAGE_KEY, prev);
    }
  }
});
