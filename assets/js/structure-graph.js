/** @typedef {import("./step-trace.js").WovenTrace} WovenTrace */

/** @typedef {'rect' | 'circle' | 'cells'} NodeShape */

/** @typedef {{
 *   id: string,
 *   kind: 'variable' | 'object' | 'list' | 'null',
 *   label: string,
 *   className?: string,
 *   primitives?: Record<string, string>,
 *   listItems?: string[],
 *   itemCount?: number,
 *   shape: NodeShape,
 *   x: number,
 *   y: number,
 *   w: number,
 *   h: number,
 *   cx?: number,
 *   cy?: number,
 *   r?: number,
 * }} StructureGraphNode */

/** @typedef {{
 *   id: string,
 *   from: string,
 *   to: string,
 *   label: string,
 *   kind: 'variable' | 'field' | 'index',
 * }} StructureGraphEdge */

/** @typedef {'linked-list' | 'tree' | 'graph' | 'array'} LayoutTopology */

/** @typedef {{
 *   nodes: StructureGraphNode[],
 *   edges: StructureGraphEdge[],
 *   empty: boolean,
 *   emptyReason?: string,
 *   topology?: LayoutTopology,
 * }} StructureGraph */

const PRIMITIVES = new Set([
  "int",
  "float",
  "string",
  "bool",
  "void",
  "null",
  "any",
  "desconocido",
]);

const OBJ_R = 34;
const VAR_W = 72;
const VAR_H = 30;
const VAR_STACK_GAP = 10;
const LIST_CELL_W = 44;
const LIST_CELL_H = 36;
const LIST_CELL_GAP = 4;
const CHAIN_GAP = 72;
const ROW_GAP = 56;
const MARGIN = 28;
const LABEL_MAX = 10;

/**
 * @param {WovenTrace | null | undefined} trace
 * @returns {Set<string>}
 */
export function collectClassNames(trace) {
  const names = new Set();
  for (const e of trace?.eventos ?? []) {
    if (e.tipo === "clase" && e.nombre) names.add(String(e.nombre));
  }
  return names;
}

/**
 * @param {string} tipo
 * @param {Set<string>} classNames
 */
export function isStructureType(tipo, classNames) {
  if (!tipo || typeof tipo !== "string") return false;
  if (tipo.startsWith("list<") || tipo === "list" || tipo === "list<any>") {
    return true;
  }
  if (PRIMITIVES.has(tipo)) return false;
  if (classNames.has(tipo)) return true;
  return /^[A-Z]/.test(tipo);
}

/**
 * @param {string} tipo
 * @param {unknown} valor
 * @param {Set<string>} classNames
 */
export function isStructureVariable(tipo, valor, classNames) {
  if (isStructureType(tipo, classNames)) return true;
  if (!valor || typeof valor !== "object") return false;
  const v = /** @type {{ kind?: string, clase?: string }} */ (valor);
  if (v.kind === "object" || v.kind === "list" || v.kind === "ref") return true;
  if ("clase" in v && v.clase) return true;
  return Array.isArray(valor);
}

/**
 * @param {unknown} val
 * @param {Record<string, unknown>} heap
 * @returns {unknown}
 */
function resolveVal(val, heap) {
  if (!val || typeof val !== "object") return val;
  const node = /** @type {{ kind?: string, id?: string }} */ (val);
  if (node.kind === "ref" && node.id && heap[node.id]) {
    return heap[node.id];
  }
  return val;
}

/**
 * @param {unknown} val
 * @param {Record<string, unknown>} heap
 */
function isObjectRef(val, heap) {
  const r = resolveVal(val, heap);
  if (!r || typeof r !== "object") return false;
  const o = /** @type {{ kind?: string, clase?: string }} */ (r);
  return o.kind === "object" || Boolean(o.clase);
}

/**
 * @param {unknown} val
 */
function formatPrimitive(val) {
  if (val == null) return null;
  if (typeof val === "object") {
    const o = /** @type {{ kind?: string }} */ (val);
    if (o.kind === "ref" || o.kind === "object" || o.kind === "list") return null;
  }
  if (typeof val === "string") return val.length > LABEL_MAX ? `${val.slice(0, LABEL_MAX)}…` : val;
  return String(val);
}

/**
 * @param {string} s
 */
