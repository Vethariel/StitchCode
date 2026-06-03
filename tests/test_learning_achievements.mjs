import assert from "node:assert/strict";
import test from "node:test";
import {
  grantTopicAchievement,
  loadLearningAchievements,
  saveLearningAchievements,
  slugTopicId,
  LEARNING_ACHIEVEMENTS_STORAGE_KEY,
} from "../assets/js/learning-achievements.js";

test("slugTopicId normaliza ids", () => {
  assert.equal(slugTopicId("Bucles For"), "bucles_for");
  assert.equal(slugTopicId("  listas!!!  "), "listas");
});

test("grantTopicAchievement persiste tema nuevo", () => {
  const key = LEARNING_ACHIEVEMENTS_STORAGE_KEY;
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
    const { list, achievement, isNew } = grantTopicAchievement({
      id: "condicionales",
      name: "Condicionales",
      desc: "Dominas if/else en Woven",
      icon: "🔀",
    });
    assert.equal(isNew, true);
    assert.equal(achievement?.earned, true);
    assert.equal(list.length, 1);
    const loaded = loadLearningAchievements();
    assert.equal(loaded[0].id, "condicionales");
    assert.equal(loaded[0].name, "Condicionales");
  } finally {
    globalThis.localStorage = prev;
    store.delete(key);
  }
});
