import assert from "node:assert/strict";
import test from "node:test";
import {
  grantTopicAchievement,
  loadLearningAchievements,
  mergeAchievementDesc,
  saveLearningAchievements,
  slugTopicId,
  formatExerciseCountLabel,
  LEARNING_ACHIEVEMENTS_STORAGE_KEY,
} from "../assets/js/learning-achievements.js";

test("slugTopicId normaliza ids", () => {
  assert.equal(slugTopicId("Bucles For"), "bucles_for");
  assert.equal(slugTopicId("  listas!!!  "), "listas");
});

test("mergeAchievementDesc complementa sin duplicar", () => {
  assert.equal(
    mergeAchievementDesc("Dominas bucles.", "Dominas bucles."),
    "Dominas bucles."
  );
  const merged = mergeAchievementDesc(
    "Practicaste for en Woven.",
    "Ahora dominas suma acumulada con bucles."
  );
  assert.match(merged, /for en Woven/);
  assert.match(merged, /suma acumulada/);
});

test("formatExerciseCountLabel pluraliza", () => {
  assert.equal(formatExerciseCountLabel(1), "1 ejercicio completado");
  assert.equal(formatExerciseCountLabel(3), "3 ejercicios completados");
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
    assert.equal(achievement?.exerciseCount, 1);
    assert.equal(list.length, 1);
    const loaded = loadLearningAchievements();
    assert.equal(loaded[0].id, "condicionales");
    assert.equal(loaded[0].name, "Condicionales");
  } finally {
    globalThis.localStorage = prev;
    store.delete(key);
  }
});

test("grantTopicAchievement refuerza mismo tema sin duplicar entrada", () => {
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
      desc: "Dominas iteración con for.",
    });
    const second = grantTopicAchievement(
      {
        id: "bucles",
        name: "Bucles",
        desc: "Resolviste un reto con bucles anidados.",
      },
      first.list
    );
    assert.equal(first.isNew, true);
    assert.equal(second.isNew, false);
    assert.equal(second.isUpdate, true);
    assert.equal(second.achievement?.exerciseCount, 2);
    assert.match(second.achievement?.desc ?? "", /for/);
    assert.match(second.achievement?.desc ?? "", /anidados/);
    assert.equal(loadLearningAchievements().length, 1);
  } finally {
    globalThis.localStorage = prev;
    store.delete(LEARNING_ACHIEVEMENTS_STORAGE_KEY);
  }
});
