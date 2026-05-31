import re
from dataclasses import dataclass

from antlr4 import CommonTokenStream, InputStream

from WovenLexer import WovenLexer
from WovenParser import WovenParser
from WovenVisitor import WovenVisitor


@dataclass
class Value:
    type_name: str
    value: object


class _ReturnSignal(Exception):
    def __init__(self, value):
        super().__init__()
        self.value = value


class InterpreterVisitor(WovenVisitor):
    def __init__(self):
        self.scopes = [{}]      # pila de tablas de simbolos
        self.types = [{}]       # pila de tablas de tipos
        self.functions = {}     # nombre -> metadata de funcion
        self.output = []        # lineas de salida para la UI

    # ---------- Helpers ----------
    def _runtime_error(self, message):
        self.output.append(f"Error: {message}")

    def _push_scope(self):
        self.scopes.append({})
        self.types.append({})

    def _pop_scope(self):
        self.scopes.pop()
        self.types.pop()

    def _lookup_var(self, name):
        for i in range(len(self.scopes) - 1, -1, -1):
            if name in self.scopes[i]:
                return i, self.scopes[i][name], self.types[i][name]
        return None, None, None

    def _declare_var(self, name, type_name, value):
        self.scopes[-1][name] = value
        self.types[-1][name] = type_name

    def _set_var(self, name, value):
        scope_idx, _, type_name = self._lookup_var(name)
        if scope_idx is None:
            raise RuntimeError(f"Variable usada sin declarar: '{name}'")
        if not self._is_compatible(type_name, value):
            raise RuntimeError(
                f"Tipo incompatible en asignacion: '{name}' es {type_name}, "
                f"se recibio {value.type_name}"
            )
        casted = self._cast_value(type_name, value)
        self.scopes[scope_idx][name] = casted

    def _is_compatible(self, expected_type, value):
        if value is None:
            return expected_type == "void"
        if expected_type == value.type_name:
            return True
        # Permitir int -> float
        return expected_type == "float" and value.type_name == "int"

    def _cast_value(self, expected_type, value):
        if expected_type == "float" and value.type_name == "int":
            return Value("float", float(value.value))
        return Value(expected_type, value.value)

    def _truthy(self, value):
        return bool(value.value)

    def _default_for_type(self, type_name):
        if type_name == "int":
            return Value("int", 0)
        if type_name == "float":
            return Value("float", 0.0)
        if type_name == "string":
            return Value("string", "")
        if type_name == "bool":
            return Value("bool", False)
        if type_name == "void":
            return None
        raise RuntimeError(f"Tipo desconocido: {type_name}")

    def _token_type_name(self, value):
        if isinstance(value, bool):
            return "bool"
        if isinstance(value, int):
            return "int"
        if isinstance(value, float):
            return "float"
        return "string"

    def _eval_interp_string(self, raw_token_text):
        inner = raw_token_text[1:-1]  # quitar comillas

        def repl(match):
            expr_text = match.group(1).strip()
            val = self._eval_expr_text(expr_text)
            return "" if val is None else str(val.value)

        return re.sub(r"\{([^}]*)\}", repl, inner)

    def _eval_expr_text(self, expr_text):
        # El lexer actual de Woven ignora WS solo con delimitadores abiertos.
        # Para expresiones embebidas, normalizamos espacios para evitar ruido.
        normalized = re.sub(r"\s+", "", expr_text)
        parser = WovenParser(CommonTokenStream(WovenLexer(InputStream(normalized))))
        tree = parser.expr()
        return self.visit(tree)

    # ---------- Program / statements ----------
    def visitProgram(self, ctx: WovenParser.ProgramContext):
        try:
            # 1) Registrar funciones
            for stmt in ctx.statement():
                comp = stmt.compoundStmt()
                if comp and comp.functionDecl():
                    self.visit(comp.functionDecl())

            # 2) Ejecutar sentencias top-level no-funcion
            for stmt in ctx.statement():
                comp = stmt.compoundStmt()
                if comp and comp.functionDecl():
                    continue
                self.visit(stmt)
        except Exception as exc:
            self._runtime_error(str(exc))
        return self.output

    def visitStatement(self, ctx: WovenParser.StatementContext):
        if ctx.compoundStmt():
            return self.visit(ctx.compoundStmt())
        return self.visit(ctx.simpleStmt())

    def visitSimpleStmt(self, ctx: WovenParser.SimpleStmtContext):
        child = ctx.getChild(0)
        return self.visit(child)

    def visitCompoundStmt(self, ctx: WovenParser.CompoundStmtContext):
        child = ctx.getChild(0)
        return self.visit(child)

    def visitBlock(self, ctx: WovenParser.BlockContext):
        for stmt in ctx.statement():
            self.visit(stmt)
        return None

    # ---------- Declarations / assignment ----------
    def visitFunctionDecl(self, ctx: WovenParser.FunctionDeclContext):
        fn_name = ctx.IDENTIFIER().getText()
        ret_type = ctx.returnType().getText()
        params = []
        if ctx.paramList():
            for p in ctx.paramList().param():
                p_type = p.typeName().getText()
                p_name = p.IDENTIFIER().getText()
                params.append((p_name, p_type))
        self.functions[fn_name] = {
            "ctx": ctx,
            "return_type": ret_type,
            "params": params,
        }
        return None

    def visitVarDecl(self, ctx: WovenParser.VarDeclContext):
        var_type = ctx.typeName().getText()
        name = ctx.IDENTIFIER().getText()
        if ctx.expr():
            value = self.visit(ctx.expr())
            if not self._is_compatible(var_type, value):
                raise RuntimeError(
                    f"Tipo incompatible en declaracion: '{name}' es {var_type}, "
                    f"se recibio {value.type_name}"
                )
            casted = self._cast_value(var_type, value)
        else:
            casted = self._default_for_type(var_type)
        self._declare_var(name, var_type, casted)
        return None

    def visitAssignment(self, ctx: WovenParser.AssignmentContext):
        name = ctx.IDENTIFIER().getText()
        value = self.visit(ctx.expr())
        self._set_var(name, value)
        return None

    # ---------- Control flow ----------
    def visitIfStmt(self, ctx: WovenParser.IfStmtContext):
        cond = self.visit(ctx.expr())
        if self._truthy(cond):
            self.visit(ctx.block(0))
        elif len(ctx.block()) > 1:
            self.visit(ctx.block(1))
        return None

    def visitForStmt(self, ctx: WovenParser.ForStmtContext):
        if ctx.forInit():
            self.visit(ctx.forInit())

        while True:
            if ctx.expr():
                cond = self.visit(ctx.expr())
                if not self._truthy(cond):
                    break
            self.visit(ctx.block())
            if ctx.forUpdate():
                self.visit(ctx.forUpdate())
            elif not ctx.expr():
                # for(;;) sin update ni condicion puede ser infinito.
                # dejamos el control al usuario solo con condicion explicita.
                break
        return None

    def visitForInit(self, ctx: WovenParser.ForInitContext):
        if ctx.typeName():
            var_type = ctx.typeName().getText()
            name = ctx.IDENTIFIER().getText()
            value = self.visit(ctx.expr())
            if not self._is_compatible(var_type, value):
                raise RuntimeError(
                    f"Tipo incompatible en forInit: '{name}' es {var_type}, "
                    f"se recibio {value.type_name}"
                )
            self._declare_var(name, var_type, self._cast_value(var_type, value))
            return None
        return self.visit(ctx.assignment())

    def visitForUpdate(self, ctx: WovenParser.ForUpdateContext):
        if ctx.assignment():
            return self.visit(ctx.assignment())
        return self.visit(ctx.expr())

    def visitWhileStmt(self, ctx: WovenParser.WhileStmtContext):
        while self._truthy(self.visit(ctx.expr())):
            self.visit(ctx.block())
        return None

    # ---------- Return / print ----------
    def visitReturnStmt(self, ctx: WovenParser.ReturnStmtContext):
        value = self.visit(ctx.expr()) if ctx.expr() else None
        raise _ReturnSignal(value)

    def visitPrintStmt(self, ctx: WovenParser.PrintStmtContext):
        if not ctx.argList():
            self.output.append("")
            return None
        values = [self.visit(expr) for expr in ctx.argList().expr()]
        self.output.append(" ".join(str(v.value) for v in values))
        return None

    def visitExprStmt(self, ctx: WovenParser.ExprStmtContext):
        return self.visit(ctx.expr())

    # ---------- Expressions ----------
    def visitExpr(self, ctx: WovenParser.ExprContext):
        return self.visit(ctx.orExpr())

    def visitLogicalOr(self, ctx: WovenParser.LogicalOrContext):
        left = self.visit(ctx.orExpr())
        if self._truthy(left):
            return Value("bool", True)
        right = self.visit(ctx.andExpr())
        return Value("bool", self._truthy(right))

    def visitAndExprAlt(self, ctx: WovenParser.AndExprAltContext):
        return self.visit(ctx.andExpr())

    def visitLogicalAnd(self, ctx: WovenParser.LogicalAndContext):
        left = self.visit(ctx.andExpr())
        if not self._truthy(left):
            return Value("bool", False)
        right = self.visit(ctx.compExpr())
        return Value("bool", self._truthy(right))

    def visitCompExprAlt(self, ctx: WovenParser.CompExprAltContext):
        return self.visit(ctx.compExpr())

    def visitBinaryOp(self, ctx: WovenParser.BinaryOpContext):
        left = self.visit(ctx.compExpr(0))
        right = self.visit(ctx.compExpr(1))
        op = ctx.op.text

        if op in {"+", "-", "*", "/", "%"}:
            if op == "+" and (left.type_name == "string" or right.type_name == "string"):
                return Value("string", str(left.value) + str(right.value))

            if left.type_name not in {"int", "float"} or right.type_name not in {"int", "float"}:
                raise RuntimeError(f"Operacion aritmetica invalida: {left.type_name} {op} {right.type_name}")

            lv = float(left.value) if left.type_name == "float" or right.type_name == "float" else int(left.value)
            rv = float(right.value) if left.type_name == "float" or right.type_name == "float" else int(right.value)

            if op == "+":
                res = lv + rv
            elif op == "-":
                res = lv - rv
            elif op == "*":
                res = lv * rv
            elif op == "/":
                if rv == 0:
                    raise RuntimeError("Division por cero")
                if left.type_name == "int" and right.type_name == "int":
                    res = int(left.value) // int(right.value)
                else:
                    res = lv / rv
            else:
                if rv == 0:
                    raise RuntimeError("Division por cero")
                res = lv % rv

            if isinstance(res, float):
                return Value("float", res)
            return Value("int", res)

        raise RuntimeError(f"Operador binario no soportado: {op}")

    def visitComparison(self, ctx: WovenParser.ComparisonContext):
        left = self.visit(ctx.compExpr(0))
        right = self.visit(ctx.compExpr(1))
        op = ctx.op.text
        lv, rv = left.value, right.value

        if op == "<":
            return Value("bool", lv < rv)
        if op == "<=":
            return Value("bool", lv <= rv)
        if op == ">":
            return Value("bool", lv > rv)
        if op == ">=":
            return Value("bool", lv >= rv)
        if op == "==":
            return Value("bool", lv == rv)
        if op == "!=":
            return Value("bool", lv != rv)
        raise RuntimeError(f"Comparador no soportado: {op}")

    def visitUnaryOp(self, ctx: WovenParser.UnaryOpContext):
        value = self.visit(ctx.compExpr())
        op = ctx.op.text
        if op == "-":
            if value.type_name not in {"int", "float"}:
                raise RuntimeError(f"Operador '-' invalido para tipo {value.type_name}")
            return Value(value.type_name, -value.value)
        if op == "!":
            return Value("bool", not self._truthy(value))
        raise RuntimeError(f"Operador unario no soportado: {op}")

    def visitAtomExpr(self, ctx: WovenParser.AtomExprContext):
        return self.visit(ctx.atom())

    def visitLiteralAtom(self, ctx: WovenParser.LiteralAtomContext):
        return self.visit(ctx.literal())

    def visitIdAtom(self, ctx: WovenParser.IdAtomContext):
        name = ctx.IDENTIFIER().getText()
        _, value, _ = self._lookup_var(name)
        if value is None:
            if name in self.functions:
                return ("function_ref", name)
            raise RuntimeError(f"Variable usada sin declarar: '{name}'")
        return value

    def visitParenAtom(self, ctx: WovenParser.ParenAtomContext):
        return self.visit(ctx.expr())

    def visitCallAtom(self, ctx: WovenParser.CallAtomContext):
        callee = self.visit(ctx.atom())
        if not isinstance(callee, tuple) or callee[0] != "function_ref":
            raise RuntimeError("Intento de llamada a un valor no invocable")

        fn_name = callee[1]
        if fn_name not in self.functions:
            raise RuntimeError(f"Funcion no declarada: '{fn_name}'")

        fn_meta = self.functions[fn_name]
        params = fn_meta["params"]
        args = []
        if ctx.argList():
            args = [self.visit(expr) for expr in ctx.argList().expr()]

        if len(args) != len(params):
            raise RuntimeError(
                f"Funcion '{fn_name}' llamada con numero incorrecto de argumentos: "
                f"esperados {len(params)}, recibidos {len(args)}"
            )

        self._push_scope()
        try:
            for (p_name, p_type), arg in zip(params, args):
                if not self._is_compatible(p_type, arg):
                    raise RuntimeError(
                        f"Tipo incompatible en parametro '{p_name}' de '{fn_name}': "
                        f"esperado {p_type}, recibido {arg.type_name}"
                    )
                self._declare_var(p_name, p_type, self._cast_value(p_type, arg))

            returned = None
            try:
                self.visit(fn_meta["ctx"].block())
            except _ReturnSignal as ret:
                returned = ret.value

            ret_type = fn_meta["return_type"]
            if ret_type == "void":
                if returned is not None:
                    raise RuntimeError(f"Funcion '{fn_name}' es void y no debe retornar valor")
                return Value("void", None)

            if returned is None:
                raise RuntimeError(f"Funcion '{fn_name}' debe retornar un valor de tipo {ret_type}")

            if not self._is_compatible(ret_type, returned):
                raise RuntimeError(
                    f"Tipo de retorno incompatible en '{fn_name}': "
                    f"esperado {ret_type}, recibido {returned.type_name}"
                )
            return self._cast_value(ret_type, returned)
        finally:
            self._pop_scope()

    def visitLiteral(self, ctx: WovenParser.LiteralContext):
        text = ctx.getText()
        if ctx.INT_LITERAL():
            return Value("int", int(text))
        if ctx.FLOAT_LITERAL():
            return Value("float", float(text))
        if ctx.STRING_INTERP():
            return Value("string", self._eval_interp_string(text))
        if ctx.STRING_LITERAL():
            # quitar comillas externas y desescapar minimalmente
            raw = text[1:-1]
            return Value("string", bytes(raw, "utf-8").decode("unicode_escape"))
        if ctx.TRUE():
            return Value("bool", True)
        if ctx.FALSE():
            return Value("bool", False)
        raise RuntimeError(f"Literal no soportado: {text}")

    # Permite que un identificador usado como atom pueda referenciar funcion.
    def visitAtom(self, ctx):  # fallback sobrecarga segura
        return super().visitAtom(ctx)

    def visitChildren(self, node):
        # Captura defensiva para evitar excepciones crudas hacia la UI.
        try:
            return super().visitChildren(node)
        except _ReturnSignal:
            raise
        except Exception as exc:
            self._runtime_error(str(exc))
            return Value("void", None)
