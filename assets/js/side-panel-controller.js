import {
  DEFAULT_LEARNING_ACHIEVEMENTS,
  unlockAchievement,
} from "./learning-achievements.js";

/** @typedef {'enunciado' | 'python' | 'java' | 'cpp' | 'logros'} SidePanelTab */

/**
 * @param {string} text
 */
function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * @param {number} lineNo 1-based
 * @param {string} contentHtml
 */
function transRowHtml(lineNo, contentHtml) {
  return (
    `<div class="trans-row" data-trans-line="${lineNo}">` +
    `<span class="trans-ln" aria-hidden="true">${lineNo}</span>` +
    `<span class="trans-line">${contentHtml}</span>` +
    `</div>`
  );
}

/**
 * @param {string} code
 */
function codeToTransRowsHtml(code) {
  const lines = (code || "").split("\n");
  if (!lines.length) {
    return transRowHtml(1, "&nbsp;");
  }
  return lines
    .map((line, i) => {
      const inner = line.length ? escapeHtml(line) : "&nbsp;";
      return transRowHtml(i + 1, inner);
    })
    .join("");
}

/**
 * @param {HTMLElement | null} rowsEl
 * @param {string} code
 */
function renderTranslationBlock(rowsEl, code) {
  if (!rowsEl) return;
  rowsEl.innerHTML = codeToTransRowsHtml(code);
}

/**
 * @param {{
 *   panel: HTMLElement,
 *   navToggleBtn: HTMLButtonElement | null,
 *   generateBtn: HTMLButtonElement | null,
 *   translateAll: (source: string) => Promise<{ python: string, java: string, cpp: string }>,
 *   getSource: () => string,
 *   isRuntimeReady: () => boolean,
 * }} opts
 */
