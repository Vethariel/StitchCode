import assert from "node:assert/strict";
import test from "node:test";
import {
  grantTopicAchievement,
  loadLearningAchievements,
  saveLearningAchievements,
  LEARNING_ACHIEVEMENTS_STORAGE_KEY,
} from "../assets/js/learning-achievements.js";

test("grantTopicAchievement no duplica tema ya ganado", () => {
  const store = new Map();
  const ls = {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => store.set(k, v),
    removeItem: (k) => store.delete(k),
  };
  const prev = globalThis.localStorage;
  // @ts-expect-error test mock
  globalThis.localStorage = ls;

  try {
    saveLearningAchievements([]);
    const first = grantTopicAchievement({
      id: "bucles",
      name: "Bucles",
      desc: "Dominas bucles",
    });
    const second = grantTopicAchievement(
      { id: "bucles", name: "Bucles", desc: "Otra vez" },
      first.list
    );
    assert.equal(first.isNew, true);
    assert.equal(second.isNew, false);
    assert.equal(loadLearningAchievements().length, 1);
  } finally {
    globalThis.localStorage = prev;
    store.delete(LEARNING_ACHIEVEMENTS_STORAGE_KEY);
  }
});
