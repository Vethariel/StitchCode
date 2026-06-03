import assert from "node:assert/strict";
import test from "node:test";
import {
  grantTopicAchievement,
  loadLearningAchievements,
  saveLearningAchievements,
  LEARNING_ACHIEVEMENTS_STORAGE_KEY,
} from "../assets/js/learning-achievements.js";

test("grantTopicAchievement incrementa ejercicios del mismo tema", () => {
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
      { id: "bucles", name: "Bucles", desc: "Segundo reto con while." },
      first.list
    );
    const third = grantTopicAchievement(
      { id: "bucles", name: "Bucles", desc: "Tercer ejercicio de patrones." },
      second.list
    );
    assert.equal(first.achievement?.exerciseCount, 1);
    assert.equal(second.achievement?.exerciseCount, 2);
    assert.equal(third.achievement?.exerciseCount, 3);
    assert.equal(loadLearningAchievements().length, 1);
    assert.match(third.achievement?.desc ?? "", /while/);
    assert.match(third.achievement?.desc ?? "", /patrones/);
  } finally {
    globalThis.localStorage = prev;
    store.delete(LEARNING_ACHIEVEMENTS_STORAGE_KEY);
  }
});
