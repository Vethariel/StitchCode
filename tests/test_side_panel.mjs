import assert from "node:assert/strict";
import { unlockAchievement, DEFAULT_LEARNING_ACHIEVEMENTS } from "../assets/js/learning-achievements.js";

const updated = unlockAchievement("traductor");
const trad = updated.find((a) => a.id === "traductor");
assert.equal(trad?.earned, true);
assert.equal(trad?.progress, 100);

const copy = unlockAchievement("traductor", DEFAULT_LEARNING_ACHIEVEMENTS);
assert.equal(copy.find((a) => a.id === "traductor")?.earned, true);

console.log("test_side_panel.mjs OK");
