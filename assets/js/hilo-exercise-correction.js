import { sanitizeModelWovenCode, validateWovenDraft } from "./hilo-draft.js";

const GUIDED_VALIDATION_MAX_ATTEMPTS = 3;

/** @typedef {'vacio' | 'incorrecto'} SlotModo */
/** @typedef {{
 *   linea: number,
 *   modo: SlotModo,
 *   contenido_erroneo?: string,
 *   tarea?: string,
 * }} LineaEdicion */

/** @typedef {{
 *   linea: number,
 *   modo: SlotModo,
 *   esperado: string,
 *   mostrado: string,
 *   tarea: string,
 * }} LineaDetalle */

/** @typedef {{
 *   tipo: 'correccion' | 'relleno',
 *   titulo: string,
 *   resumen: string,
 *   criterios: string[],
 *   codigo_referencia: string,
 *   codigo_estudiante: string,
 *   lineas_editables: number[],
 *   lineas_detalle: LineaDetalle[],
 *   enunciado: string[],
 *   salida_esperada: string[],
 * }} GuidedExercisePackage */

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
 * @param {string} esperado
 * @param {string} mostrado
 * @param {SlotModo} modo
 * @param {string} [tareaGemini]
 */
function buildLineTask(esperado, mostrado, modo, tareaGemini) {
  if (tareaGemini?.trim()) {
    return tareaGemini.trim();
  }
  if (modo === "vacio") {
    return "Completa esta línea (está vacía en el editor).";
  }
  const e = esperado.trim();
  const m = mostrado.trim();
  const ei = e.match(/\[(\d+)\]/);
  const mi = m.match(/\[(\d+)\]/);
  if (ei && mi && ei[1] !== mi[1]) {
    return `Corrige el índice: debe ser [${ei[1]}], no [${mi[1]}].`;
  }
  if (/print\s*\(/i.test(e) && /print\s*\(/i.test(m)) {
    return "Corrige qué valor imprime esta línea.";
  }
  if (/\.append\s*\(/i.test(e) || /\.append\s*\(/i.test(m)) {
    return "Corrige la llamada a append en esta línea.";
  }
  if (e !== m) {
    return "Corrige el error en esta línea.";
  }
  return "Revisa y corrige esta línea.";
}

/**
 * @param {string} solution
 * @param {LineaEdicion[]} slots
 */
export function normalizeLineasEdicion(solution, slots) {
  const lineCount = solution.split("\n").length;
  const seen = new Set();
  /** @type {LineaEdicion[]} */
  const out = [];
  for (const slot of slots) {
    const linea = Math.floor(Number(slot.linea));
    if (!Number.isFinite(linea) || linea < 1 || linea > lineCount) continue;
    if (seen.has(linea)) continue;
    seen.add(linea);
    const modo = slot.modo === "incorrecto" ? "incorrecto" : "vacio";
    const entry = { linea, modo };
    if (modo === "incorrecto" && slot.contenido_erroneo) {
      entry.contenido_erroneo = String(slot.contenido_erroneo);
    }
    if (slot.tarea) entry.tarea = String(slot.tarea);
    out.push(entry);
  }
  return out.sort((a, b) => a.linea - b.linea);
}

/**
 * @param {string} solution
 * @param {LineaEdicion[]} slots
 * @param {'correccion' | 'relleno'} tipo
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
function enforceSlotsForTipo(solution, slots, tipo) {
  const forcedModo = tipo === "relleno" ? "vacio" : "incorrecto";
  const solutionLines = solution.split("\n");
  return slots.map((slot) => {
    const i = slot.linea - 1;
    const esperado = solutionLines[i] ?? "";
    /** @type {LineaEdicion} */
    const entry = {
      linea: slot.linea,
      modo: forcedModo,
      tarea: slot.tarea,
    };
    if (forcedModo === "incorrecto") {
      entry.contenido_erroneo =
        slot.contenido_erroneo?.trim() || buggyVariant(esperado);
    }
    return entry;
  });
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
 * @param {{
 *   tipo: 'correccion' | 'relleno',
 *   titulo: string,
 *   resumen: string,
 *   criterios: string[],
 *   lineas_detalle: LineaDetalle[],
 *   lineas_editables: number[],
 *   salida_esperada: string[],
 * }} spec
 * @returns {string[]}
 */
export function buildAlignedEnunciado(spec) {
  /** @type {string[]} */
  const parts = [];

  const objetivo =
    spec.resumen?.trim() ||
    spec.titulo?.trim() ||
    "Completa el ejercicio según las líneas indicadas.";
  parts.push(objetivo);

  parts.push(
    spec.tipo === "relleno"
      ? "Solo puedes editar las líneas vacías indicadas abajo. El resto del programa está bloqueado."
      : "Solo puedes corregir las líneas con error indicadas abajo. El resto del programa está bloqueado."
  );

  parts.push("Qué debes hacer en cada línea editable:");
  for (const d of spec.lineas_detalle) {
    let line = `Línea ${d.linea}: ${d.tarea}`;
    if (spec.tipo === "correccion" && d.mostrado.trim()) {
      line += ` (ahora: ${d.mostrado.trim()})`;
    }
    parts.push(line);
  }

  if (spec.salida_esperada.length) {
    parts.push(
      "Salida esperada en consola al ejecutar bien: " +
        spec.salida_esperada.map((l) => `"${l}"`).join(", ")
    );
  }

  if (spec.criterios.length) {
    parts.push(
      "Criterios: " + spec.criterios.map((c) => `• ${c}`).join(" ")
    );
  }

  parts.push(
    `Líneas editables: ${spec.lineas_editables.join(", ")}. Pulsa Run al terminar.`
  );

  return parts;
}

/**
 * @param {string} solution
 * @param {LineaEdicion[]} slots
 * @param {'correccion' | 'relleno'} tipo
 * @returns {LineaDetalle[]}
 */
export function buildLineasDetalle(solution, slots, tipo) {
  const built = buildStudentCodeFromSolution(solution, slots, tipo);
  const refLines = solution.split("\n");
  const studentLines = built.code.split("\n");

  return slots.map((slot) => {
    const i = slot.linea - 1;
    const esperado = refLines[i] ?? "";
    const mostrado = studentLines[i] ?? "";
    return {
      linea: slot.linea,
      modo: slot.modo,
      esperado,
      mostrado,
      tarea: buildLineTask(esperado, mostrado, slot.modo, slot.tarea),
    };
  });
}

/**
 * Arma una ficha única: enunciado, código alumno, líneas y salida esperada alineados.
 * @param {import("./hilo-exercise.js").ExercisePayload} exercise
 * @param {{
 *   lintWoven: (code: string) => Promise<{ parse_ok: boolean, errores?: { mensaje: string }[] }>,
 *   runWoven: (code: string) => Promise<{ salida: string[], tiene_errores: boolean, diagnosticos?: { mensaje: string }[] }>,
 *   retryEstablish?: (detail: string) => Promise<import("./hilo-exercise.js").ExercisePayload>,
 *   recoverSolution?: (
 *     exercise: import("./hilo-exercise.js").ExercisePayload,
 *     detail: string
 *   ) => Promise<string>,
 * }} runtime
 * @returns {Promise<GuidedExercisePackage>}
 */
export async function finalizeGuidedExercise(exercise, runtime) {
  const tipo =
    exercise.tipo_ejercicio === "relleno" ? "relleno" : "correccion";

  /** @type {import("./hilo-exercise.js").ExercisePayload} */
  let current = { ...exercise };
  let solution = "";
  let rawSlots = [];
  /** @type {Awaited<ReturnType<typeof validateWovenDraft>>} */
  let validation = { ok: false, reason: "sintaxis", detail: "" };

  for (let attempt = 0; attempt < GUIDED_VALIDATION_MAX_ATTEMPTS; attempt++) {
    solution = sanitizeModelWovenCode(current.codigo_solucion?.trim() || "");
    if (!solution) {
      solution = sanitizeModelWovenCode(current.codigo_plantilla?.trim() || "");
    }
    rawSlots = normalizeLineasEdicion(
      solution,
      current.lineas_edicion ?? []
    );
    if (!rawSlots.length && solution) {
      rawSlots = defaultLineasEdicion(solution, tipo);
    }

    validation = await validateWovenDraft(solution, "ejemplo_correcto", runtime);
    if (validation.ok) break;

    if (attempt < GUIDED_VALIDATION_MAX_ATTEMPTS - 1 && runtime.retryEstablish) {
      current = await runtime.retryEstablish(validation.detail);
      continue;
    }
  }

  if (!validation.ok && runtime.recoverSolution) {
    try {
      solution = sanitizeModelWovenCode(
        await runtime.recoverSolution(current, validation.detail)
      );
      rawSlots = normalizeLineasEdicion(
        solution,
        current.lineas_edicion?.length
          ? current.lineas_edicion
          : defaultLineasEdicion(solution, tipo)
      );
      validation = await validateWovenDraft(solution, "ejemplo_correcto", runtime);
      if (validation.ok) {
        current = { ...current, codigo_solucion: solution };
      }
    } catch {
      /* se reporta el error original abajo */
    }
  }

  if (!validation.ok) {
    const hint =
      validation.reason === "sintaxis"
        ? `${validation.detail} Revisa que el ejercicio use list<int>/list<string>, append e índices en Woven.`
        : validation.detail;
    throw new Error(`No pude validar el ejercicio: ${hint}`);
  }

  const slots = enforceSlotsForTipo(solution, rawSlots, tipo);
  if (!slots.length) {
    throw new Error("El ejercicio guiado no definió líneas editables válidas.");
  }

  const built = buildStudentCodeFromSolution(solution, slots, tipo);
  const lineas_detalle = buildLineasDetalle(solution, slots, tipo);
  const salida_esperada = validation.output ?? [];

  /** @type {GuidedExercisePackage} */
  const pkg = {
    tipo,
    titulo: current.titulo,
    resumen: current.resumen,
    criterios: [...(current.criterios ?? [])],
    codigo_referencia: solution,
    codigo_estudiante: built.code,
    lineas_editables: built.editableLines,
    lineas_detalle,
    salida_esperada,
    enunciado: [],
  };

  pkg.enunciado = buildAlignedEnunciado(pkg);

  return pkg;
}

/** @deprecated Usar finalizeGuidedExercise */
export async function prepareGuidedExercise(exercise, runtime) {
  const pkg = await finalizeGuidedExercise(exercise, runtime);
  return {
    codigo_plantilla: pkg.codigo_estudiante,
    locks: pkg.lineas_editables,
    codigo_referencia: pkg.codigo_referencia,
    lineas_editables: pkg.lineas_editables,
    enunciado: pkg.enunciado,
    lineas_detalle: pkg.lineas_detalle,
    salida_esperada: pkg.salida_esperada,
  };
}

/**
 * @param {string} studentCode
 * @param {string} referenceCode
 * @param {number[]} editableLines
 */
export function checkGuidedExerciseCompletion(
  studentCode,
  referenceCode,
  editableLines
) {
  if (!editableLines?.length || !referenceCode?.trim()) return false;
  const student = studentCode.split("\n");
  const ref = referenceCode.split("\n");
  for (const lineNum of editableLines) {
    const i = lineNum - 1;
    if ((student[i] ?? "").trimEnd() !== (ref[i] ?? "").trimEnd()) return false;
  }
  return true;
}

/**
 * @param {GuidedExercisePackage | { titulo: string, tema_id?: string, tema_nombre?: string }} pkg
 */
export function buildGuidedCompletionTurn(pkg) {
  return {
    type: "conversation",
    chunks: [
      {
        text: "¡Correcto! Las líneas editables ya coinciden con la solución.",
        emotion: "happy",
      },
      {
        text: "Si hay un tema nuevo en Logros, es por lo que practicaste, no solo por terminar el reto.",
        emotion: "heart_eyes",
      },
    ],
    texto_completo:
      "¡Correcto! Las líneas editables ya coinciden con la solución.",
    ejercicioCompletado: true,
  };
}
