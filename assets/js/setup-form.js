import { createGeminiApiKeyField } from "./gemini-api-key-field.js";
import {
  ESTILO_OPTIONS,
  TONO_OPTIONS,
  defaultProfile,
  loadUserProfile,
  markOnboardingComplete,
  saveUserProfile,
} from "./user-settings.js";

/**
 * @param {HTMLElement} root Contenedor con data-profile-form
 */
export function createProfileForm(root) {
  const apiBlock = root.querySelector("[data-api-field]");

  const apiKey = createGeminiApiKeyField({
    input: /** @type {HTMLInputElement} */ (root.querySelector("[data-api-input]")),
    hint: /** @type {HTMLElement} */ (root.querySelector("[data-api-hint]")),
    validateBtn: /** @type {HTMLButtonElement} */ (
      root.querySelector("[data-api-validate]")
    ),
    clearBtn: root.querySelector("[data-api-clear]") ?? undefined,
    allowEmpty: true,
  });

  function fieldValue(sel) {
    const el = root.querySelector(sel);
    return el && "value" in el ? String(el.value).trim() : "";
  }

  function readProfile() {
    return {
      tono: fieldValue("[data-field-tono]"),
      estilo: fieldValue("[data-field-estilo]"),
      objetivos: fieldValue("[data-field-objetivos]"),
    };
  }

  function writeProfile(profile) {
    const tono = root.querySelector("[data-field-tono]");
    const estilo = root.querySelector("[data-field-estilo]");
    const objetivos = root.querySelector("[data-field-objetivos]");
    if (tono) tono.value = profile.tono ?? "";
    if (estilo) estilo.value = profile.estilo ?? "";
    if (objetivos) objetivos.value = profile.objetivos ?? "";
  }

  function loadIntoForm() {
    writeProfile(loadUserProfile());
  }

  function saveFromForm() {
    const profile = readProfile();
    saveUserProfile(profile);
    apiKey.persistInput();
    return profile;
  }

  return { apiKey, readProfile, writeProfile, loadIntoForm, saveFromForm };
}

/**
 * Chips opcionales que rellenan el textarea (no sustituyen escribir a mano).
 * @param {HTMLElement} container
 */
export function bindProfileSuggestions(container) {
  container.addEventListener("click", (e) => {
    const chip = /** @type {HTMLElement | null} */ (
      e.target.closest("[data-fill-tono], [data-fill-estilo]")
    );
    if (!chip) return;
    const tono = container.querySelector("[data-field-tono]");
    const estilo = container.querySelector("[data-field-estilo]");
    if (chip.dataset.fillTono && tono) tono.value = chip.dataset.fillTono;
    if (chip.dataset.fillEstilo && estilo) estilo.value = chip.dataset.fillEstilo;
  });

  const tonoHost = container.querySelector("[data-chips-tono]");
  const estiloHost = container.querySelector("[data-chips-estilo]");
  if (tonoHost) {
    tonoHost.innerHTML = TONO_OPTIONS.map(
      (o) =>
        `<button type="button" class="setup-chip" data-fill-tono="${o.label}">${o.label}</button>`
    ).join("");
  }
  if (estiloHost) {
    estiloHost.innerHTML = ESTILO_OPTIONS.map(
      (o) =>
        `<button type="button" class="setup-chip" data-fill-estilo="${o.label}">${o.label}</button>`
    ).join("");
  }
}

/**
 * @param {{
 *   overlay: HTMLElement,
 *   formRoot: HTMLElement,
 *   steps: HTMLElement,
 *   panels: NodeListOf<HTMLElement>,
 *   btnBack: HTMLButtonElement,
 *   btnNext: HTMLButtonElement,
 *   btnFinish: HTMLButtonElement,
 *   onComplete: (form: ReturnType<typeof createProfileForm>) => void | Promise<void>,
 * }} opts
 */
export function createOnboardingController({
  overlay,
  formRoot,
  steps,
  panels,
  btnBack,
  btnNext,
  btnFinish,
  onComplete,
}) {
  bindProfileSuggestions(formRoot);
  const form = createProfileForm(formRoot);
  let step = 0;
  const total = panels.length;

  function syncStepUi() {
    panels.forEach((p, i) => {
      p.hidden = i !== step;
    });
    const active = panels[step];
    const focusable = active?.querySelector(
      "textarea, input:not([type=hidden]):not([disabled])"
    );
    if (focusable && !overlay.hidden) {
      requestAnimationFrame(() => focusable.focus());
    }
    steps.querySelectorAll(".setup-step-dot").forEach((dot, i) => {
      dot.classList.toggle("is-active", i === step);
      dot.classList.toggle("is-done", i < step);
    });
    btnBack.hidden = step === 0;
    btnNext.hidden = step === total - 1;
    btnFinish.hidden = step !== total - 1;
  }

  function show() {
    overlay.hidden = false;
    form.loadIntoForm();
    step = 0;
    syncStepUi();
  }

  function hide() {
    overlay.hidden = true;
  }

  btnBack.addEventListener("click", () => {
    if (step > 0) {
      step -= 1;
      syncStepUi();
    }
  });

  btnNext.addEventListener("click", () => {
    if (step < total - 1) {
      step += 1;
      syncStepUi();
    }
  });

  btnFinish.addEventListener("click", () => {
    form.saveFromForm();
    markOnboardingComplete();
    hide();
    void Promise.resolve(onComplete(form));
  });

  syncStepUi();

  return { show, hide, form };
}

/**
 * @param {{
 *   modal: HTMLElement,
 *   formRoot: HTMLElement,
 *   openBtn: HTMLButtonElement,
 *   closeBtn: HTMLButtonElement,
 *   backdrop: HTMLElement,
 *   saveBtn: HTMLButtonElement,
 *   onSave?: (form: ReturnType<typeof createProfileForm>) => void | Promise<void>,
 * }} opts
 */
export function createSettingsModalController({
  modal,
  formRoot,
  openBtn,
  closeBtn,
  backdrop,
  saveBtn,
  onSave,
}) {
  bindProfileSuggestions(formRoot);
  const form = createProfileForm(formRoot);

  function open() {
    form.loadIntoForm();
    modal.hidden = false;
    document.body.style.overflow = "hidden";
  }

  function close() {
    modal.hidden = true;
    document.body.style.overflow = "";
  }

  openBtn.addEventListener("click", open);
  closeBtn.addEventListener("click", close);
  backdrop.addEventListener("click", close);
  saveBtn.addEventListener("click", () => {
    form.saveFromForm();
    void Promise.resolve(onSave?.(form));
    close();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.hidden) close();
  });

  return { open, close, form };
}
