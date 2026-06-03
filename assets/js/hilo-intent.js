/** @typedef {'conversation' | 'explanation' | 'learning'} HiloIntent */

/** Quita tildes para que los regex coincidan con "enseñame" y "enséñame" por igual. */
function foldAccents(text) {
  return text.normalize("NFD").replace(/\p{M}/gu, "");
}

/**
 * TRIGGERS · Modo aprendizaje (Hilo)
 * ---------------------------------
 * Activa redacción de ejemplo + traducciones + explicación comparativa.
 * Aplica a conceptos de programación en general (listas, bucles, funciones…),
 * no solo sintaxis Woven. El ejemplo se genera en Woven como vehículo pedagógico.
 *
 * SÍ activa (ejemplos):
 * - "Enséñame de listas", "Enséñame sobre recursión"
 * - "Quiero aprender arrays", "Necesito saber de condicionales"
 * - "¿Qué es una lista?", "¿Qué son los bucles?"
 * - "Háblame de funciones", "Tutorial de variables"
 * - "Cómo se usan las listas", "Introducción a la programación orientada a objetos"
 * - "Modo aprendizaje", "Aprendamos strings"
 *
 * NO activa (va a explicación o conversación):
 * - Referencia explícita al código del alumno en pantalla:
 *   "Explícame mi código", "¿Qué hace esta línea?", "No entiendo mi programa"
 */

const EXPLANATION_PATTERNS = [
  /\bexpl[ií]came\b/i,
  /\bexpl[ií]came\s+(?:el|la|los|las|mi|tu|su|este|esta|esto)\b/i,
  /\bexpl[ií]ca(?:me|r|ndo)?\b/i,
  /\bqu[eé]\s+(?:hace|significa|muestra|imprime|devuelve)\b/i,
  /\b(c[oó]mo\s+funciona|para\s+qu[eé]\s+sirve)\b/i,
  /\bno\s+entiendo\s+(?:mi|este|esta|el|la)\s+(?:c[oó]digo|programa|l[ií]nea|bloque)/i,
  /\b(?:ay[uú]dame\s+a\s+)?entender\s+(?:mi|este|esta|el|la)\s+(?:c[oó]digo|programa|bloque)/i,
  /\bcu[eé]ntame\s+(?:qu[eé]\s+hace|este|esta|mi)\b/i,
  /\bdescr[ií]beme\s+(?:este|esta|mi)\b/i,
  /\b(?:qu[eé]|que)\s+(?:es|son)\s+(?:esto|esta|estas|estos)\b/i,
  /\bmodo\s+foco\b/i,
];

/** Verbos y modos de enseñar / aprender / estudiar (n/ñ tras foldAccents). */
const LEARNING_VERB =
  /\b(?:ensen[a-z]*|ens[eé][nñ][a-z]*|aprend[a-z]*|estudi[a-z]*|practicar|repasar)\b/i;

/** Frases directas de pedido de lección (sin depender solo de "enséñame"). */
const LEARNING_PHRASE_PATTERNS = [
  /\bmodo\s+aprendizaje\b/i,
  /\baprendamos\b/i,
  /\b(?:quiero|necesito|me gustar[ií]a|podr[ií]as|puedes|podr[ií]a)\s+(?:que\s+)?(?:me\s+)?(?:ensen|ens[eé][nñ]|aprend|estudi)/i,
  /\b(?:quiero|necesito)\s+(?:saber|entender|conocer)\s+(?:sobre|de|acerca|c[oó]mo\s+(?:se\s+)?(?:usan|funcionan|implementan|escriben))\b/i,
  /\b(?:habl|cu[eé]nt)[a-záéíóú]*\s+(?:sobre|de|acerca)\b/i,
  /\b(?:introducci[oó]n|tutorial|lecci[oó]n|clase|repaso)\s+(?:de|sobre|acerca|del|la|el)\b/i,
  /\bconcepto\s+(?:de|sobre|del|la)\b/i,
  /\bqu[eé]\s+(?:es|son)\s+(?:un[ao]?|el|la|los|las)\s+\w/i,
  /\bc[oó]mo\s+(?:se\s+)?(?:usan|funcionan|escriben|declaran|definen|crean)\s+(?:las?|los|el|un[ao]?)\s+/i,
  /\b(?:que\s+)?me\s+ensen[a-z]*\b/i,
  /\bensen[a-z]*\s+(?:sobre|de|acerca)\b/i,
];