function truncate(s) {
  if (s.length <= LABEL_MAX) return s;
  return `${s.slice(0, LABEL_MAX - 1)}…`;
}

/**
 * @param {string} className
 * @param {Record<string, string>} primitives
 */
function objectDisplayLines(className, primitives) {
  const keys = Object.keys(primitives);
  if (!keys.length) return { value: truncate(className), caption: "" };
  if (keys.length === 1) {
    const k = keys[0];
    const v = primitives[k];
    if (k === "valor" || k === "value" || k === "dato") {
      return { value: truncate(v), caption: className };
    }
    return { value: truncate(v), caption: `${className} · ${k}` };
  }
  const value = keys
    .slice(0, 2)
    .map((k) => `${k}:${primitives[k]}`)
    .join(" ");
  return { value: truncate(value), caption: className };
}

/**
 * @param {StructureGraphNode[]} nodes
 * @param {StructureGraphEdge[]} edges
 * @returns {LayoutTopology}
 */
export function detectTopology(nodes, edges) {
  const objectIds = new Set(
    nodes.filter((n) => n.kind === "object").map((n) => n.id)
  );
  if (!objectIds.size) {
    if (nodes.some((n) => n.kind === "list")) return "array";
    return "graph";
  }

  /** @type {Map<string, string[]>} */
  const out = new Map();
  /** @type {Map<string, number>} */
  const inDeg = new Map();
  for (const id of objectIds) inDeg.set(id, 0);

  for (const e of edges) {
    if (e.kind !== "field") continue;
    if (!objectIds.has(e.from) || !objectIds.has(e.to)) continue;
    if (!out.has(e.from)) out.set(e.from, []);
    out.get(e.from).push(e.to);
    inDeg.set(e.to, (inDeg.get(e.to) ?? 0) + 1);
  }

  let maxOut = 0;
  let maxIn = 0;
  for (const id of objectIds) {
    maxOut = Math.max(maxOut, (out.get(id) ?? []).length);
    maxIn = Math.max(maxIn, inDeg.get(id) ?? 0);
  }

  if (hasObjectCycle(objectIds, out)) return "graph";
  if (maxOut <= 1 && maxIn <= 1) return "linked-list";
  if (maxIn <= 1) return "tree";
  return "graph";
}

/**
 * @param {Set<string>} objectIds
 * @param {Map<string, string[]>} out
 */
function hasObjectCycle(objectIds, out) {
  const state = new Map();
  for (const id of objectIds) state.set(id, 0);

  /** @param {string} id */
  function dfs(id) {
    const s = state.get(id) ?? 0;
    if (s === 1) return true;
    if (s === 2) return false;
    state.set(id, 1);
    for (const next of out.get(id) ?? []) {
      if (objectIds.has(next) && dfs(next)) return true;
    }
    state.set(id, 2);
    return false;
  }

  for (const id of objectIds) {
    if (dfs(id)) return true;
  }
  return false;
}

/**
 * @param {Record<string, { valor: unknown, tipo: string }>} scope
 * @param {Record<string, unknown>} heap
 * @param {Set<string>} classNames
 * @returns {StructureGraph}
 */
