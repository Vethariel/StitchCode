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


class WovenObject:
    def __init__(self, class_name, fields):
        self.class_name = class_name
        self.fields = fields  # {nombre: Value}


class NullValue:
    """Representa ausencia de valor en Woven."""

    def __repr__(self):
        return "null"

    def __str__(self):
        return "null"

    def __eq__(self, other):
        return isinstance(other, NullValue)

    def __bool__(self):
        return False


class _ReturnSignal(Exception):
    def __init__(self, value):
        super().__init__()
        self.value = value


class BreakSignal(Exception):
    pass


class ContinueSignal(Exception):
    pass


class WovenThrowSignal(Exception):
    def __init__(self, mensaje: str, linea: int = None):
        super().__init__(mensaje)
        self.mensaje = mensaje
        self.linea = linea


class InterpreterVisitor(WovenVisitor):
    def __init__(self):
        self.scopes = [{}]
        self.types = [{}]
        self.functions = {}   # nombre -> {ctx, return_type, params}
        self.classes = {}     # nombre -> {fields, methods, parent, constructor}
        self.output = []
        self.current_class_stack = []
        self.return_type_actual = None
        self.return_encontrado = False
        self.scopes_cerrados = []

    # ---------- helpers ----------
    def _runtime_error(self, message):
        self.output.append(f"Error: {message}")

    def _es_error_no_capturable(self, exc: Exception):
        message = str(exc)
        return (
            "Variable usada sin declarar" in message
            or "no es visible aquí" in message
        )

    def _push_scope(self):
        self.scopes.append({})
        self.types.append({})

    def _pop_scope(self, es_funcion=False):
        closed_scope = self.scopes.pop()
        self.types.pop()
        self.scopes_cerrados.append(dict(closed_scope))

    def _lookup_var(self, name):
        for i in range(len(self.scopes) - 1, -1, -1):
            if name in self.scopes[i]:
                return i, self.scopes[i][name], self.types[i][name]
        return None, None, None

    def _in_closed_scopes(self, name):
        for scope in reversed(self.scopes_cerrados):
            if name in scope:
                return True
        return False

    def _declare_var(self, name, type_name, value):
        self.scopes[-1][name] = value
        self.types[-1][name] = type_name

    def _set_var(self, name, value):
        scope_idx, _, expected = self._lookup_var(name)
        if scope_idx is None:
            raise RuntimeError(f"Variable usada sin declarar: '{name}'")
        if value.type_name == "null" and not self._is_nullable_type(expected):
            raise RuntimeError(f"El tipo {expected} no puede ser null")
        if not self._is_compatible(expected, value):
            raise RuntimeError(
                f"Tipo incompatible en asignacion: '{name}' es {expected}, "
                f"se recibio {value.type_name}"
            )
        self.scopes[scope_idx][name] = self._cast_value(expected, value)

    def _truthy(self, value):
        return bool(value.value)

    def _is_list_type(self, type_name):
        return type_name.startswith("list<") or type_name == "list"

    def _is_nullable_type(self, type_name):
        return (
            type_name == "string"
            or self._is_list_type(type_name)
            or type_name in self.classes
        )

    def _get_list_inner_type(self, list_type_name: str) -> str:
        # "list<Nodo>" -> "Nodo"
        if list_type_name.startswith("list<") and list_type_name.endswith(">"):
            return list_type_name[5:-1]
        return list_type_name

    def _is_subclass_of(self, class_name, parent_name):
        cur = class_name
        while cur:
            if cur == parent_name:
                return True
            info = self.classes.get(cur)
            cur = info["parent"] if info else None
        return False

    def _is_compatible(self, expected_type, value):
        if value is None:
            return expected_type == "void"
        if value.type_name == "null":
            return self._is_nullable_type(expected_type)
        if expected_type == value.type_name:
            return True
        if expected_type == "float" and value.type_name == "int":
            return True
        if self._is_list_type(expected_type) and self._is_list_type(value.type_name):
            return True
        if expected_type in self.classes:
            if value.value is None:
                return True
            if isinstance(value.value, WovenObject):
                return self._is_subclass_of(value.value.class_name, expected_type)
        return False

    def _cast_value(self, expected_type, value):
        if value.type_name == "null":
            return Value(expected_type, value.value)
        if expected_type == "float" and value.type_name == "int":
            return Value("float", float(value.value))
        if expected_type in self.classes and isinstance(value.value, WovenObject):
            return Value(expected_type, value.value)
        if self._is_list_type(expected_type) and self._is_list_type(value.type_name):
            return Value(expected_type, value.value)
        return Value(expected_type, value.value)

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
        if self._is_list_type(type_name):
            return Value(type_name, [])
        if type_name in self.classes:
            return Value(type_name, None)
        return Value(type_name, None)

    def _infer_value(self, raw):
        if isinstance(raw, Value):
            return raw
        if isinstance(raw, NullValue):
            return Value("null", raw)
        if isinstance(raw, WovenObject):
            return Value(raw.class_name, raw)
        if isinstance(raw, bool):
            return Value("bool", raw)
        if isinstance(raw, int):
            return Value("int", raw)
        if isinstance(raw, float):
            return Value("float", raw)
        if isinstance(raw, str):
            return Value("string", raw)
        if isinstance(raw, list):
            return Value("list<any>", raw)
        return Value("unknown", raw)

    def _eval_interp_string(self, raw_token_text):
        inner = raw_token_text[1:-1]

        def repl(match):
            expr_text = match.group(1).strip()
            val = self._eval_expr_text(expr_text)
            return "" if val is None else str(val.value)

        return re.sub(r"\{([^}]*)\}", repl, inner)

    def _eval_expr_text(self, expr_text):
        parser = WovenParser(CommonTokenStream(WovenLexer(InputStream(expr_text))))
        return self.visit(parser.expr())

    def _parse_params(self, param_list_ctx):
        params = []
        if not param_list_ctx:
            return params
        for p in param_list_ctx.param():
            params.append((p.IDENTIFIER().getText(), p.typeName().getText()))
        return params

    # ---------- class/method helpers ----------
    def _resolve_method(self, class_name, method_name):
        cur = class_name
        while cur:
            info = self.classes.get(cur)
            if not info:
                break
            if method_name in info["methods"]:
                return cur, info["methods"][method_name]
            cur = info["parent"]
        return None, None

    def _collect_fields(self, class_name):
        info = self.classes.get(class_name)
        if not info:
            raise RuntimeError(f"Clase no declarada: '{class_name}'")
        items = []
        if info["parent"]:
            items.extend(self._collect_fields(info["parent"]))
        names = [n for n, _ in items]
        for name, t in info["fields"]:
            if name in names:
                idx = names.index(name)
                items[idx] = (name, t)
            else:
                items.append((name, t))
        return items

    def _invoke_constructor(self, obj, class_name, args):
        info = self.classes.get(class_name)
        if not info:
            raise RuntimeError(f"Clase no declarada: '{class_name}'")
        ctor = info["constructor"]
        if ctor is None:
            if args:
                raise RuntimeError(
                    f"Constructor de '{class_name}' llamado con numero incorrecto de argumentos: "
                    f"esperados 0, recibidos {len(args)}"
                )
            return

        params = self._parse_params(ctor.paramList())
        if len(args) != len(params):
            raise RuntimeError(
                f"Constructor de '{class_name}' llamado con numero incorrecto de argumentos: "
                f"esperados {len(params)}, recibidos {len(args)}"
            )

        self._push_scope()
        self.current_class_stack.append(class_name)
        try:
            self._declare_var("self", class_name, Value(class_name, obj))
            for (p_name, p_type), arg in zip(params, args):
                if not self._is_compatible(p_type, arg):
                    raise RuntimeError(
                        f"Tipo incompatible en parametro '{p_name}' de constructor '{class_name}': "
                        f"esperado {p_type}, recibido {arg.type_name}"
                    )
                self._declare_var(p_name, p_type, self._cast_value(p_type, arg))
            try:
                self.visit(ctor.block())
            except _ReturnSignal:
                pass
        finally:
            self.current_class_stack.pop()
            self._pop_scope(es_funcion=True)

    def _instantiate_class(self, class_name, args):
        if class_name not in self.classes:
            raise RuntimeError(f"Clase no definida: {class_name}")
        fields = {}
        for field_name, field_type in self._collect_fields(class_name):
            fields[field_name] = self._default_for_type(field_type)
        obj = WovenObject(class_name, fields)
        self._invoke_constructor(obj, class_name, args)
        return Value(class_name, obj)

    def _invoke_method(self, obj, method_name, args):
        owner_class, method_info = self._resolve_method(obj.class_name, method_name)
        if method_info is None:
            raise RuntimeError(f"Metodo no encontrado: '{method_name}' en clase '{obj.class_name}'")
        method_ctx = method_info["ctx"]
        ret_type = method_info["return_type"]
        params = method_info["params"]

        if len(args) != len(params):
            raise RuntimeError(
                f"Funcion '{method_name}' llamada con numero incorrecto de argumentos: "
                f"esperados {len(params)}, recibidos {len(args)}"
            )

        prev_return_type = self.return_type_actual
        prev_return_found = self.return_encontrado
        self.return_type_actual = ret_type
        self.return_encontrado = False

        self._push_scope()
        self.current_class_stack.append(owner_class)
        try:
            self._declare_var("self", obj.class_name, Value(obj.class_name, obj))
            for (p_name, p_type), arg in zip(params, args):
                if not self._is_compatible(p_type, arg):
                    raise RuntimeError(
                        f"Tipo incompatible en parametro '{p_name}' de metodo '{method_name}': "
                        f"esperado {p_type}, recibido {arg.type_name}"
                    )
                self._declare_var(p_name, p_type, self._cast_value(p_type, arg))

            returned = None
            try:
                self.visit(method_ctx.block())
            except _ReturnSignal as ret:
                returned = ret.value

            if ret_type == "void":
                return Value("void", None)
            if not self.return_encontrado:
                self.output.append(
                    f"Error: la función '{method_name}' debe retornar un valor de tipo "
                    f"{ret_type} pero no tiene return"
                )
                return Value("void", None)
            return self._cast_value(ret_type, returned)
        finally:
            self.return_type_actual = prev_return_type
            self.return_encontrado = prev_return_found
            self.current_class_stack.pop()
            self._pop_scope(es_funcion=True)

    # ---------- top-level ----------
    def visitProgram(self, ctx: WovenParser.ProgramContext):
        try:
            # 1) Registrar funciones y clases
            for stmt in ctx.statement():
                comp = stmt.compoundStmt()
                if not comp:
                    continue
                if comp.functionDecl():
                    self.visit(comp.functionDecl())
                elif comp.classDecl():
                    self.visit(comp.classDecl())

            # 2) Ejecutar sentencias top-level no declarativas
            for stmt in ctx.statement():
                comp = stmt.compoundStmt()
                if comp and (comp.functionDecl() or comp.classDecl()):
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
        return self.visit(ctx.getChild(0))

    def visitCompoundStmt(self, ctx: WovenParser.CompoundStmtContext):
        return self.visit(ctx.getChild(0))

    def visitBlock(self, ctx: WovenParser.BlockContext):
        for stmt in ctx.statement():
            self.visit(stmt)
        return None

    # ---------- declarations ----------
    def visitFunctionDecl(self, ctx: WovenParser.FunctionDeclContext):
        fn_name = ctx.IDENTIFIER().getText()
        self.functions[fn_name] = {
            "ctx": ctx,
            "return_type": ctx.returnType().getText(),
            "params": self._parse_params(ctx.paramList()),
        }
        return None

    def visitClassDecl(self, ctx: WovenParser.ClassDeclContext):
        ids = ctx.IDENTIFIER()
        class_name = ids[0].getText()
        parent = ids[1].getText() if len(ids) > 1 else None

        fields = []
        methods = {}
        constructor = None

        for member in ctx.classBody().classMember():
            if member.fieldDecl():
                f = member.fieldDecl()
                fields.append((f.IDENTIFIER().getText(), f.typeName().getText()))
            elif member.constructorDecl():
                constructor = member.constructorDecl()
            elif member.methodDecl():
                m = member.methodDecl()
                name = m.IDENTIFIER().getText()
                methods[name] = {
                    "ctx": m,
                    "return_type": m.returnType().getText(),
                    "params": self._parse_params(m.paramList()),
                    "virtual": m.VIRTUAL() is not None,
                }

        self.classes[class_name] = {
            "fields": fields,
            "methods": methods,
            "parent": parent,
            "constructor": constructor,
        }
        return None

    def visitMethodDecl(self, ctx: WovenParser.MethodDeclContext):
        return None

    def visitConstructorDecl(self, ctx: WovenParser.ConstructorDeclContext):
        return None

    def visitVarDecl(self, ctx: WovenParser.VarDeclContext):
        var_type = ctx.typeName().getText()
        name = ctx.IDENTIFIER().getText()
        if ctx.expr():
            value = self.visit(ctx.expr())
            if value.type_name == "null" and not self._is_nullable_type(var_type):
                raise RuntimeError(f"El tipo {var_type} no puede ser null")
            if not self._is_compatible(var_type, value):
                raise RuntimeError(
                    f"Tipo incompatible en declaracion: '{name}' es {var_type}, "
                    f"se recibio {value.type_name}"
                )
            casted = self._cast_value(var_type, value)
        else:
            if self._is_nullable_type(var_type):
                casted = Value(var_type, NullValue())
            else:
                raise RuntimeError(f"El tipo {var_type} no puede ser null")
        self._declare_var(name, var_type, casted)
        return None

    def visitAssignment(self, ctx: WovenParser.AssignmentContext):
        self._set_var(ctx.IDENTIFIER().getText(), self.visit(ctx.expr()))
        return None

    def visitSelfAssignment(self, ctx: WovenParser.SelfAssignmentContext):
        _, self_val, _ = self._lookup_var("self")
        if self_val is None or not isinstance(self_val.value, WovenObject):
            raise RuntimeError("Uso de self fuera de contexto de objeto")
        field = ctx.IDENTIFIER().getText()
        obj = self_val.value
        if field not in obj.fields:
            raise RuntimeError(f"Campo no declarado: '{field}' en clase '{obj.class_name}'")
        expected = obj.fields[field].type_name
        value = self.visit(ctx.expr())
        if not self._is_compatible(expected, value):
            raise RuntimeError(
                f"Tipo incompatible en asignacion de campo '{field}': "
                f"esperado {expected}, recibido {value.type_name}"
            )
        obj.fields[field] = self._cast_value(expected, value)
        return None

    def visitIndexAssignment(self, ctx: WovenParser.IndexAssignmentContext):
        idx_val = self.visit(ctx.expr(0))
        rhs_val = self.visit(ctx.expr(1))
        if idx_val.type_name != "int":
            raise RuntimeError("Indice de lista debe ser int")
        index = idx_val.value

        if ctx.SELF():
            _, self_val, _ = self._lookup_var("self")
            if self_val is None or not isinstance(self_val.value, WovenObject):
                raise RuntimeError("Uso de self fuera de contexto de objeto")
            field = ctx.IDENTIFIER().getText()
            if field not in self_val.value.fields:
                raise RuntimeError(f"Campo no declarado: '{field}'")
            list_val = self_val.value.fields[field]
        else:
            _, list_val, _ = self._lookup_var(ctx.IDENTIFIER().getText())
            if list_val is None:
                raise RuntimeError(f"Variable usada sin declarar: '{ctx.IDENTIFIER().getText()}'")

        if not self._is_list_type(list_val.type_name):
            raise RuntimeError("Asignacion por indice requiere una lista")
        if index < 0 or index >= len(list_val.value):
            raise RuntimeError("Indice fuera de rango")
        list_val.value[index] = rhs_val.value
        return None

    # ---------- control ----------
    def visitIfStmt(self, ctx: WovenParser.IfStmtContext):
        if self._truthy(self.visit(ctx.expr())):
            self._push_scope()
            try:
                self.visit(ctx.block(0))
            finally:
                self._pop_scope()
        elif len(ctx.block()) > 1:
            self._push_scope()
            try:
                self.visit(ctx.block(1))
            finally:
                self._pop_scope()
        return None

    def visitForStmt(self, ctx: WovenParser.ForStmtContext):
        self._push_scope()
        try:
            if ctx.forInit():
                self.visit(ctx.forInit())
            while True:
                if ctx.expr() and not self._truthy(self.visit(ctx.expr())):
                    break
                self._push_scope()
                should_break = False
                try:
                    self.visit(ctx.block())
                except BreakSignal:
                    should_break = True
                except ContinueSignal:
                    pass
                finally:
                    self._pop_scope()
                if should_break:
                    break
                if ctx.forUpdate():
                    self.visit(ctx.forUpdate())
                if not ctx.expr() and not ctx.forUpdate():
                    break
        finally:
            self._pop_scope()
        return None

    def visitForInit(self, ctx: WovenParser.ForInitContext):
        if ctx.typeName():
            t = ctx.typeName().getText()
            n = ctx.IDENTIFIER().getText()
            v = self.visit(ctx.expr())
            if not self._is_compatible(t, v):
                raise RuntimeError(
                    f"Tipo incompatible en forInit: '{n}' es {t}, se recibio {v.type_name}"
                )
            self._declare_var(n, t, self._cast_value(t, v))
            return None
        return self.visit(ctx.assignment())

    def visitForUpdate(self, ctx: WovenParser.ForUpdateContext):
        if ctx.assignment():
            return self.visit(ctx.assignment())
        return self.visit(ctx.expr())

    def visitWhileStmt(self, ctx: WovenParser.WhileStmtContext):
        while self._truthy(self.visit(ctx.expr())):
            self._push_scope()
            try:
                self.visit(ctx.block())
            except BreakSignal:
                self._pop_scope()
                break
            except ContinueSignal:
                self._pop_scope()
                continue
            self._pop_scope()
        return None

    def _ejecutar_catch(self, ctx: WovenParser.TryStmtContext, mensaje: str):
        nombre_var = ctx.IDENTIFIER().getText()
        self._push_scope()
        try:
            self._declare_var(nombre_var, "string", Value("string", mensaje))
            self.visit(ctx.block(1))
        finally:
            self._pop_scope()
        return None

    def visitTryStmt(self, ctx: WovenParser.TryStmtContext):
        self._push_scope()
        try:
            self.visit(ctx.block(0))
        except WovenThrowSignal as exc:
            self._pop_scope()
            return self._ejecutar_catch(ctx, exc.mensaje)
        except Exception as exc:
            self._pop_scope()
            if self._es_error_no_capturable(exc):
                raise
            return self._ejecutar_catch(ctx, str(exc))
        self._pop_scope()
        return None

    def visitBreakStmt(self, ctx: WovenParser.BreakStmtContext):
        raise BreakSignal()

    def visitContinueStmt(self, ctx: WovenParser.ContinueStmtContext):
        raise ContinueSignal()

    def visitThrowStmt(self, ctx: WovenParser.ThrowStmtContext):
        valor = self.visit(ctx.expr())
        mensaje = str(valor.value) if valor.value is not None else "error"
        raise WovenThrowSignal(mensaje, ctx.start.line)

    # ---------- io / returns ----------
    def visitReturnStmt(self, ctx: WovenParser.ReturnStmtContext):
        self.return_encontrado = True

        if ctx.expr() is None:
            if self.return_type_actual and self.return_type_actual != "void":
                self.output.append(
                    f"Error: se esperaba retornar {self.return_type_actual} "
                    f"pero return no tiene valor"
                )
            raise _ReturnSignal(Value("void", None))

        valor = self.visit(ctx.expr())

        if self.return_type_actual == "void":
            self.output.append("Error: función void no debe retornar un valor")
            raise _ReturnSignal(valor)

        if self.return_type_actual and not self._is_compatible(self.return_type_actual, valor):
            self.output.append(
                f"Error: se esperaba retornar {self.return_type_actual} "
                f"pero se retornó {valor.type_name}"
            )

        raise _ReturnSignal(valor)

    def visitPrintStmt(self, ctx: WovenParser.PrintStmtContext):
        if not ctx.argList():
            self.output.append("")
            return None
        vals = [self.visit(e).value for e in ctx.argList().expr()]
        self.output.append(" ".join(str(v) for v in vals))
        return None

    def visitExprStmt(self, ctx: WovenParser.ExprStmtContext):
        return self.visit(ctx.expr())

    # ---------- expr ----------
    def visitExpr(self, ctx: WovenParser.ExprContext):
        return self.visit(ctx.orExpr())

    def visitLogicalOr(self, ctx: WovenParser.LogicalOrContext):
        left = self.visit(ctx.orExpr())
        if self._truthy(left):
            return Value("bool", True)
        return Value("bool", self._truthy(self.visit(ctx.andExpr())))

    def visitAndExprAlt(self, ctx: WovenParser.AndExprAltContext):
        return self.visit(ctx.andExpr())

    def visitLogicalAnd(self, ctx: WovenParser.LogicalAndContext):
        left = self.visit(ctx.andExpr())
        if not self._truthy(left):
            return Value("bool", False)
        return Value("bool", self._truthy(self.visit(ctx.compExpr())))

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

            mixed = left.type_name == "float" or right.type_name == "float"
            lv = float(left.value) if mixed else int(left.value)
            rv = float(right.value) if mixed else int(right.value)

            if op == "+":
                res = lv + rv
            elif op == "-":
                res = lv - rv
            elif op == "*":
                res = lv * rv
            elif op == "/":
                if rv == 0:
                    raise WovenThrowSignal("Division por cero", ctx.start.line)
                if left.type_name == "int" and right.type_name == "int":
                    res = int(left.value) // int(right.value)
                else:
                    res = lv / rv
            else:
                if rv == 0:
                    raise WovenThrowSignal("Division por cero", ctx.start.line)
                res = lv % rv

            if isinstance(res, float):
                return Value("float", res)
            return Value("int", res)

        raise RuntimeError(f"Operador binario no soportado: {op}")

    def visitComparison(self, ctx: WovenParser.ComparisonContext):
        left = self.visit(ctx.compExpr(0)).value
        right = self.visit(ctx.compExpr(1)).value
        op = ctx.op.text
        if op == "<":
            return Value("bool", left < right)
        if op == "<=":
            return Value("bool", left <= right)
        if op == ">":
            return Value("bool", left > right)
        if op == ">=":
            return Value("bool", left >= right)
        if op == "==":
            return Value("bool", left == right)
        if op == "!=":
            return Value("bool", left != right)
        raise RuntimeError(f"Comparador no soportado: {op}")

    def visitUnaryOp(self, ctx: WovenParser.UnaryOpContext):
        val = self.visit(ctx.compExpr())
        if ctx.op.text == "-":
            if val.type_name not in {"int", "float"}:
                raise RuntimeError(f"Operador '-' invalido para tipo {val.type_name}")
            return Value(val.type_name, -val.value)
        if ctx.op.text == "!":
            return Value("bool", not self._truthy(val))
        raise RuntimeError(f"Operador unario no soportado: {ctx.op.text}")

    def visitAtomExpr(self, ctx: WovenParser.AtomExprContext):
        return self.visit(ctx.atom())

    # ---------- atom ----------
    def visitLiteralAtom(self, ctx: WovenParser.LiteralAtomContext):
        return self.visit(ctx.literal())

    def visitIdAtom(self, ctx: WovenParser.IdAtomContext):
        name = ctx.IDENTIFIER().getText()
        _, value, _ = self._lookup_var(name)
        if value is not None:
            return value
        if self._in_closed_scopes(name):
            raise RuntimeError(
                f"Variable '{name}' fue declarada dentro de un bloque "
                f"y no es visible aquí"
            )
        if name in self.classes:
            return ("class_ref", name)
        if name in self.functions:
            return ("function_ref", name)
        raise RuntimeError(f"Variable usada sin declarar: '{name}'")

    def visitParenAtom(self, ctx: WovenParser.ParenAtomContext):
        return self.visit(ctx.expr())

    def visitCallAtom(self, ctx: WovenParser.CallAtomContext):
        args = [self.visit(e) for e in (ctx.argList().expr() if ctx.argList() else [])]
        fn_name = ctx.IDENTIFIER().getText()
        if fn_name in self.classes:
            raise RuntimeError(f"Para crear un objeto usa new {fn_name}(...)")
        if fn_name not in self.functions:
            raise RuntimeError(f"Funcion no declarada: '{fn_name}'")

        fn_meta = self.functions[fn_name]
        params = fn_meta["params"]
        if len(args) != len(params):
            raise RuntimeError(
                f"Funcion '{fn_name}' llamada con numero incorrecto de argumentos: "
                f"esperados {len(params)}, recibidos {len(args)}"
            )

        prev_return_type = self.return_type_actual
        prev_return_found = self.return_encontrado
        self.return_type_actual = fn_meta["return_type"]
        self.return_encontrado = False

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
                return Value("void", None)
            if not self.return_encontrado:
                self.output.append(
                    f"Error: la función '{fn_name}' debe retornar un valor de tipo "
                    f"{ret_type} pero no tiene return"
                )
                return Value("void", None)
            return self._cast_value(ret_type, returned)
        finally:
            self.return_type_actual = prev_return_type
            self.return_encontrado = prev_return_found
            self._pop_scope(es_funcion=True)

    def visitNewAtom(self, ctx: WovenParser.NewAtomContext):
        class_name = ctx.IDENTIFIER().getText()
        args = [self.visit(e) for e in (ctx.argList().expr() if ctx.argList() else [])]
        return self._instantiate_class(class_name, args)

    def visitSelfFieldAtom(self, ctx: WovenParser.SelfFieldAtomContext):
        _, self_val, _ = self._lookup_var("self")
        if self_val is None or not isinstance(self_val.value, WovenObject):
            raise RuntimeError("Uso de self fuera de contexto de objeto")
        field = ctx.IDENTIFIER().getText()
        obj = self_val.value
        if field not in obj.fields:
            raise RuntimeError(f"Campo no declarado: '{field}'")
        return obj.fields[field]

    def visitSelfCallAtom(self, ctx: WovenParser.SelfCallAtomContext):
        _, self_val, _ = self._lookup_var("self")
        if self_val is None or not isinstance(self_val.value, WovenObject):
            raise RuntimeError("Uso de self fuera de contexto de objeto")
        method = ctx.IDENTIFIER().getText()
        args = [self.visit(e) for e in (ctx.argList().expr() if ctx.argList() else [])]
        return self._invoke_method(self_val.value, method, args)

    def visitMemberAccessAtom(self, ctx: WovenParser.MemberAccessAtomContext):
        base = self.visit(ctx.atom())
        member = ctx.IDENTIFIER().getText()

        if isinstance(base.value, NullValue):
            raise WovenThrowSignal("No se puede acceder a un objeto null", ctx.start.line)

        if self._is_list_type(base.type_name):
            if member == "length":
                return Value("int", len(base.value))
            if member in {"append", "remove"}:
                return ("list_method_ref", base, member)
            raise RuntimeError(f"Miembro no soportado para lista: '{member}'")

        if isinstance(base.value, WovenObject):
            if member not in base.value.fields:
                if self._resolve_method(base.value.class_name, member)[1] is not None:
                    return ("object_method_ref", base.value, member)
                raise RuntimeError(f"Campo no declarado: '{member}'")
            return base.value.fields[member]

        raise RuntimeError("Acceso a miembro sobre valor no-objeto")

    def visitMemberCallAtom(self, ctx: WovenParser.MemberCallAtomContext):
        base = self.visit(ctx.atom())
        name = ctx.IDENTIFIER().getText()
        args = [self.visit(e) for e in (ctx.argList().expr() if ctx.argList() else [])]

        if isinstance(base.value, NullValue):
            raise WovenThrowSignal("No se puede acceder a un objeto null", ctx.start.line)

        if self._is_list_type(base.type_name):
            if name == "append":
                if len(args) != 1:
                    raise RuntimeError("append requiere exactamente 1 argumento")
                inner_type = self._get_list_inner_type(base.type_name)
                if not self._is_compatible(inner_type, args[0]):
                    self.output.append(
                        f"Error: no se puede agregar {args[0].type_name} "
                        f"a una lista de {inner_type}"
                    )
                    return Value("void", None)
                base.value.append(args[0].value)
                return Value("void", None)
            if name == "remove":
                if len(args) != 1 or args[0].type_name != "int":
                    raise RuntimeError("remove requiere indice int")
                idx = args[0].value
                if idx < 0 or idx >= len(base.value):
                    raise RuntimeError("Indice fuera de rango")
                removed = base.value.pop(idx)
                return self._infer_value(removed)
            raise RuntimeError(f"Metodo de lista no soportado: '{name}'")

        if isinstance(base.value, WovenObject):
            return self._invoke_method(base.value, name, args)

        raise RuntimeError("Llamada a miembro sobre valor no-objeto")

    def visitIndexAtom(self, ctx: WovenParser.IndexAtomContext):
        base = self.visit(ctx.atom())
        idx = self.visit(ctx.expr())
        if not self._is_list_type(base.type_name):
            raise RuntimeError("Indexacion requiere lista")
        if idx.type_name != "int":
            raise RuntimeError("Indice de lista debe ser int")
        if idx.value < 0 or idx.value >= len(base.value):
            raise RuntimeError("Indice fuera de rango")
        item = base.value[idx.value]
        inferred = self._infer_value(item)
        if self._is_list_type(base.type_name) and base.type_name.startswith("list<") and base.type_name.endswith(">"):
            inner = base.type_name[5:-1]
            return Value(inner, item)
        return inferred

    def visitListLiteralAtom(self, ctx: WovenParser.ListLiteralAtomContext):
        if not ctx.argList():
            return Value("list<any>", [])
        items = [self.visit(e) for e in ctx.argList().expr()]
        inner_type = items[0].type_name
        homogeneous = all(i.type_name == inner_type for i in items)
        list_type = f"list<{inner_type}>" if homogeneous else "list<any>"
        return Value(list_type, [i.value for i in items])

    def visitSuperCallAtom(self, ctx: WovenParser.SuperCallAtomContext):
        if not self.current_class_stack:
            raise RuntimeError("super() fuera de contexto de clase")
        cur_class = self.current_class_stack[-1]
        info = self.classes.get(cur_class)
        parent = info["parent"] if info else None
        if not parent:
            raise RuntimeError(f"La clase '{cur_class}' no tiene clase padre")
        _, self_val, _ = self._lookup_var("self")
        if self_val is None or not isinstance(self_val.value, WovenObject):
            raise RuntimeError("super() requiere instancia activa")
        args = [self.visit(e) for e in (ctx.argList().expr() if ctx.argList() else [])]
        self._invoke_constructor(self_val.value, parent, args)
        return Value("void", None)

    # ---------- literals ----------
    def visitLiteral(self, ctx: WovenParser.LiteralContext):
        text = ctx.getText()
        if ctx.INT_LITERAL():
            return Value("int", int(text))
        if ctx.FLOAT_LITERAL():
            return Value("float", float(text))
        if ctx.STRING_INTERP():
            return Value("string", self._eval_interp_string(text))
        if ctx.STRING_LITERAL():
            raw = text[1:-1]
            return Value("string", bytes(raw, "utf-8").decode("unicode_escape"))
        if ctx.TRUE():
            return Value("bool", True)
        if ctx.FALSE():
            return Value("bool", False)
        if ctx.NULL():
            return Value("null", NullValue())
        raise RuntimeError(f"Literal no soportado: {text}")
