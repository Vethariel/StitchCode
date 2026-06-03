import assert from "node:assert/strict";
import test from "node:test";
import {
  buildStructureGraph,
  buildStructureGraphForStep,
  collectClassNames,
  detectTopology,
  isStructureVariable,
} from "../assets/js/structure-graph.js";

test("buildStructureGraph enlaza referencias compartidas", () => {
  const heap = {
    o1: {
      kind: "object",
      id: "o1",
      class: "Nodo",
      fields: { valor: 1, siguiente: { kind: "ref", id: "o2" } },
    },
    o2: {
      kind: "object",
      id: "o2",
      class: "Nodo",
      fields: { valor: 2, siguiente: null },
    },
  };
  const scope = {
    a: { tipo: "Nodo", valor: heap.o1 },
    b: { tipo: "Nodo", valor: { kind: "ref", id: "o1" } },
  };
  const classNames = new Set(["Nodo"]);
  const graph = buildStructureGraph(scope, heap, classNames);

  assert.equal(graph.empty, false);
  assert.ok(graph.nodes.some((n) => n.id === "var:a"));
  assert.ok(graph.nodes.some((n) => n.id === "o1"));
  assert.ok(graph.nodes.some((n) => n.id === "o2"));
  const sigEdge = graph.edges.find(
    (e) => e.from === "o1" && e.to === "o2" && e.label === "siguiente"
  );
  assert.ok(sigEdge);
  const aliasEdge = graph.edges.find((e) => e.from === "var:b" && e.to === "o1");
  assert.ok(aliasEdge);
  assert.equal(graph.topology, "linked-list");
  const o1 = graph.nodes.find((n) => n.id === "o1");
  assert.equal(o1?.shape, "circle");
  assert.equal(o1?.primitives?.valor, "1");
  assert.equal(o1?.label, "1");
  assert.ok(!graph.edges.some((e) => e.from === "o1" && e.label === "valor"));
  assert.ok(!graph.nodes.some((n) => n.kind === "null"));
  const o2 = graph.nodes.find((n) => n.id === "o2");
  assert.ok(o2 && o1 && o2.x > o1.x);
});

test("buildStructureGraph lista con elementos", () => {
  const heap = {
    l1: { kind: "list", id: "l1", items: [10, 20] },
  };
  const scope = {
    nums: { tipo: "list<int>", valor: heap.l1 },
    x: { tipo: "int", valor: 5 },
  };
  const graph = buildStructureGraph(scope, heap, new Set());
  assert.ok(graph.nodes.some((n) => n.kind === "list"));
  assert.equal(graph.topology, "array");
  const lista = graph.nodes.find((n) => n.kind === "list");
  assert.equal(lista?.shape, "cells");
  assert.deepEqual(lista?.listItems, ["10", "20"]);
  assert.ok(lista.x >= 0);
  assert.equal(isStructureVariable("int", 5, new Set()), false);
});

test("detectTopology distingue arbol y grafo", () => {
  const chainNodes = [
    { id: "o1", kind: "object" },
    { id: "o2", kind: "object" },
  ];
  const chainEdges = [
    { id: "e1", from: "o1", to: "o2", label: "siguiente", kind: "field" },
  ];
  assert.equal(detectTopology(chainNodes, chainEdges), "linked-list");

  const treeEdges = [
    { id: "e1", from: "o1", to: "o2", label: "izq", kind: "field" },
    { id: "e2", from: "o1", to: "o3", label: "der", kind: "field" },
  ];
  const treeNodes = [
    { id: "o1", kind: "object" },
    { id: "o2", kind: "object" },
    { id: "o3", kind: "object" },
  ];
  assert.equal(detectTopology(treeNodes, treeEdges), "tree");

  const cycleEdges = [
    { id: "e1", from: "o1", to: "o2", label: "a", kind: "field" },
    { id: "e2", from: "o2", to: "o1", label: "b", kind: "field" },
  ];
  assert.equal(detectTopology(treeNodes, cycleEdges), "graph");
});

test("buildStructureGraphForStep usa scope del paso", () => {
  const trace = {
    exito: true,
    total_pasos: 2,
    heap: {
      o1: {
        kind: "object",
        id: "o1",
        class: "Punto",
        fields: { x: 1, y: 2 },
      },
    },
    eventos: [
      {
        paso: 0,
        tipo: "variable",
        nombre: "p",
        scope: { p: { tipo: "Punto", valor: { kind: "object", id: "o1", class: "Punto", fields: { x: 1, y: 2 } } } },
      },
      {
        paso: 1,
        tipo: "linea",
        linea: 2,
        scope: { p: { tipo: "Punto", valor: { kind: "ref", id: "o1" } } },
      },
    ],
  };
  const g0 = buildStructureGraphForStep(trace, 0);
  assert.ok(g0.nodes.some((n) => n.id === "o1"));
  const g1 = buildStructureGraphForStep(trace, 1);
  assert.ok(g1.edges.some((e) => e.to === "o1"));
});

test("collectClassNames desde eventos clase", () => {
  const names = collectClassNames({
    eventos: [{ tipo: "clase", nombre: "Animal" }, { tipo: "linea", linea: 1 }],
  });
  assert.deepEqual([...names], ["Animal"]);
});
