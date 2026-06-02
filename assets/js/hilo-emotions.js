/** Mapeo de estados conversacionales a expresiones del sprite. */

/** @typedef {string} HiloEmotionName */

export const HILO_SPRITE_EMOTIONS = new Set([
  "happy",
  "smile",
  "kiss",
  "heart_eyes",
  "grin",
  "tongue",
  "sleep",
  "cool",
  "laugh",
  "wink",
  "neutral",
  "expressionless",
  "cry",
  "sad",
  "worried",
  "angry",
]);

/** @type {Record<string, HiloEmotionName>} */
export const HILO_STATE_EMOTION = {
  idle: "smile",
  greeting: "happy",
  thinking: "neutral",
  explaining: "cool",
  hint: "wink",
  celebrate: "grin",
  laugh: "laugh",
  love: "heart_eyes",
  error: "worried",
  api_missing: "sad",
  confused: "expressionless",
  empathy: "cry",
  annoyed: "angry",
};

/**
 * @param {keyof typeof HILO_STATE_EMOTION | string} state
 */
export function emotionForState(state) {
  return HILO_STATE_EMOTION[state] ?? HILO_STATE_EMOTION.idle;
}

/**
 * @param {string} emotion
 * @returns {HiloEmotionName}
 */
export function normalizeSpriteEmotion(emotion) {
  const key = (emotion ?? "").trim().toLowerCase();
  if (HILO_SPRITE_EMOTIONS.has(key)) return key;
  return "neutral";
}
