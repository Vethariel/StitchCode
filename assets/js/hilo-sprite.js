/** Avatares de Hilo: un PNG cuadrado por emoción (assets/sprite/frames/). */

const MANIFEST_URL = "assets/sprite/HiloManifest.json";
const SPRITE_BASE = "assets/sprite/";

/** @typedef {{ name: string, file: string, size?: number }} HiloFrameEntry */

/** @type {Map<string, HiloFrameEntry> | null} */
let frames = null;

export async function loadHiloSpriteAtlas() {
  if (frames) return { frames };

  const res = await fetch(MANIFEST_URL);
  if (!res.ok) {
    throw new Error(
      "No se pudo cargar HiloManifest.json. Ejecuta: uv run python scripts/build_hilo_frames.py"
    );
  }
  const data = await res.json();
  const list = /** @type {HiloFrameEntry[]} */ (data.frames ?? data);
  frames = new Map(list.map((f) => [f.name, f]));
  return { frames };
}

/**
 * @param {HTMLElement} el Contenedor circular (overflow hidden).
 * @param {string} emotionName
 */
export function applyHiloEmotion(el, emotionName) {
  if (!frames) return;

  const frame = frames.get(emotionName) ?? frames.get("smile");
  if (!frame) return;

  let img = el.querySelector(".hilo-sprite-img");
  if (!img) {
    img = document.createElement("img");
    img.className = "hilo-sprite-img";
    img.setAttribute("aria-hidden", "true");
    img.decoding = "async";
    el.textContent = "";
    el.appendChild(img);
  }

  const src = `${SPRITE_BASE}${frame.file}`;
  if (img.getAttribute("src") !== src) {
    img.src = src;
  }
  el.dataset.emotion = frame.name;
}

export function getDefaultEmotion() {
  return "smile";
}
