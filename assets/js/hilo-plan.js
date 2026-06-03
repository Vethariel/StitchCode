import { callGeminiHilo } from "./hilo-chat.js";
import { hiloEstablishPlan, hiloParsePlan } from "./bridge/pyodide-bridge.js";
import { runHiloExercise } from "./hilo-exercise.js";
import { runHiloLearning } from "./hilo-learning.js";
import { slugTopicId } from "./learning-achievements.js";
import { localHiloTurn } from "./hilo-response.js";
import {
  activatePlanMode,
  getActivePlan,
  getCurrentPlanActivity,
  getPlanActivityIndex,
  isLastPlanActivity,
  isPlanModeActive,
  markCurrentPlanActivityComplete,
  pushPlanHistorial,
  setPlanActivityIndex,
} from "./hilo-plan-mode.js";

/** @typedef {import("./hilo-plan-mode.js").ActivePlan} ActivePlan */
/** @typedef {import("./hilo-plan-mode.js").PlanActivity} PlanActivity */

/**
 * @param {string} raw
 * @returns {ActivePlan}
 */
export function parsePlanPayload(raw) {
  const data = JSON.parse(raw);
  if (String(data.type).toLowerCase() !== "plan") {
    throw new Error("La respuesta no es un plan válido.");
  }
  const titulo = String(data.titulo ?? "Plan de aprendizaje").trim() || "Plan";
  const eje = String(data.eje_tematico ?? titulo).trim() || titulo;
  const temaNombre = String(data.tema_nombre ?? eje).trim() || eje;
  const temaId = slugTopicId(String(data.tema_id ?? temaNombre));
  const logro = String(data.logro_descripcion ?? "").trim();
  const resumen = String(data.resumen ?? "").trim();

  /** @type {PlanActivity[]} */
  const actividades = [];
  const rawActs = Array.isArray(data.actividades) ? data.actividades : [];
  for (let i = 0; i < rawActs.length; i++) {
    const item = rawActs[i];
    if (!item || typeof item !== "object") continue;
    const tipoRaw = String(item.tipo ?? "reflexion").toLowerCase();
    /** @type {PlanActivity['tipo']} */
    let tipo = "reflexion";
    if (tipoRaw === "aprendizaje") tipo = "aprendizaje";
    else if (tipoRaw === "correccion") tipo = "correccion";
    else if (tipoRaw === "relleno") tipo = "relleno";
    else if (tipoRaw === "ejercicio_libre" || tipoRaw === "ejercicio" || tipoRaw === "libre") {
      tipo = "ejercicio_libre";
    }
    const id = String(item.id ?? `act_${i + 1}`).trim() || `act_${i + 1}`;
    const tituloAct = String(item.titulo ?? `Actividad ${i + 1}`).trim();
    const objetivo = String(item.objetivo ?? "").trim();
    const mensaje_inicio =
      String(item.mensaje_inicio ?? item.mensaje ?? objetivo).trim() ||
      `Realiza la actividad: ${tituloAct}`;
    actividades.push({
      id,
      titulo: tituloAct,
      tipo,
      objetivo,
      mensaje_inicio,
      contexto_activo: String(item.contexto_activo ?? "").trim() || undefined,
    });
  }

  if (actividades.length < 2) {
    throw new Error("El plan debe incluir al menos 2 actividades.");
  }

  return {
    titulo,
    eje_tematico: eje,
    tema_id: temaId,
    tema_nombre: temaNombre,
    resumen: resumen || `Plan para aprender ${eje}.`,
    logro_descripcion: logro,
    actividades,
  };
}

/**
 * @param {ActivePlan} plan
 * @returns {{ tag: string, title: string, paragraphs: string[] }}
 */
export function buildPlanEnunciado(plan) {
  /** @type {string[]} */
  const paragraphs = [plan.resumen, "", "Actividades del plan:"];
  plan.actividades.forEach((a, i) => {
    const tipoLabel =
      a.tipo === "aprendizaje"
        ? "Aprendizaje"
        : a.tipo === "ejercicio_libre"
          ? "Ejercicio"
          : a.tipo === "correccion"
            ? "Corrección"
            : a.tipo === "relleno"
              ? "Completar código"
              : "Reflexión";
    paragraphs.push(`${i + 1}. [${tipoLabel}] ${a.titulo} — ${a.objetivo}`);
  });
  paragraphs.push(
    "",
    "Completa cada actividad en orden. Cuando termines una, usa «Siguiente actividad»."
  );
  return { tag: "Plan", title: plan.titulo, paragraphs };
}

