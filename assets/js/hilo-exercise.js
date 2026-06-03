import { callGeminiHilo } from "./hilo-chat.js";
import {
  hiloEstablishExercise,
  hiloParseExercise,
} from "./bridge/pyodide-bridge.js";
import { activateExerciseMode } from "./hilo-exercise-mode.js";
import {
  inferExerciseTipo,
  prepareGuidedExercise,
} from "./hilo-exercise-correction.js";
import { slugTopicId } from "./learning-achievements.js";
import { localHiloTurn } from "./hilo-response.js";

/** @typedef {'libre' | 'correccion' | 'relleno'} ExerciseTipo */
/** @typedef {{ linea: number, modo: 'vacio' | 'incorrecto', contenido_erroneo?: string }} LineaEdicion */

/**
 * @typedef {{
 *   titulo: string,
 *   enunciado: string[],
 *   codigo_plantilla: string,
 *   criterios: string[],
 *   resumen: string,
 *   tema_id: string,
 *   tema_nombre: string,
 *   tipo_ejercicio: ExerciseTipo,
 *   codigo_solucion?: string,
 *   lineas_edicion?: LineaEdicion[],
 * }} ExercisePayload
 */

/**
 * @param {string} raw JSON normalizado desde Python.
 * @returns {ExercisePayload}
 */
export function parseExercisePayload(raw) {
  const data = JSON.parse(raw);
  if (String(data.type).toLowerCase() !== "ejercicio") {
    throw new Error("La respuesta no es un ejercicio válido.");
  }
  const parrafos = Array.isArray(data.enunciado)
    ? data.enunciado.map((p) => String(p).trim()).filter(Boolean)
    : [];
  const codigo = String(data.codigo_plantilla ?? data.codigo ?? "").trim();
  const tipoRaw = String(data.tipo_ejercicio ?? "libre").toLowerCase();
  const tipo =
    tipoRaw === "correccion" || tipoRaw === "relleno" ? tipoRaw : "libre";
  if (!codigo && tipo === "libre") {
    throw new Error("El ejercicio no incluyó código inicial.");
  }
  const titulo = String(data.titulo ?? "Ejercicio").trim() || "Ejercicio";
  const temaNombre = String(data.tema_nombre ?? titulo).trim() || titulo;
  /** @type {LineaEdicion[]} */
  const lineas_edicion = Array.isArray(data.lineas_edicion)
    ? data.lineas_edicion
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const linea = Number(item.linea);
          if (!Number.isFinite(linea) || linea < 1) return null;
          const modo =
            String(item.modo).toLowerCase() === "incorrecto"
              ? "incorrecto"
              : "vacio";
          const slot = { linea: Math.floor(linea), modo };
          if (item.contenido_erroneo) {
            slot.contenido_erroneo = String(item.contenido_erroneo);
          }
          return slot;
        })
        .filter(Boolean)
    : [];

  return {
    titulo,
    enunciado: parrafos.length ? parrafos : [titulo],
    codigo_plantilla: codigo,
    criterios: Array.isArray(data.criterios)
      ? data.criterios.map((c) => String(c).trim()).filter(Boolean)
      : [],
    resumen: String(data.resumen ?? "").trim(),
    tema_id: slugTopicId(String(data.tema_id ?? temaNombre)),
    tema_nombre: temaNombre,
    tipo_ejercicio: tipo,
    codigo_solucion: String(data.codigo_solucion ?? "").trim() || undefined,
    lineas_edicion: lineas_edicion.length ? lineas_edicion : undefined,
  };
}

/**
 * Poder Ejercicio: genera enunciado + plantilla, activa modo global.
 * @param {{
 *   mensaje: string,
 *   apiKey: string,
 *   perfilJson: string,
 *   getContext: () => {
 *     codigo: string,
 *     modo: string,
 *     bloquesResumen: string,
 *   },
 *   applyTemplate: (code: string, opts?: { editableLines?: number[] | null }) => Promise<void>,
 *   lintWoven?: (code: string) => Promise<{ parse_ok: boolean, errores?: { mensaje: string }[] }>,
 *   runWoven?: (code: string) => Promise<{ salida: string[], tiene_errores: boolean, diagnosticos?: { mensaje: string }[] }>,
 *   onEnunciado?: (data: { tag: string, title: string, paragraphs: string[] }) => void,
 *   onExerciseModeChange?: (active: boolean) => void,
 * }} opts
 */
