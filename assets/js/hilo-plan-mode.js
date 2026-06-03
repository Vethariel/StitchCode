/**
 * Estado global del plan de aprendizaje (eje temático + actividades).
 * @typedef {'aprendizaje' | 'ejercicio_libre' | 'correccion' | 'relleno' | 'reflexion'} PlanActivityTipo
 * @typedef {{
 *   id: string,
 *   titulo: string,
 *   tipo: PlanActivityTipo,
 *   objetivo: string,
 *   mensaje_inicio: string,
 *   contexto_activo?: string,
 * }} PlanActivity
 * @typedef {{
 *   titulo: string,
 *   eje_tematico: string,
 *   tema_id: string,
 *   tema_nombre: string,
 *   resumen: string,
 *   logro_descripcion: string,
 *   actividades: PlanActivity[],
 * }} ActivePlan
 */

/** @type {ActivePlan | null} */
let activePlan = null;
/** @type {number} */
let currentActivityIndex = 0;
/** @type {Set<string>} */
const completedActivityIds = new Set();
/** @type {{ role: string, content: string }[]} */
let planHistorial = [];
/** @type {boolean} */
let planFinished = false;

export function isPlanModeActive() {
  return activePlan !== null && !planFinished;
}

/** @returns {ActivePlan | null} */
export function getActivePlan() {
  return activePlan;
}

/** @returns {number} */
export function getPlanActivityIndex() {
  return currentActivityIndex;
}

/** @returns {PlanActivity | null} */
export function getCurrentPlanActivity() {
  if (!activePlan?.actividades?.length) return null;
  return activePlan.actividades[currentActivityIndex] ?? null;
}

/** @returns {boolean} */
export function isLastPlanActivity() {
  if (!activePlan?.actividades?.length) return true;
  return currentActivityIndex >= activePlan.actividades.length - 1;
}

/** @returns {boolean} */
export function isCurrentPlanActivityDone() {
  const act = getCurrentPlanActivity();
  if (!act) return false;
  return completedActivityIds.has(act.id);
}

/** @returns {boolean} Habilita el botón (siguiente actividad o terminar plan en la última). */
export function canAdvancePlanActivity() {
  return isPlanModeActive() && isCurrentPlanActivityDone();
}

/** @returns {boolean} */
export function isPlanFullyComplete() {
  if (!activePlan?.actividades?.length) return false;
  return activePlan.actividades.every((a) => completedActivityIds.has(a.id));
}

/**
 * @param {ActivePlan} plan
 */
export function activatePlanMode(plan) {
  activePlan = {
    titulo: plan.titulo,
    eje_tematico: plan.eje_tematico,
    tema_id: plan.tema_id,
    tema_nombre: plan.tema_nombre,
    resumen: plan.resumen,
    logro_descripcion: plan.logro_descripcion,
    actividades: plan.actividades.map((a) => ({ ...a })),
  };
  currentActivityIndex = 0;
  completedActivityIds.clear();
  planHistorial = [];
  planFinished = false;
}

export function deactivatePlanMode() {
  activePlan = null;
  currentActivityIndex = 0;
  completedActivityIds.clear();
  planHistorial = [];
  planFinished = false;
}

export function markPlanFinished() {
  planFinished = true;
}

/** @returns {{ role: string, content: string }[]} */
export function getPlanHistorial() {
  return planHistorial;
}

/** @param {{ role: string, content: string }} entry */
export function pushPlanHistorial(entry) {
  planHistorial.push(entry);
}

export function markCurrentPlanActivityComplete() {
  const act = getCurrentPlanActivity();
  if (!act) return;
  completedActivityIds.add(act.id);
}

/**
 * @param {number} index
 */
export function setPlanActivityIndex(index) {
  if (!activePlan) return;
  const max = activePlan.actividades.length - 1;
  currentActivityIndex = Math.max(0, Math.min(index, max));
}

/** @returns {string} JSON para Gemini. */
export function getPlanContextJson() {
  if (!activePlan) return "{}";
  const act = getCurrentPlanActivity();
  return JSON.stringify({
    titulo: activePlan.titulo,
    eje_tematico: activePlan.eje_tematico,
    tema_id: activePlan.tema_id,
    tema_nombre: activePlan.tema_nombre,
    resumen: activePlan.resumen,
    actividad_actual: act
      ? {
          indice: currentActivityIndex + 1,
          total: activePlan.actividades.length,
          id: act.id,
          titulo: act.titulo,
          tipo: act.tipo,
          objetivo: act.objetivo,
          contexto_activo: act.contexto_activo ?? "",
        }
      : null,
    actividades: activePlan.actividades.map((a, i) => ({
      indice: i + 1,
      id: a.id,
      titulo: a.titulo,
      tipo: a.tipo,
      objetivo: a.objetivo,
      estado: completedActivityIds.has(a.id)
        ? "completada"
        : i === currentActivityIndex
          ? "actual"
          : "pendiente",
    })),
    completadas: [...completedActivityIds],
  });
}