/**
 * @param {PlanActivity} act
 */
function exerciseMessageForActivity(act) {
  if (act.tipo === "correccion") {
    return `Ejercicio de corrección: ${act.mensaje_inicio}`;
  }
  if (act.tipo === "relleno") {
    return `Ejercicio de relleno: ${act.mensaje_inicio}`;
  }
  return `Ejercicio de práctica: ${act.mensaje_inicio}`;
}

/**
 * @param {PlanActivity} act
 * @param {ActivePlan} plan
 */
function buildPlanExerciseEstablishPreamble(act, plan) {
  const wovenHint =
    act.tipo === "correccion" || act.tipo === "relleno"
      ? "codigo_solucion OBLIGATORIO: programa Woven que compile y ejecute. " +
        "Ejemplo válido: list<int> nums = [10, 20]\\nprint(nums[0]) o list<string> con append. " +
        "Sin Python (no def, no lista = []). tipo_ejercicio \"" +
        act.tipo +
        "\"."
      : "";
  return (
    `Actividad del plan «${plan.titulo}» (eje: ${plan.eje_tematico}). ` +
    `Actividad: ${act.titulo}. ${wovenHint} ` +
    (act.contexto_activo ? `Contexto: ${act.contexto_activo}` : "")
  ).trim();
}

/**
 * @param {number} index
 * @param {{
 *   apiKey: string,
 *   perfilJson: string,
 *   getContext: () => object,
 *   learning: import("./hilo-learning.js").runHiloLearning extends Function ? Parameters<typeof runHiloLearning>[0] : never,
 *   exercise: import("./hilo-exercise.js").runHiloExercise extends Function ? Parameters<typeof runHiloExercise>[0] : never,
 *   onPlanActivityChange?: (info: { index: number, activity: PlanActivity, total: number }) => void,
 * }} deps
 */
export async function startPlanActivityAt(index, deps) {
  if (!isPlanModeActive()) {
    throw new Error("No hay un plan activo.");
  }
  const plan = getActivePlan();
  if (!plan) throw new Error("Plan no disponible.");
  if (index < 0 || index >= plan.actividades.length) {
    throw new Error("Índice de actividad inválido.");
  }

  setPlanActivityIndex(index);
  const act = plan.actividades[index];
  deps.onPlanActivityChange?.({
    index,
    activity: act,
    total: plan.actividades.length,
  });

  const ctx = deps.getContext();
  const mensaje = act.mensaje_inicio;

  if (act.tipo === "aprendizaje") {
    if (!deps.learning) throw new Error("Aprendizaje no disponible.");
    const { turn } = await runHiloLearning({
      mensaje,
      apiKey: deps.apiKey,
      perfilJson: deps.perfilJson,
      getContext: deps.getContext,
      lintWoven: deps.learning.lintWoven,
      runWoven: deps.learning.runWoven,
      applyExample: deps.learning.applyExample,
      translateAll: deps.learning.translateAll,
      onEnunciado: deps.learning.onEnunciado,
      onTranslations: deps.learning.onTranslations,
      onPhase: deps.learning.onPhase,
    });
    pushPlanHistorial({ role: "user", content: `[Plan · ${act.titulo}] ${mensaje}` });
    pushPlanHistorial({ role: "model", content: turn.texto_completo });
    return { turn, activity: act, markCompleteOnExplanation: true };
  }

  if (
    act.tipo === "ejercicio_libre" ||
    act.tipo === "correccion" ||
    act.tipo === "relleno"
  ) {
    if (!deps.exercise) throw new Error("Ejercicios no disponibles.");
    const msg = exerciseMessageForActivity(act);
    const { turn } = await runHiloExercise({
      mensaje: msg,
      establishPreamble: buildPlanExerciseEstablishPreamble(act, plan),
      apiKey: deps.apiKey,
      perfilJson: deps.perfilJson,
      getContext: deps.getContext,
      applyTemplate: deps.exercise.applyTemplate,
      lintWoven: deps.exercise.lintWoven,
      runWoven: deps.exercise.runWoven,
      onEnunciado: deps.exercise.onEnunciado,
      onExerciseModeChange: deps.exercise.onExerciseModeChange,
    });
    pushPlanHistorial({ role: "user", content: `[Plan · ${act.titulo}] ${msg}` });
    pushPlanHistorial({ role: "model", content: turn.texto_completo });
    return { turn, activity: act, markCompleteOnExplanation: false };
  }

  pushPlanHistorial({
    role: "user",
    content: `[Plan · reflexión] ${mensaje}`,
  });
  markCurrentPlanActivityComplete();
  return {
    turn: localHiloTurn([
      {
        text: `Actividad «${act.titulo}»: ${act.objetivo}`,
        emotion: "smile",
      },
      {
        text: "Cuando quieras profundizar, escríbeme; al terminar pulsa «Siguiente actividad».",
        emotion: "happy",
      },
    ]),
    activity: act,
    markCompleteOnExplanation: false,
  };
}

