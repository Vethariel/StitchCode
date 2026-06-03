import { validateWovenDraft } from "./hilo-draft.js";

/** @typedef {'vacio' | 'incorrecto'} SlotModo */
/** @typedef {{ linea: number, modo: SlotModo, contenido_erroneo?: string }} LineaEdicion */

/**
 * @param {string} mensaje
 * @returns {'correccion' | 'relleno' | 'libre'}
 */
export function inferExerciseTipo(mensaje) {
  const t = mensaje.toLowerCase();
  if (
    /\b(?:rellenar|completar|llenar|hueco|huecos|espacio\s+en\s+blanco|dejar\s+vac[ií]o)\b/i.test(
      t
    )
  ) {
    return "relleno";
  }
  if (
    /\b(?:corregir|correcci[oó]n|corrige|error\s+intencional|l[ií]neas?\s+con\s+error|arreglar\s+el\s+c[oó]digo)\b/i.test(
      t
    )
  ) {
    return "correccion";
  }
  return "libre";
}

/**
 * @param {string} line
 */
function buggyVariant(line) {
  const trimmed = line.trimEnd();
  if (/\d+/.test(trimmed)) {
    return trimmed.replace(/\d+/, (n) => String(Number(n) + 1));
  }
  if (trimmed.includes("==")) return trimmed.replace("==", "!=");
  if (trimmed.includes("=")) return trimmed.replace("=", "==");
  return trimmed + " // ?";
}

/**
 * @param {string} solution
 * @param {'correccion' | 'relleno'} tipo
 * @returns {LineaEdicion[]}
 */
export function defaultLineasEdicion(solution, tipo) {
  const lines = solution.split("\n");
  /** @type {number[]} */
  const candidates = [];
  lines.forEach((line, i) => {
    const t = line.trim();
    if (!t || t.startsWith("//") || t.startsWith("class ") || t === "init():") {
      return;
    }
    candidates.push(i + 1);
  });
  const pick = candidates.slice(0, Math.min(2, candidates.length));
  return pick.map((linea) => ({
    linea,
    modo: tipo === "correccion" ? "incorrecto" : "vacio",
    contenido_erroneo:
      tipo === "correccion" ? buggyVariant(lines[linea - 1]) : undefined,
  }));
}

/**
 * @param {string} solution
 * @param {LineaEdicion[]} slots
 * @param {'correccion' | 'relleno'} tipo
 */
export function buildStudentCodeFromSolution(solution, slots, tipo) {
  const lines = solution.split("\n");
  /** @type {Set<number>} */
  const editable = new Set();

  for (const slot of slots) {
    const idx = slot.linea - 1;
    if (idx < 0 || idx >= lines.length) continue;
    editable.add(slot.linea);
    const indent = (lines[idx].match(/^(\s*)/) ?? [""])[0];
    if (slot.modo === "vacio" || tipo === "relleno") {
      lines[idx] = indent;
    } else if (slot.contenido_erroneo) {
      lines[idx] = slot.contenido_erroneo;
    } else {
      lines[idx] = indent + buggyVariant(lines[idx].trim());
    }
  }

  return {
    code: lines.join("\n"),
    editableLines: [...editable].sort((a, b) => a - b),
  };
}

/**
 * @param {import("./hilo-exercise.js").ExercisePayload} exercise
 * @param {{
 *   lintWoven: (code: string) => Promise<{ parse_ok: boolean, errores?: { mensaje: string }[] }>,
 *   runWoven: (code: string) => Promise<{ salida: string[], tiene_errores: boolean, diagnosticos?: { mensaje: string }[] }>,
 *   retryEstablish?: (detail: string) => Promise<import("./hilo-exercise.js").ExercisePayload>,
 * }} runtime
 */
export async function prepareGuidedExercise(exercise, runtime) {
  const tipo = exercise.tipo_ejercicio;
  if (tipo !== "correccion" && tipo !== "relleno") {
    return {
      codigo_plantilla: exercise.codigo_plantilla,
      locks: null,
      codigo_referencia: null,
    };
  }

  let solution = exercise.codigo_solucion?.trim() || "";
  let slots = exercise.lineas_edicion ?? [];

  if (!slots.length && solution) {
    slots = defaultLineasEdicion(solution, tipo);
  }

  let validation = await validateWovenDraft(solution, "ejemplo_correcto", runtime);

  if (!validation.ok && runtime.retryEstablish) {
    const retry = await runtime.retryEstablish(validation.detail);
    solution = retry.codigo_solucion?.trim() || retry.codigo_plantilla || solution;
    slots = retry.lineas_edicion?.length
      ? retry.lineas_edicion
      : defaultLineasEdicion(solution, tipo);
    validation = await validateWovenDraft(solution, "ejemplo_correcto", runtime);
  }

  if (!validation.ok) {
    throw new Error(
      `No pude validar el ejercicio: ${validation.detail}`
    );
  }

  if (!slots.length) {
    throw new Error("El ejercicio guiado no definió líneas editables.");
  }

  const built = buildStudentCodeFromSolution(solution, slots, tipo);

  return {
    codigo_plantilla: built.code,
    locks: built.editableLines,
    codigo_referencia: solution,
    lineas_editables: built.editableLines,
  };
}