export async function runHiloExercise({
  mensaje,
  apiKey,
  perfilJson,
  getContext,
  applyTemplate,
  lintWoven,
  runWoven,
  onEnunciado,
  onExerciseModeChange,
}) {
  const ctx = getContext();
  const tipoPedido = inferExerciseTipo(mensaje);

  /** @param {string} [retryDetail] */
  async function establish(retryDetail) {
    const msg =
      retryDetail != null
        ? `${mensaje}\n\nEl código anterior falló validación: ${retryDetail}. Genera otro ejercicio completo.`
        : mensaje;
    const prep = await hiloEstablishExercise({
      mensaje: msg,
      codigo: ctx.codigo,
      modo: ctx.modo,
      perfilJson,
      bloquesResumen: ctx.bloquesResumen ?? "",
      tipoEjercicio: tipoPedido,
    });
    if (!prep.ok) {
      throw new Error(prep.error ?? "No se pudo preparar el ejercicio.");
    }
    const responseJson = await callGeminiHilo(apiKey, prep.payload);
    const normalized = await hiloParseExercise(responseJson);
    return parseExercisePayload(normalized);
  }

  let exercise = await establish();

  let templateCode = exercise.codigo_plantilla;
  /** @type {number[] | null} */
  let editableLines = null;
  /** @type {string | undefined} */
  let codigoReferencia;

  const guided =
    exercise.tipo_ejercicio === "correccion" ||
    exercise.tipo_ejercicio === "relleno";

  if (guided && lintWoven && runWoven) {
    const prepared = await prepareGuidedExercise(exercise, {
      lintWoven,
      runWoven,
      retryEstablish: async (detail) => establish(detail),
    });
    templateCode = prepared.codigo_plantilla;
    editableLines = prepared.locks;
    codigoReferencia = prepared.codigo_referencia ?? undefined;
    exercise = {
      ...exercise,
      lineas_editables: prepared.lineas_editables,
    };
  }

  const paragraphs = [...exercise.enunciado];
  if (guided && editableLines?.length) {
    paragraphs.push(
      `Solo puedes editar las líneas: ${editableLines.join(", ")}. El resto del código está bloqueado.`
    );
  }
  if (exercise.criterios.length) {
    paragraphs.push(
      "Criterios: " + exercise.criterios.map((c) => `• ${c}`).join(" ")
    );
  }

  const tag =
    exercise.tipo_ejercicio === "correccion"
      ? "Corrección"
      : exercise.tipo_ejercicio === "relleno"
        ? "Completar código"
        : "Ejercicio";

  onEnunciado?.({
    tag,
    title: exercise.titulo,
    paragraphs,
  });

  activateExerciseMode({
    titulo: exercise.titulo,
    enunciado: exercise.enunciado,
    criterios: exercise.criterios,
    resumen: exercise.resumen,
    tema_id: exercise.tema_id,
    tema_nombre: exercise.tema_nombre,
    tipo_ejercicio: exercise.tipo_ejercicio,
    lineas_editables: editableLines ?? undefined,
    codigo_referencia: codigoReferencia,
  });
  onExerciseModeChange?.(true);

  await applyTemplate(templateCode, { editableLines });

  const intro = exercise.resumen
    ? exercise.resumen
    : guided
      ? `Listo: «${exercise.titulo}». Corrige o completa solo las líneas indicadas.`
      : `Listo: «${exercise.titulo}». El enunciado está en el panel lateral. Cuando ejecutes (Run) te iré guiando.`;

  return {
    exercise,
    turn: localHiloTurn([
      { text: intro, emotion: "happy" },
      {
        text: guided
          ? "Edita únicamente las líneas permitidas y pulsa Run para comprobar."
          : "Pregúntame sobre el ejercicio o pulsa Run para que revise tu avance.",
        emotion: "smile",
      },
    ]),
  };
}
