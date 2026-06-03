import {
  BLOCK_SCHEMAS,
  PALETTE_ORDER,
  PALETTE_TYPES,
  createBlock,
  fieldKeyForVerbosePlaceholder,
  inlinePartsFor,
  isLegibleTypePlaceholder,
  labelForBlock,
  syncLegibleTypes,
  TIPO_LEGIBLE,
  verboseInlineParts,
  WOVEN_TYPES,
} from "./block-schemas.js";

/** @typedef {import("./bridge/pyodide-bridge.js").Bloque} Bloque */

/** @typedef {{ list: Bloque[], at: number, label: string, indent: number }} DropTarget */

/** @typedef {{ list: Bloque[], index: number, bloque: Bloque, slot?: string, parent: BlockContext | null, indent: number }} BlockContext */

/**
 * @param {{ paletteEl: HTMLElement, documentEl: HTMLElement, onChange?: () => void }} opts
 */
export function createBlocksController({ paletteEl, documentEl, onChange }) {
  /** @type {Bloque[]} */
  let bloques = [];
  /** @type {'code'|'verbose'} */
  let viewMode = "code";
  let dragActive = false;
  /** @type {{ bloque: Bloque, sourceList: Bloque[], sourceIndex: number, dropped: boolean, ghost: HTMLElement } | null} */
  let moveDrag = null;
  /** @type {{ bloque: Bloque, parentList: Bloque[], index: number, startX: number, startY: number } | null} */
  let movePending = null;
  /** @type {Set<number> | null} Líneas Woven editables (1-based) en ejercicio guiado. */
  let exerciseEditableLines = null;

  function notify() {
    onChange?.();
  }

  function isExerciseLockActive() {
    return exerciseEditableLines != null && exerciseEditableLines.size > 0;
  }

  /**
   * @param {Bloque} bloque
   */
  function getWovenLine(bloque) {
    const wl = bloque.linea_fuente ?? bloque.linea;
    return typeof wl === "number" && wl > 0 ? wl : 0;
  }

  /**
   * @param {Bloque} bloque
   */
  function isBlockEditable(bloque) {
    if (!isExerciseLockActive()) return true;
    const wl = getWovenLine(bloque);
    return wl > 0 && exerciseEditableLines.has(wl);
  }

  /**
   * @param {number | null | undefined} wovenLine
   */
  function wovenLineRowClass(wovenLine) {
    if (!isExerciseLockActive() || !wovenLine) return "";
    return exerciseEditableLines.has(wovenLine)
      ? " blocks-woven-editable"
      : " blocks-woven-locked";
  }

  /** @param {number[] | null} lines */
  function setExerciseEditableLines(lines) {
    exerciseEditableLines = lines?.length ? new Set(lines) : null;
    documentEl.classList.toggle("blocks-exercise-active", isExerciseLockActive());
    paletteEl.classList.toggle("blocks-palette-locked", isExerciseLockActive());
    render();
  }

  function clearExerciseEditableLines() {
    exerciseEditableLines = null;
    documentEl.classList.remove("blocks-exercise-active");
    paletteEl.classList.remove("blocks-palette-locked");
    render();
  }

  function setDragActive(active) {
    dragActive = active;
    documentEl.classList.toggle("blocks-drag-active", active);
    if (!active) {
      documentEl.querySelectorAll(".block-drop-gap").forEach((g) => {
        g.classList.remove("drag-over");
      });
    }
  }

  /**
   * @param {Bloque} bloque
   * @param {Bloque[]} list
   */
  function listContainedInBlock(bloque, list) {
    if (bloque.hijos === list || bloque.hijos_else === list || bloque.hijos_catch === list) {
      return true;
    }
    for (const slot of /** @type {const} */ (["hijos", "hijos_else", "hijos_catch"])) {
      for (const child of bloque[slot] || []) {
        if (listContainedInBlock(child, list)) return true;
      }
    }
    return false;
  }

  /**
   * @param {Bloque} moving
   * @param {DropTarget} target
   */
  function isInvalidMoveTarget(moving, target) {
    return listContainedInBlock(moving, target.list);
  }

  /**
   * @param {DropTarget[]} targets
   * @param {Bloque} moving
   */
  function filterTargetsForMove(targets) {
    return targets.filter((t) => !isGapDisabledForMove(t));
  }

  /**
   * @param {DropTarget} target
   */
  function isGapDisabledForMove(target) {
    if (isExerciseLockActive()) return true;
    if (!moveDrag) return false;
    if (isInvalidMoveTarget(moveDrag.bloque, target)) return true;
    if (moveDrag.sourceList === target.list && target.at === moveDrag.sourceIndex) {
      return true;
    }
    return false;
  }

  function refreshGapsForMove() {
    documentEl.querySelectorAll(".block-drop-gap").forEach((gap) => {
      const target = /** @type {DropTarget | undefined} */ (gap._wovenDropTarget);
      if (!target) return;
      gap.classList.toggle("block-drop-gap--disabled", isGapDisabledForMove(target));
    });
  }

  /**
   * @param {DropTarget} target
   * @param {DataTransfer} dataTransfer
   */
  function applyPaletteDropAtTarget(target, dataTransfer) {
    if (isExerciseLockActive()) return false;
    const tipo = dataTransfer.getData("application/x-woven-block");
    if (!tipo) return false;
    target.list.splice(target.at, 0, createBlock(tipo));
    return true;
  }

  /**
   * @param {Bloque} bloque
   */
  function createFloatingGhost(bloque) {
    const schema = BLOCK_SCHEMAS[bloque.tipo];
    const ghost = document.createElement("div");
    ghost.className = `block-drag-ghost block-${schema?.color || "let"}`;
    ghost.setAttribute("role", "status");
    ghost.setAttribute("aria-live", "polite");

    const type = document.createElement("span");
    type.className = "block-drag-ghost-type";
    type.textContent = blockTypeLabel(bloque);

    const preview = document.createElement("span");
    preview.className = "block-drag-ghost-preview";
    preview.textContent = labelForBlock(bloque, viewMode);

    ghost.append(type, preview);
    document.body.appendChild(ghost);
    return ghost;
  }

  /**
   * @param {MouseEvent} e
   */
  function positionFloatingGhost(e) {
    if (!moveDrag?.ghost) return;
    moveDrag.ghost.style.left = `${e.clientX + 14}px`;
    moveDrag.ghost.style.top = `${e.clientY + 14}px`;
  }

  /**
   * @param {MouseEvent} e
   */
  function highlightGapUnderPointer(e) {
    documentEl.querySelectorAll(".block-drop-gap").forEach((g) => {
      g.classList.remove("drag-over");
    });
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const gap = el?.closest(".block-drop-gap:not(.block-drop-gap--disabled)");
    gap?.classList.add("drag-over");
  }

  /**
   * @param {Bloque} bloque
   * @param {Bloque[]} parentList
   * @param {number} index
   */
  /**
   * @param {Bloque} bloque
   * @param {Bloque[]} parentList
   * @param {number} index
   * @param {MouseEvent} [ev]
   */
  function beginMoveDrag(bloque, parentList, index, ev) {
    if (!isBlockEditable(bloque)) return;
    const [removed] = parentList.splice(index, 1);
    moveDrag = {
      bloque: removed,
      sourceList: parentList,
      sourceIndex: index,
      dropped: false,
      ghost: createFloatingGhost(removed),
    };
    document.body.classList.add("blocks-pointer-dragging");
    documentEl.classList.add("blocks-move-dragging");
    setDragActive(true);
    render();
    refreshGapsForMove();
    if (ev) positionFloatingGhost(ev);
  }

  /**
   * @param {DropTarget | null} target
   */
  function endMoveDrag(target) {
    if (!moveDrag) return;
    const committed = target && !isGapDisabledForMove(target);
    if (committed) {
      target.list.splice(target.at, 0, moveDrag.bloque);
      moveDrag.dropped = true;
    } else if (!moveDrag.dropped) {
      moveDrag.sourceList.splice(moveDrag.sourceIndex, 0, moveDrag.bloque);
    }
    moveDrag.ghost.remove();
    cleanupMoveDrag();
    render();
    if (committed) notify();
  }

  function cleanupMoveDrag() {
    document.body.classList.remove("blocks-pointer-dragging");
    documentEl.classList.remove("blocks-move-dragging");
    documentEl.querySelectorAll(".block-drop-gap--disabled").forEach((el) => {
      el.classList.remove("block-drop-gap--disabled");
    });
    documentEl.querySelectorAll(".block-drop-gap").forEach((g) => {
      g.classList.remove("drag-over");
    });
    moveDrag = null;
    movePending = null;
    setDragActive(false);
  }

  /**
   * @param {Bloque} bloque
   * @param {Bloque[]} parentList
   * @param {number} index
   * @param {HTMLElement} card
   * @param {MouseEvent} e
   */
  function onBlockPointerDown(bloque, parentList, index, card, e) {
    if (e.button !== 0) return;
    if (!isBlockEditable(bloque)) return;
    if (e.target.closest("button, input, select, textarea, option, label")) return;

    movePending = {
      bloque,
      parentList,
      index,
      startX: e.clientX,
      startY: e.clientY,
    };

    const onMove = (ev) => {
      if (!movePending && !moveDrag) return;

      if (movePending) {
        const dx = Math.abs(ev.clientX - movePending.startX);
        const dy = Math.abs(ev.clientY - movePending.startY);
        if (dx < 5 && dy < 5) return;
        const { bloque: b, parentList: list, index: i } = movePending;
        movePending = null;
        beginMoveDrag(b, list, i, ev);
      }

      if (moveDrag) {
        ev.preventDefault();
        positionFloatingGhost(ev);
        highlightGapUnderPointer(ev);
      }
    };

    const onUp = (ev) => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);

      if (moveDrag) {
        const el = document.elementFromPoint(ev.clientX, ev.clientY);
        const gap = el?.closest(".block-drop-gap:not(.block-drop-gap--disabled)");
        const target = /** @type {DropTarget | undefined} */ (gap?._wovenDropTarget);
        endMoveDrag(target ?? null);
        return;
      }

      movePending = null;
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  /**
   * @param {Bloque[]} list
   * @param {'code'|'verbose'} mode
   */
  function setDocument(list, mode = viewMode) {
    bloques = normalizeBlocks(list);
    viewMode = mode;
    render();
  }

  function getDocument() {
    return { bloques: structuredClone(bloques) };
  }

  /** Resumen numerado (L1, L2…) para el contexto de Hilo — misma numeración que la UI. */
  function getProgramSummary() {
    if (!bloques.length) {
      return "(programa vacío — sin bloques en el documento)";
    }

    const lines = [];
    const counter = { n: 1 };
    const vista = viewMode === "verbose" ? "verboso" : "bloques";

    /**
     * @param {Bloque[]} list
     */
    function walk(list) {
      for (const bloque of list) {
        const line = counter.n++;
        const schema = BLOCK_SCHEMAS[bloque.tipo];
        const label = schema?.label || bloque.tipo;
        const preview = (bloque.texto || "")
          .trim()
          .replace(/\s+/g, " ")
          .slice(0, 140);
        lines.push(
          `L${line} · [${label}] ${preview || "(sin texto en el bloque)"}`
        );

        if (schema?.slots?.includes("hijos") && bloque.hijos?.length) {
          walk(bloque.hijos);
        }
        if (schema?.slots?.includes("hijos_else") && bloque.hijos_else?.length) {
          lines.push(`  └ rama sino de L${line}:`);
          walk(bloque.hijos_else);
        }
        if (schema?.slots?.includes("hijos_catch") && bloque.hijos_catch?.length) {
          lines.push(`  └ rama capturar de L${line}:`);
          walk(bloque.hijos_catch);
        }
      }
    }

    walk(bloques);
    return `Vista: ${vista}\n${lines.join("\n")}`;
  }

  /** @returns {number} */
  function getBlockLineCount() {
    if (!bloques.length) return 0;
    const counter = { n: 1 };

    /** @param {Bloque[]} list */
    function walk(list) {
      for (const bloque of list) {
        counter.n += 1;
        const schema = BLOCK_SCHEMAS[bloque.tipo];
        if (schema?.slots?.includes("hijos") && bloque.hijos?.length) walk(bloque.hijos);
        if (schema?.slots?.includes("hijos_else") && bloque.hijos_else?.length) {
          walk(bloque.hijos_else);
        }
        if (schema?.slots?.includes("hijos_catch") && bloque.hijos_catch?.length) {
          walk(bloque.hijos_catch);
        }
      }
    }

    walk(bloques);
    return counter.n - 1;
  }

  function setViewMode(mode) {
    viewMode = mode;
    render();
  }

  /**
   * @param {Bloque[]} list
   */
  function normalizeBlocks(list) {
    return list.map((b) => ({
      ...b,
      id: b.id || `${b.tipo}_${Math.random().toString(36).slice(2, 9)}`,
      placeholders: { ...(b.placeholders || {}) },
      linea_fuente: b.linea_fuente ?? undefined,
      hijos: b.hijos ? normalizeBlocks(b.hijos) : [],
      hijos_else: b.hijos_else ? normalizeBlocks(b.hijos_else) : undefined,
      hijos_catch: b.hijos_catch ? normalizeBlocks(b.hijos_catch) : undefined,
    }));
  }

  function clearStepHighlight() {
    documentEl
      .querySelectorAll(".step-highlight-line")
      .forEach((el) => el.classList.remove("step-highlight-line"));
  }

  /**
   * @param {number} wovenLine Línea 1-based del fuente Woven (traza / verbose)
   * @returns {string | null} Línea de bloque L1, L2… en la cuadrícula
   */
  function findDisplayLineForWovenLine(wovenLine) {
    if (!wovenLine || !Number.isFinite(wovenLine)) return null;
    const n = Math.floor(wovenLine);
    let el = documentEl.querySelector(`[data-woven-line="${n}"]`);
    if (!el) {
      const all = [...documentEl.querySelectorAll("[data-woven-line]")];
      let best = null;
      let bestWl = -1;
      for (const node of all) {
        const wl = Number(node.dataset.wovenLine);
        if (!Number.isFinite(wl) || wl > n) continue;
        if (wl > bestWl) {
          bestWl = wl;
          best = node;
        }
      }
      el = best;
    }
    return el?.dataset?.hiloLine ?? null;
  }

  /**
   * @param {number | null} wovenLine
   */
  function highlightByWovenLine(wovenLine) {
    clearStepHighlight();
    if (wovenLine == null || !Number.isFinite(wovenLine)) return;
    const n = Math.floor(wovenLine);
    let nodes = documentEl.querySelectorAll(`[data-woven-line="${n}"]`);
    if (!nodes.length) {
      const all = [...documentEl.querySelectorAll("[data-woven-line]")];
      let best = null;
      let bestWl = -1;
      for (const el of all) {
        const wl = Number(el.dataset.wovenLine);
        if (!Number.isFinite(wl) || wl > n) continue;
        if (wl > bestWl) {
          bestWl = wl;
          best = el;
        }
      }
      if (best?.dataset?.wovenLine) {
        nodes = documentEl.querySelectorAll(
          `[data-woven-line="${best.dataset.wovenLine}"]`
        );
      }
    }
    nodes.forEach((el) => el.classList.add("step-highlight-line"));
    const scrollKey =
      nodes[0]?.dataset?.wovenLine ??
      (nodes.length ? String(n) : null);
    if (scrollKey) {
      documentEl
        .querySelector(`.blocks-line-num[data-woven-line="${scrollKey}"]`)
        ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }

  function render() {
    renderPalette();
    documentEl.innerHTML = "";
    if (!bloques.length) {
      const doc = document.createElement("div");
      doc.className = "blocks-document blocks-doc-grid blocks-document-empty";
      doc.dataset.dropZone = "root";
      appendGapRow(doc, [
        { list: bloques, at: 0, label: "Línea base", indent: 0 },
      ]);
      const hint = document.createElement("p");
      hint.className = "blocks-doc-empty";
      hint.textContent =
        "Arrastra bloques desde la paleta o cambia desde texto con sintaxis válida.";
      const main = doc.querySelector(".blocks-gap-main");
      if (main) main.appendChild(hint);
      documentEl.appendChild(doc);
      return;
    }
    const doc = document.createElement("div");
    doc.className = "blocks-document blocks-doc-grid";
    doc.dataset.dropZone = "root";
    renderBlockList(bloques, doc, { n: 1 }, null);
    documentEl.appendChild(doc);
  }

  function renderPalette() {
    paletteEl.innerHTML = "";
    const byCat = /** @type {Record<string, typeof PALETTE_TYPES>} */ ({});
    for (const item of PALETTE_TYPES) {
      if (!byCat[item.category]) byCat[item.category] = [];
      byCat[item.category].push(item);
    }

    for (const cat of PALETTE_ORDER) {
      if (!byCat[cat]?.length) continue;
      const section = document.createElement("div");
      section.className = "blocks-palette-section";
      const title = document.createElement("div");
      title.className = "blocks-palette-cat";
      title.textContent = cat;
      section.appendChild(title);

      for (const schema of byCat[cat]) {
        const chip = document.createElement("div");
        chip.className = `blocks-palette-chip block-${schema.color}`;
        chip.draggable = !isExerciseLockActive();
        chip.dataset.blockTipo = schema.tipo;
        chip.textContent = schema.label;
        chip.addEventListener("dragstart", (e) => {
          if (isExerciseLockActive()) {
            e.preventDefault();
            return;
          }
          moveDrag = null;
          documentEl.classList.remove("blocks-move-dragging");
          e.dataTransfer?.setData("application/x-woven-block", schema.tipo);
          e.dataTransfer?.setData("text/plain", schema.tipo);
          if (e.dataTransfer) e.dataTransfer.effectAllowed = "copy";
          setDragActive(true);
        });
        section.appendChild(chip);
      }
      paletteEl.appendChild(section);
    }
  }

  /**
   * @param {Bloque} bloque
   */
  function blockTypeLabel(bloque) {
    return BLOCK_SCHEMAS[bloque.tipo]?.label || bloque.tipo;
  }

  /**
   * @param {BlockContext | null} listOwner
   */
  function labelForParentList(listOwner) {
    if (!listOwner) return "Línea base";
    const parentLabel = blockTypeLabel(listOwner.bloque);
    const lineTag = listOwner.bloque.linea ? ` · L${listOwner.bloque.linea}` : "";
    if (listOwner.slot === "hijos_else") return `Dentro de sino · ${parentLabel}${lineTag}`;
    if (listOwner.slot === "hijos_catch") return `Dentro de capturar · ${parentLabel}${lineTag}`;
    return `Dentro de ${parentLabel}${lineTag}`;
  }

  /**
   * @param {Bloque} bloque
   */
  function blockHasRenderedChildren(bloque) {
    const schema = BLOCK_SCHEMAS[bloque.tipo];
    if (!schema?.slots) return false;
    return schema.slots.some((s) => (bloque[s]?.length ?? 0) > 0);
  }

  /**
   * @param {DropTarget[]} targets
   */
  function dedupeTargets(targets) {
    return targets.filter(
      (t, i, arr) => arr.findIndex((u) => u.list === t.list && u.at === t.at) === i
    );
  }

  /**
   * @param {Bloque} bloque
   * @param {Bloque[]} list
   * @param {number} index
   * @param {BlockContext} rowCtx
   */
  function targetsAfterBlockRow(bloque, list, index, rowCtx) {
    /** @type {DropTarget[]} */
    const targets = [];
    const schema = BLOCK_SCHEMAS[bloque.tipo];

    if (schema?.slots?.includes("hijos") && !(bloque.hijos?.length)) {
      const hijos = bloque.hijos || (bloque.hijos = []);
      const lineTag = bloque.linea ? ` · L${bloque.linea}` : "";
      targets.push({
        list: hijos,
        at: 0,
        label: `Dentro de ${blockTypeLabel(bloque)}${lineTag}`,
        indent: rowCtx.indent + 1,
      });
    }

    targets.push({
      list,
      at: index + 1,
      label: labelForParentList(rowCtx.parent),
      indent: rowCtx.indent,
    });

    if (index !== list.length - 1) {
      return dedupeTargets(targets);
    }

    let walk = rowCtx;
    while (walk.index === walk.list.length - 1 && walk.parent) {
      const listOwner = walk.parent;
      const outerRow = listOwner.parent;
      if (!outerRow) break;
      targets.push({
        list: outerRow.list,
        at: outerRow.index + 1,
        label: labelForParentList(outerRow.parent),
        indent: outerRow.indent,
      });
      if (outerRow.index < outerRow.list.length - 1) break;
      walk = outerRow;
    }

    return dedupeTargets(targets);
  }

  /**
   * @param {HTMLElement} container
   * @param {DropTarget[]} targets
   */
  function appendGapRow(container, targets) {
    if (moveDrag) {
      targets = filterTargetsForMove(targets);
    }
    if (!targets.length) return;

    const gutter = document.createElement("div");
    gutter.className = "blocks-gap-cell blocks-line-num";
    gutter.setAttribute("aria-hidden", "true");

    const typeCell = document.createElement("div");
    typeCell.className = "blocks-gap-cell blocks-line-type";
    typeCell.setAttribute("aria-hidden", "true");

    const main = document.createElement("div");
    main.className = "blocks-gap-main";

    if (targets.length === 1) {
      main.appendChild(makeDropGap(targets[0]));
    } else {
      const stack = document.createElement("div");
      stack.className = "blocks-gap-stack";
      stack.setAttribute("role", "group");
      stack.setAttribute(
        "aria-label",
        `${targets.length} posiciones para soltar el bloque`
      );
      for (const target of targets) {
        stack.appendChild(makeDropGap(target));
      }
      main.appendChild(stack);
    }

    container.append(gutter, typeCell, main);
  }

  /**
   * @param {DropTarget} target
   */
  function makeDropGap(target) {
    const gap = document.createElement("div");
    gap.className = "block-drop-gap";
    gap.style.setProperty("--gap-indent", String(target.indent));

    const mark = document.createElement("span");
    mark.className = "block-drop-gap-mark";
    mark.textContent = "+";
    gap.appendChild(mark);

    const label = document.createElement("span");
    label.className = "block-drop-gap-label";
    label.textContent = target.label;
    gap.appendChild(label);

    gap._wovenDropTarget = target;
    if (isExerciseLockActive()) {
      gap.classList.add("block-drop-gap--disabled");
    }

    gap.addEventListener("dragover", (e) => {
      if (!dragActive || isGapDisabledForMove(target)) return;
      e.preventDefault();
      e.stopPropagation();
      gap.classList.add("drag-over");
    });
    gap.addEventListener("dragleave", (e) => {
      if (!gap.contains(/** @type {Node} */ (e.relatedTarget))) {
        gap.classList.remove("drag-over");
      }
    });
    gap.addEventListener("drop", (e) => {
      e.preventDefault();
      e.stopPropagation();
      gap.classList.remove("drag-over");
      if (!e.dataTransfer || !applyPaletteDropAtTarget(target, e.dataTransfer)) return;
      setDragActive(false);
      render();
      notify();
    });

    return gap;
  }

  /**
   * @param {Bloque[]} list
   * @param {HTMLElement} container
   * @param {{ n: number }} lineCounter
   * @param {BlockContext | null} listOwner
   */
  function renderBlockList(list, container, lineCounter, listOwner) {
    const lineDepth = listOwner ? listOwner.indent : 0;

    list.forEach((bloque, index) => {
      /** @type {BlockContext} */
      const rowCtx = {
        list,
        index,
        bloque,
        parent: listOwner,
        indent: lineDepth,
      };

      if (index === 0) {
        appendGapRow(container, [
          {
            list,
            at: 0,
            label: labelForParentList(listOwner),
            indent: lineDepth,
          },
        ]);
      }

      renderBlockLine(bloque, list, index, lineCounter, rowCtx, container);
      if (!blockHasRenderedChildren(bloque)) {
        appendGapRow(container, targetsAfterBlockRow(bloque, list, index, rowCtx));
      }
    });
  }

  /**
   * @param {Bloque} bloque
   * @param {Bloque[]} parentList
   * @param {number} index
   * @param {{ n: number }} lineCounter
   * @param {BlockContext} rowCtx
   * @param {HTMLElement} container
   */
  function renderBlockLine(bloque, parentList, index, lineCounter, rowCtx, container) {
    const schema = BLOCK_SCHEMAS[bloque.tipo];
    if (bloque.linea_fuente == null && bloque.linea > 0) {
      bloque.linea_fuente = bloque.linea;
    }
    const displayLine = lineCounter.n++;
    bloque.linea = displayLine;
    const wovenLine = bloque.linea_fuente;
    const rowLockCls = wovenLineRowClass(wovenLine);

    const num = document.createElement("div");
    num.className = `blocks-line-num${rowLockCls}`;
    num.textContent = String(displayLine);
    num.setAttribute("aria-label", `Línea ${displayLine}`);
    num.dataset.hiloLine = String(displayLine);
    if (wovenLine != null) num.dataset.wovenLine = String(wovenLine);

    const kind = document.createElement("div");
    kind.className = `blocks-line-type${rowLockCls}`;
    kind.textContent = schema?.label || bloque.tipo;
    kind.dataset.hiloLine = String(displayLine);
    if (wovenLine != null) kind.dataset.wovenLine = String(wovenLine);

    const main = document.createElement("div");
    main.className = `blocks-line-main${rowLockCls}`;
    main.dataset.hiloLine = String(displayLine);
    if (wovenLine != null) main.dataset.wovenLine = String(wovenLine);
    main.style.setProperty("--block-depth", String(rowCtx.indent));
    main.appendChild(renderBlockCard(bloque, parentList, index));

    container.append(num, kind, main);

    if (schema?.slots?.includes("hijos")) {
      renderChildSlot(bloque, "hijos", lineCounter, rowCtx, container);
    }
    if (schema?.slots?.includes("hijos_else")) {
      const elseNum = document.createElement("div");
      elseNum.className = "blocks-line-num blocks-line-aux";
      const elseType = document.createElement("div");
      elseType.className = "blocks-line-type blocks-line-aux";
      elseType.textContent = "sino";
      const elseMain = document.createElement("div");
      elseMain.className = "blocks-line-main blocks-line-aux";
      elseMain.style.setProperty("--block-depth", String(rowCtx.indent + 1));
      container.append(elseNum, elseType, elseMain);
      if (!bloque.hijos_else) bloque.hijos_else = [];
      renderChildSlot(bloque, "hijos_else", lineCounter, rowCtx, container);
    }
    if (schema?.slots?.includes("hijos_catch")) {
      const catchNum = document.createElement("div");
      catchNum.className = "blocks-line-num blocks-line-aux";
      const catchType = document.createElement("div");
      catchType.className = "blocks-line-type blocks-line-aux";
      catchType.textContent = `capturar (${bloque.placeholders.variable || "e"})`;
      const catchMain = document.createElement("div");
      catchMain.className = "blocks-line-main blocks-line-aux";
      catchMain.style.setProperty("--block-depth", String(rowCtx.indent + 1));
      container.append(catchNum, catchType, catchMain);
      if (!bloque.hijos_catch) bloque.hijos_catch = [];
      renderChildSlot(bloque, "hijos_catch", lineCounter, rowCtx, container);
    }
  }

  /**
   * @param {Bloque} bloque
   * @param {'hijos'|'hijos_else'|'hijos_catch'} slot
   * @param {{ n: number }} lineCounter
   * @param {BlockContext} rowCtx
   * @param {HTMLElement} container
   */
  function renderChildSlot(bloque, slot, lineCounter, rowCtx, container) {
    const list = bloque[slot] || (bloque[slot] = []);
    /** @type {BlockContext} */
    const listOwner = {
      list,
      index: rowCtx.index,
      bloque,
      slot,
      parent: rowCtx,
      indent: rowCtx.indent + 1,
    };
    renderBlockList(list, container, lineCounter, listOwner);
  }

  /**
   * @param {Bloque} bloque
   * @param {Bloque[]} parentList
   * @param {number} index
   */
  function renderBlockCard(bloque, parentList, index) {
    const schema = BLOCK_SCHEMAS[bloque.tipo];
    const editable = isBlockEditable(bloque);
    const card = document.createElement("article");
    card.className = `woven-block block-${schema?.color || "let"}${
      editable ? "" : " block-exercise-locked"
    }`;
    card.dataset.blockId = bloque.id;

    const notch = document.createElement("div");
    notch.className = "block-notch";
    card.appendChild(notch);

    if (editable) {
      card.classList.add("block-draggable");
      card.title = "Arrastrar para mover (incluye bloques anidados)";
      card.addEventListener("mousedown", (e) => {
        onBlockPointerDown(bloque, parentList, index, card, e);
      });
    } else {
      card.title = "Línea bloqueada en este ejercicio";
    }

    const body = document.createElement("div");
    body.className = "block-body";

    const inline = document.createElement("div");
    inline.className = "block-inline";
    const parts =
      viewMode === "code"
        ? inlinePartsFor(bloque.tipo, bloque.texto)
        : verboseInlineParts(bloque.texto);
    const fieldByKey = Object.fromEntries((schema?.fields || []).map((f) => [f.key, f]));

    for (const part of parts) {
      if (part.kind === "text") {
        const span = document.createElement("span");
        span.className = "block-inline-text";
        span.textContent = part.value;
        inline.appendChild(span);
      } else {
        const resolvedKey = fieldKeyForVerbosePlaceholder(part.key);
        const field = fieldByKey[resolvedKey];
        if (field && viewMode === "verbose" && isLegibleTypePlaceholder(part.key)) {
          inline.appendChild(renderLegibleTypeField(bloque, field, editable));
        } else if (field) {
          inline.appendChild(renderInlineField(bloque, field, editable));
        } else {
          const span = document.createElement("span");
          span.className = "block-inline-readonly";
          span.textContent = bloque.placeholders[part.key] ?? "";
          inline.appendChild(span);
        }
      }
    }
    body.appendChild(inline);

    if (editable) {
      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "block-act-btn";
      delBtn.title = "Eliminar bloque";
      delBtn.textContent = "✕";
      delBtn.addEventListener("mousedown", (e) => e.stopPropagation());
      delBtn.addEventListener("click", () => {
        parentList.splice(index, 1);
        render();
        notify();
      });
      body.appendChild(delBtn);
    }

    card.appendChild(body);
    return card;
  }

  /**
   * Select de tipo con etiquetas en español (modo verboso).
   * @param {Bloque} bloque
   * @param {{ key: string, label: string, kind: string, options?: string[] }} field
   */
  function renderLegibleTypeField(bloque, field, editable = true) {
    const wrap = document.createElement("span");
    wrap.className = "block-inline-field";
    wrap.title = editable ? field.label : "Campo bloqueado en este ejercicio";
    const p = bloque.placeholders;
    const options = field.options || WOVEN_TYPES;

    const input = document.createElement("select");
    input.className = "block-inline-input block-inline-select block-inline-select-legible";
    input.disabled = !editable;
    for (const t of options) {
      const opt = document.createElement("option");
      opt.value = t;
      opt.textContent = TIPO_LEGIBLE[t] || t;
      input.appendChild(opt);
    }
    input.value = p[field.key] || "int";
    input.addEventListener("change", () => {
      p[field.key] = input.value;
      syncLegibleTypes(p);
      notify();
    });
    wrap.addEventListener("mousedown", (e) => e.stopPropagation());
    wrap.appendChild(input);
    return wrap;
  }

  /**
   * @param {Bloque} bloque
   * @param {{ key: string, label: string, kind: string, options?: string[] }} field
   */
  function renderInlineField(bloque, field, editable = true) {
    const wrap = document.createElement("span");
    wrap.className = "block-inline-field";
    wrap.title = editable ? field.label : "Campo bloqueado en este ejercicio";
    wrap.addEventListener("mousedown", (e) => e.stopPropagation());
    const p = bloque.placeholders;

    if (field.kind === "type") {
      const input = document.createElement("select");
      input.className = "block-inline-input block-inline-select";
      input.disabled = !editable;
      for (const t of field.options || ["int", "float", "string", "bool", "void"]) {
        const opt = document.createElement("option");
        opt.value = t;
        opt.textContent = t;
        input.appendChild(opt);
      }
      input.value = p[field.key] || "int";
      input.addEventListener("change", () => {
        p[field.key] = input.value;
        syncDerivedTypes(p);
        notify();
      });
      wrap.appendChild(input);
    } else if (field.kind === "bool") {
      const input = document.createElement("input");
      input.type = "checkbox";
      input.className = "block-inline-check";
      input.disabled = !editable;
      input.checked = p[field.key] === "true";
      input.title = field.label;
      input.addEventListener("change", () => {
        p[field.key] = input.checked ? "true" : "false";
        notify();
      });
      wrap.appendChild(input);
    } else {
      const input = document.createElement("input");
      input.type = "text";
      input.className = "block-inline-input";
      input.readOnly = !editable;
      input.value = p[field.key] ?? "";
      input.placeholder = field.label;
      input.size = Math.max(3, Math.min(24, (input.value.length || 3) + 1));
      input.addEventListener("input", () => {
        p[field.key] = input.value;
        input.size = Math.max(3, Math.min(24, input.value.length + 1));
        notify();
      });
      wrap.appendChild(input);
    }

    return wrap;
  }

  /**
   * @param {Record<string, string>} p
   */
  function syncDerivedTypes(p) {
    syncLegibleTypes(p);
  }

  documentEl.addEventListener("dragover", (e) => {
    const dt = e.dataTransfer;
    if (!dragActive || !dt || moveDrag) return;
    if (!dt.types.includes("application/x-woven-block")) return;
    e.preventDefault();
    dt.dropEffect = "copy";
  });

  documentEl.addEventListener("drop", (e) => {
    if (isExerciseLockActive()) return;
    if (moveDrag || e.target.closest(".block-drop-gap")) return;
    if (!e.target.closest("[data-drop-zone='root']")) return;
    e.preventDefault();
    const tipo = e.dataTransfer?.getData("application/x-woven-block");
    if (!tipo) return;
    bloques.push(createBlock(tipo));
    setDragActive(false);
    render();
    notify();
  });

  document.addEventListener("dragend", () => {
    if (!moveDrag) setDragActive(false);
  });

  renderPalette();

  return {
    setDocument,
    getDocument,
    setViewMode,
    getProgramSummary,
    getBlockLineCount,
    render,
    highlightByWovenLine,
    clearStepHighlight,
    findDisplayLineForWovenLine,
    setExerciseEditableLines,
    clearExerciseEditableLines,
  };
}