export function buildStructureGraph(scope, heap, classNames) {
  /** @type {StructureGraphNode[]} */
  const nodes = [];
  /** @type {StructureGraphEdge[]} */
  const edges = [];
  /** @type {Map<string, StructureGraphNode>} */
  const nodeById = new Map();
  let edgeSeq = 0;

  /** @param {StructureGraphNode} node */
  function addNode(node) {
    if (nodeById.has(node.id)) return;
    nodeById.set(node.id, node);
    nodes.push(node);
  }

  /** @param {string} from @param {string} to @param {string} label @param {StructureGraphEdge['kind']} kind */
  function addEdge(from, to, label, kind) {
    if (from === to) return;
    edges.push({ id: `e${edgeSeq++}`, from, to, label, kind });
  }

  /**
   * @param {unknown} val
   * @param {string} fromId
   * @param {string} label
   * @param {StructureGraphEdge['kind']} edgeKind
   */
  function walkRef(val, fromId, label, edgeKind) {
    const resolved = resolveVal(val, heap);
    if (resolved == null) return;

    if (typeof resolved !== "object") return;

    const obj = /** @type {{
     *   kind?: string, id?: string, class?: string, clase?: string,
     *   fields?: Record<string, unknown>, campos?: Record<string, unknown>, items?: unknown[],
     * }} */ (resolved);

    if (obj.kind === "object" || (obj.clase && obj.campos)) {
      const oid = obj.id ?? `obj:${fromId}:${label}`;
      if (nodeById.has(oid)) {
        addEdge(fromId, oid, label, edgeKind);
        return;
      }
      const className = obj.class ?? obj.clase ?? "objeto";
      const fields = obj.fields ?? obj.campos ?? {};
      /** @type {Record<string, string>} */
      const primitives = {};
      for (const [fname, fval] of Object.entries(fields)) {
        if (isObjectRef(fval, heap)) {
          walkRef(fval, oid, fname, "field");
        } else {
          const text = formatPrimitive(resolveVal(fval, heap));
          if (text != null) primitives[fname] = text;
        }
      }
      const { value, caption } = objectDisplayLines(className, primitives);
      const r = OBJ_R;
      addNode({
        id: oid,
        kind: "object",
        label: value,
        className: caption || className,
        primitives,
        shape: "circle",
        x: 0,
        y: 0,
        w: r * 2,
        h: r * 2 + 18,
        r,
      });
      addEdge(fromId, oid, label, edgeKind);
      return;
    }

    if (obj.kind === "list" || Array.isArray(resolved)) {
      const lid = obj.id ?? `list:${fromId}:${label}`;
      if (nodeById.has(lid)) {
        addEdge(fromId, lid, label, edgeKind);
        return;
      }
      const items = obj.items ?? (Array.isArray(resolved) ? resolved : []);
      const listItems = items.map((item) => {
        if (isObjectRef(item, heap)) return null;
        return formatPrimitive(resolveVal(item, heap)) ?? "·";
      });
      const cellCount = Math.max(1, listItems.length);
      const w = cellCount * LIST_CELL_W + (cellCount - 1) * LIST_CELL_GAP;
      addNode({
        id: lid,
        kind: "list",
        label: "",
        listItems,
        itemCount: items.length,
        shape: "cells",
        x: 0,
        y: 0,
        w,
        h: LIST_CELL_H,
      });
      addEdge(fromId, lid, label, edgeKind);
      items.forEach((item, i) => {
        if (isObjectRef(item, heap)) walkRef(item, lid, `[${i}]`, "index");
      });
      return;
    }

    if (obj.kind === "ref" && obj.id) {
      walkRef(heap[obj.id] ?? obj, fromId, label, edgeKind);
    }
  }

  const structureVars = Object.entries(scope ?? {}).filter(([, info]) =>
    isStructureVariable(info.tipo, info.valor, classNames)
  );

  if (!structureVars.length) {
    return {
      nodes: [],
      edges: [],
      empty: true,
      emptyReason:
        "No hay variables de tipo lista u objeto en este paso. Declara una clase o list<…> para ver el grafo.",
    };
  }

  for (const [name, info] of structureVars) {
    const vid = `var:${name}`;
    addNode({
      id: vid,
      kind: "variable",
      label: name,
      shape: "rect",
      x: 0,
      y: 0,
      w: VAR_W,
      h: VAR_H,
    });
    walkRef(info.valor, vid, name, "variable");
  }

  const topology = detectTopology(nodes, edges);
  layoutStructureGraph(nodes, edges, topology);

  return { nodes, edges, empty: false, topology };
}

/**
 * @param {StructureGraphNode[]} nodes
 * @param {StructureGraphEdge[]} edges
 */
function findLayoutRows(nodes, edges) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const adj = new Map();
  for (const n of nodes) adj.set(n.id, new Set());
  for (const e of edges) {
    adj.get(e.from)?.add(e.to);
    adj.get(e.to)?.add(e.from);
  }

  const visited = new Set();
  /** @type {string[][]} */
  const groups = [];

  for (const n of nodes) {
    if (visited.has(n.id)) continue;
    /** @type {string[]} */
    const group = [];
    const stack = [n.id];
    visited.add(n.id);
    while (stack.length) {
      const id = stack.pop();
      group.push(id);
      for (const next of adj.get(id) ?? []) {
        if (!visited.has(next)) {
          visited.add(next);
          stack.push(next);
        }
      }
    }
    groups.push(group);
  }

  return groups.map((ids) => ({
    ids,
    nodes: ids.map((id) => byId.get(id)).filter(Boolean),
    edges: edges.filter((e) => ids.includes(e.from) && ids.includes(e.to)),
  }));
}