/**
 * @param {{
 *   mensaje: string,
 *   apiKey: string,
 *   perfilJson: string,
 *   getContext: () => object,
 *   onEnunciado?: (data: { tag: string, title: string, paragraphs: string[] }) => void,
 *   onPlanModeChange?: (active: boolean) => void,
 *   onPlanActivityChange?: (info: { index: number, activity: PlanActivity, total: number }) => void,
 *   learning?: Parameters<typeof startPlanActivityAt>[1]["learning"],
 *   exercise?: Parameters<typeof startPlanActivityAt>[1]["exercise"],
 * }} opts
 */
export async function runHiloPlan(opts) {
  const ctx = opts.getContext();
  const prep = await hiloEstablishPlan({
    mensaje: opts.mensaje,
    codigo: ctx.codigo,
    modo: ctx.modo,
    perfilJson: opts.perfilJson,
    bloquesResumen: ctx.bloquesResumen ?? "",
  });
  if (!prep.ok) {
    throw new Error(prep.error ?? "No se pudo preparar el plan.");
  }

  const responseJson = await callGeminiHilo(opts.apiKey, prep.payload);
  const normalized = await hiloParsePlan(responseJson);
  const plan = parsePlanPayload(normalized);

  activatePlanMode(plan);
  opts.onPlanModeChange?.(true);
  opts.onEnunciado?.(buildPlanEnunciado(plan));

  pushPlanHistorial({
    role: "user",
    content: opts.mensaje,
  });

  const { turn } = await startPlanActivityAt(0, {
    apiKey: opts.apiKey,
    perfilJson: opts.perfilJson,
    getContext: opts.getContext,
    learning: opts.learning,
    exercise: opts.exercise,
    onPlanActivityChange: opts.onPlanActivityChange,
  });

  const intro = localHiloTurn([
    {
      text: `Plan listo: «${plan.titulo}». Eje: ${plan.eje_tematico}.`,
      emotion: "happy",
    },
    {
      text: `Empezamos con la actividad 1 de ${plan.actividades.length}: «${plan.actividades[0].titulo}».`,
      emotion: "smile",
    },
  ]);

  return {
    plan,
    introTurn: intro,
    activityTurn: turn,
  };
}

/**
 * Avanza a la siguiente actividad o indica fin de plan.
 * @param {Parameters<typeof startPlanActivityAt>[1]} deps
 */
export async function advancePlanActivity(deps) {
  if (!isPlanModeActive()) {
    throw new Error("No hay plan activo.");
  }
  if (!getCurrentPlanActivity() || !isLastPlanActivity()) {
    const next = getPlanActivityIndex() + 1;
    return startPlanActivityAt(next, deps);
  }
  throw new Error("Ya estás en la última actividad.");
}

/**
 * @param {ActivePlan} plan
 */
export function buildPlanMasteryTopic(plan) {
  return {
    id: plan.tema_id,
    name: plan.tema_nombre,
    desc: plan.logro_descripcion,
    icon: "🏆",
  };
}
