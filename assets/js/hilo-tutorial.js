/** Tutorial guiado de Hilo (después de la configuración inicial). */

export const TUTORIAL_STORAGE_KEY = "stitch_hilo_tutorial_complete";

/**
 * @typedef {'center' | 'focus'} TutorialPresentation
 * @typedef {'editor' | 'blocks' | 'console' | 'python' | 'java' | 'cpp' | 'enunciado' | 'logros'} TutorialPanel
 * @typedef {'enunciado' | 'logros' | 'python' | 'java' | 'cpp'} TutorialSideTab
 * @typedef {{
 *   text: string,
 *   emotion: string,
 *   presentation: TutorialPresentation,
 *   panel?: TutorialPanel,
 *   tab?: TutorialSideTab,
 *   highlight?: { line: number },
 *   action?: 'mode:text' | 'mode:blocks' | 'mode:verbose' | 'open:panel' | 'demo:translations',
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

/** Texto de demostración para el panel Enunciado durante el recorrido. */
export function getTutorialDemoEnunciado() {
  return {
    tag: "Tutorial",
    title: "Panel de aprendizaje",
    paragraphs: [
      "Aquí aparece el enunciado cuando pides un plan de estudio, un ejercicio o una lección.",
      "También verás criterios, el itinerario del plan y las instrucciones de cada actividad.",
    ],
  };
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
      text: "Stitch Code es tu espacio para aprender programación con **Woven**: escribes, ejecutas y ves resultados en la consola.",
      emotion: "smile",
    },
    {
      presentation: "center",
      text: "Te guío con **pistas** y explicaciones sobre tu código. No te doy la solución de golpe: practicas y entiendes.",
      emotion: "wink",
    },
    {
      presentation: "center",
      text: "Primero el **editor** y la **consola**; después el **panel lateral** y los **poderes** que puedes pedirme por chat.",
      emotion: "neutral",
    },
    {
      presentation: "center",
      text: "Pulsa **Enter** o haz clic en mí para avanzar en cada paso.",
      emotion: "smile",
    },

    {
      presentation: "focus",
      action: "mode:text",
      panel: "editor",
      highlight: { line: 1 },
      text: "Modo **Texto**: escribes Woven directamente, como en un editor de código.",
      emotion: "smile",
    },
    {
      presentation: "focus",
      panel: "editor",
      highlight: { line: 4 },
      text: "El ejemplo inicial recorre tipos, condicionales, bucles, funciones, listas y clases con **new**.",
      emotion: "neutral",
    },
    {
      presentation: "focus",
      action: "mode:blocks",
      panel: "blocks",
      highlight: { line: 1 },
      text: "Modo **Bloques**: el mismo programa como piezas que encajan. Ideal si prefieres lo visual.",
      emotion: "happy",
    },
    {
      presentation: "focus",
      action: "mode:verbose",
      panel: "blocks",
      highlight: { line: 1 },
      text: "Modo **Verboso**: cada bloque se lee en lenguaje natural, sin símbolos de programación.",
      emotion: "wink",
    },
    {
      presentation: "focus",
      action: "mode:text",
      panel: "console",
      highlight: { line: 1 },
      text: "La **consola** muestra la salida. Pulsa **Run** (o Ctrl+Enter) para ejecutar y comprobar tu programa.",
      emotion: "smile",
    },

    {
      presentation: "focus",
      action: "open:panel",
      tab: "enunciado",
      panel: "enunciado",
      text: "El **panel lateral** concentra el enunciado del reto, traducciones y tus logros de aprendizaje.",
      emotion: "neutral",
    },
    {
      presentation: "focus",
      tab: "enunciado",
      panel: "enunciado",
      text: "Pestaña **Enunciado**: instrucciones del plan, ejercicio o lección activa. Siempre alineadas con lo que haces en el editor.",
      emotion: "smile",
    },
    {
      presentation: "focus",
      action: "demo:translations",
      tab: "python",
      panel: "python",
      highlight: { line: 1 },
      text: "Tras una lección, aquí comparas el mismo ejemplo en **Python**, **Java** y **C++**.",
      emotion: "happy",
    },
    {
      presentation: "focus",
      tab: "logros",
      panel: "logros",
      text: "En **Logros** se registran los temas que dominas al completar planes y ejercicios (competencias, no solo «terminé un reto»).",
      emotion: "heart_eyes",
    },

    {
      presentation: "center",
      text: "Arriba tienes atajos: **Paso a paso** (traza línea a línea), **Generar traducciones** y abrir el **Panel**.",
      emotion: "neutral",
    },
    {
      presentation: "center",
      text: "Poder **Plan**: di «quiero aprender sobre listas» y armo un itinerario con lecciones, ejercicios, corrección y reflexión final.",
      emotion: "happy",
    },
    {
      presentation: "center",
      text: "Poder **Ejercicio**: pide un reto (libre, corregir líneas o completar huecos). Vigilo tus **Run** y el enunciado.",
      emotion: "smile",
    },
    {
      presentation: "center",
      text: "Poder **Explicación**: «explícame mi código» o «qué hace esta línea» y enfoco el editor o la consola.",
      emotion: "wink",
    },
    {
      presentation: "center",
      text: "Poder **Paso a paso**: recorre la ejecución con variables, consola y grafo de estructuras en el panel.",
      emotion: "neutral",
    },
    {
      presentation: "center",
      text: "¡Listo! Cambia de modo cuando quieras y escríbeme. Usa Enter para seguir mis mensajes.",
      emotion: "happy",
    },
  ];
}
