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
            self._indentar(f"{p['tipo']} {p['nombre']} = {p['valor']}")

        elif tipo == "assignment":
            self._indentar(f"{p['nombre']} = {p['valor']}")

        elif tipo == "if_stmt":
            self._indentar(f"if {p['condicion']}:")
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
            self._indentar(f"while ({p['condicion']}):")
            self.indent += 1
            for hijo in bloque.get("hijos", []):
                self._procesar(hijo)
            self.indent -= 1

        elif tipo == "for_stmt":
            self._indentar(
                f"for ({p['tipo']} {p['variable']} = {p['inicio']}; "
                f"{p['condicion']}; {p['variable']} = {p['paso']}):"
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
            self._indentar(f"return {p['valor']}")

        elif tipo == "print_stmt":
            self._indentar(f"print({p['valor']})")

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
            self._indentar(f"list<{p['tipo_elemento']}> {p['nombre']} = []")

        elif tipo == "method_call":
            method_name = p.get("m\u00e9todo", p.get("metodo", ""))
            self._indentar(f"{p['objeto']}.{method_name}({p['args']})")

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
            self._indentar(f"throw {p['mensaje']}")

        elif tipo == "break_stmt":
            self._indentar("break")

        elif tipo == "continue_stmt":
            self._indentar("continue")

        elif tipo == "self_assignment":
            self._indentar(f"self.{p['campo']} = {p['valor']}")

        elif tipo == "index_assignment":
            self._indentar(f"{p['nombre']}[{p['indice']}] = {p['valor']}")


def inverse_verbose(bloques_json: str) -> str:
    import json

    data = json.loads(bloques_json)
    inverse = VerboseInverse()
    return inverse.generar(data["bloques"])
