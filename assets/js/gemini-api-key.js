/** Clave Gemini: almacenamiento, formato y validación remota. */

export const GEMINI_API_STORAGE_KEY = "gemini_api_key";

/** Modelo usado por Hilo (debe coincidir con las llamadas generateContent). */
export const GEMINI_MODEL_ID = "gemini-3.1-flash-lite";

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";
const VALIDATE_TIMEOUT_MS = 12_000;

/** @param {string} apiKey */
export function geminiGenerateContentUrl(apiKey) {
  return `${GEMINI_API_BASE}/models/${GEMINI_MODEL_ID}:generateContent?key=${encodeURIComponent(apiKey.trim())}`;
}

/**
 * @param {string} key
 * @returns {{ ok: true } | { ok: false, message: string }}
 */
export function validateGeminiKeyFormat(key) {
  const trimmed = (key ?? "").trim();
  if (!trimmed) {
    return { ok: false, message: "Introduce tu clave de la API de Gemini." };
  }
  if (!/^AIza[0-9A-Za-z_-]{20,}$/.test(trimmed)) {
    return {
      ok: false,
      message:
        "Formato no reconocido. Las claves de Google suelen empezar por AIza…",
    };
  }
  return { ok: true, key: trimmed };
}

/**
 * @param {Response} response
 * @param {string} fallbackBody
 */
export async function geminiErrorMessage(response, fallbackBody = "") {
  let body = fallbackBody;
  try {
    if (!body) body = await response.text();
    const data = JSON.parse(body);
    const msg = data?.error?.message;
    if (typeof msg === "string" && msg.trim()) {
      if (/API key not valid|invalid.*api key/i.test(msg)) {
        return "Clave no válida. Revisa que la copiaste completa desde Google AI Studio.";
      }
      if (/permission|denied|forbidden/i.test(msg)) {
        return "Clave rechazada o sin permiso para usar la API de Gemini.";
      }
      if (/quota|billing|exceeded/i.test(msg)) {
        return "Clave aceptada, pero la cuota o facturación impiden usar el modelo.";
      }
      return msg;
    }
  } catch {
    /* cuerpo no JSON */
  }
  if (response.status === 401 || response.status === 403) {
    return "Clave no autorizada. Comprueba que la API de Gemini está habilitada.";
  }
  if (response.status === 429) {
    return "Demasiadas solicitudes. Espera un momento e inténtalo de nuevo.";
  }
  if (response.status === 404) {
    return `El modelo ${GEMINI_MODEL_ID} no está disponible. Revisa el nombre en Google AI Studio.`;
  }
  if (response.status >= 500) {
    return "El servicio de Gemini no respondió. Inténtalo más tarde.";
  }
  return `No se pudo validar la clave (HTTP ${response.status}).`;
}

/**
 * Comprueba la clave contra el modelo que usará Hilo.
 * @param {string} key
 * @param {{ signal?: AbortSignal }} [opts]
 */
export async function validateGeminiApiKeyRemote(key, opts = {}) {
  const format = validateGeminiKeyFormat(key);
  if (!format.ok) return { ok: false, message: format.message };

  const url = `${GEMINI_API_BASE}/models/${GEMINI_MODEL_ID}?key=${encodeURIComponent(format.key)}`;
  const response = await fetch(url, {
    method: "GET",
    signal: opts.signal,
  });

  if (response.ok) {
    return {
      ok: true,
      message: `Clave válida (${GEMINI_MODEL_ID}).`,
      key: format.key,
    };
  }

  const body = await response.text().catch(() => "");
  return {
    ok: false,
    message: await geminiErrorMessage(response, body),
  };
}

export function getStoredGeminiApiKey() {
  try {
    return localStorage.getItem(GEMINI_API_STORAGE_KEY)?.trim() ?? "";
  } catch {
    return "";
  }
}

/** @param {string} key */
export function setStoredGeminiApiKey(key) {
  localStorage.setItem(GEMINI_API_STORAGE_KEY, key.trim());
}

export function clearStoredGeminiApiKey() {
  localStorage.removeItem(GEMINI_API_STORAGE_KEY);
}

/**
 * @param {string} key
 * @param {{ signal?: AbortSignal }} [opts]
 */
export async function validateGeminiApiKey(key, opts = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), VALIDATE_TIMEOUT_MS);
  if (opts.signal) {
    opts.signal.addEventListener("abort", () => controller.abort(), {
      once: true,
    });
  }

  try {
    return await validateGeminiApiKeyRemote(key, { signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return {
        ok: false,
        message: "La validación tardó demasiado. Comprueba tu conexión.",
      };
    }
    return {
      ok: false,
      message:
        "No se pudo contactar con Gemini. Revisa tu conexión a internet.",
    };
  } finally {
    clearTimeout(timeout);
  }
}