export function createSidePanelController({
  panel,
  navToggleBtn,
  generateBtn,
  translateAll,
  getSource,
  isRuntimeReady,
}) {
  const tabs = /** @type {NodeListOf<HTMLButtonElement>} */ (
    panel.querySelectorAll(".r-tab[data-tab]")
  );
  const tabPanels = /** @type {Record<SidePanelTab, HTMLElement>} */ ({});
  panel.querySelectorAll(".right-content[data-tab-panel]").forEach((el) => {
    const id = el.getAttribute("data-tab-panel");
    if (id) tabPanels[/** @type {SidePanelTab} */ (id)] = /** @type {HTMLElement} */ (el);
  });

  const enunciadoTag = panel.querySelector("#ex-tag");
  const enunciadoTitle = panel.querySelector("#ex-title");
  const enunciadoBody = panel.querySelector("#ex-body");
  const transPython = panel.querySelector("#trans-python");
  const transJava = panel.querySelector("#trans-java");
  const transCpp = panel.querySelector("#trans-cpp");
  const logrosRoot = panel.querySelector("#logros-list");

  /** @type {SidePanelTab} */
  let activeTab = "enunciado";
  let open = false;
  let hasTranslations = false;
  /** @type {import("./learning-achievements.js").LearningAchievement[]} */
  let achievements = DEFAULT_LEARNING_ACHIEVEMENTS.map((a) => ({ ...a }));

  function setOpen(next) {
    open = next;
    panel.classList.toggle("open", next);
    navToggleBtn?.classList.toggle("active", next);
    navToggleBtn?.setAttribute("aria-expanded", next ? "true" : "false");
  }

  function toggleOpen() {
    setOpen(!open);
  }

  /** @param {SidePanelTab} tab */
  function updateTabButtons(tab) {
    tabs.forEach((btn) => {
      const t = btn.getAttribute("data-tab");
      const isTrans = t === "python" || t === "java" || t === "cpp";
      if (isTrans) {
        btn.disabled = !hasTranslations;
        btn.classList.toggle("disabled", !hasTranslations);
      }
      btn.classList.toggle("active", t === tab);
      btn.setAttribute("aria-selected", t === tab ? "true" : "false");
    });
    Object.entries(tabPanels).forEach(([key, el]) => {
      el.classList.toggle("active", key === tab);
    });
  }

  /** @param {SidePanelTab} tab */
  function setActiveTab(tab) {
    if ((tab === "python" || tab === "java" || tab === "cpp") && !hasTranslations) {
      return;
    }
    activeTab = tab;
    updateTabButtons(tab);
  }

  function clearTranslationHighlights() {
    panel.querySelectorAll(".trans-row.hilo-highlight-line").forEach((el) => {
      el.classList.remove("hilo-highlight-line");
    });
  }

  /**
   * @param {'python' | 'java' | 'cpp'} lang
   * @param {number} line 1-based
   */
  function applyTranslationHighlight(lang, line) {
    clearTranslationHighlights();
    setActiveTab(lang);
    if (!open) setOpen(true);
    const view =
      lang === "python"
        ? panel.querySelector("#trans-python-view")
        : lang === "java"
          ? panel.querySelector("#trans-java-view")
          : panel.querySelector("#trans-cpp-view");
    const ln = Math.max(1, line);
    const row = view?.querySelector(`.trans-row[data-trans-line="${ln}"]`);
    row?.classList.add("hilo-highlight-line");
    row?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  /**
   * @param {{ tag?: string, title: string, paragraphs?: string[] }} data
   */
  function setEnunciado({ tag, title, paragraphs = [] }) {
    if (enunciadoTag) {
      enunciadoTag.textContent = tag ?? "Aprendizaje";
      enunciadoTag.hidden = !tag;
    }
    if (enunciadoTitle) enunciadoTitle.textContent = title;
    if (enunciadoBody) {
      enunciadoBody.innerHTML = paragraphs
        .filter(Boolean)
        .map((p) => `<p>${escapeHtml(p)}</p>`)
        .join("");
    }
    setActiveTab("enunciado");
    if (!open) setOpen(true);
  }

  /**
   * @param {{ python: string, java: string, cpp: string }} trans
   */
  function setTranslations(trans) {
    hasTranslations = true;
    renderTranslationBlock(transPython, trans.python);
    renderTranslationBlock(transJava, trans.java);
    renderTranslationBlock(transCpp, trans.cpp);
    updateTabButtons(activeTab);
    achievements = unlockAchievement("traductor", achievements);
    renderLogros();
  }

  function renderLogros() {
    if (!logrosRoot) return;
    logrosRoot.innerHTML = achievements
      .map((a) => {
        const earned = !!a.earned;
        return `
        <div class="logro" data-achievement="${a.id}">
          <div class="logro-icon ${earned ? "earned" : "locked"}">${a.icon}</div>
          <div class="logro-info">
            <div class="logro-name${earned ? "" : " locked"}">${escapeHtml(a.name)}</div>
            <div class="logro-desc">${escapeHtml(a.desc)}</div>
            <div class="logro-bar-wrap">
              <div class="logro-bar" style="width:${a.progress}%;${earned ? "" : " background: var(--palette-linen-muted);"}"></div>
            </div>
          </div>
        </div>`;
      })
      .join("");
  }

  async function generateFromEditor() {
    if (!isRuntimeReady()) {
      throw new Error("El entorno Woven aún no está listo.");
    }
    const source = getSource().trim();
    if (!source) {
      throw new Error("Escribe código Woven antes de generar traducciones.");
    }
    const trans = await translateAll(source);
    setTranslations(trans);
    if (!open) setOpen(true);
    return trans;
  }

  function syncGenerateButton() {
    if (!generateBtn) return;
    generateBtn.disabled = !isRuntimeReady();
  }

  tabs.forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.getAttribute("data-tab");
      if (tab) setActiveTab(/** @type {SidePanelTab} */ (tab));
    });
  });

  navToggleBtn?.addEventListener("click", () => toggleOpen());
  generateBtn?.addEventListener("click", () => {
    generateBtn.disabled = true;
    generateFromEditor()
      .catch((err) => {
        const msg = err instanceof Error ? err.message : String(err);
        window.alert(msg);
      })
      .finally(() => syncGenerateButton());
  });

  renderLogros();
  updateTabButtons("enunciado");
  syncGenerateButton();

  return {
    setOpen,
    toggleOpen,
    isOpen: () => open,
    setActiveTab,
    setEnunciado,
    setTranslations,
    generateFromEditor,
    applyTranslationHighlight,
    clearTranslationHighlights,
    hasTranslations: () => hasTranslations,
    syncGenerateButton,
  };
}
