_VERBOSE_MARKERS = (
    "nuevo ",
    "ejecutando ",
    "este objeto.",
    "sin valor",
    "valor por defecto",
    "ningun argumento",
    "la cantidad de elementos",
    "el elemento ",
    "el campo ",
)


def _woven_expr(p: dict, key: str, default: str = "") -> str:
    """Código Woven: *_raw del parseo, o el placeholder editado en bloques."""
    val = p.get(key, default)
    if val == "ningun argumento":
        val = ""
    raw_key = f"{key}_raw"
    raw = p.get(raw_key) if raw_key in p else None
    if val and not any(m in val for m in _VERBOSE_MARKERS):
        return val
    if raw is not None:
        return raw
    return val or default


def _pick(p: dict, key: str, default: str = "") -> str:
    return _woven_expr(p, key, default)


class VerboseInverse:
    def __init__(self):
        self.lineas = []
        self.indent = 0

    def generar(self, bloques: list) -> str:
        for bloque in bloques:
            self._procesar(bloque)
        return "\n".join(self.lineas)

    def _indentar(self, texto: str):
        self.lineas.append("    " * self.indent + texto)

    def _procesar(self, bloque: dict):
        tipo = bloque["tipo"]
        p = bloque.get("placeholders", {})

        if tipo == "var_decl":
            valor = _pick(p, "valor")
            if valor and valor != "valor por defecto":
                self._indentar(f"{p['tipo']} {p['nombre']} = {valor}")
            else:
                self._indentar(f"{p['tipo']} {p['nombre']}")

        elif tipo == "assignment":
            self._indentar(f"{p['nombre']} = {_pick(p, 'valor')}")

        elif tipo == "if_stmt":
            self._indentar(f"if {_pick(p, 'condicion')}:")
            self.indent += 1
            for hijo in bloque.get("hijos", []):
                self._procesar(hijo)
            self.indent -= 1
            if bloque.get("hijos_else"):
                self._indentar("else:")
                self.indent += 1
                for hijo in bloque["hijos_else"]:
                    self._procesar(hijo)
                self.indent -= 1

        elif tipo == "while_stmt":
            self._indentar(f"while ({_pick(p, 'condicion')}):")
            self.indent += 1
            for hijo in bloque.get("hijos", []):
                self._procesar(hijo)
            self.indent -= 1

        elif tipo == "for_stmt":
            paso = _pick(p, "paso", "sin cambio")
            paso_clause = (
                p["variable"]
                if paso == "sin cambio"
                else f"{p['variable']} = {paso}"
            )
            self._indentar(
                f"for ({p['tipo']} {p['variable']} = {_pick(p, 'inicio', '0')}; "
                f"{_pick(p, 'condicion', 'true')}; {paso_clause}):"
            )
            self.indent += 1
            for hijo in bloque.get("hijos", []):
                self._procesar(hijo)
            self.indent -= 1

        elif tipo == "function_decl":
            retorno_raw = p.get("retorno_raw", p.get("retorno", "void"))
            self._indentar(
                f"function {retorno_raw} {p['nombre']}({p['params_raw']}):"
            )
            self.indent += 1
            for hijo in bloque.get("hijos", []):
                self._procesar(hijo)
            self.indent -= 1

        elif tipo == "return_stmt":
            self._indentar(f"return {_pick(p, 'valor')}")

        elif tipo == "print_stmt":
            self._indentar(f"print({_pick(p, 'valor')})")

        elif tipo == "class_decl":
            herencia = f" extends {p['padre']}" if p.get("padre") else ""
            self._indentar(f"class {p['nombre']}{herencia}:")
            self.indent += 1
            for hijo in bloque.get("hijos", []):
                self._procesar(hijo)
            self.indent -= 1

        elif tipo == "field_decl":
            self._indentar(f"{p['tipo']} {p['nombre']}")

        elif tipo == "constructor_decl":
            self._indentar(f"init({p['params_raw']}):")
            self.indent += 1
            for hijo in bloque.get("hijos", []):
                self._procesar(hijo)
            self.indent -= 1

        elif tipo == "method_decl":
            retorno_raw = p.get("retorno_raw", p.get("retorno", "void"))
            virtual = "virtual " if p.get("virtual") else ""
            self._indentar(
                f"{virtual}function {retorno_raw} {p['nombre']}({p['params_raw']}):"
            )
            self.indent += 1
            for hijo in bloque.get("hijos", []):
                self._procesar(hijo)
            self.indent -= 1

        elif tipo == "list_decl":
            inicial = p.get("valor_raw", "[]")
            self._indentar(
                f"list<{p['tipo_elemento']}> {p['nombre']} = {inicial}"
            )

        elif tipo == "method_call":
            method_name = p.get("m\u00e9todo", p.get("metodo", ""))
            self._indentar(
                f"{p['objeto']}.{method_name}({_pick(p, 'args')})"
            )

        elif tipo == "try_stmt":
            self._indentar("try:")
            self.indent += 1
            for hijo in bloque["hijos"]:
                self._procesar(hijo)
            self.indent -= 1
            variable = p.get("variable", "e")
            self._indentar(f"catch (string {variable}):")
            self.indent += 1
            for hijo in bloque.get("hijos_catch", []):
                self._procesar(hijo)
            self.indent -= 1

        elif tipo == "throw_stmt":
            self._indentar(f"throw {_pick(p, 'mensaje')}")

        elif tipo == "break_stmt":
            self._indentar("break")

        elif tipo == "continue_stmt":
            self._indentar("continue")

        elif tipo == "self_assignment":
            self._indentar(f"self.{p['campo']} = {_pick(p, 'valor')}")

        elif tipo == "index_assignment":
            self._indentar(
                f"{p['nombre']}[{_pick(p, 'indice')}] = {_pick(p, 'valor')}"
            )


def inverse_verbose(bloques_json: str) -> str:
    import json

    data = json.loads(bloques_json)
    inverse = VerboseInverse()
    return inverse.generar(data["bloques"])
