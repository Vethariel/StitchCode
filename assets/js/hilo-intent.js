/** @typedef {'conversation' | 'explanation' | 'learning'} HiloIntent */

const EXPLANATION_PATTERNS = [
  /\bexpl[ií]came\b/i,
  /\bexpl[ií]came\s+(?:el|la|los|las|mi|tu|su|este|esta|esto)\b/i,
  /\bexpl[ií]ca(?:me|r|ndo)?\b/i,
  /\bqu[eé]\s+(?:hace|significa|es|muestra|imprime|devuelve)\b/i,
  /\b(c[oó]mo\s+funciona|para\s+qu[eé]\s+sirve)\b/i,
  /\bno\s+entiendo\b/i,
  /\b(?:ay[uú]dame\s+a\s+)?entender\b/i,
  /\bcu[eé]ntame\b/i,
  /\bdescr[ií]beme\b/i,
  /\b(?:qu[eé]|que)\s+(?:es|son)\s+(?:esto|esta|estas|estos)\b/i,
  /\bmodo\s+foco\b/i,
];

const LEARNING_PATTERNS = [
  /\b(?:ens[eé]ñame|ens[eé]ñar(?:me)?)\b/i,
  /\bmodo\s+aprendizaje\b/i,
  /\bquiero\s+aprender\b/i,
  /\bconcepto\s+de\b/i,
  /\bqu[eé]\s+es\s+(?:un|una)\s+\w+/i,
  /\baprendamos\b/i,
];

/**
 * Aprendizaje: concepto nuevo con ejemplo generado + explicación (no el código actual del alumno).
 * @param {string} message
 */
function detectLearning(message) {
  const t = message.trim();
  if (!t) return false;
  if (/\b(?:mi|este|esta)\s+(?:c[oó]digo|programa|bloque)\b/i.test(t)) {
    return false;
  }
  for (const re of LEARNING_PATTERNS) {
    if (re.test(t)) return true;
  }
  return false;
}

/**
 * Detecta el poder de Hilo: aprendizaje, explicación o conversación.
 * @param {string} message
 * @returns {HiloIntent}
 */
export function detectHiloIntent(message) {
  const t = message.trim();
  if (!t) return "conversation";

  if (detectLearning(t)) return "learning";

  for (const re of EXPLANATION_PATTERNS) {
    if (re.test(t)) return "explanation";
  }

  const lower = t.toLowerCase();
  const asksExplain =
    /\b(?:explic|entender|significa|descr|cu[eé]nta)\w*/i.test(lower);
  const aboutCode =
    /\b(?:c[oó]digo|programa|l[ií]nea|editor|woven|variable|funci[oó]n|bucle|bloque|bloques|verboso|L\d+)\w*/i.test(
      lower
    );
  const aboutConsole =
    /\b(?:consola|salida|output|resultado|imprime|muestra|ejecut)\w*/i.test(
      lower
    );

  if (asksExplain && (aboutCode || aboutConsole)) return "explanation";

  return "conversation";
}

/** @param {HiloIntent} intent */
export function intentToApiTipo(intent) {
  if (intent === "learning") return "aprendizaje";
  if (intent === "explanation") return "explicacion";
  return "conversacion";
}
