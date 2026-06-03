/** @typedef {{ id: string, icon: string, name: string, desc: string, progress: number, earned?: boolean, earnedAt?: string }} LearningAchievement */

export const LEARNING_ACHIEVEMENTS_STORAGE_KEY = "stitchcode-learning-achievements";

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
      .map((a) => ({
        id: slugTopicId(a.id),
        icon: String(a.icon ?? "🏆").slice(0, 4) || "🏆",
        name: String(a.name ?? a.id).slice(0, 80),
        desc: String(a.desc ?? a.descripcion ?? "").slice(0, 200),
        progress: a.earned ? 100 : Math.min(100, Math.max(0, Number(a.progress) || 0)),
        earned: !!a.earned,
        earnedAt: a.earnedAt ? String(a.earnedAt) : undefined,
      }));
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
 * Registra dominio de un tema (ejercicio completado). Devuelve el logro y si era nuevo.
 * @param {{ id: string, name: string, desc: string, icon?: string }} topic
 * @param {LearningAchievement[]} [list]
 */
export function grantTopicAchievement(topic, list = loadLearningAchievements()) {
  const id = slugTopicId(topic.id);
  if (!id) {
    return { list, achievement: null, isNew: false };
  }
  const now = new Date().toISOString();
  const existing = list.find((a) => a.id === id);
  if (existing?.earned) {
    return { list, achievement: existing, isNew: false };
  }
  const achievement = {
    id,
    icon: String(topic.icon ?? "🏆").slice(0, 4) || "🏆",
    name: String(topic.name || id).slice(0, 80),
    desc: String(topic.desc || "").slice(0, 200),
    progress: 100,
    earned: true,
    earnedAt: now,
  };
  const next = existing
    ? list.map((a) => (a.id === id ? { ...achievement } : { ...a }))
    : [...list, achievement];
  saveLearningAchievements(next);
  return { list: next, achievement, isNew: true };
}

/**
 * @param {string} id
 * @param {LearningAchievement[]} list
 */
export function unlockAchievement(id, list) {
  return list.map((a) => {
    if (a.id !== id) return { ...a };
    return { ...a, earned: true, progress: 100, earnedAt: a.earnedAt ?? new Date().toISOString() };
  });
}
