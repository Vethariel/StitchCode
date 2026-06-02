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

/** Texto para el prompt de Hilo (valores por defecto si el usuario dejó campos vacíos). */
export function profileForHilo(profile = loadUserProfile()) {
  const tonoLabels = Object.fromEntries(TONO_OPTIONS.map((o) => [o.value, o.label]));
  const estiloLabels = Object.fromEntries(ESTILO_OPTIONS.map((o) => [o.value, o.label]));

  const tono =
    tonoLabels[profile.tono] ||
    profile.tono ||
    "amigable y cercano (valor por defecto)";
  const estilo =
    estiloLabels[profile.estilo] ||
    profile.estilo ||
    "explicaciones claras paso a paso (valor por defecto)";
  const objetivos =
    profile.objetivos ||
    "aprender a programar en Woven con buenas prácticas (sin objetivos declarados)";

  return { tono, estilo, objetivos };
}
