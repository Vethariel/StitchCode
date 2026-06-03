/** @typedef {'type'|'identifier'|'expression'|'params'|'bool'} FieldKind */

/** @typedef {{ key: string, label: string, kind: FieldKind, options?: string[] }} FieldDef */

/** @typedef {{ tipo: string, label: string, category: string, color: string, fields: FieldDef[], defaults: Record<string, string>, slots?: string[], texto: string }} BlockSchema */

export const WOVEN_TYPES = ["int", "float", "string", "bool", "void"];

export const BLOCK_SCHEMAS = /** @type {Record<string, BlockSchema>} */ ({
  var_decl: {
    tipo: "var_decl",
    label: "Asignación",
    category: "Variables",
    color: "let",
    texto: "guardar el valor {valor} en una variable {tipo_legible} llamada {nombre}",
    fields: [
      { key: "tipo", label: "Tipo", kind: "type" },
      { key: "nombre", label: "Nombre", kind: "identifier" },
      { key: "valor", label: "Valor", kind: "expression" },
    ],
    defaults: { tipo: "int", nombre: "x", valor: "0", tipo_legible: "entero" },
  },
  list_decl: {
    tipo: "list_decl",
    label: "Lista",
    category: "Variables",
    color: "let",
    texto: "guardar una coleccion de objetos {tipo_elemento_legible} llamada {nombre}",
    fields: [
      { key: "tipo_elemento", label: "Tipo elemento", kind: "type" },
      { key: "nombre", label: "Nombre", kind: "identifier" },
    ],
    defaults: { tipo_elemento: "int", nombre: "items", tipo_elemento_legible: "entero" },
  },
  assignment: {
    tipo: "assignment",
    label: "Asignar",
    category: "Variables",
    color: "assign",
    texto: "actualizar {nombre} al resultado de {valor}",
    fields: [
      { key: "nombre", label: "Variable", kind: "identifier" },
      { key: "valor", label: "Expresión", kind: "expression" },
    ],
    defaults: { nombre: "x", valor: "0" },
  },
  print_stmt: {
    tipo: "print_stmt",
    label: "Imprimir",
    category: "Salida",
    color: "print",
    texto: "imprimir {valor}",
    fields: [{ key: "valor", label: "Valor", kind: "expression" }],
    defaults: { valor: "x" },
  },
  return_stmt: {
    tipo: "return_stmt",
    label: "Retornar",
    category: "Flujo",
    color: "return",
    texto: "el resultado es {valor}",
    fields: [{ key: "valor", label: "Valor", kind: "expression" }],
    defaults: { valor: "0" },
  },
  if_stmt: {
    tipo: "if_stmt",
    label: "Si",
    category: "Control",
    color: "for",
    texto: "si se cumple que {condicion}",
    slots: ["hijos", "hijos_else"],
    fields: [{ key: "condicion", label: "Condición", kind: "expression" }],
    defaults: { condicion: "true" },
  },
  while_stmt: {
    tipo: "while_stmt",
    label: "Mientras",
    category: "Control",
    color: "for",
    texto: "repetir mientras {condicion}",
    slots: ["hijos"],
    fields: [{ key: "condicion", label: "Condición", kind: "expression" }],
    defaults: { condicion: "true" },
  },
  for_stmt: {
    tipo: "for_stmt",
    label: "For",
    category: "Control",
    color: "for",
    texto: "repetir con {tipo_legible} {variable} comenzando en {inicio} hasta que {condicion}",
    slots: ["hijos"],
    fields: [
      { key: "tipo", label: "Tipo", kind: "type" },
      { key: "variable", label: "Variable", kind: "identifier" },
      { key: "inicio", label: "Inicio", kind: "expression" },
      { key: "condicion", label: "Condición", kind: "expression" },
      { key: "paso", label: "Paso", kind: "expression" },
    ],
    defaults: {
      tipo: "int",
      tipo_legible: "entero",
      variable: "i",
      inicio: "0",
      condicion: "i < 10",
      paso: "i = i + 1",
    },
  },
  function_decl: {
    tipo: "function_decl",
    label: "Función",
    category: "Estructuras",
    color: "fun",
    texto: "definir una funcion llamada {nombre} que recibe {params} y devuelve {retorno}",
    slots: ["hijos"],
    fields: [
      { key: "retorno_raw", label: "Retorno", kind: "type", options: [...WOVEN_TYPES] },
      { key: "nombre", label: "Nombre", kind: "identifier" },
      { key: "params_raw", label: "Parámetros", kind: "params" },
    ],
    defaults: {
      nombre: "miFuncion",
      params: "ningún parámetro",
      params_raw: "",
      retorno: "entero",
      retorno_raw: "int",
    },
  },
  class_decl: {
    tipo: "class_decl",
    label: "Clase",
    category: "Estructuras",
    color: "fun",
    texto: "la clase {nombre} es un tipo de objeto",
    slots: ["hijos"],
    fields: [
      { key: "nombre", label: "Nombre", kind: "identifier" },
      { key: "padre", label: "Hereda de (opcional)", kind: "identifier" },
    ],
    defaults: { nombre: "MiClase", padre: "", herencia: "" },
  },
  field_decl: {
    tipo: "field_decl",
    label: "Campo",
    category: "Clase",
    color: "let",
    texto: "esta clase tiene un campo {tipo_legible} llamado {nombre}",
    fields: [
      { key: "tipo", label: "Tipo", kind: "type" },
      { key: "nombre", label: "Nombre", kind: "identifier" },
    ],
    defaults: { tipo: "int", tipo_legible: "entero", nombre: "campo" },
  },
  constructor_decl: {
    tipo: "constructor_decl",
    label: "Constructor",
    category: "Clase",
    color: "fun",
    texto: "para crear un objeto de esta clase se necesita {params}",
    slots: ["hijos"],
    fields: [{ key: "params_raw", label: "Parámetros", kind: "params" }],
    defaults: { params: "ningún parámetro", params_raw: "" },
  },
  method_decl: {
    tipo: "method_decl",
    label: "Método",
    category: "Clase",
    color: "fun",
    texto: "esta clase puede {nombre} y devuelve {retorno}",
    slots: ["hijos"],
    fields: [
      { key: "virtual", label: "Virtual", kind: "bool" },
      { key: "retorno_raw", label: "Retorno", kind: "type", options: [...WOVEN_TYPES] },
      { key: "nombre", label: "Nombre", kind: "identifier" },
      { key: "params_raw", label: "Parámetros", kind: "params" },
    ],
    defaults: {
      virtual: "false",
      nombre: "metodo",
      params: "ningún parámetro",
      params_raw: "",
      retorno: "nada",
      retorno_raw: "void",
    },
  },
  try_stmt: {
    tipo: "try_stmt",
    label: "Try / Catch",
    category: "Control",
    color: "for",
    texto: "intentar ejecutar el bloque, si falla capturar el error en {variable}",
    slots: ["hijos", "hijos_catch"],
    fields: [{ key: "variable", label: "Variable error", kind: "identifier" }],
    defaults: { variable: "e" },
  },
  throw_stmt: {
    tipo: "throw_stmt",
    label: "Lanzar error",
    category: "Control",
    color: "return",
    texto: "lanzar el error {mensaje}",
    fields: [{ key: "mensaje", label: "Mensaje", kind: "expression" }],
    defaults: { mensaje: '"error"' },
  },
  break_stmt: {
    tipo: "break_stmt",
    label: "Break",
    category: "Flujo",
    color: "return",
    texto: "salir del ciclo inmediatamente",
    fields: [],
    defaults: {},
  },
  continue_stmt: {
    tipo: "continue_stmt",
    label: "Continue",
    category: "Flujo",
    color: "return",
    texto: "saltar al siguiente paso del ciclo",
    fields: [],
    defaults: {},
  },
  self_assignment: {
    tipo: "self_assignment",
    label: "self.campo =",
    category: "Clase",
    color: "assign",
    texto: "guardar {valor} en el campo {campo} de este objeto",
    fields: [
      { key: "campo", label: "Campo", kind: "identifier" },
      { key: "valor", label: "Valor", kind: "expression" },
    ],
    defaults: { campo: "x", valor: "0" },
  },
  index_assignment: {
    tipo: "index_assignment",
    label: "lista[i] =",
    category: "Variables",
    color: "assign",
    texto: "guardar {valor} en la posicion {indice} de {nombre}",
    fields: [
      { key: "nombre", label: "Lista", kind: "identifier" },
      { key: "indice", label: "Índice", kind: "expression" },
      { key: "valor", label: "Valor", kind: "expression" },
    ],
    defaults: { nombre: "nums", indice: "0", valor: "0" },
  },
});