/**
 * @param {StructureGraphNode[]} nodes
 * @param {StructureGraphEdge[]} edges
 * @param {LayoutTopology} topology
 */
function layoutStructureGraph(nodes, edges, topology) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const rows = findLayoutRows(nodes, edges);
  let y = MARGIN;

  for (const row of rows) {
    const rowTopo = detectTopology(row.nodes, row.edges);
    const h = layoutRow(row.nodes, row.edges, rowTopo, byId, MARGIN, y);
    y += h + ROW_GAP;
  }
}

/**
 * @param {StructureGraphNode[]} nodes
 * @param {StructureGraphEdge[]} edges
 * @param {LayoutTopology} topology
 * @param {Map<string, StructureGraphNode>} byId
 * @param {number} startX
 * @param {number} startY
 * @returns {number}
 */
function layoutRow(nodes, edges, topology, byId, startX, startY) {
  const varNodes = nodes.filter((n) => n.kind === "variable");
  const objectNodes = nodes.filter((n) => n.kind === "object");
  const listNodes = nodes.filter((n) => n.kind === "list");

  const chainY = startY + OBJ_R;

  if (topology === "linked-list" && objectNodes.length) {
    const chains = buildObjectChains(
      objectNodes.map((n) => n.id),
      edges
    );
    const chainStartX = startX + VAR_W + 36;
    let maxChainX = chainStartX;

    for (const chain of chains) {
      let x = chainStartX;
      for (const id of chain) {
        const n = byId.get(id);
        if (!n) continue;
        n.x = x;
        n.y = chainY - OBJ_R;
        n.cx = x + OBJ_R;
        n.cy = chainY;
        x += OBJ_R * 2 + CHAIN_GAP;
      }
      maxChainX = Math.max(maxChainX, x);
    }

    layoutVariablesBesideChain(varNodes, edges, byId, startX, chainY);
    let listY = chainY + OBJ_R + 36;
    let lx = startX;
    for (const n of listNodes) {
      n.x = lx;
      n.y = listY;
      lx += n.w + 40;
    }
    return Math.max(listY + LIST_CELL_H, chainY + OBJ_R + 20) - startY;
  }

  if (topology === "array" && listNodes.length) {
    let x = startX + VAR_W + 28;
    const midY = startY + LIST_CELL_H / 2;
    for (const n of listNodes) {
      n.x = x;
      n.y = startY;
      x += n.w + 32;
    }
    layoutVariablesBesideChain(varNodes, edges, byId, startX, midY);
    return LIST_CELL_H + 16;
  }

  if (topology === "tree" && objectNodes.length) {
    layoutTreeObjects(objectNodes, edges, byId, startX + VAR_W + 20, startY);
    const treeBottom =
      startY + countTreeHeight(objectNodes, edges) * (OBJ_R * 2 + 40);
    layoutVariablesBesideChain(varNodes, edges, byId, startX, startY + OBJ_R);
    return treeBottom - startY;
  }

  layoutLayeredGraph(nodes, edges, byId, startX, startY);
  layoutVariablesBesideChain(varNodes, edges, byId, startX, startY + OBJ_R);
  const maxY = Math.max(...nodes.map((n) => n.y + n.h), startY);
  return maxY - startY + 16;
}

/**
 * @param {StructureGraphNode[]} varNodes
 * @param {StructureGraphEdge[]} edges
 * @param {Map<string, StructureGraphNode>} byId
 * @param {number} colX
 * @param {number} defaultCy
 */
function layoutVariablesBesideChain(varNodes, edges, byId, colX, defaultCy) {
  /** @type {Map<string, StructureGraphNode[]>} */
  const byTarget = new Map();

  for (const v of varNodes) {
    const edge = edges.find((e) => e.from === v.id);
    const targetId = edge?.to ?? "_none";
    if (!byTarget.has(targetId)) byTarget.set(targetId, []);
    byTarget.get(targetId).push(v);
  }

  for (const [targetId, vars] of byTarget) {
    const target = targetId !== "_none" ? byId.get(targetId) : null;
    const cy = target?.cy ?? defaultCy;
    const blockH = vars.length * VAR_H + (vars.length - 1) * VAR_STACK_GAP;
    let y = cy - blockH / 2;
    for (const v of vars) {
      v.x = colX;
      v.y = y;
      y += VAR_H + VAR_STACK_GAP;
    }
  }
}

