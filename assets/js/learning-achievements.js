/** @typedef {{
 *   id: string,
 *   icon: string,
 *   name: string,
 *   desc: string,
 *   progress: number,
 *   earned?: boolean,
 *   earnedAt?: string,
 *   updatedAt?: string,
 *   exerciseCount?: number,
 * }} LearningAchievement */

export const LEARNING_ACHIEVEMENTS_STORAGE_KEY = "stitchcode-learning-achievements";

const MAX_DESC_LEN = 500;

/** @param {string} id */
export function slugTopicId(id) {
  return String(id)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 48);
}

/**
 * Añade información nueva sin repetir el mismo texto.
 * @param {string} existing
 * @param {string} incoming
 */
export function mergeAchievementDesc(existing, incoming) {
  const prev = (existing ?? "").trim();
  const next = (incoming ?? "").trim();
  if (!next) return prev.slice(0, MAX_DESC_LEN);
  if (!prev) return next.slice(0, MAX_DESC_LEN);
  if (prev === next) return prev;
  if (prev.includes(next)) return prev.slice(0, MAX_DESC_LEN);
  if (next.includes(prev)) return next.slice(0, MAX_DESC_LEN);

  const sep = prev.endsWith(".") || prev.endsWith("!") || prev.endsWith("?") ? " " : ". ";
  return `${prev}${sep}${next}`.slice(0, MAX_DESC_LEN);
}

/**
 * @returns {LearningAchievement[]}
 */
export function loadLearningAchievements() {
  try {
    const raw = localStorage.getItem(LEARNING_ACHIEVEMENTS_STORAGE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data
      .filter((a) => a && typeof a.id === "string")
      .map((a) => {
        const earned = !!a.earned;
        const exerciseCount = Math.max(
          0,
          Number(a.exerciseCount) || (earned ? 1 : 0)
        );
        return {
          id: slugTopicId(a.id),
          icon: String(a.icon ?? "🏆").slice(0, 4) || "🏆",
          name: String(a.name ?? a.id).slice(0, 80),
          desc: String(a.desc ?? a.descripcion ?? "").slice(0, MAX_DESC_LEN),
          progress: earned
            ? 100
            : Math.min(100, Math.max(0, Number(a.progress) || 0)),
          earned,
          earnedAt: a.earnedAt ? String(a.earnedAt) : undefined,
          updatedAt: a.updatedAt ? String(a.updatedAt) : undefined,
          exerciseCount: earned ? Math.max(1, exerciseCount) : exerciseCount,
        };
      });
  } catch {
    return [];
  }
}

/**
 * @param {LearningAchievement[]} list
 */
export function saveLearningAchievements(list) {
  localStorage.setItem(LEARNING_ACHIEVEMENTS_STORAGE_KEY, JSON.stringify(list));
}

/**
 * Registra dominio de un tema (ejercicio completado).
 * Un solo logro por tema: refuerza la descripción y suma ejercicios completados.
 * @param {{ id: string, name: string, desc: string, icon?: string }} topic
 * @param {LearningAchievement[]} [list]
 */
export function grantTopicAchievement(topic, list = loadLearningAchievements()) {
  const id = slugTopicId(topic.id);
  if (!id) {
    return { list, achievement: null, isNew: false, isUpdate: false };
  }

  const now = new Date().toISOString();
  const incomingDesc = String(topic.desc ?? "").trim();
  const existing = list.find((a) => a.id === id);

  if (existing?.earned) {
    const exerciseCount = (existing.exerciseCount ?? 1) + 1;
    /** @type {LearningAchievement} */
    const achievement = {
      ...existing,
      icon: String(topic.icon ?? existing.icon).slice(0, 4) || existing.icon,
      name: String(topic.name || existing.name).slice(0, 80),
      desc: mergeAchievementDesc(existing.desc, incomingDesc),
      progress: 100,
      earned: true,
      earnedAt: existing.earnedAt ?? now,
      updatedAt: now,
      exerciseCount,
    };
    const next = list.map((a) => (a.id === id ? achievement : { ...a }));
    saveLearningAchievements(next);
    return { list: next, achievement, isNew: false, isUpdate: true };
  }

  const name = String(topic.name || id).slice(0, 80);
  /** @type {LearningAchievement} */
  const achievement = {
    id,
    icon: String(topic.icon ?? "🏆").slice(0, 4) || "🏆",
    name,
    desc:
      incomingDesc.slice(0, MAX_DESC_LEN) ||
      `Dominio demostrado en ejercicio: ${name}.`,
    progress: 100,
    earned: true,
    earnedAt: now,
    exerciseCount: 1,
  };
  const next = existing
    ? list.map((a) => (a.id === id ? achievement : { ...a }))
    : [...list, achievement];
  saveLearningAchievements(next);
  return { list: next, achievement, isNew: true, isUpdate: false };
}

/**
 * @param {string} id
 * @param {LearningAchievement[]} list
 */
export function unlockAchievement(id, list) {
  return list.map((a) => {
    if (a.id !== id) return { ...a };
    return {
      ...a,
      earned: true,
      progress: 100,
      earnedAt: a.earnedAt ?? new Date().toISOString(),
      exerciseCount: Math.max(1, a.exerciseCount ?? 1),
    };
  });
}

/**
 * @param {number} count
 */
export function formatExerciseCountLabel(count) {
  const n = Math.max(1, Math.floor(Number(count) || 1));
  return n === 1 ? "1 ejercicio completado" : `${n} ejercicios completados`;
}
