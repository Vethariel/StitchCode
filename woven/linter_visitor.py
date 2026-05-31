import json

from antlr4.error.ErrorListener import ErrorListener

from WovenVisitor import WovenVisitor
from WovenParser import WovenParser

NOMBRES_RESERVADOS = {"self", "super", "true", "false"}


class LinterVisitor(WovenVisitor):
    def __init__(self):
        self.diagnosticos = []
        # Fase 1: simbolos declarados
        self.variables = {}      # nombre -> {tipo, linea, usado}
        self.funciones = {}      # nombre -> {params, retorno, linea}
        self.clases = {}         # nombre -> {campos, metodos, padre, linea}
        self.scope_stack = [{}]  # pila de scopes
        self.funcion_actual = None
        self.clase_actual = None

    def _error(self, linea, mensaje):
        self.diagnosticos.append({
            "nivel": "error",
            "linea": linea,
            "mensaje": mensaje
        })

    def _warning(self, linea, mensaje):
        self.diagnosticos.append({
            "nivel": "warning",
            "linea": linea,
            "mensaje": mensaje
        })

    def _declarar(self, nombre, tipo, linea):
        if nombre in NOMBRES_RESERVADOS:
            return
        self.scope_stack[-1][nombre] = {
            "tipo": tipo, "linea": linea, "usado": False
        }
        self.variables[nombre] = self.scope_stack[-1][nombre]

    def _buscar(self, nombre):
        if nombre in NOMBRES_RESERVADOS:
            return {"tipo": "reservado", "linea": 0, "usado": True}
        for scope in reversed(self.scope_stack):
            if nombre in scope:
                return scope[nombre]
        return None

    def _marcar_usado(self, nombre):
        if nombre in NOMBRES_RESERVADOS:
            return
        for scope in reversed(self.scope_stack):
            if nombre in scope:
                scope[nombre]["usado"] = True
                return

    def _entrar_scope(self):
        self.scope_stack.append({})

    def _emit_unused(self, scope):
        for nombre, info in scope.items():
            if not info["usado"] and nombre not in ("_",):
                self._warning(
                    info["linea"],
                    f"Variable '{nombre}' declarada pero nunca usada"
                )

    def _salir_scope(self):
        scope = self.scope_stack.pop()
        self._emit_unused(scope)

    def _es_tipo_primitivo(self, t):
        return t in {"int", "float", "string", "bool", "void"}

    def _es_tipo_lista(self, t):
        return isinstance(t, str) and t.startswith("list<") and t.endswith(">")

    def _tipo_inner_lista(self, t):
        return t[5:-1] if self._es_tipo_lista(t) else None

    def _compatible(self, esperado, recibido):
        if esperado == recibido:
            return True
        if esperado == "float" and recibido == "int":
            return True
        if self._es_tipo_lista(esperado) and self._es_tipo_lista(recibido):
            return True
        if esperado in self.clases and recibido in self.clases:
            cur = recibido
            while cur:
                if cur == esperado:
                    return True
                cur = self.clases.get(cur, {}).get("padre")
        return False

    def _params_de_ctx(self, param_list_ctx):
        if not param_list_ctx:
            return []
        return [
            {
                "nombre": p.IDENTIFIER().getText(),
                "tipo": p.typeName().getText(),
                "linea": p.start.line,
            }
            for p in param_list_ctx.param()
        ]

    def _expr_types(self, arg_list_ctx):
        if not arg_list_ctx:
            return []
        return [self.visit(e) for e in arg_list_ctx.expr()]

    # ---------- top-level ----------
    def visitProgram(self, ctx: WovenParser.ProgramContext):
        # Fase 1: registrar nombres de clases/funciones
        for stmt in ctx.statement():
            comp = stmt.compoundStmt()
            if not comp:
                continue
            if comp.functionDecl():
                fn = comp.functionDecl()
                name = fn.IDENTIFIER().getText()
                self.funciones[name] = {
                    "params": self._params_de_ctx(fn.paramList()),
                    "retorno": fn.returnType().getText(),
                    "linea": fn.start.line,
                    "ctx": fn,
                }
            elif comp.classDecl():
                c = comp.classDecl()
                ids = c.IDENTIFIER()
                cname = ids[0].getText()
                padre = ids[1].getText() if len(ids) > 1 else None
                self.clases[cname] = {
                    "campos": {},
                    "metodos": {},
                    "padre": padre,
                    "linea": c.start.line,
                    "constructor": None,
                    "ctx": c,
                }

        # Fase 2: analizar todo
        for stmt in ctx.statement():
            self.visit(stmt)

        # warnings de variables globales sin uso
        self._emit_unused(self.scope_stack[0])
        return self.diagnosticos

    def visitStatement(self, ctx: WovenParser.StatementContext):
        if ctx.compoundStmt():
            return self.visit(ctx.compoundStmt())
        return self.visit(ctx.simpleStmt())

    def visitSimpleStmt(self, ctx: WovenParser.SimpleStmtContext):
        return self.visit(ctx.getChild(0))

    def visitCompoundStmt(self, ctx: WovenParser.CompoundStmtContext):
        return self.visit(ctx.getChild(0))

    def visitBlock(self, ctx: WovenParser.BlockContext):
        self._entrar_scope()
        try:
            for stmt in ctx.statement():
                self.visit(stmt)
        finally:
            self._salir_scope()
        return None

    # ---------- classes ----------
    def visitClassDecl(self, ctx: WovenParser.ClassDeclContext):
        ids = ctx.IDENTIFIER()
        nombre = ids[0].getText()
        padre = ids[1].getText() if len(ids) > 1 else None

        info = self.clases.get(nombre)
        if info is None:
            self.clases[nombre] = {
                "campos": {},
                "metodos": {},
                "padre": padre,
                "linea": ctx.start.line,
                "constructor": None,
            }
            info = self.clases[nombre]

        if padre and padre not in self.clases:
            self._error(ctx.start.line, f"La clase padre '{padre}' no existe")

        prev_class = self.clase_actual
        self.clase_actual = nombre
        try:
            # Primero registrar members
            for m in ctx.classBody().classMember():
                if m.fieldDecl():
                    self.visit(m.fieldDecl())
                elif m.methodDecl():
                    md = m.methodDecl()
                    mname = md.IDENTIFIER().getText()
                    info["metodos"][mname] = {
                        "params": self._params_de_ctx(md.paramList()),
                        "retorno": md.returnType().getText(),
                        "linea": md.start.line,
                        "virtual": md.VIRTUAL() is not None,
                        "ctx": md,
                    }
                elif m.constructorDecl():
                    ctor = m.constructorDecl()
                    info["constructor"] = {
                        "params": self._params_de_ctx(ctor.paramList()),
                        "linea": ctor.start.line,
                        "ctx": ctor,
                    }

            if info.get("constructor") is None:
                self._warning(ctx.start.line, f"La clase '{nombre}' no tiene constructor")

            # Luego validar/visitar bodies de constructor/metodos
            for m in ctx.classBody().classMember():
                if m.constructorDecl():
                    self.visit(m.constructorDecl())
                elif m.methodDecl():
                    self.visit(m.methodDecl())
        finally:
            self.clase_actual = prev_class
        return None

    def visitFieldDecl(self, ctx: WovenParser.FieldDeclContext):
        if not self.clase_actual:
            return None
        cname = self.clase_actual
        campo = ctx.IDENTIFIER().getText()
        ctype = ctx.typeName().getText()
        self.clases[cname]["campos"][campo] = {
            "tipo": ctype,
            "linea": ctx.start.line,
        }
        return None

    def visitConstructorDecl(self, ctx: WovenParser.ConstructorDeclContext):
        self._entrar_scope()
        try:
            self._declarar("self", self.clase_actual or "self", ctx.start.line)
            for p in self._params_de_ctx(ctx.paramList()):
                self._declarar(p["nombre"], p["tipo"], p["linea"])
            self.visit(ctx.block())
        finally:
            self._salir_scope()
        return None

    def visitMethodDecl(self, ctx: WovenParser.MethodDeclContext):
        mname = ctx.IDENTIFIER().getText()
        if self.clase_actual:
            cinfo = self.clases.get(self.clase_actual, {})
            padre = cinfo.get("padre")
            if ctx.VIRTUAL() is not None and padre in self.clases:
                parent_methods = self.clases[padre].get("metodos", {})
                pmethod = parent_methods.get(mname)
                if not pmethod or not pmethod.get("virtual"):
                    self._error(
                        ctx.start.line,
                        f"El método virtual '{mname}' no existe como virtual en la clase padre"
                    )

        prev_fn = self.funcion_actual
        self.funcion_actual = {
            "nombre": mname,
            "retorno": ctx.returnType().getText(),
            "has_return": False,
        }
        self._entrar_scope()
        try:
            self._declarar("self", self.clase_actual or "self", ctx.start.line)
            for p in self._params_de_ctx(ctx.paramList()):
                self._declarar(p["nombre"], p["tipo"], p["linea"])
            self.visit(ctx.block())
        finally:
            self._salir_scope()
            self.funcion_actual = prev_fn
        return None

    # ---------- functions ----------
    def visitFunctionDecl(self, ctx: WovenParser.FunctionDeclContext):
        nombre = ctx.IDENTIFIER().getText()
        if len(nombre) == 1:
            self._warning(ctx.start.line, "Nombre de función muy corto")

        ret = ctx.returnType().getText()
        prev_fn = self.funcion_actual
        self.funcion_actual = {"nombre": nombre, "retorno": ret, "has_return": False}

        self._entrar_scope()
        try:
            for p in self._params_de_ctx(ctx.paramList()):
                self._declarar(p["nombre"], p["tipo"], p["linea"])
            self.visit(ctx.block())
        finally:
            self._salir_scope()

        if ret != "void" and not self.funcion_actual["has_return"]:
            self._error(ctx.start.line, f"La función '{nombre}' debe tener al menos un return")

        self.funcion_actual = prev_fn
        return None

    # ---------- variables ----------
    def visitVarDecl(self, ctx: WovenParser.VarDeclContext):
        nombre = ctx.IDENTIFIER().getText()
        tipo = ctx.typeName().getText()
        linea = ctx.start.line

        if nombre in NOMBRES_RESERVADOS:
            return None

        if len(nombre) == 1 and nombre not in {"i", "j", "k", "n", "x", "y", "z"}:
            self._warning(linea, f"Nombre de variable '{nombre}' muy corto")

        if ctx.expr():
            expr_tipo = self.visit(ctx.expr())
            if expr_tipo and not self._compatible(tipo, expr_tipo):
                self._error(
                    linea,
                    f"Asignación incompatible: '{nombre}' es {tipo}, recibió {expr_tipo}"
                )

        self._declarar(nombre, tipo, linea)
        return None

    def visitForStmt(self, ctx: WovenParser.ForStmtContext):
        self._entrar_scope()
        try:
            if ctx.forInit():
                self.visit(ctx.forInit())
            if ctx.expr():
                self.visit(ctx.expr())
            if ctx.forUpdate():
                self.visit(ctx.forUpdate())
            self.visit(ctx.block())
        finally:
            self._salir_scope()
        return None

    def visitForInit(self, ctx: WovenParser.ForInitContext):
        if ctx.typeName():
            nombre = ctx.IDENTIFIER().getText()
            tipo = ctx.typeName().getText()
            linea = ctx.start.line
            expr_tipo = self.visit(ctx.expr()) if ctx.expr() else None
            if expr_tipo and not self._compatible(tipo, expr_tipo):
                self._error(
                    linea,
                    f"Asignación incompatible: '{nombre}' es {tipo}, recibió {expr_tipo}"
                )
            self._declarar(nombre, tipo, linea)
            return None
        if ctx.assignment():
            return self.visit(ctx.assignment())
        return None

    def visitForUpdate(self, ctx: WovenParser.ForUpdateContext):
        if ctx.assignment():
            return self.visit(ctx.assignment())
        if ctx.expr():
            return self.visit(ctx.expr())
        return None

    def visitAssignment(self, ctx: WovenParser.AssignmentContext):
        nombre = ctx.IDENTIFIER().getText()
        info = self._buscar(nombre)
        if info is None:
            self._error(ctx.start.line, f"Variable '{nombre}' usada sin declarar")
            return None

        expr_tipo = self.visit(ctx.expr())
        if expr_tipo and not self._compatible(info["tipo"], expr_tipo):
            self._error(
                ctx.start.line,
                f"Asignación incompatible: '{nombre}' es {info['tipo']}, recibió {expr_tipo}"
            )
        return None

    def visitReturnStmt(self, ctx: WovenParser.ReturnStmtContext):
        if self.funcion_actual:
            self.funcion_actual["has_return"] = True
            if self.funcion_actual["retorno"] == "void" and ctx.expr() is not None:
                self._warning(ctx.start.line, "Función void no debería retornar un valor")
        if ctx.expr():
            self.visit(ctx.expr())
        return None

    # ---------- calls / atoms ----------
    def visitIdAtom(self, ctx: WovenParser.IdAtomContext):
        nombre = ctx.IDENTIFIER().getText()
        found = self._buscar(nombre)
        if found:
            self._marcar_usado(nombre)
            return found["tipo"]
        if nombre in self.funciones:
            return self.funciones[nombre]["retorno"]
        if nombre in self.clases:
            return nombre
        self._error(ctx.start.line, f"'{nombre}' no está definido")
        return None

    def visitCallAtom(self, ctx: WovenParser.CallAtomContext):
        nombre = ctx.IDENTIFIER().getText()
        if nombre not in self.funciones:
            self._error(ctx.start.line, f"Función '{nombre}' no existe")
            return None

        meta = self.funciones[nombre]
        args = self._expr_types(ctx.argList())
        esperados = meta["params"]
        if len(args) != len(esperados):
            self._error(
                ctx.start.line,
                f"'{nombre}' espera {len(esperados)} argumentos, recibió {len(args)}"
            )
        return meta["retorno"]

    def visitNewAtom(self, ctx: WovenParser.NewAtomContext):
        nombre = ctx.IDENTIFIER().getText()
        if nombre not in self.clases:
            self._error(ctx.start.line, f"Clase '{nombre}' no definida")
            self._expr_types(ctx.argList())
            return None

        args = self._expr_types(ctx.argList())
        ctor = self.clases[nombre].get("constructor")
        esperados = ctor["params"] if ctor else []
        if len(args) != len(esperados):
            self._error(
                ctx.start.line,
                f"Constructor de '{nombre}' espera {len(esperados)} argumentos, recibió {len(args)}"
            )
        return nombre

    def visitMemberAccessAtom(self, ctx: WovenParser.MemberAccessAtomContext):
        base_type = self.visit(ctx.atom())
        campo = ctx.IDENTIFIER().getText()

        if self._es_tipo_lista(base_type):
            if campo == "length":
                return "int"
            self._error(ctx.start.line, f"La lista no tiene campo '{campo}'")
            return None

        if base_type in self.clases:
            class_info = self.clases[base_type]
            if campo in class_info["campos"]:
                return class_info["campos"][campo]["tipo"]
            self._error(ctx.start.line, f"La clase '{base_type}' no tiene campo '{campo}'")
            return None
        return None

    def visitMemberCallAtom(self, ctx: WovenParser.MemberCallAtomContext):
        base_type = self.visit(ctx.atom())
        method = ctx.IDENTIFIER().getText()
        args = self._expr_types(ctx.argList())

        if self._es_tipo_lista(base_type):
            inner = self._tipo_inner_lista(base_type) or "any"
            if method == "append":
                if len(args) != 1:
                    self._error(ctx.start.line, "append espera 1 argumento")
                elif args[0] and inner != "any" and not self._compatible(inner, args[0]):
                    self._error(ctx.start.line, f"append requiere {inner}, recibió {args[0]}")
                return "void"
            if method == "remove":
                if len(args) != 1:
                    self._error(ctx.start.line, "remove espera 1 argumento")
                return inner
            self._error(ctx.start.line, f"Método de lista no soportado: '{method}'")
            return None

        if base_type in self.clases:
            cinfo = self.clases[base_type]
            minfo = cinfo.get("metodos", {}).get(method)
            if not minfo:
                self._error(ctx.start.line, f"La clase '{base_type}' no tiene método '{method}'")
                return None
            if len(args) != len(minfo["params"]):
                self._error(
                    ctx.start.line,
                    f"'{method}' espera {len(minfo['params'])} argumentos, recibió {len(args)}"
                )
            return minfo["retorno"]
        return None

    def visitSelfFieldAtom(self, ctx: WovenParser.SelfFieldAtomContext):
        campo = ctx.IDENTIFIER().getText()
        if self.clase_actual in self.clases:
            campos = self.clases[self.clase_actual]["campos"]
            if campo in campos:
                return campos[campo]["tipo"]
            self._error(ctx.start.line, f"La clase '{self.clase_actual}' no tiene campo '{campo}'")
        return None

    def visitSelfCallAtom(self, ctx: WovenParser.SelfCallAtomContext):
        if not self.clase_actual or self.clase_actual not in self.clases:
            return None
        method = ctx.IDENTIFIER().getText()
        minfo = self.clases[self.clase_actual].get("metodos", {}).get(method)
        args = self._expr_types(ctx.argList())
        if not minfo:
            self._error(ctx.start.line, f"La clase '{self.clase_actual}' no tiene método '{method}'")
            return None
        if len(args) != len(minfo["params"]):
            self._error(
                ctx.start.line,
                f"'{method}' espera {len(minfo['params'])} argumentos, recibió {len(args)}"
            )
        return minfo["retorno"]

    def visitIndexAtom(self, ctx: WovenParser.IndexAtomContext):
        base_type = self.visit(ctx.atom())
        _ = self.visit(ctx.expr())
        if self._es_tipo_lista(base_type):
            return self._tipo_inner_lista(base_type)
        return None

    def visitListLiteralAtom(self, ctx: WovenParser.ListLiteralAtomContext):
        if not ctx.argList() or len(ctx.argList().expr()) == 0:
            return "list<any>"
        types = [self.visit(e) for e in ctx.argList().expr()]
        first = types[0]
        if all(t == first for t in types if t is not None):
            return f"list<{first}>"
        return "list<any>"

    # ---------- expr typing ----------
    def visitExpr(self, ctx: WovenParser.ExprContext):
        return self.visit(ctx.orExpr())

    def visitLogicalOr(self, ctx: WovenParser.LogicalOrContext):
        self.visit(ctx.orExpr())
        self.visit(ctx.andExpr())
        return "bool"

    def visitAndExprAlt(self, ctx: WovenParser.AndExprAltContext):
        return self.visit(ctx.andExpr())

    def visitLogicalAnd(self, ctx: WovenParser.LogicalAndContext):
        self.visit(ctx.andExpr())
        self.visit(ctx.compExpr())
        return "bool"

    def visitCompExprAlt(self, ctx: WovenParser.CompExprAltContext):
        return self.visit(ctx.compExpr())

    def visitBinaryOp(self, ctx: WovenParser.BinaryOpContext):
        left = self.visit(ctx.compExpr(0))
        right = self.visit(ctx.compExpr(1))
        if left == "string" or right == "string":
            return "string"
        if left == "float" or right == "float":
            return "float"
        return "int"

    def visitComparison(self, ctx: WovenParser.ComparisonContext):
        self.visit(ctx.compExpr(0))
        self.visit(ctx.compExpr(1))
        return "bool"

    def visitUnaryOp(self, ctx: WovenParser.UnaryOpContext):
        t = self.visit(ctx.compExpr())
        if ctx.op.text == "!":
            return "bool"
        return t

    def visitAtomExpr(self, ctx: WovenParser.AtomExprContext):
        return self.visit(ctx.atom())

    def visitLiteralAtom(self, ctx: WovenParser.LiteralAtomContext):
        return self.visit(ctx.literal())

    def visitParenAtom(self, ctx: WovenParser.ParenAtomContext):
        return self.visit(ctx.expr())

    def visitLiteral(self, ctx: WovenParser.LiteralContext):
        if ctx.INT_LITERAL():
            return "int"
        if ctx.FLOAT_LITERAL():
            return "float"
        if ctx.STRING_LITERAL() or ctx.STRING_INTERP():
            return "string"
        if ctx.TRUE() or ctx.FALSE():
            return "bool"
        return None


def lint_woven(source: str) -> str:
    from antlr4 import CommonTokenStream, InputStream
    from WovenLexer import WovenLexer
    from WovenParser import WovenParser

    class SilentErrors(ErrorListener):
        def syntaxError(self, *args):
            pass

    lexer = WovenLexer(InputStream(source))
    lexer.removeErrorListeners()
    lexer.addErrorListener(SilentErrors())

    stream = CommonTokenStream(lexer)
    parser = WovenParser(stream)
    parser.removeErrorListeners()
    parser.addErrorListener(SilentErrors())

    tree = parser.program()
    if parser.getNumberOfSyntaxErrors() > 0:
        return json.dumps({"diagnosticos": []}, ensure_ascii=False)

    visitor = LinterVisitor()
    try:
        visitor.visit(tree)
    except Exception:
        pass  # linter nunca debe crashear

    return json.dumps({
        "diagnosticos": visitor.diagnosticos
    }, ensure_ascii=False)
