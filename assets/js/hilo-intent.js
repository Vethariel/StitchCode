/** @typedef {'conversation' | 'explanation'} HiloIntent */

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

/**
 * Detecta si el estudiante pide una explicación (poder Explicación) o conversación.
 * @param {string} message
 * @returns {HiloIntent}
 */
export function detectHiloIntent(message) {
  const t = message.trim();
  if (!t) return "conversation";

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
  return intent === "explanation" ? "explicacion" : "conversacion";
}
