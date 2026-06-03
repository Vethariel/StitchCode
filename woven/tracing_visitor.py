import json

from antlr4 import CommonTokenStream, InputStream

from WovenLexer import WovenLexer
from WovenParser import WovenParser
from interpreter_visitor import (
    InterpreterVisitor,
    NullValue,
    Value,
    WovenObject,
    _ReturnSignal,
)


class TracingInterpreterVisitor(InterpreterVisitor):
    def __init__(self, source: str = ""):
        super().__init__(source)
        self.eventos = []
        self.paso_actual = 0
        self.call_stack = []

    def _emit_event(self, data: dict):
        event = dict(data)
        event["paso"] = self.paso_actual
        event["call_stack"] = list(self.call_stack)
        self.eventos.append(event)
        self.paso_actual += 1

    def _snapshot_scope(self) -> dict:
        """Captura el estado completo de todas las variables en scopes activos."""
        snapshot = {}
        for scope, types in zip(self.scopes, self.types):
            for nombre, valor in scope.items():
                snapshot[nombre] = {
                    "valor": self._serializar_valor(valor),
                    "tipo": types.get(nombre, "desconocido"),
                }
        return snapshot

    def _serializar_valor(self, valor):
        """Convierte cualquier valor Woven a algo serializable en JSON."""
        if valor is None or isinstance(valor, NullValue):
            return None
        if isinstance(valor, Value):
            return self._serializar_valor(valor.value)
        if isinstance(valor, WovenObject):
            return {
                "clase": valor.class_name,
                "campos": {
                    k: self._serializar_valor(v)
                    for k, v in valor.fields.items()
                },
            }
        if isinstance(valor, list):
            return [self._serializar_valor(v) for v in valor]
        return valor

    def _codigo_linea(self, ctx):
        line = getattr(ctx.start, "line", None)
        if line is None:
            return ctx.getText()
        source = getattr(ctx.start, "source", None)
        if not source or len(source) < 2 or source[1] is None:
            return ctx.getText()
        try:
            lines = source[1].strdata.splitlines()
            if 1 <= line <= len(lines):
                return lines[line - 1]
        except Exception:
            pass
        return ctx.getText()

    def _emit_linea(self, ctx):
        self._emit_event(
            {
                "tipo": "linea",
                "linea": getattr(ctx.start, "line", None),
                "codigo": self._codigo_linea(ctx),
            }
        )

    def _emitir_variable(self, ctx, nombre, valor, tipo):
        self._emit_event(
            {
                "tipo": "variable",
                "linea": getattr(ctx.start, "line", None),
                "nombre": nombre,
                "valor": self._serializar_valor(valor),
                "tipo_var": tipo,
                "scope": self._snapshot_scope(),
            }
        )

    def _emitir_llamada(self, ctx, nombre, args_map):
        self._emit_event(
            {
                "tipo": "llamada",
                "linea": getattr(ctx.start, "line", None),
                "nombre": nombre,
                "args": args_map,
                "scope_previo": self._snapshot_scope(),
            }
        )

    def _emitir_retorno(self, ctx, nombre, valor):
        self._emit_event(
            {
                "tipo": "retorno",
                "linea": getattr(ctx.start, "line", None),
                "nombre": nombre,
                "valor": self._serializar_valor(valor),
                "scope_final": self._snapshot_scope(),
            }
        )

    def visitProgram(self, ctx: WovenParser.ProgramContext):
        try:
            for stmt in ctx.statement():
                comp = stmt.compoundStmt()
                if not comp:
                    continue
                if comp.functionDecl():
                    self.visit(comp.functionDecl())
                elif comp.classDecl():
                    self.visit(comp.classDecl())

            for stmt in ctx.statement():
                comp = stmt.compoundStmt()
                if comp and (comp.functionDecl() or comp.classDecl()):
                    continue
                self.visit(stmt)
        except Exception as e:
            self._emit_event(
                {
                    "tipo": "error",
                    "mensaje": str(e),
                    "linea": getattr(e, "linea", None),
                    "scope_al_fallar": self._snapshot_scope(),
                }
            )
            self._runtime_error(str(e))
        return self.output

    def visitStatement(self, ctx: WovenParser.StatementContext):
        self._emit_linea(ctx)
        return super().visitStatement(ctx)

    def visitVarDecl(self, ctx: WovenParser.VarDeclContext):
        result = super().visitVarDecl(ctx)
        nombre = ctx.IDENTIFIER().getText()
        _, valor, tipo = self._lookup_var(nombre)
        self._emitir_variable(ctx, nombre, valor, tipo)
        return result

    def visitAssignment(self, ctx: WovenParser.AssignmentContext):
        result = super().visitAssignment(ctx)
        nombre = ctx.IDENTIFIER().getText()
        _, valor, tipo = self._lookup_var(nombre)
        self._emitir_variable(ctx, nombre, valor, tipo)
        return result

    def visitClassDecl(self, ctx: WovenParser.ClassDeclContext):
        result = super().visitClassDecl(ctx)
        ids = ctx.IDENTIFIER()
        nombre_clase = ids[0].getText()
        padre = ids[1].getText() if len(ids) > 1 else None
        info = self.classes.get(nombre_clase, {})
        campos = [name for name, _ in info.get("fields", [])]
        self._emit_event(
            {
                "tipo": "clase",
                "linea": getattr(ctx.start, "line", None),
                "nombre": nombre_clase,
                "padre": padre,
                "campos": campos,
            }
        )
        return result

    def visitCallAtom(self, ctx: WovenParser.CallAtomContext):
        fn_name = ctx.IDENTIFIER().getText()
        args = [self.visit(e) for e in (ctx.argList().expr() if ctx.argList() else [])]
        fn_meta = self.functions.get(fn_name)
        params = [name for name, _ in fn_meta["params"]] if fn_meta else []
        args_map = {
            param: self._serializar_valor(val)
            for param, val in zip(params, args)
        }
        if fn_name in self.functions:
            self.call_stack.append(fn_name)
            self._emitir_llamada(ctx, fn_name, args_map)
        try:
            return super().visitCallAtom(ctx)
        finally:
            if self.call_stack and self.call_stack[-1] == fn_name:
                self.call_stack.pop()

    def visitMemberCallAtom(self, ctx: WovenParser.MemberCallAtomContext):
        base = self.visit(ctx.atom())
        name = ctx.IDENTIFIER().getText()
        args = [self.visit(e) for e in (ctx.argList().expr() if ctx.argList() else [])]

        should_trace_call = isinstance(getattr(base, "value", None), WovenObject)
        if should_trace_call:
            obj = base.value
            _, method_info = self._resolve_method(obj.class_name, name)
            params = [p_name for p_name, _ in method_info["params"]] if method_info else []
            args_map = {
                param: self._serializar_valor(val)
                for param, val in zip(params, args)
            }
            self.call_stack.append(name)
            self._emitir_llamada(ctx, name, args_map)

        try:
            return super().visitMemberCallAtom(ctx)
        finally:
            if should_trace_call and self.call_stack and self.call_stack[-1] == name:
                self.call_stack.pop()

    def visitReturnStmt(self, ctx: WovenParser.ReturnStmtContext):
        value = self.visit(ctx.expr()) if ctx.expr() else None
        self._emitir_retorno(ctx, self.call_stack[-1] if self.call_stack else None, value)
        raise _ReturnSignal(value)


def trace_woven(source: str) -> str:
    lexer = WovenLexer(InputStream(source))
    stream = CommonTokenStream(lexer)
    parser = WovenParser(stream)
    tree = parser.program()

    visitor = TracingInterpreterVisitor(source)
    try:
        visitor.visit(tree)
    except Exception as e:
        visitor._emit_event(
            {
                "tipo": "error",
                "mensaje": str(e),
                "linea": None,
                "scope_al_fallar": visitor._snapshot_scope(),
            }
        )

    return json.dumps(
        {
            "eventos": visitor.eventos,
            "total_pasos": visitor.paso_actual,
            "exito": not any(e["tipo"] == "error" for e in visitor.eventos),
        },
        ensure_ascii=False,
    )