/**
 * @param {string[]} objectIds
 * @param {StructureGraphEdge[]} edges
 * @returns {string[][]}
 */
function buildObjectChains(objectIds, edges) {
  const idSet = new Set(objectIds);
  /** @type {Map<string, string>} */
  const next = new Map();
  const hasIn = new Set();

  for (const e of edges) {
    if (e.kind !== "field" || !idSet.has(e.from) || !idSet.has(e.to)) continue;
    if (!next.has(e.from)) next.set(e.from, e.to);
    hasIn.add(e.to);
  }

  const heads = objectIds.filter((id) => !hasIn.has(id));
  const startIds = heads.length ? heads : objectIds;
  /** @type {string[][]} */
  const chains = [];
  const used = new Set();

  for (const head of startIds) {
    if (used.has(head)) continue;
    /** @type {string[]} */
    const chain = [];
    let cur = head;
    while (cur && idSet.has(cur) && !used.has(cur)) {
      used.add(cur);
      chain.push(cur);
      cur = next.get(cur);
      if (cur && chain.includes(cur)) break;
    }
    if (chain.length) chains.push(chain);
  }

  for (const id of objectIds) {
    if (!used.has(id)) chains.push([id]);
  }
  return chains;
}

/**
 * @param {StructureGraphNode[]} objectNodes
 * @param {StructureGraphEdge[]} edges
 * @param {Map<string, StructureGraphNode>} byId
 * @param {number} startX
 * @param {number} startY
 */
function layoutTreeObjects(objectNodes, edges, byId, startX, startY) {
  const idSet = new Set(objectNodes.map((n) => n.id));
  /** @type {Map<string, string[]>} */
  const children = new Map();
  const hasIn = new Set();

  for (const e of edges) {
    if (e.kind !== "field" || !idSet.has(e.from) || !idSet.has(e.to)) continue;
    if (!children.has(e.from)) children.set(e.from, []);
    children.get(e.from).push(e.to);
    hasIn.add(e.to);
  }

  const roots = objectNodes.map((n) => n.id).filter((id) => !hasIn.has(id));
  const rootIds = roots.length ? roots : [objectNodes[0].id];
  /** @type {Map<string, number>} */
  const width = new Map();

  /** @param {string} id */
  function subtreeWidth(id) {
    if (width.has(id)) return width.get(id);
    const kids = children.get(id) ?? [];
    const w = kids.length === 0 ? 1 : kids.reduce((s, k) => s + subtreeWidth(k), 0);
    width.set(id, w);
    return w;
  }

  for (const r of rootIds) subtreeWidth(r);

  const slotW = OBJ_R * 2 + 28;
  let xCursor = 0;

  /** @param {string} id @param {number} depth @param {number} leftSlot */
  function place(id, depth, leftSlot) {
    const n = byId.get(id);
    const w = width.get(id) ?? 1;
    const centerSlot = leftSlot + w / 2;
    if (n) {
      const px = startX + centerSlot * slotW - OBJ_R;
      const py = startY + depth * (OBJ_R * 2 + 36);
      n.x = px;
      n.y = py;
      n.cx = px + OBJ_R;
      n.cy = py + OBJ_R;
    }
    let childLeft = leftSlot;
    for (const kid of children.get(id) ?? []) {
      place(kid, depth + 1, childLeft);
      childLeft += width.get(kid) ?? 1;
    }
  }

  for (const r of rootIds) {
    place(r, 0, xCursor);
    xCursor += (width.get(r) ?? 1) * slotW + 24;
  }
}

/**
 * @param {StructureGraphNode[]} objectNodes
 * @param {StructureGraphEdge[]} edges
 */
function countTreeHeight(objectNodes, edges) {
  const idSet = new Set(objectNodes.map((n) => n.id));
  /** @type {Map<string, string[]>} */
  const children = new Map();
  for (const e of edges) {
    if (e.kind !== "field" || !idSet.has(e.from) || !idSet.has(e.to)) continue;
    if (!children.has(e.from)) children.set(e.from, []);
    children.get(e.from).push(e.to);
  }
  let maxD = 1;
  /** @param {string} id @param {number} d */
  function dfs(id, d) {
    maxD = Math.max(maxD, d + 1);
    for (const k of children.get(id) ?? []) dfs(k, d + 1);
  }
  for (const n of objectNodes) dfs(n.id, 0);
  return maxD;
}

