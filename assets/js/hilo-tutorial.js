/** Tutorial guiado de Hilo (después de la configuración inicial). */

export const TUTORIAL_STORAGE_KEY = "stitch_hilo_tutorial_complete";

/**
 * @typedef {'center' | 'focus'} TutorialPresentation
 * @typedef {'editor' | 'blocks' | 'console'} TutorialPanel
 * @typedef {{
 *   text: string,
 *   emotion: string,
 *   presentation: TutorialPresentation,
 *   panel?: TutorialPanel,
 *   highlight?: { line: number },
 *   action?: 'mode:text' | 'mode:blocks' | 'mode:verbose',
 * }} TutorialChunk
 */

export function isHiloTutorialComplete() {
  try {
    return localStorage.getItem(TUTORIAL_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function markHiloTutorialComplete() {
  localStorage.setItem(TUTORIAL_STORAGE_KEY, "1");
}

/** @returns {TutorialChunk[]} */
export function getHiloTutorialScript() {
  return [
    {
      presentation: "center",
      text: "Buenos días. Soy Hilo, tu tutor en Stitch Code.",
      emotion: "happy",
    },
    {
      presentation: "center",
      text: "Stitch Code es tu espacio para aprender a programar con Woven, un lenguaje pensado para principiantes.",
      emotion: "smile",
    },
    {
      presentation: "center",
      text: "Aquí escribes programas, los ejecutas y ves el resultado. Puedes elegir cómo ver el código según cómo prefieras aprender.",
      emotion: "neutral",
    },
    {
      presentation: "center",
      text: "Yo te acompaño con preguntas, pistas y explicaciones sobre tu propio código, sin darte la respuesta de inmediato.",
      emotion: "wink",
    },
    {
      presentation: "center",
      text: "A continuación te muestro el editor, los tres modos de vista y la consola. Pulsa Enter para continuar.",
      emotion: "smile",
    },
    {
      presentation: "focus",
      action: "mode:text",
      panel: "editor",
      highlight: { line: 1 },
      text: "Este es el editor en modo Texto: escribes Woven directamente, como en un cuaderno de código.",
      emotion: "smile",
    },
    {
      presentation: "focus",
      panel: "editor",
      highlight: { line: 4 },
      text: "El ejemplo inicial recorre lo esencial: tipos, condicionales, bucle for, funciones, listas y clases con new.",
      emotion: "neutral",
    },
    {
      presentation: "focus",
      action: "mode:blocks",
      panel: "blocks",
      highlight: { line: 1 },
      text: "En modo Bloques ves el mismo programa como piezas que encajan. Ideal si prefieres lo visual.",
      emotion: "happy",
    },
    {
      presentation: "focus",
      action: "mode:verbose",
      panel: "blocks",
      highlight: { line: 1 },
      text: "En modo Verboso cada bloque se lee en lenguaje natural, sin símbolos de programación.",
      emotion: "wink",
    },
    {
      presentation: "focus",
      action: "mode:text",
      panel: "console",
      highlight: { line: 1 },
      text: "Abajo está la consola: al pulsar Run verás aquí la salida de tu programa y podrás comprobar si funciona.",
      emotion: "smile",
    },
    {
      presentation: "center",
      text: "¡Listo! Ya conoces la plataforma. Escríbeme cuando quieras o pídeme que te explique algo con Enter.",
      emotion: "happy",
    },
  ];
}
