import {
  clearStoredGeminiApiKey,
  getStoredGeminiApiKey,
  setStoredGeminiApiKey,
  validateGeminiApiKey,
  validateGeminiKeyFormat,
} from "./gemini-api-key.js";

/**
 * @param {{
 *   dock: HTMLElement,
 *   wrap: HTMLElement,
 *   input: HTMLInputElement,
 *   dot: HTMLElement,
 *   hint: HTMLElement,
 *   validateBtn: HTMLButtonElement,
 *   toggleBtn: HTMLButtonElement,
 *   clearBtn?: HTMLButtonElement,
 * }} els
 */
export function createGeminiApiKeyController({
  dock,
  wrap,
  input,
  dot,
  hint,
  validateBtn,
  toggleBtn,
  clearBtn,
}) {
  /** @type {"unknown"|"validating"|"valid"|"invalid"} */
  let state = "unknown";
  let lastValidatedKey = getStoredGeminiApiKey();
  /** @type {AbortController | null} */
  let pending = null;

  function setState(next) {
    state = next;
    wrap.dataset.keyState = next;
    dot.dataset.state = next;
    syncPanelLayout();
  }

  function syncPanelLayout() {
    const active = state === "valid";
    dock.dataset.active = active ? "true" : "false";
    toggleBtn.hidden = !active;

    if (!active) {
      dock.dataset.expanded = "true";
      toggleBtn.setAttribute("aria-expanded", "true");
      toggleBtn.textContent = "Ver API";
      return;
    }

    const expanded = dock.dataset.expanded === "true";
    toggleBtn.setAttribute("aria-expanded", expanded ? "true" : "false");
    toggleBtn.innerHTML =
      '<span class="gemini-key-toggle-dot" aria-hidden="true"></span>' +
      (expanded ? "Ocultar API" : "Ver API");
  }

  function setExpanded(expanded) {
    dock.dataset.expanded = expanded ? "true" : "false";
    syncPanelLayout();
    if (expanded) {
      input.focus();
    }
  }

  function setHint(text, kind = "") {
    hint.textContent = text;
    hint.dataset.kind = kind;
  }

  function setBusy(busy) {
    validateBtn.disabled = busy;
    input.disabled = busy;
    clearBtn && (clearBtn.disabled = busy);
  }

  async function runValidation() {
    const value = input.value;
    const format = validateGeminiKeyFormat(value);
    if (!format.ok) {
      setState("invalid");
      setHint(format.message, "error");
      return false;
    }

    pending?.abort();
    pending = new AbortController();
    setState("validating");
    setHint("Comprobando clave con Gemini…", "pending");
    setBusy(true);

    try {
      const result = await validateGeminiApiKey(value, {
        signal: pending.signal,
      });
      if (!result.ok) {
        setState("invalid");
        setHint(result.message, "error");
        return false;
      }
      setStoredGeminiApiKey(result.key);
      lastValidatedKey = result.key;
      setState("valid");
      setHint(result.message, "success");
      dock.dataset.expanded = "false";
      syncPanelLayout();
      return true;
    } finally {
      setBusy(false);
      pending = null;
    }
  }

  function loadStored() {
    const stored = getStoredGeminiApiKey();
    if (stored) {
      input.value = stored;
      lastValidatedKey = stored;
      setState("unknown");
      setHint("Clave guardada. Pulsa Validar para comprobarla.", "muted");
    } else {
      setState("unknown");
      setHint("Obtén una clave en aistudio.google.com/apikey", "muted");
    }
  }

  toggleBtn.addEventListener("click", () => {
    if (state !== "valid") return;
    setExpanded(dock.dataset.expanded !== "true");
  });

  validateBtn.addEventListener("click", () => {
    void runValidation();
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void runValidation();
    }
  });

  input.addEventListener("input", () => {
    const current = input.value.trim();
    if (current === lastValidatedKey && state === "valid") return;
    if (state === "valid" || state === "invalid") {
      setState("unknown");
      setHint("Pulsa Validar para guardar la clave.", "muted");
    }
  });

  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      pending?.abort();
      input.value = "";
      lastValidatedKey = "";
      clearStoredGeminiApiKey();
      setState("unknown");
      setHint("Clave eliminada.", "muted");
      setExpanded(true);
      input.focus();
    });
  }

  loadStored();
  syncPanelLayout();

  if (getStoredGeminiApiKey()) {
    void runValidation();
  }

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
  };
}