/**
 * @param {StructureGraphNode[]} nodes
 * @param {StructureGraphEdge[]} edges
 * @param {Map<string, StructureGraphNode>} byId
 * @param {number} startX
 * @param {number} startY
 */
function layoutLayeredGraph(nodes, edges, byId, startX, startY) {
  const children = new Map();
  const incoming = new Set();
  for (const e of edges) {
    incoming.add(e.to);
    if (!children.has(e.from)) children.set(e.from, []);
    children.get(e.from).push(e.to);
  }

  const roots = nodes
    .filter((n) => n.kind === "variable" || !incoming.has(n.id))
    .map((n) => n.id);

  const levels = new Map();
  const queue = roots.map((id) => ({ id, depth: 0 }));
  const seen = new Set();

  while (queue.length) {
    const { id, depth } = queue.shift();
    if (seen.has(id)) continue;
    seen.add(id);
    if (!levels.has(depth)) levels.set(depth, []);
    levels.get(depth).push(id);
    for (const childId of children.get(id) ?? []) {
      if (!seen.has(childId)) queue.push({ id: childId, depth: depth + 1 });
    }
  }

  for (const n of nodes) {
    if (!seen.has(n.id)) {
      const d = levels.size;
      if (!levels.has(d)) levels.set(d, []);
      levels.get(d).push(n.id);
    }
  }

  const x0 = startX + VAR_W + 24;
  const yGap = OBJ_R * 2 + 48;
  for (let d = 0; d < levels.size; d++) {
    const row = levels.get(d) ?? [];
    let x = x0;
    const y = startY + d * yGap;
    for (const id of row) {
      const n = byId.get(id);
      if (!n || n.kind === "variable") continue;
      n.x = x;
      n.y = y;
      if (n.shape === "circle" && n.r) {
        n.cx = x + n.r;
        n.cy = y + n.r;
      }
      x += n.w + 36;
    }
  }
}

/**
 * @param {WovenTrace} trace
 * @param {number} stepIndex
 */
export function buildStructureGraphForStep(trace, stepIndex) {
  const eventos = trace.eventos ?? [];
  const max = Math.max(0, eventos.length - 1);
  const idx = Math.min(Math.max(0, stepIndex), max);
  const classNames = collectClassNames(trace);

  /** @type {Record<string, { valor: unknown, tipo: string }>} */
  let scope = {};
  for (let i = 0; i <= idx; i++) {
    const e = eventos[i];
    if (!e) continue;
    if (e.tipo === "variable" && e.scope) scope = { ...e.scope };
    if (e.tipo === "llamada" && e.scope_previo) scope = { ...e.scope_previo };
    if (e.tipo === "retorno" && e.scope_final) scope = { ...e.scope_final };
    if (e.tipo === "error" && e.scope_al_fallar) scope = { ...e.scope_al_fallar };
  }

  const ev = eventos[idx];
  if (ev?.tipo === "variable" && ev.scope) scope = { ...ev.scope };
  if (ev?.tipo === "llamada" && ev.scope_previo) scope = { ...ev.scope_previo };
  if (ev?.tipo === "retorno" && ev.scope_final) scope = { ...ev.scope_final };
  if (ev?.tipo === "error" && ev.scope_al_fallar) scope = { ...ev.scope_al_fallar };

  return buildStructureGraph(scope, trace.heap ?? {}, classNames);
}

/**
 * @param {import("./step-trace.js").TraceEvent | null} event
 */
export function highlightHintsFromEvent(event) {
  const nodeIds = [];
  const varNames = [];
  if (!event) return { nodeIds, varNames };
  if (event.tipo === "variable" && event.nombre) {
    varNames.push(String(event.nombre));
    nodeIds.push(`var:${event.nombre}`);
    const v = event.valor;
    if (v && typeof v === "object" && "id" in v && v.id) {
      nodeIds.push(String(v.id));
    }
  }
  return { nodeIds, varNames };
}

/**
 * @param {StructureGraphNode} n
 * @param {'out' | 'in'} side
 * @param {boolean} horizontal
 */
