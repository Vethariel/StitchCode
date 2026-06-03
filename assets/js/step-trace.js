/** @typedef {{
 *   paso: number,
 *   tipo: string,
 *   linea?: number | null,
 *   codigo?: string,
 *   nombre?: string,
 *   valor?: unknown,
 *   tipo_var?: string,
 *   scope?: Record<string, { valor: unknown, tipo: string }>,
 *   scope_previo?: Record<string, { valor: unknown, tipo: string }>,
 *   scope_final?: Record<string, { valor: unknown, tipo: string }>,
 *   scope_al_fallar?: Record<string, { valor: unknown, tipo: string }>,
 *   call_stack?: string[],
 *   mensaje?: string,
 * }} TraceEvent */

/** @typedef {{
 *   eventos: TraceEvent[],
 *   total_pasos: number,
 *   exito: boolean,
 * }} WovenTrace */

/**
 * @param {unknown} val
 * @returns {string}
 */
export function formatWovenValue(val) {
  if (val === null || val === undefined) return "null";
  if (typeof val === "string") return `"${val}"`;
  if (typeof val === "boolean" || typeof val === "number") return String(val);
  if (Array.isArray(val)) {
    const inner = val.map(formatWovenValue).join(", ");
    return `[${inner}]`;
  }
  if (typeof val === "object" && val && "clase" in val) {
    const obj = /** @type {{ clase: string, campos?: Record<string, unknown> }} */ (val);
    const fields = Object.entries(obj.campos ?? {})
      .map(([k, v]) => `${k}: ${formatWovenValue(v)}`)
      .join(", ");
    return `${obj.clase} { ${fields} }`;
  }
  try {
    return JSON.stringify(val);
  } catch {
    return String(val);
  }
}

/**
 * @param {string} tipo
 */
export function eventTypeLabel(tipo) {
  const map = {
    linea: "Línea",
    variable: "Variable",
    llamada: "Llamada",
    retorno: "Retorno",
    clase: "Clase",
    error: "Error",
  };
  return map[tipo] ?? tipo;
}

/**
 * Estado acumulado hasta el paso `index` (índice en eventos).
 * @param {WovenTrace} trace
 * @param {number} index
 */
export function buildStepView(trace, index) {
  const eventos = trace.eventos ?? [];
  const max = Math.max(0, eventos.length - 1);
  const idx = Math.min(Math.max(0, index), max);
  const event = eventos[idx] ?? null;

  /** @type {Record<string, { valor: unknown, tipo: string }>} */
  let scope = {};
  let callStack = [];
  let lastLine = null;
  let lastCode = "";

  for (let i = 0; i <= idx; i++) {
    const e = eventos[i];
    if (!e) continue;
    if (e.call_stack) callStack = [...e.call_stack];
    if (e.tipo === "linea") {
      lastLine = e.linea ?? lastLine;
      lastCode = e.codigo ?? lastCode;
    }
    if (e.tipo === "variable" && e.scope) scope = { ...e.scope };
    if (e.tipo === "llamada" && e.scope_previo) scope = { ...e.scope_previo };
    if (e.tipo === "retorno" && e.scope_final) scope = { ...e.scope_final };
    if (e.tipo === "error" && e.scope_al_fallar) scope = { ...e.scope_al_fallar };
  }

  if (event?.tipo === "variable" && event.scope) scope = { ...event.scope };
  if (event?.tipo === "llamada" && event.scope_previo) scope = { ...event.scope_previo };
  if (event?.tipo === "retorno" && event.scope_final) scope = { ...event.scope_final };
  if (event?.tipo === "error" && event.scope_al_fallar) scope = { ...event.scope_al_fallar };

  const contextLabel =
    callStack.length > 0 ? callStack.join(" → ") : "Programa principal";

  return {
    index: idx,
    total: eventos.length,
    event,
    scope,
    callStack,
    contextLabel,
    line: event?.linea ?? lastLine,
    code: event?.codigo ?? lastCode,
    hasError: event?.tipo === "error",
    errorMessage: event?.tipo === "error" ? event.mensaje : null,
  };
}