/** Plantillas Woven (modo código) */
/** @typedef {{ kind: 'text', value: string } | { kind: 'field', key: string }} InlinePart */

/** Línea compacta (modo Bloques): texto fijo + campos en el lugar. */
export const CODE_INLINE = /** @type {Record<string, InlinePart[]>} */ ({
  var_decl: [
    { kind: "field", key: "tipo" },
    { kind: "text", value: " " },
    { kind: "field", key: "nombre" },
    { kind: "text", value: " = " },
    { kind: "field", key: "valor" },
  ],
  list_decl: [
    { kind: "text", value: "list<" },
    { kind: "field", key: "tipo_elemento" },
    { kind: "text", value: "> " },
    { kind: "field", key: "nombre" },
    { kind: "text", value: " = " },
    { kind: "field", key: "valor_raw" },
  ],
  assignment: [
    { kind: "field", key: "nombre" },
    { kind: "text", value: " = " },
    { kind: "field", key: "valor" },
  ],
  print_stmt: [
    { kind: "text", value: "print(" },
    { kind: "field", key: "valor" },
    { kind: "text", value: ")" },
  ],
  return_stmt: [
    { kind: "text", value: "return " },
    { kind: "field", key: "valor" },
  ],
  if_stmt: [
    { kind: "text", value: "if " },
    { kind: "field", key: "condicion" },
    { kind: "text", value: ":" },
  ],
  while_stmt: [
    { kind: "text", value: "while (" },
    { kind: "field", key: "condicion" },
    { kind: "text", value: "):" },
  ],
  for_stmt: [
    { kind: "text", value: "for (" },
    { kind: "field", key: "tipo" },
    { kind: "text", value: " " },
    { kind: "field", key: "variable" },
    { kind: "text", value: " = " },
    { kind: "field", key: "inicio" },
    { kind: "text", value: "; " },
    { kind: "field", key: "condicion" },
    { kind: "text", value: "; " },
    { kind: "field", key: "paso" },
    { kind: "text", value: "):" },
  ],
  function_decl: [
    { kind: "text", value: "function " },
    { kind: "field", key: "retorno_raw" },
    { kind: "text", value: " " },
    { kind: "field", key: "nombre" },
    { kind: "text", value: "(" },
    { kind: "field", key: "params_raw" },
    { kind: "text", value: "):" },
  ],
  class_decl: [
    { kind: "text", value: "class " },
    { kind: "field", key: "nombre" },
    { kind: "text", value: ":" },
  ],
  field_decl: [
    { kind: "field", key: "tipo" },
    { kind: "text", value: " " },
    { kind: "field", key: "nombre" },
  ],
  constructor_decl: [
    { kind: "text", value: "init(" },
    { kind: "field", key: "params_raw" },
    { kind: "text", value: "):" },
  ],
  method_decl: [
    { kind: "field", key: "virtual" },
    { kind: "text", value: "function " },
    { kind: "field", key: "retorno_raw" },
    { kind: "text", value: " " },
    { kind: "field", key: "nombre" },
    { kind: "text", value: "(" },
    { kind: "field", key: "params_raw" },
    { kind: "text", value: "):" },
  ],
  try_stmt: [{ kind: "text", value: "try:" }],
  throw_stmt: [
    { kind: "text", value: "throw " },
    { kind: "field", key: "mensaje" },
  ],
  break_stmt: [{ kind: "text", value: "break" }],
  continue_stmt: [{ kind: "text", value: "continue" }],
  self_assignment: [
    { kind: "text", value: "self." },
    { kind: "field", key: "campo" },
    { kind: "text", value: " = " },
    { kind: "field", key: "valor" },
  ],
  index_assignment: [
    { kind: "field", key: "nombre" },
    { kind: "text", value: "[" },
    { kind: "field", key: "indice" },
    { kind: "text", value: "] = " },
    { kind: "field", key: "valor" },
  ],
});

