import {
  clearStoredGeminiApiKey,
  getStoredGeminiApiKey,
  validateGeminiApiKey,
} from "./gemini-api-key.js";

let validatedKey = "";

export function setValidatedApiKey(key) {
  validatedKey = (key ?? "").trim();
}

export function clearValidatedApiKey() {
  validatedKey = "";
  clearStoredGeminiApiKey();
}

export async function refreshApiKeyValidation() {
  const stored = getStoredGeminiApiKey();
  if (!stored) {
    validatedKey = "";
    return false;
  }
  const result = await validateGeminiApiKey(stored);
  if (result.ok) {
    validatedKey = result.key;
    return true;
  }
  validatedKey = "";
  return false;
}

/** API usada por Hilo y el resto de la app. */
export function createGeminiApiAccess() {
  return {
    getActiveKey() {
      return validatedKey;
    },
    isValid() {
      return !!validatedKey;
    },
    setValidated(key) {
      setValidatedApiKey(key);
    },
    async refresh() {
      return refreshApiKeyValidation();
    },
  };
}