function edgeAnchor(n, side, horizontal) {
  if (n.shape === "circle" && n.cx != null && n.cy != null && n.r) {
    if (horizontal) {
      if (side === "out") return { x: n.cx + n.r, y: n.cy };
      return { x: n.cx - n.r, y: n.cy };
    }
    if (side === "out") return { x: n.cx, y: n.cy + n.r };
    return { x: n.cx, y: n.cy - n.r };
  }
  if (n.shape === "cells") {
    if (horizontal) {
      if (side === "out") return { x: n.x + n.w, y: n.y + n.h / 2 };
      return { x: n.x, y: n.y + n.h / 2 };
    }
    if (side === "out") return { x: n.x + n.w / 2, y: n.y + n.h };
    return { x: n.x + n.w / 2, y: n.y };
  }
  if (horizontal) {
    if (side === "out") return { x: n.x + n.w, y: n.y + n.h / 2 };
    return { x: n.x, y: n.y + n.h / 2 };
  }
  if (side === "out") return { x: n.x + n.w / 2, y: n.y + n.h };
  return { x: n.x + n.w / 2, y: n.y };
}

/**
 * @param {StructureGraphEdge} e
 * @param {StructureGraphNode | undefined} from
 * @param {StructureGraphNode | undefined} to
 */
function shouldShowEdgeLabel(e, from, to) {
  return (
    e.kind === "field" &&
    from?.kind === "object" &&
    to?.kind === "object" &&
    Boolean(e.label)
  );
}

/**
 * @param {SVGElement} svg
 * @param {StructureGraph} graph
 * @param {{ highlightNodeIds?: string[] }} [opts]
 */
