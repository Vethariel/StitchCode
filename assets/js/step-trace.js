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
 *   texto?: string,
 *   es_error?: boolean,
 * }} TraceEvent */

/** @typedef {{ texto: string, es_error: boolean, linea?: number | null }} StepOutputLine */

/** @typedef {{
 *   kind?: string,
 *   id?: string,
 *   class?: string,
 *   fields?: Record<string, unknown>,
 *   items?: unknown[],
 * }} TraceValueNode */

/** @typedef {{
 *   eventos: TraceEvent[],
 *   heap?: Record<string, TraceValueNode>,
 *   total_pasos: number,
 *   exito: boolean,
 * }} WovenTrace */

/**
 * @param {unknown} val
 * @param {Record<string, TraceValueNode>} [heap]
 * @returns {string}
 */
export function formatWovenValue(val, heap) {
  if (val === null || val === undefined) return "null";
  if (typeof val === "string") return `"${val}"`;
  if (typeof val === "boolean" || typeof val === "number") return String(val);

  if (typeof val === "object" && val) {
    const node = /** @type {TraceValueNode & { clase?: string, campos?: Record<string, unknown> }} */ (
      val
    );

    if (node.kind === "ref" && node.id) {
      const resolved = heap?.[node.id];
      if (resolved) {
        return `@${node.id} → ${formatWovenValue(resolved, heap)}`;
      }
      return `@${node.id}`;
    }

    if (node.kind === "object") {
      const fields = Object.entries(node.fields ?? {})
        .map(([k, v]) => `${k}: ${formatWovenValue(v, heap)}`)
        .join(", ");
      return `${node.class ?? "objeto"} { ${fields} }`;
    }

    if (node.kind === "list") {
      const inner = (node.items ?? []).map((v) => formatWovenValue(v, heap)).join(", ");
      return `[${inner}]`;
    }

    if ("clase" in node && node.clase) {
      const fields = Object.entries(node.campos ?? {})
        .map(([k, v]) => `${k}: ${formatWovenValue(v, heap)}`)
        .join(", ");
      return `${node.clase} { ${fields} }`;
    }
  }

  if (Array.isArray(val)) {
    const inner = val.map((v) => formatWovenValue(v, heap)).join(", ");
    return `[${inner}]`;
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
    salida: "Salida",
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
  /** @type {StepOutputLine[]} */
  const outputLines = [];

  for (let i = 0; i <= idx; i++) {
    const e = eventos[i];
    if (!e) continue;
    if (e.call_stack) callStack = [...e.call_stack];
    if (e.tipo === "linea") {
      lastLine = e.linea ?? lastLine;
      lastCode = e.codigo ?? lastCode;
    }
    if (e.tipo === "salida" && e.texto !== undefined) {
      outputLines.push({
        texto: String(e.texto),
        es_error: !!e.es_error,
        linea: e.linea ?? null,
      });
      lastLine = e.linea ?? lastLine;
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
    outputLines,
  };
}

/**
 * Contexto compacto para Hilo cuando el modo paso a paso está activo.
 * @param {WovenTrace} trace
 * @param {number} stepIndex índice del evento actual (0-based)
 */
export function buildStepContextForHilo(trace, stepIndex) {
  const eventos = trace.eventos ?? [];
  if (!eventos.length) return null;

  const view = buildStepView(trace, stepIndex);
  const ev = view.event;

  const resumen_traza = eventos.map((e, i) => {
    const actual = i === view.index ? " ← PASO ACTUAL" : "";
    let line = `${i + 1}/${eventos.length} · ${eventTypeLabel(e.tipo)}`;
    if (e.linea != null) line += ` · línea ${e.linea}`;
    if (e.codigo) line += ` · ${String(e.codigo).trim().slice(0, 100)}`;
    else if (e.nombre) line += ` · ${e.nombre}`;
    else if (e.texto !== undefined) line += ` · salida «${String(e.texto).slice(0, 80)}»`;
    else if (e.mensaje) line += ` · ${String(e.mensaje).slice(0, 100)}`;
    return line + actual;
  });

  const variables_visibles = Object.entries(view.scope)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, info]) => `${name} (${info.tipo}) = ${formatWovenValue(info.valor)}`);

  return {
    activo: true,
    paso_actual: view.index + 1,
    total_pasos: view.total,
    indice_evento: view.index,
    evento: ev
      ? {
          tipo: ev.tipo,
          linea: ev.linea ?? null,
          codigo: view.code || ev.codigo || null,
          nombre: ev.nombre ?? null,
          mensaje: ev.mensaje ?? null,
          texto: ev.texto ?? null,
        }
      : null,
    contexto_ejecucion: view.contextLabel,
    variables_visibles,
    salida_consola_hasta_paso: view.outputLines.map((l) => l.texto),
    resumen_traza,
    traza_exito: !!trace.exito,
    hay_error_en_paso_actual: view.hasError,
    mensaje_error: view.errorMessage,
  };
}
