from WovenVisitor import WovenVisitor
from WovenParser import WovenParser
import re


class VerboseVisitor(WovenVisitor):
    def __init__(self):
        self.bloques = []
        self._targets = [self.bloques]
        self._suppress_method_call_blocks = False

    def _bloque(self, tipo, texto, placeholders, linea, hijos=None):
        return {
            "id": f"{tipo}_{linea}",
            "tipo": tipo,
            "texto": texto,
            "placeholders": placeholders,
            "linea": linea,
            "hijos": hijos or [],
        }

    def _add(self, bloque):
        self._targets[-1].append(bloque)
        return bloque

    def _collect_in_temp(self, fn):
        temp = []
        self._targets.append(temp)
        try:
            fn()
        finally:
            self._targets.pop()
        return temp

    def _collect_block(self, block_ctx):
        if block_ctx is None:
            return []
        return self._collect_in_temp(
            lambda: [self.visit(stmt) for stmt in block_ctx.statement()]
        )

    def _collect_expr_blocks(self, expr_ctx):
        if expr_ctx is None:
            return []
        prev = self._suppress_method_call_blocks
        self._suppress_method_call_blocks = True
        try:
            return self._collect_in_temp(lambda: self.visit(expr_ctx))
        finally:
            self._suppress_method_call_blocks = prev

    def _line(self, ctx):
        return getattr(ctx.start, "line", None)

    def _expr_raw(self, ctx) -> str:
        if ctx is None:
            return ""
        stream = ctx.start.getInputStream()
        if stream is not None and ctx.stop is not None:
            return stream.getText(ctx.start.start, ctx.stop.stop)
        return ctx.getText()

    def _tipo_legible(self, type_name):
        t = type_name or ""
        mapping = {
            "int": "entero",
            "float": "decimal",
            "string": "texto",
            "bool": "booleano",
            "void": "nada",
        }
        if t in mapping:
            return mapping[t]
        if t.startswith("list<") and t.endswith(">"):
            return f"lista de {self._tipo_legible(t[5:-1])}"
        return t

    def _texto_expr(self, ctx) -> str:
        if ctx is None:
            return ""
        texto = ctx.getText()
        if texto == "null":
            return "sin valor"
        if len(texto) >= 2 and texto[0] == '"' and texto[-1] == '"':
            return texto.replace("self.", "este objeto.")

        def _split_quoted_segments(s):
            parts = []
            buf = []
            in_quotes = False
            escaped = False
            for ch in s:
                if in_quotes:
                    buf.append(ch)
                    if escaped:
                        escaped = False
                    elif ch == "\\":
                        escaped = True
                    elif ch == '"':
                        parts.append(("quoted", "".join(buf)))
                        buf = []
                        in_quotes = False
                else:
                    if ch == '"':
                        if buf:
                            parts.append(("plain", "".join(buf)))
                            buf = []
                        buf.append(ch)
                        in_quotes = True
                    else:
                        buf.append(ch)
            if buf:
                parts.append(("quoted" if in_quotes else "plain", "".join(buf)))
            return parts

        def _transform_plain(s):
            texto_local = s
            texto_local = texto_local.replace("self.", "este objeto.")
            texto_local = re.sub(r"new([A-Z])", r"new \1", texto_local)
            texto_local = re.sub(r"(<=|>=|==|!=|\*\*|&&|\|\||[<>+\-*/=%])", r" \1 ", texto_local)
            texto_local = re.sub(r"\b(and|or)\b", r" \1 ", texto_local)
            texto_local = re.sub(r"\bnew\s+", "nuevo ", texto_local)
            texto_local = re.sub(r"\s*,\s*", ", ", texto_local)
            texto_local = re.sub(r" +", " ", texto_local).strip()
            return texto_local

        segment_parts = _split_quoted_segments(texto)
        texto = "".join(
            part.replace("self.", "este objeto.") if kind == "quoted" else _transform_plain(part)
            for kind, part in segment_parts
        )

        def _count_top_level_commas(args_text):
            depth = 0
            in_quotes = False
            escaped = False
            count = 0
            for ch in args_text:
                if in_quotes:
                    if escaped:
                        escaped = False
                    elif ch == "\\":
                        escaped = True
                    elif ch == '"':
                        in_quotes = False
                    continue
                if ch == '"':
                    in_quotes = True
                elif ch == "(":
                    depth += 1
                elif ch == ")":
                    depth = max(0, depth - 1)
                elif ch == "," and depth == 0:
                    count += 1
            return count

        def _transform_new_calls(text):
            result = []
            i = 0
            n = len(text)
            in_quotes = False
            escaped = False
            while i < n:
                ch = text[i]
                if in_quotes:
                    result.append(ch)
                    if escaped:
                        escaped = False
                    elif ch == "\\":
                        escaped = True
                    elif ch == '"':
                        in_quotes = False
                    i += 1
                    continue
                if ch == '"':
                    in_quotes = True
                    result.append(ch)
                    i += 1
                    continue
                if text.startswith("nuevo ", i):
                    j = i + len("nuevo ")
                    m = re.match(r"[A-Za-z_]\w*", text[j:])
                    if not m:
                        result.append(text[i])
                        i += 1
                        continue
                    class_name = m.group(0)
                    k = j + len(class_name)
                    if k >= n or text[k] != "(":
                        result.append(f"nuevo {class_name}")
                        i = k
                        continue
                    depth = 0
                    sub_in_quotes = False
                    sub_escaped = False
                    end = k
                    while end < n:
                        ch_end = text[end]
                        if sub_in_quotes:
                            if sub_escaped:
                                sub_escaped = False
                            elif ch_end == "\\":
                                sub_escaped = True
                            elif ch_end == '"':
                                sub_in_quotes = False
                            end += 1
                            continue
                        if ch_end == '"':
                            sub_in_quotes = True
                        elif ch_end == "(":
                            depth += 1
                        elif ch_end == ")":
                            depth -= 1
                            if depth == 0:
                                break
                        end += 1
                    if end >= n:
                        result.append(text[i:])
                        break
                    args_text = text[k + 1:end].strip()
                    if not args_text:
                        transformed = f"nuevo {class_name}"
                    elif _count_top_level_commas(args_text) == 0:
                        transformed = f"nuevo {class_name} con {args_text}"
                    else:
                        transformed = f"nuevo {class_name} con ({args_text})"
                    result.append(transformed)
                    i = end + 1
                    continue
                result.append(text[i])
                i += 1
            return "".join(result)

        texto = _transform_new_calls(texto)

        def _transform_members_plain(s):
            out = s
            # Orden: mas especifico -> menos especifico
            out = re.sub(
                r"\b([A-Za-z_]\w*)\s*\[\s*([^\]]+?)\s*\]\s*\.\s*([A-Za-z_]\w*)\s*\(\s*([^)]+?)\s*\)",
                lambda m: (
                    f"el elemento {m.group(2).strip()} de {m.group(1)} "
                    f"ejecutando {m.group(3)} con {m.group(4).strip()}"
                ),
                out,
            )
            out = re.sub(
                r"\b([A-Za-z_]\w*)\s*\[\s*([^\]]+?)\s*\]\s*\.\s*([A-Za-z_]\w*)\s*\(\s*\)",
                lambda m: (
                    f"el elemento {m.group(2).strip()} de {m.group(1)} "
                    f"ejecutando {m.group(3)}"
                ),
                out,
            )
            out = re.sub(
                r"\b([A-Za-z_]\w*)\s*\[\s*([^\]]+?)\s*\]\s*\.\s*([A-Za-z_]\w*)\b(?!\s*\()",
                lambda m: (
                    f"el campo {m.group(3)} del elemento {m.group(2).strip()} "
                    f"de {m.group(1)}"
                ),
                out,
            )
            out = re.sub(
                r"\b([A-Za-z_]\w*)\.length\b",
                lambda m: f"la cantidad de elementos en {m.group(1)}",
                out,
            )
            out = re.sub(
                r"\b([A-Za-z_]\w*)\s*\.\s*([A-Za-z_]\w*)\s*\(\s*([^)]+?)\s*\)",
                lambda m: f"{m.group(1)} ejecutando {m.group(2)} con {m.group(3).strip()}",
                out,
            )
            out = re.sub(
                r"\b([A-Za-z_]\w*)\s*\.\s*([A-Za-z_]\w*)\s*\(\s*\)",
                lambda m: f"{m.group(1)} ejecutando {m.group(2)}",
                out,
            )
            return out

        segment_parts = _split_quoted_segments(texto)
        return "".join(
            part.replace("self.", "este objeto.") if kind == "quoted" else _transform_members_plain(part)
            for kind, part in segment_parts
        )

    def _params_info(self, param_list_ctx):
        if not param_list_ctx:
            return []
        return [
            {"tipo": p.typeName().getText(), "nombre": p.IDENTIFIER().getText()}
            for p in param_list_ctx.param()
        ]

    def _params_legible(self, params) -> str:
        return ", ".join(
            f"{p['nombre']} de tipo {self._tipo_legible(p['tipo'])}"
            for p in params
        )

    def _params_raw(self, params) -> str:
        if not params:
            return ""
        return ", ".join(f"{p['tipo']} {p['nombre']}" for p in params)

    # ---- top-level / containers ----
    def visitProgram(self, ctx: WovenParser.ProgramContext):
        for stmt in ctx.statement():
            self.visit(stmt)
        return self.bloques

    def visitStatement(self, ctx: WovenParser.StatementContext):
        if ctx.compoundStmt():
            return self.visit(ctx.compoundStmt())
        return self.visit(ctx.simpleStmt())

    def visitSimpleStmt(self, ctx: WovenParser.SimpleStmtContext):
        return self.visit(ctx.getChild(0))

    def visitCompoundStmt(self, ctx: WovenParser.CompoundStmtContext):
        return self.visit(ctx.getChild(0))

    # ---- declarations ----
    def visitVarDecl(self, ctx: WovenParser.VarDeclContext):
        type_name = ctx.typeName().getText()
        name = ctx.IDENTIFIER().getText()
        expr_text = self._texto_expr(ctx.expr()) if ctx.expr() else "valor por defecto"
        line = self._line(ctx)

        expr_blocks = self._collect_in_temp(lambda: self.visit(ctx.expr())) if ctx.expr() else []

        if type_name.startswith("list<") and type_name.endswith(">"):
            inner = type_name[5:-1]
            valor_raw = self._expr_raw(ctx.expr()) if ctx.expr() else "[]"
            bloque = self._bloque(
                "list_decl",
                "guardar una coleccion de objetos {tipo_elemento} llamada {nombre}",
                {
                    "tipo_elemento": inner,
                    "tipo_elemento_legible": self._tipo_legible(inner),
                    "nombre": name,
                    "valor_raw": valor_raw,
                },
                line,
                hijos=expr_blocks,
            )
            return self._add(bloque)

        placeholders = {
            "tipo": type_name,
            "tipo_legible": self._tipo_legible(type_name),
            "nombre": name,
            "valor": expr_text,
        }
        if ctx.expr():
            placeholders["valor_raw"] = self._expr_raw(ctx.expr())

        bloque = self._bloque(
            "var_decl",
            "guardar el valor {valor} en una variable {tipo_legible} llamada {nombre}",
            placeholders,
            line,
            hijos=expr_blocks,
        )
        return self._add(bloque)

    def visitAssignment(self, ctx: WovenParser.AssignmentContext):
        name = ctx.IDENTIFIER().getText()
        expr_text = self._texto_expr(ctx.expr())
        expr_blocks = self._collect_in_temp(lambda: self.visit(ctx.expr()))
        bloque = self._bloque(
            "assignment",
            "actualizar {nombre} al resultado de {valor}",
            {
                "nombre": name,
                "valor": expr_text,
                "valor_raw": self._expr_raw(ctx.expr()),
            },
            self._line(ctx),
            hijos=expr_blocks,
        )
        return self._add(bloque)

    def visitFunctionDecl(self, ctx: WovenParser.FunctionDeclContext):
        name = ctx.IDENTIFIER().getText()
        params_info = self._params_info(ctx.paramList())
        ret_raw = ctx.returnType().getText()
        ret = self._tipo_legible(ret_raw)
        hijos = self._collect_block(ctx.block())
        has_params = len(params_info) > 0
        bloque = self._bloque(
            "function_decl",
            (
                "definir una funcion llamada {nombre} que recibe {params} y devuelve {retorno}"
                if has_params
                else "definir una funcion llamada {nombre} que devuelve {retorno}"
            ),
            {
                "nombre": name,
                "params": self._params_legible(params_info),
                "params_raw": self._params_raw(params_info),
                "retorno": ret,
                "retorno_raw": ret_raw,
            },
            self._line(ctx),
            hijos=hijos,
        )
        return self._add(bloque)

    def visitClassDecl(self, ctx: WovenParser.ClassDeclContext):
        ids = ctx.IDENTIFIER()
        name = ids[0].getText()
        parent = ids[1].getText() if len(ids) > 1 else None
        herencia = f" que hereda de {parent}" if parent else ""

        hijos = self._collect_in_temp(
            lambda: [self.visit(member) for member in ctx.classBody().classMember()]
        )
        bloque = self._bloque(
            "class_decl",
            (
                "la clase {nombre} es un tipo especial de {padre}"
                if parent
                else "la clase {nombre} es un tipo de objeto"
            ),
            {
                "nombre": name,
                "herencia": herencia,
                "padre": parent or "",
            },
            self._line(ctx),
            hijos=hijos,
        )
        return self._add(bloque)

    def visitClassMember(self, ctx: WovenParser.ClassMemberContext):
        return self.visit(ctx.getChild(0))

    def visitFieldDecl(self, ctx: WovenParser.FieldDeclContext):
        bloque = self._bloque(
            "field_decl",
            "esta clase tiene un campo {tipo_legible} llamado {nombre}",
            {
                "tipo": ctx.typeName().getText(),
                "tipo_legible": self._tipo_legible(ctx.typeName().getText()),
                "nombre": ctx.IDENTIFIER().getText(),
            },
            self._line(ctx),
        )
        return self._add(bloque)

    def visitConstructorDecl(self, ctx: WovenParser.ConstructorDeclContext):
        params_info = self._params_info(ctx.paramList())
        hijos = self._collect_block(ctx.block())
        bloque = self._bloque(
            "constructor_decl",
            "para crear un objeto de esta clase se necesita {params}",
            {
                "params": self._params_legible(params_info),
                "params_raw": self._params_raw(params_info),
            },
            self._line(ctx),
            hijos=hijos,
        )
        return self._add(bloque)

    def visitMethodDecl(self, ctx: WovenParser.MethodDeclContext):
        name = ctx.IDENTIFIER().getText()
        params_info = self._params_info(ctx.paramList())
        ret_raw = ctx.returnType().getText()
        ret = self._tipo_legible(ret_raw)
        hijos = self._collect_block(ctx.block())
        has_params = len(params_info) > 0
        bloque = self._bloque(
            "method_decl",
            (
                "esta clase puede {nombre} recibiendo {params} y devuelve {retorno}"
                if has_params
                else "esta clase puede {nombre} y devuelve {retorno}"
            ),
            {
                "nombre": name,
                "params": self._params_legible(params_info),
                "params_raw": self._params_raw(params_info),
                "retorno": ret,
                "retorno_raw": ret_raw,
                "virtual": ctx.VIRTUAL() is not None,
            },
            self._line(ctx),
            hijos=hijos,
        )
        return self._add(bloque)

    # ---- control flow ----
    def visitIfStmt(self, ctx: WovenParser.IfStmtContext):
        condicion = self._texto_expr(ctx.expr())
        hijos = self._collect_block(ctx.block(0))
        hijos_else = self._collect_block(ctx.block(1)) if len(ctx.block()) > 1 else []

        bloque = self._bloque(
            "if_stmt",
            "si se cumple que {condicion}",
            {
                "condicion": condicion,
                "condicion_raw": self._expr_raw(ctx.expr()),
            },
            self._line(ctx),
            hijos=hijos,
        )
        if hijos_else:
            bloque["hijos_else"] = hijos_else
        return self._add(bloque)

    def visitWhileStmt(self, ctx: WovenParser.WhileStmtContext):
        bloque = self._bloque(
            "while_stmt",
            "repetir mientras {condicion}",
            {
                "condicion": self._texto_expr(ctx.expr()),
                "condicion_raw": self._expr_raw(ctx.expr()),
            },
            self._line(ctx),
            hijos=self._collect_block(ctx.block()),
        )
        return self._add(bloque)

    def visitForStmt(self, ctx: WovenParser.ForStmtContext):
        init = ctx.forInit()
        f_type = ""
        var = ""
        inicio = ""
        inicio_raw = "0"
        if init and init.typeName():
            f_type = init.typeName().getText()
            var = init.IDENTIFIER().getText()
            inicio = self._texto_expr(init.expr()) if init.expr() else ""
            inicio_raw = self._expr_raw(init.expr()) if init.expr() else "0"
        elif init and init.assignment():
            var = init.assignment().IDENTIFIER().getText()
            inicio = self._texto_expr(init.assignment().expr())
            inicio_raw = self._expr_raw(init.assignment().expr())

        condicion = self._texto_expr(ctx.expr()) if ctx.expr() else "true"
        condicion_raw = self._expr_raw(ctx.expr()) if ctx.expr() else "true"
        paso = "sin cambio"
        paso_raw = "sin cambio"
        if ctx.forUpdate():
            if ctx.forUpdate().assignment():
                paso = self._texto_expr(ctx.forUpdate().assignment().expr())
                paso_raw = self._expr_raw(ctx.forUpdate().assignment().expr())
            elif ctx.forUpdate().expr():
                paso = self._texto_expr(ctx.forUpdate().expr())
                paso_raw = self._expr_raw(ctx.forUpdate().expr())

        bloque = self._bloque(
            "for_stmt",
            "repetir con {tipo_legible} {variable} comenzando en {inicio} hasta que {condicion}",
            {
                "tipo": f_type or "auto",
                "tipo_legible": self._tipo_legible(f_type) if f_type else "auto",
                "variable": var or "iterador",
                "inicio": inicio or "0",
                "inicio_raw": inicio_raw,
                "condicion": condicion,
                "condicion_raw": condicion_raw,
                "paso": paso,
                "paso_raw": paso_raw,
            },
            self._line(ctx),
            hijos=self._collect_block(ctx.block()),
        )
        return self._add(bloque)

    def visitTryStmt(self, ctx: WovenParser.TryStmtContext):
        hijos_try = self._collect_block(ctx.block(0))
        hijos_catch = self._collect_block(ctx.block(1))
        nombre_var = ctx.IDENTIFIER().getText()
        bloque = self._bloque(
            "try_stmt",
            "intentar ejecutar el bloque, si falla capturar el error en {variable}",
            {"variable": nombre_var},
            self._line(ctx),
            hijos=hijos_try,
        )
        bloque["hijos_catch"] = hijos_catch
        return self._add(bloque)

    # ---- simple statements ----
    def visitReturnStmt(self, ctx: WovenParser.ReturnStmtContext):
        expr_text = self._texto_expr(ctx.expr()) if ctx.expr() else "nada"
        expr_blocks = self._collect_expr_blocks(ctx.expr()) if ctx.expr() else []
        bloque = self._bloque(
            "return_stmt",
            "el resultado es {valor}",
            {
                "valor": expr_text,
                "valor_raw": self._expr_raw(ctx.expr()) if ctx.expr() else "",
            },
            self._line(ctx),
            hijos=expr_blocks,
        )
        return self._add(bloque)

    def visitThrowStmt(self, ctx: WovenParser.ThrowStmtContext):
        expr_text = self._texto_expr(ctx.expr())
        bloque = self._bloque(
            "throw_stmt",
            "lanzar el error {mensaje}",
            {
                "mensaje": expr_text,
                "mensaje_raw": self._expr_raw(ctx.expr()),
            },
            self._line(ctx),
        )
        return self._add(bloque)

    def visitPrintStmt(self, ctx: WovenParser.PrintStmtContext):
        value_raw = ""
        if not ctx.argList():
            value_text = ""
            expr_blocks = []
        else:
            exprs = list(ctx.argList().expr())
            value_text = ", ".join(self._texto_expr(e) for e in exprs)
            value_raw = ", ".join(self._expr_raw(e) for e in exprs)
            prev = self._suppress_method_call_blocks
            self._suppress_method_call_blocks = True
            try:
                expr_blocks = self._collect_in_temp(lambda: [self.visit(e) for e in exprs])
            finally:
                self._suppress_method_call_blocks = prev
        bloque = self._bloque(
            "print_stmt",
            "imprimir {valor}",
            {
                "valor": value_text,
                "valor_raw": value_raw if ctx.argList() else "",
            },
            self._line(ctx),
            hijos=expr_blocks,
        )
        return self._add(bloque)

    def visitExprStmt(self, ctx: WovenParser.ExprStmtContext):
        return self.visit(ctx.expr())

    def visitBreakStmt(self, ctx: WovenParser.BreakStmtContext):
        bloque = self._bloque(
            "break_stmt",
            "salir del ciclo inmediatamente",
            {},
            self._line(ctx),
        )
        return self._add(bloque)

    def visitContinueStmt(self, ctx: WovenParser.ContinueStmtContext):
        bloque = self._bloque(
            "continue_stmt",
            "saltar al siguiente paso del ciclo",
            {},
            self._line(ctx),
        )
        return self._add(bloque)

    def visitSelfAssignment(self, ctx: WovenParser.SelfAssignmentContext):
        campo = ctx.IDENTIFIER().getText()
        expr_text = self._texto_expr(ctx.expr())
        bloque = self._bloque(
            "self_assignment",
            "guardar {valor} en el campo {campo} de este objeto",
            {
                "campo": campo,
                "valor": expr_text,
                "valor_raw": self._expr_raw(ctx.expr()),
            },
            self._line(ctx),
        )
        return self._add(bloque)

    def visitIndexAssignment(self, ctx: WovenParser.IndexAssignmentContext):
        nombre = ctx.IDENTIFIER().getText()
        idx_text = self._texto_expr(ctx.expr(0))
        val_text = self._texto_expr(ctx.expr(1))
        bloque = self._bloque(
            "index_assignment",
            "guardar {valor} en la posicion {indice} de {nombre}",
            {
                "nombre": nombre,
                "indice": idx_text,
                "indice_raw": self._expr_raw(ctx.expr(0)),
                "valor": val_text,
                "valor_raw": self._expr_raw(ctx.expr(1)),
            },
            self._line(ctx),
        )
        return self._add(bloque)

    # ---- expression-level special constructions ----
    def visitNewAtom(self, ctx: WovenParser.NewAtomContext):
        clase = ctx.IDENTIFIER().getText()
        args = ""
        if ctx.argList():
            args = ", ".join(self._texto_expr(e) for e in ctx.argList().expr())
        bloque = self._bloque(
            "new_object",
            "crear nuevo {clase} con {args}",
            {"clase": clase, "args": args or "ningun argumento"},
            self._line(ctx),
        )
        return self._add(bloque)

    def visitMemberCallAtom(self, ctx: WovenParser.MemberCallAtomContext):
        if self._suppress_method_call_blocks:
            return self.visitChildren(ctx)
        objeto = ctx.atom().getText()
        metodo = ctx.IDENTIFIER().getText()
        args = ""
        args_raw = ""
        if ctx.argList():
            args = ", ".join(self._texto_expr(e) for e in ctx.argList().expr())
            args_raw = ", ".join(self._expr_raw(e) for e in ctx.argList().expr())
        if metodo == "append":
            texto = "agregar {args} a {objeto}"
        elif metodo == "remove":
            texto = "eliminar el elemento {args} de {objeto}"
        else:
            texto = "pedirle a {objeto} que ejecute {metodo} con {args}"
        bloque = self._bloque(
            "method_call",
            texto,
            {
                "objeto": objeto,
                "metodo": metodo,
                "args": args or "ningun argumento",
                "args_raw": args_raw,
            },
            self._line(ctx),
        )
        return self._add(bloque)

    def visitSelfCallAtom(self, ctx: WovenParser.SelfCallAtomContext):
        if self._suppress_method_call_blocks:
            return self.visitChildren(ctx)
        metodo = ctx.IDENTIFIER().getText()
        args = ""
        args_raw = ""
        if ctx.argList():
            args = ", ".join(self._texto_expr(e) for e in ctx.argList().expr())
            args_raw = ", ".join(self._expr_raw(e) for e in ctx.argList().expr())
        if metodo == "append":
            texto = "agregar {args} a {objeto}"
        elif metodo == "remove":
            texto = "eliminar el elemento {args} de {objeto}"
        else:
            texto = "pedirle a {objeto} que ejecute {metodo} con {args}"
        bloque = self._bloque(
            "method_call",
            texto,
            {
                "objeto": "self",
                "metodo": metodo,
                "args": args or "ningun argumento",
                "args_raw": args_raw,
            },
            self._line(ctx),
        )
        return self._add(bloque)

    # ---- default traversal helpers for expressions ----
    def visitExpr(self, ctx: WovenParser.ExprContext):
        return self.visitChildren(ctx)

    def visitLogicalOr(self, ctx: WovenParser.LogicalOrContext):
        return self.visitChildren(ctx)

    def visitAndExprAlt(self, ctx: WovenParser.AndExprAltContext):
        return self.visitChildren(ctx)

    def visitCompExprAlt(self, ctx: WovenParser.CompExprAltContext):
        return self.visitChildren(ctx)

    def visitLogicalAnd(self, ctx: WovenParser.LogicalAndContext):
        return self.visitChildren(ctx)

    def visitBinaryOp(self, ctx: WovenParser.BinaryOpContext):
        return self.visitChildren(ctx)

    def visitComparison(self, ctx: WovenParser.ComparisonContext):
        return self.visitChildren(ctx)

    def visitUnaryExprAlt(self, ctx: WovenParser.UnaryExprAltContext):
        return self.visitChildren(ctx)

    def visitPowerExprAlt(self, ctx: WovenParser.PowerExprAltContext):
        return self.visitChildren(ctx)

    def visitPowerOp(self, ctx: WovenParser.PowerOpContext):
        return self.visitChildren(ctx)

    def visitAtomExpr(self, ctx: WovenParser.AtomExprContext):
        return self.visitChildren(ctx)

    def visitUnaryOp(self, ctx: WovenParser.UnaryOpContext):
        return self.visitChildren(ctx)

    def visitLiteralAtom(self, ctx: WovenParser.LiteralAtomContext):
        return self.visitChildren(ctx)

    def visitIdAtom(self, ctx: WovenParser.IdAtomContext):
        return self.visitChildren(ctx)

    def visitCallAtom(self, ctx: WovenParser.CallAtomContext):
        return self.visitChildren(ctx)

    def visitParenAtom(self, ctx: WovenParser.ParenAtomContext):
        return self.visitChildren(ctx)

    def visitIndexAtom(self, ctx: WovenParser.IndexAtomContext):
        return self.visitChildren(ctx)

    def visitMemberAccessAtom(self, ctx: WovenParser.MemberAccessAtomContext):
        return self.visitChildren(ctx)

    def visitSelfFieldAtom(self, ctx: WovenParser.SelfFieldAtomContext):
        return self.visitChildren(ctx)

    def visitListLiteralAtom(self, ctx: WovenParser.ListLiteralAtomContext):
        return self.visitChildren(ctx)

    def visitSuperCallAtom(self, ctx: WovenParser.SuperCallAtomContext):
        return self.visitChildren(ctx)


def verbose_woven(source: str) -> str:
    import json
    from antlr4 import CommonTokenStream, InputStream
    from WovenLexer import WovenLexer
    from WovenParser import WovenParser

    lexer = WovenLexer(InputStream(source))
    stream = CommonTokenStream(lexer)
    parser = WovenParser(stream)
    tree = parser.program()

    visitor = VerboseVisitor()
    visitor.visit(tree)

    return json.dumps({"bloques": visitor.bloques}, ensure_ascii=False)