/**
 * @param {string} texto
 * @returns {InlinePart[]}
 */
export function verboseInlineParts(texto) {
  /** @type {InlinePart[]} */
  const parts = [];
  const re = /\{(\w+)\}/g;
  let last = 0;
  let m;
  while ((m = re.exec(texto)) !== null) {
    if (m.index > last) {
      parts.push({ kind: "text", value: texto.slice(last, m.index) });
    }
    parts.push({ kind: "field", key: m[1] });
    last = m.lastIndex;
  }
  if (last < texto.length) {
    parts.push({ kind: "text", value: texto.slice(last) });
  }
  return parts.length ? parts : [{ kind: "text", value: texto }];
}

/**
 * @param {string} tipo
 * @param {string} [texto]
 * @returns {InlinePart[]}
 */
export function inlinePartsFor(tipo, texto) {
  if (CODE_INLINE[tipo]) return CODE_INLINE[tipo];
  if (texto) return verboseInlineParts(texto);
  return [{ kind: "text", value: tipo }];
}

export const CODE_TEMPLATES = {
  var_decl: (p) => `${p.tipo} ${p.nombre} = ${p.valor}`,
  list_decl: (p) =>
    `list<${p.tipo_elemento}> ${p.nombre} = ${p.valor_raw ?? "[]"}`,
  assignment: (p) => `${p.nombre} = ${p.valor}`,
  print_stmt: (p) => `print(${p.valor})`,
  return_stmt: (p) => `return ${p.valor}`,
  if_stmt: (p) => `if ${p.condicion}:`,
  while_stmt: (p) => `while (${p.condicion}):`,
  for_stmt: (p) =>
    `for (${p.tipo} ${p.variable} = ${p.inicio}; ${p.condicion}; ${p.paso}):`,
  function_decl: (p) =>
    `function ${p.retorno_raw || "void"} ${p.nombre}(${p.params_raw || ""}):`,
  class_decl: (p) =>
    p.padre ? `class ${p.nombre} extends ${p.padre}:` : `class ${p.nombre}:`,
  field_decl: (p) => `${p.tipo} ${p.nombre}`,
  constructor_decl: (p) => `init(${p.params_raw || ""}):`,
  method_decl: (p) =>
    `${p.virtual === "true" ? "virtual " : ""}function ${p.retorno_raw || "void"} ${p.nombre}(${p.params_raw || ""}):`,
  try_stmt: (p) => `try:`,
  throw_stmt: (p) => `throw ${p.mensaje}`,
  break_stmt: () => "break",
  continue_stmt: () => "continue",
  self_assignment: (p) => `self.${p.campo} = ${p.valor}`,
  index_assignment: (p) => `${p.nombre}[${p.indice}] = ${p.valor}`,
};