export function renderStructureGraph(svg, graph, opts = {}) {
  const highlight = new Set(opts.highlightNodeIds ?? []);
  while (svg.firstChild) svg.removeChild(svg.firstChild);

  if (graph.empty || !graph.nodes.length) {
    svg.setAttribute("viewBox", "0 0 400 80");
    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", "24");
    text.setAttribute("y", "44");
    text.setAttribute("class", "structure-graph-empty-text");
    text.textContent = graph.emptyReason ?? "Sin estructuras en este paso";
    svg.appendChild(text);
    return;
  }

  const pad = 24;
  let maxX = 0;
  let maxY = 0;
  for (const n of graph.nodes) {
    const bottom = n.shape === "circle" && n.cy != null && n.r
      ? n.cy + n.r + (n.className ? 16 : 0)
      : n.y + n.h;
    maxX = Math.max(maxX, n.x + n.w);
    maxY = Math.max(maxY, bottom);
  }

  svg.setAttribute(
    "viewBox",
    `${-pad} ${-pad} ${maxX + pad * 2} ${maxY + pad * 2}`
  );

  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const horiz =
    graph.topology === "linked-list" || graph.topology === "array";

  const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
  const marker = document.createElementNS("http://www.w3.org/2000/svg", "marker");
  marker.setAttribute("id", "structure-arrow");
  marker.setAttribute("markerWidth", "7");
  marker.setAttribute("markerHeight", "7");
  marker.setAttribute("refX", "5");
  marker.setAttribute("refY", "3");
  marker.setAttribute("orient", "auto");
  const arrowPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
  arrowPath.setAttribute("d", "M0,0 L5,3 L0,6 Z");
  arrowPath.setAttribute("fill", "rgba(120, 168, 220, 0.8)");
  marker.appendChild(arrowPath);
  defs.appendChild(marker);
  svg.appendChild(defs);

  const edgesG = document.createElementNS("http://www.w3.org/2000/svg", "g");
  edgesG.setAttribute("class", "structure-graph-edges");

  for (const e of graph.edges) {
    const from = byId.get(e.from);
    const to = byId.get(e.to);
    if (!from || !to) continue;

    const a1 = edgeAnchor(from, "out", horiz);
    const a2 = edgeAnchor(to, "in", horiz);

    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", String(a1.x));
    line.setAttribute("y1", String(a1.y));
    line.setAttribute("x2", String(a2.x));
    line.setAttribute("y2", String(a2.y));
    line.setAttribute("class", "structure-graph-edge");
    if (e.kind === "field") line.classList.add("structure-graph-edge--ref");
    line.setAttribute("marker-end", "url(#structure-arrow)");
    edgesG.appendChild(line);

    if (shouldShowEdgeLabel(e, from, to)) {
      const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
      label.setAttribute("x", String((a1.x + a2.x) / 2));
      label.setAttribute("y", String((a1.y + a2.y) / 2 - 5));
      label.setAttribute("class", "structure-graph-edge-label");
      label.setAttribute("text-anchor", "middle");
      label.textContent = e.label;
      edgesG.appendChild(label);
    }
  }
  svg.appendChild(edgesG);

  const nodesG = document.createElementNS("http://www.w3.org/2000/svg", "g");
  nodesG.setAttribute("class", "structure-graph-nodes");

  for (const n of graph.nodes) {
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute(
      "class",
      `structure-graph-node structure-graph-node--${n.kind}${
        highlight.has(n.id) ? " structure-graph-node--highlight" : ""
      }`
    );
    g.setAttribute("data-node-id", n.id);

    if (n.shape === "circle") {
      const cx = n.cx ?? n.x + (n.r ?? OBJ_R);
      const cy = n.cy ?? n.y + (n.r ?? OBJ_R);
      const r = n.r ?? OBJ_R;

      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle.setAttribute("cx", String(cx));
      circle.setAttribute("cy", String(cy));
      circle.setAttribute("r", String(r));
      g.appendChild(circle);

      const val = document.createElementNS("http://www.w3.org/2000/svg", "text");
      val.setAttribute("x", String(cx));
      val.setAttribute("y", String(cy + 4));
      val.setAttribute("text-anchor", "middle");
      val.setAttribute("class", "structure-graph-node-value");
      val.textContent = n.label;
      g.appendChild(val);

      if (n.className) {
        const cap = document.createElementNS("http://www.w3.org/2000/svg", "text");
        cap.setAttribute("x", String(cx));
        cap.setAttribute("y", String(cy + r + 14));
        cap.setAttribute("text-anchor", "middle");
        cap.setAttribute("class", "structure-graph-node-caption");
        cap.textContent = truncate(n.className);
        g.appendChild(cap);
      }
    } else if (n.shape === "cells") {
      const items = n.listItems?.length ? n.listItems : [null];
      items.forEach((cell, i) => {
        const rx = n.x + i * (LIST_CELL_W + LIST_CELL_GAP);
        const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        rect.setAttribute("x", String(rx));
        rect.setAttribute("y", String(n.y));
        rect.setAttribute("width", String(LIST_CELL_W));
        rect.setAttribute("height", String(LIST_CELL_H));
        rect.setAttribute("rx", "4");
        rect.setAttribute("class", "structure-graph-list-cell");
        g.appendChild(rect);

        if (i > 0) {
          const link = document.createElementNS("http://www.w3.org/2000/svg", "line");
          link.setAttribute("x1", String(rx - LIST_CELL_GAP));
          link.setAttribute("y1", String(n.y + LIST_CELL_H / 2));
          link.setAttribute("x2", String(rx));
          link.setAttribute("y2", String(n.y + LIST_CELL_H / 2));
          link.setAttribute("class", "structure-graph-list-link");
          g.appendChild(link);
        }

        const val = document.createElementNS("http://www.w3.org/2000/svg", "text");
        val.setAttribute("x", String(rx + LIST_CELL_W / 2));
        val.setAttribute("y", String(n.y + LIST_CELL_H / 2 + 4));
        val.setAttribute("text-anchor", "middle");
        val.setAttribute("class", "structure-graph-node-value");
        val.textContent = cell == null ? "·" : String(cell);
        g.appendChild(val);
      });
    } else {
      const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      rect.setAttribute("x", String(n.x));
      rect.setAttribute("y", String(n.y));
      rect.setAttribute("width", String(n.w));
      rect.setAttribute("height", String(n.h));
      rect.setAttribute("rx", n.kind === "variable" ? "8" : "6");
      g.appendChild(rect);

      const title = document.createElementNS("http://www.w3.org/2000/svg", "text");
      title.setAttribute("x", String(n.x + n.w / 2));
      title.setAttribute("y", String(n.y + n.h / 2 + 4));
      title.setAttribute("text-anchor", "middle");
      title.setAttribute("class", "structure-graph-node-value");
      title.textContent = n.label;
      g.appendChild(title);
    }

    nodesG.appendChild(g);
  }
  svg.appendChild(nodesG);
}
