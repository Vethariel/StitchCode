import {
  clearStoredGeminiApiKey,
  getStoredGeminiApiKey,
  setStoredGeminiApiKey,
  validateGeminiApiKey,
  validateGeminiKeyFormat,
} from "./gemini-api-key.js";

/**
 * Campo reutilizable de API Gemini (onboarding o modal de ajustes).
 * @param {{
 *   input: HTMLInputElement,
 *   hint: HTMLElement,
 *   validateBtn: HTMLButtonElement,
 *   clearBtn?: HTMLButtonElement,
 *   allowEmpty?: boolean,
 * }} opts
 */
export function createGeminiApiKeyField({
  input,
  hint,
  validateBtn,
  clearBtn,
  allowEmpty = true,
}) {
  /** @type {"unknown"|"validating"|"valid"|"invalid"|"empty"} */
  let state = "unknown";
  let lastValidatedKey = getStoredGeminiApiKey();

  function setState(next) {
    state = next;
    if (input.closest("[data-api-field]")) {
      input.closest("[data-api-field]").dataset.keyState = next;
    }
  }

  function setHint(text, kind = "") {
    hint.textContent = text;
    hint.dataset.kind = kind;
  }

  function setBusy(busy) {
    validateBtn.disabled = busy;
    input.disabled = busy;
    if (clearBtn) clearBtn.disabled = busy;
  }

  async function runValidation() {
    const value = input.value.trim();
    if (!value) {
      if (allowEmpty) {
        clearStoredGeminiApiKey();
        lastValidatedKey = "";
        setState("empty");
        setHint("Sin clave: Hilo no podrá responder hasta que configures una.", "muted");
        return true;
      }
      setState("invalid");
      setHint("Introduce tu clave o déjala en blanco para continuar sin Hilo.", "error");
      return false;
    }

    const format = validateGeminiKeyFormat(value);
    if (!format.ok) {
      setState("invalid");
      setHint(format.message, "error");
      return false;
    }

    setState("validating");
    setHint("Comprobando clave con Gemini…", "pending");
    setBusy(true);

    try {
      const result = await validateGeminiApiKey(value);
      if (!result.ok) {
        setState("invalid");
        setHint(result.message, "error");
        return false;
      }
      setStoredGeminiApiKey(result.key);
      lastValidatedKey = result.key;
      setState("valid");
      setHint(result.message, "success");
      return true;
    } finally {
      setBusy(false);
    }
  }

  function loadStored() {
    const stored = getStoredGeminiApiKey();
    if (stored) {
      input.value = stored;
      lastValidatedKey = stored;
      setState("unknown");
      setHint("Clave guardada. Pulsa «Validar clave» para comprobarla.", "muted");
    } else {
      setState(allowEmpty ? "empty" : "unknown");
      setHint(
        "Opcional. Obtén una en aistudio.google.com/apikey",
        "muted"
      );
    }
  }

  validateBtn.addEventListener("click", () => {
    void runValidation();
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void runValidation();
    }
  });

  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      input.value = "";
      lastValidatedKey = "";
      clearStoredGeminiApiKey();
      setState("empty");
      setHint("Clave eliminada.", "muted");
      input.focus();
    });
  }

  loadStored();

  return {
    getActiveKey() {
      return state === "valid" ? lastValidatedKey : "";
    },
    isValid() {
      return state === "valid";
    },
    async validate() {
      return runValidation();
    },
    /** Guarda perfil sin validar remota (p. ej. al omitir validación en onboarding). */
    persistInput() {
      const v = input.value.trim();
      if (!v) {
        clearStoredGeminiApiKey();
        lastValidatedKey = "";
        setState("empty");
        return;
      }
      setStoredGeminiApiKey(v);
      lastValidatedKey = v;
      if (state !== "valid") setState("unknown");
    },
    setValue(key) {
      input.value = key ?? "";
      lastValidatedKey = input.value.trim();
    },
  };
}