/** Temas de programación (lenguaje agnóstico; el ejemplo se teje en Woven). */
const PROGRAMMING_TOPIC =
  /\b(?:lista?s|arreglos?|arrays?|vectores?|matrices?|bucles?|iteraci[oó]n|condicionales?|funciones?|m[eé]todos?|procedimientos?|variables?|constantes?|tipos?\s+de\s+datos|strings?|cadenas?|caracteres?|enteros?|flotantes?|booleanos?|recursi[oó]n|clases?|objetos?|programaci[oó]n|algoritmos?|entrada|salida|impresi[oó]n|print|return|devolver|par[aá]metros?|argumentos?|poo|orientad[oa]\s+a\s+objetos|estructuras?\s+de\s+datos|diccionarios?|mapas?|conjuntos?|sets?|tuplas?|indexaci[oó]n|alcance|scope|pilas?|colas?|memoria|asignaci[oó]n|declaraci[oó]n|operadores?|comparaci[oó]n|l[oó]gica|excepciones?|errores?|debug|depuraci[oó]n|sintaxis|sem[aá]ntica|m[oó]dulos?|librer[ií]as?|apis?|json|archivos?|io|entrada\/salida)\b/i;

/** El alumno habla de SU código en pantalla → explicación, no aprendizaje nuevo. */
const MY_CODE_CONTEXT =
  /\b(?:mi|mis|este|esta|estos|estas|el|la)\s+(?:c[oó]digo|programa|script|bloque|funci[oó]n|bucle|variable|lista|m[eé]todo|clase)\b/i;

const SCREEN_CONTEXT =
  /\b(?:en\s+)?(?:pantalla|editor|consola|aqu[ií]|ac[aá]|lo\s+que\s+tengo|lo\s+que\s+veo|lo\s+que\s+escrib[ií])\b/i;

const EXPLAIN_MY_CODE =
  /\b(?:expl[ií]c|entiend|revis|analiz|corrige|arregla|depur|qué\s+hace|qué\s+hace\s+este)\w*/i;

/**
 * @param {string} message
 */
function detectLearning(message) {
  const t = message.trim();
  if (!t) return false;
  const n = foldAccents(t);

  if (MY_CODE_CONTEXT.test(n) && (SCREEN_CONTEXT.test(n) || EXPLAIN_MY_CODE.test(n))) {
    return false;
  }
  if (MY_CODE_CONTEXT.test(n) && EXPLAIN_MY_CODE.test(n)) {
    return false;
  }

  for (const re of LEARNING_PHRASE_PATTERNS) {
    if (re.test(n)) return true;
  }

  if (LEARNING_VERB.test(n)) {
    if (/\b(?:sobre|de|acerca(?:\s+de)?|del|la|el|los|las|un[ao]?|una)\b/i.test(n)) {
      return true;
    }
    if (PROGRAMMING_TOPIC.test(n)) return true;
  }

  if (
    PROGRAMMING_TOPIC.test(n) &&
    /\b(?:quiero|necesito|aprender|saber|entender|conocer|repasar|practicar)\b/i.test(n) &&
    !MY_CODE_CONTEXT.test(n)
  ) {
    return true;
  }

  if (
    /\bno\s+entiendo\b/i.test(n) &&
    PROGRAMMING_TOPIC.test(n) &&
    !MY_CODE_CONTEXT.test(n)
  ) {
    return true;
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
  const n = foldAccents(t);

  if (detectLearning(t)) return "learning";

  for (const re of EXPLANATION_PATTERNS) {
    if (re.test(n)) return "explanation";
  }

  const lower = n.toLowerCase();
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

/** Expuesto para pruebas y depuración de triggers. */
export { detectLearning, LEARNING_PHRASE_PATTERNS, PROGRAMMING_TOPIC };
