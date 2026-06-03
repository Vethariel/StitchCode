/** @typedef {{ id: string, icon: string, name: string, desc: string, progress: number, earned?: boolean }} LearningAchievement */

/** @type {LearningAchievement[]} */
export const DEFAULT_LEARNING_ACHIEVEMENTS = [
  {
    id: "primer_hilo",
    icon: "🧵",
    name: "Primer hilo",
    desc: "Ejecutaste tu primer programa en Woven",
    progress: 100,
    earned: true,
  },
  {
    id: "tejedor_bucles",
    icon: "🔁",
    name: "Tejedor de bucles",
    desc: "Usaste un bucle for por primera vez",
    progress: 100,
    earned: true,
  },
  {
    id: "patron_anidado",
    icon: "🌿",
    name: "Patrón anidado",
    desc: "Completaste un bucle dentro de otro",
    progress: 65,
    earned: true,
  },
  {
    id: "maestro_tejedor",
    icon: "🏆",
    name: "Maestro tejedor",
    desc: "Completa 10 ejercicios sin errores",
    progress: 30,
    earned: false,
  },
  {
    id: "traductor",
    icon: "✨",
    name: "Traductor de código",
    desc: "Compara tu ejemplo en Python, Java y C++",
    progress: 10,
    earned: false,
  },
];

/**
 * @param {string} id
 * @param {LearningAchievement[]} list
 * @returns {LearningAchievement[]}
 */
export function unlockAchievement(id, list = DEFAULT_LEARNING_ACHIEVEMENTS) {
  return list.map((a) => {
    if (a.id !== id) return { ...a };
    return { ...a, earned: true, progress: 100 };
  });
}
