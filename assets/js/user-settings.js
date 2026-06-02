/** Perfil del estudiante y estado de configuración inicial. */

export const ONBOARDING_STORAGE_KEY = "stitch_onboarding_complete";
export const PROFILE_STORAGE_KEY = "stitch_user_profile";

/** @typedef {{
 *   tono: string,
 *   estilo: string,
 *   objetivos: string,
 * }} UserProfile */

export const TONO_OPTIONS = [
  { value: "amigable", label: "Amigable y cercano" },
  { value: "formal", label: "Formal y respetuoso" },
  { value: "motivador", label: "Motivador y entusiasta" },
  { value: "paciente", label: "Paciente y calmado" },
];

export const ESTILO_OPTIONS = [
  { value: "paso_a_paso", label: "Paso a paso, sin saltos" },
  { value: "analogias", label: "Con analogías del día a día" },
  { value: "directo", label: "Directo y al grano" },
  { value: "conceptual", label: "Conceptual, poco código al inicio" },
];

/** @returns {UserProfile} */
export function defaultProfile() {
  return {
    tono: "",
    estilo: "",
    objetivos: "",
  };
}

export function isOnboardingComplete() {
  try {
    return localStorage.getItem(ONBOARDING_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function markOnboardingComplete() {
  localStorage.setItem(ONBOARDING_STORAGE_KEY, "1");
}

/** @returns {UserProfile} */
export function loadUserProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) return defaultProfile();
    const data = JSON.parse(raw);
    return {
      tono: String(data.tono ?? "").trim(),
      estilo: String(data.estilo ?? "").trim(),
      objetivos: String(data.objetivos ?? "").trim(),
    };
  } catch {
    return defaultProfile();
  }
}

/** @param {UserProfile} profile */
export function saveUserProfile(profile) {
  localStorage.setItem(
    PROFILE_STORAGE_KEY,
    JSON.stringify({
      tono: profile.tono ?? "",
      estilo: profile.estilo ?? "",
      objetivos: profile.objetivos ?? "",
    })
  );
}

/** @param {{ value: string, label: string }[]} options */
function resolveProfileField(options, value) {
  const v = String(value ?? "").trim();
  if (!v) return "";
  const hit = options.find((o) => o.value === v);
  return hit ? hit.label : v;
}

/**
 * Parámetros de perfil que Gemini recibe en cada mensaje de Hilo
 * (onboarding / Ajustes → localStorage → perfilJson en hilo_chat).
 * Campos vacíos se envían como "" y el backend aplica valores por defecto.
 * @returns {{ tono: string, estilo: string, objetivos: string }}
 */
export function profileParamsForGemini(profile = loadUserProfile()) {
  return {
    tono: resolveProfileField(TONO_OPTIONS, profile.tono),
    estilo: resolveProfileField(ESTILO_OPTIONS, profile.estilo),
    objetivos: String(profile.objetivos ?? "").trim(),
  };
}

/** JSON del perfil para el argumento perfil_json de hilo_chat. */
export function profileJsonForGemini(profile = loadUserProfile()) {
  return JSON.stringify(profileParamsForGemini(profile));
}

/** @deprecated Usa profileParamsForGemini */
export const profileForHilo = profileParamsForGemini;