export const PALETTE_ORDER = [
  "Variables",
  "Salida",
  "Control",
  "Flujo",
  "Estructuras",
  "Clase",
];

export const PALETTE_TYPES = Object.values(BLOCK_SCHEMAS)
  .filter((s) => PALETTE_ORDER.includes(s.category))
  .sort((a, b) => PALETTE_ORDER.indexOf(a.category) - PALETTE_ORDER.indexOf(b.category));

export const TIPO_LEGIBLE = {
  int: "entero",
  float: "decimal",
  string: "texto",
  bool: "booleano",
  void: "nada",
};

/** Placeholder verboso → campo editable en placeholders */
export const VERBOSE_FIELD_ALIASES = {
  tipo_legible: "tipo",
  tipo_elemento_legible: "tipo_elemento",
  retorno: "retorno_raw",
  params: "params_raw",
};

/**
 * @param {string} placeholderKey
 */
export function fieldKeyForVerbosePlaceholder(placeholderKey) {
  return VERBOSE_FIELD_ALIASES[placeholderKey] ?? placeholderKey;
}

/**
 * @param {string} placeholderKey
 */
export function isLegibleTypePlaceholder(placeholderKey) {
  return (
    placeholderKey === "tipo_legible" ||
    placeholderKey === "tipo_elemento_legible" ||
    placeholderKey === "retorno"
  );
}

/**
 * @param {Record<string, string>} p
 */
export function syncLegibleTypes(p) {
  if (p.tipo && TIPO_LEGIBLE[p.tipo]) p.tipo_legible = TIPO_LEGIBLE[p.tipo];
  if (p.tipo_elemento && TIPO_LEGIBLE[p.tipo_elemento]) {
    p.tipo_elemento_legible = TIPO_LEGIBLE[p.tipo_elemento];
  }
  if (p.retorno_raw && TIPO_LEGIBLE[p.retorno_raw]) {
    p.retorno = TIPO_LEGIBLE[p.retorno_raw];
  }
}

/**
 * @param {string} tipo
 */
export function createBlock(tipo) {
  const schema = BLOCK_SCHEMAS[tipo];
  if (!schema) throw new Error(`Tipo de bloque desconocido: ${tipo}`);

  const placeholders = { ...schema.defaults };
  if (placeholders.tipo && TIPO_LEGIBLE[placeholders.tipo]) {
    placeholders.tipo_legible = TIPO_LEGIBLE[placeholders.tipo];
  }
  if (placeholders.tipo_elemento && TIPO_LEGIBLE[placeholders.tipo_elemento]) {
    placeholders.tipo_elemento_legible = TIPO_LEGIBLE[placeholders.tipo_elemento];
  }

  /** @type {import("./bridge/pyodide-bridge.js").Bloque} */
  const bloque = {
    id: `${tipo}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    tipo,
    texto: schema.texto,
    placeholders,
    linea: 0,
    hijos: [],
  };

  if (schema.slots?.includes("hijos_else")) bloque.hijos_else = [];
  if (schema.slots?.includes("hijos_catch")) bloque.hijos_catch = [];

  return bloque;
}

/**
 * @param {import("./bridge/pyodide-bridge.js").Bloque} bloque
 * @param {'code'|'verbose'} viewMode
 */
export function labelForBlock(bloque, viewMode) {
  const p = bloque.placeholders || {};
  if (viewMode === "code") {
    const fn = CODE_TEMPLATES[bloque.tipo];
    return fn ? fn(p) : bloque.texto;
  }
  return bloque.texto.replace(/\{(\w+)\}/g, (_, key) => p[key] ?? `{${key}}`);
}
