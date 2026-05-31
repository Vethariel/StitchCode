import re
from dataclasses import dataclass

from antlr4 import CommonTokenStream, InputStream

from WovenLexer import WovenLexer
from WovenParser import WovenParser
from WovenVisitor import WovenVisitor


@dataclass
class ExprResult:
    code: str
    type_name: str


class LanguageStrategy:
    """Reglas de emision especificas por lenguaje."""

    def type_name(self, woven_type: str) -> str:
        raise NotImplementedError

    def function_signature(self, name, return_type, params) -> str:
        raise NotImplementedError

    def block_open(self) -> str:
        raise NotImplementedError

    def block_close(self) -> str:
        raise NotImplementedError

    def print_stmt(self, args: list, types: list) -> str:
        raise NotImplementedError

    def and_op(self) -> str:
        raise NotImplementedError

    def or_op(self) -> str:
        raise NotImplementedError

    def string_interp(self, template: str, exprs: dict) -> str:
        raise NotImplementedError


class PythonStrategy(LanguageStrategy):
    _types = {
        "int": "int",
        "float": "float",
        "string": "str",
        "bool": "bool",
        "void": "None",
    }

    def type_name(self, woven_type: str) -> str:
        return self._types[woven_type]

    def function_signature(self, name, return_type, params) -> str:
        param_names = ", ".join(p_name for p_name, _ in params)
        return f"def {name}({param_names}) -> {self.type_name(return_type)}:"

    def block_open(self) -> str:
        return ""

    def block_close(self) -> str:
        return ""

    def print_stmt(self, args: list, types: list) -> str:
        return f"print({', '.join(args)})"

    def and_op(self) -> str:
        return "and"

    def or_op(self) -> str:
        return "or"

    def string_interp(self, template: str, exprs: dict) -> str:
        rendered = template
        for original, expr_result in exprs.items():
            rendered = rendered.replace("{" + original + "}", "{" + expr_result.code + "}")
        return f'f"{rendered}"'


class JavaStrategy(LanguageStrategy):
    _types = {
        "int": "int",
        "float": "double",
        "string": "String",
        "bool": "boolean",
        "void": "void",
    }

    def type_name(self, woven_type: str) -> str:
        return self._types[woven_type]

    def function_signature(self, name, return_type, params) -> str:
        params_txt = ", ".join(f"{self.type_name(p_type)} {p_name}" for p_name, p_type in params)
        return f"public static {self.type_name(return_type)} {name}({params_txt})"

    def block_open(self) -> str:
        return "{"

    def block_close(self) -> str:
        return "}"

    def print_stmt(self, args: list, types: list) -> str:
        payload = args[0] if len(args) == 1 else " + \" \" + ".join(args)
        return f"System.out.println({payload});"

    def and_op(self) -> str:
        return "&&"

    def or_op(self) -> str:
        return "||"

    def string_interp(self, template: str, exprs: dict) -> str:
        fmt = re.sub(r"\{[^}]*\}", "%s", template)
        args = []
        for original, expr_result in exprs.items():
            if "{" + original + "}" in template:
                args.append(expr_result.code)
        args_txt = ", ".join(args)
        if args_txt:
            return f'String.format("{fmt}", {args_txt})'
        return f'"{template}"'


class CppStrategy(LanguageStrategy):
    _types = {
        "int": "int",
        "float": "double",
        "string": "std::string",
        "bool": "bool",
        "void": "void",
    }

    def type_name(self, woven_type: str) -> str:
        return self._types[woven_type]

    def function_signature(self, name, return_type, params) -> str:
        params_txt = ", ".join(f"{self.type_name(p_type)} {p_name}" for p_name, p_type in params)
        return f"{self.type_name(return_type)} {name}({params_txt})"

    def block_open(self) -> str:
        return "{"

    def block_close(self) -> str:
        return "}"

    def print_stmt(self, args: list, types: list) -> str:
        # Interpolacion especial codificada por string_interp para C++.
        if len(args) == 1 and args[0].startswith("__CPP_INTERP__|"):
            _, fmt, arg_blob = args[0].split("|", 2)
            parts = []
            segments = fmt.split("%s")
            exprs = [e.strip() for e in arg_blob.split(",")] if arg_blob else []
            for i, seg in enumerate(segments):
                if seg:
                    escaped = seg.replace("\\", "\\\\").replace('"', '\\"')
                    parts.append(f'"{escaped}"')
                if i < len(exprs):
                    parts.append(exprs[i])
            chain = " << ".join(parts) if parts else '""'
            return f"std::cout << {chain} << std::endl;"

        if len(args) == 1:
            arg = args[0]
            if "&&" in arg or "||" in arg:
                return f"std::cout << ({arg}) << std::endl;"
            return f"std::cout << {arg} << std::endl;"

        return f'std::cout << {" << \" \" << ".join(args)} << std::endl;'

    def and_op(self) -> str:
        return "&&"

    def or_op(self) -> str:
        return "||"

    def string_interp(self, template: str, exprs: dict) -> str:
        fmt = template
        args = []
        for original, expr_result in exprs.items():
            place = "{" + original + "}"
            if place in fmt:
                fmt = fmt.replace(place, "%s", 1)
                args.append(expr_result.code)
        return f"__CPP_INTERP__|{fmt}|{', '.join(args)}"


class TranslatorVisitor(WovenVisitor):
    def __init__(self, strategy: LanguageStrategy, type_table: dict):
        self.strategy = strategy
        self.type_table = dict(type_table or {})
        self.indent_level = 0
        self.lines = []
        self.functions = {}
        self.scope_types = [dict(self.type_table)]
        self.top_level_functions = []
        self.top_level_stmts = []
        self.top_level_order = []

    # ---------- helpers ----------
    def _emit(self, line: str = ""):
        self.lines.append(("    " * self.indent_level) + line if line else "")

    def _push_scope(self):
        self.scope_types.append({})

    def _pop_scope(self):
        self.scope_types.pop()

    def _declare_type(self, name: str, type_name: str):
        self.scope_types[-1][name] = type_name

    def _lookup_type(self, name: str):
        for i in range(len(self.scope_types) - 1, -1, -1):
            if name in self.scope_types[i]:
                return self.scope_types[i][name]
        if name in self.type_table:
            return self.type_table[name]
        return "int"

    def _woven_not_op(self):
        return "not" if isinstance(self.strategy, PythonStrategy) else "!"

    def _translate_expr_text(self, expr_text: str) -> ExprResult:
        parser = WovenParser(CommonTokenStream(WovenLexer(InputStream(expr_text))))
        return self.visit(parser.expr())

    def _capture_visit(self, node):
        previous_lines = self.lines
        previous_indent = self.indent_level
        self.lines = []
        self.indent_level = 0
        self.visit(node)
        captured = self.lines
        self.lines = previous_lines
        self.indent_level = previous_indent
        return captured

    @staticmethod
    def _append_lines(target, lines, prefix=""):
        for line in lines:
            target.append(f"{prefix}{line}" if line else "")

    def _assemble_program(self):
        if isinstance(self.strategy, PythonStrategy):
            out = []
            for kind, idx in self.top_level_order:
                lines = self.top_level_functions[idx] if kind == "function" else self.top_level_stmts[idx]
                self._append_lines(out, lines)
            self.lines = out
            return

        if isinstance(self.strategy, JavaStrategy):
            out = ["public class Main {", ""]
            for fn_lines in self.top_level_functions:
                self._append_lines(out, fn_lines, "    ")
                out.append("")
            out.append("    public static void main(String[] args) {")
            for stmt_lines in self.top_level_stmts:
                self._append_lines(out, stmt_lines, "        ")
            out.append("    }")
            out.append("}")
            self.lines = out
            return

        if isinstance(self.strategy, CppStrategy):
            out = ["#include <iostream>", "#include <string>", ""]
            for fn_lines in self.top_level_functions:
                self._append_lines(out, fn_lines)
                out.append("")
            out.append("int main() {")
            for stmt_lines in self.top_level_stmts:
                self._append_lines(out, stmt_lines, "    ")
            out.append("    return 0;")
            out.append("}")
            self.lines = out
            return

        # Fallback lineal por seguridad.
        self.lines = [line for group in (self.top_level_functions + self.top_level_stmts) for line in group]

    def _for_init_parts(self, ctx: WovenParser.ForStmtContext):
        if not ctx.forInit():
            return "", "", ""
        init_ctx = ctx.forInit()
        if init_ctx.typeName():
            var_type = init_ctx.typeName().getText()
            var_name = init_ctx.IDENTIFIER().getText()
            init_expr = self.visit(init_ctx.expr()).code
            self._declare_type(var_name, var_type)
            if isinstance(self.strategy, PythonStrategy):
                return f"{var_name} = {init_expr}", var_name, init_expr
            typed = f"{self.strategy.type_name(var_type)} {var_name} = {init_expr}"
            return typed, var_name, init_expr

        assign_ctx = init_ctx.assignment()
        name = assign_ctx.IDENTIFIER().getText()
        value = self.visit(assign_ctx.expr()).code
        return f"{name} = {value}", name, value

    def _python_range_from_for(self, ctx: WovenParser.ForStmtContext):
        init_txt, var_name, start = self._for_init_parts(ctx)
        if not var_name or not ctx.expr() or not ctx.forUpdate():
            return None, init_txt

        cond = self.visit(ctx.expr()).code
        upd_ctx = ctx.forUpdate()
        if not upd_ctx.assignment():
            return None, init_txt

        upd = upd_ctx.assignment()
        if upd.IDENTIFIER().getText() != var_name:
            return None, init_txt

        upd_expr = self.visit(upd.expr()).code
        m_step = re.match(rf"{re.escape(var_name)}\s*([\+\-])\s*(\d+)$", upd_expr)
        if not m_step:
            return None, init_txt
        sign, step_num = m_step.groups()
        step = int(step_num) if sign == "+" else -int(step_num)

        m_cond = re.match(rf"{re.escape(var_name)}\s*(<=|<|>=|>)\s*(.+)$", cond)
        if not m_cond:
            return None, init_txt
        op, end = m_cond.groups()

        if step > 0 and op in ("<", "<="):
            stop = end if op == "<" else f"({end}) + 1"
        elif step < 0 and op in (">", ">="):
            stop = end if op == ">" else f"({end}) - 1"
        else:
            return None, init_txt

        if step == 1:
            return f"for {var_name} in range({start}, {stop}):", init_txt
        return f"for {var_name} in range({start}, {stop}, {step}):", init_txt

    # ---------- top-level ----------
    def visitProgram(self, ctx: WovenParser.ProgramContext):
        self.top_level_functions = []
        self.top_level_stmts = []
        self.top_level_order = []

        for stmt in ctx.statement():
            comp = stmt.compoundStmt()
            if comp and comp.functionDecl():
                fn = comp.functionDecl()
                self.functions[fn.IDENTIFIER().getText()] = fn

        for stmt in ctx.statement():
            comp = stmt.compoundStmt()
            if comp and comp.functionDecl():
                lines = self._capture_visit(comp.functionDecl())
                self.top_level_functions.append(lines)
                self.top_level_order.append(("function", len(self.top_level_functions) - 1))
            else:
                lines = self._capture_visit(stmt)
                self.top_level_stmts.append(lines)
                self.top_level_order.append(("stmt", len(self.top_level_stmts) - 1))

        self._assemble_program()
        return "\n".join(self.lines)

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

    # ---------- statements ----------
    def visitFunctionDecl(self, ctx: WovenParser.FunctionDeclContext):
        name = ctx.IDENTIFIER().getText()
        ret_type = ctx.returnType().getText()
        params = []
        if ctx.paramList():
            for p in ctx.paramList().param():
                params.append((p.IDENTIFIER().getText(), p.typeName().getText()))

        sig = self.strategy.function_signature(name, ret_type, params)
        if isinstance(self.strategy, PythonStrategy):
            self._emit(sig)
            self.indent_level += 1
            self._push_scope()
            for p_name, p_type in params:
                self._declare_type(p_name, p_type)
            self.visit(ctx.block())
            self._pop_scope()
            self.indent_level -= 1
            return

        self._emit(f"{sig} {self.strategy.block_open()}")
        self.indent_level += 1
        self._push_scope()
        for p_name, p_type in params:
            self._declare_type(p_name, p_type)
        self.visit(ctx.block())
        self._pop_scope()
        self.indent_level -= 1
        self._emit(self.strategy.block_close())

    def visitVarDecl(self, ctx: WovenParser.VarDeclContext):
        woven_type = ctx.typeName().getText()
        name = ctx.IDENTIFIER().getText()
        self._declare_type(name, woven_type)
        if ctx.expr():
            expr = self.visit(ctx.expr())
            if isinstance(self.strategy, PythonStrategy):
                self._emit(f"{name} = {expr.code}")
            else:
                self._emit(f"{self.strategy.type_name(woven_type)} {name} = {expr.code};")
        else:
            defaults = {"int": "0", "float": "0.0", "string": '""', "bool": "false"}
            default_val = defaults[woven_type]
            if isinstance(self.strategy, PythonStrategy):
                if woven_type == "bool":
                    default_val = "False"
                self._emit(f"{name} = {default_val}")
            else:
                self._emit(f"{self.strategy.type_name(woven_type)} {name} = {default_val};")

    def visitAssignment(self, ctx: WovenParser.AssignmentContext):
        name = ctx.IDENTIFIER().getText()
        expr = self.visit(ctx.expr())
        if isinstance(self.strategy, PythonStrategy):
            self._emit(f"{name} = {expr.code}")
        else:
            self._emit(f"{name} = {expr.code};")

    def visitIfStmt(self, ctx: WovenParser.IfStmtContext):
        cond = self.visit(ctx.expr()).code
        if isinstance(self.strategy, PythonStrategy):
            self._emit(f"if {cond}:")
            self.indent_level += 1
            self.visit(ctx.block(0))
            self.indent_level -= 1
            if len(ctx.block()) > 1:
                self._emit("else:")
                self.indent_level += 1
                self.visit(ctx.block(1))
                self.indent_level -= 1
            return

        self._emit(f"if ({cond}) {self.strategy.block_open()}")
        self.indent_level += 1
        self.visit(ctx.block(0))
        self.indent_level -= 1
        self._emit(self.strategy.block_close())
        if len(ctx.block()) > 1:
            self._emit(f"else {self.strategy.block_open()}")
            self.indent_level += 1
            self.visit(ctx.block(1))
            self.indent_level -= 1
            self._emit(self.strategy.block_close())

    def visitForStmt(self, ctx: WovenParser.ForStmtContext):
        if isinstance(self.strategy, PythonStrategy):
            loop_header, init_txt = self._python_range_from_for(ctx)
            if loop_header is None:
                if init_txt:
                    self._emit(init_txt)
                cond = self.visit(ctx.expr()).code if ctx.expr() else "True"
                self._emit(f"while {cond}:")
                self.indent_level += 1
                self.visit(ctx.block())
                if ctx.forUpdate():
                    if ctx.forUpdate().assignment():
                        a = ctx.forUpdate().assignment()
                        self._emit(f"{a.IDENTIFIER().getText()} = {self.visit(a.expr()).code}")
                    else:
                        self._emit(self.visit(ctx.forUpdate().expr()).code)
                self.indent_level -= 1
                return

            self._emit(loop_header)
            self.indent_level += 1
            self.visit(ctx.block())
            self.indent_level -= 1
            return

        init_txt, _, _ = self._for_init_parts(ctx)
        cond = self.visit(ctx.expr()).code if ctx.expr() else ""
        update = ""
        if ctx.forUpdate():
            if ctx.forUpdate().assignment():
                a = ctx.forUpdate().assignment()
                update = f"{a.IDENTIFIER().getText()} = {self.visit(a.expr()).code}"
            else:
                update = self.visit(ctx.forUpdate().expr()).code
        self._emit(f"for ({init_txt}; {cond}; {update}) {self.strategy.block_open()}")
        self.indent_level += 1
        self.visit(ctx.block())
        self.indent_level -= 1
        self._emit(self.strategy.block_close())

    def visitWhileStmt(self, ctx: WovenParser.WhileStmtContext):
        cond = self.visit(ctx.expr()).code
        if isinstance(self.strategy, PythonStrategy):
            self._emit(f"while {cond}:")
            self.indent_level += 1
            self.visit(ctx.block())
            self.indent_level -= 1
            return
        self._emit(f"while ({cond}) {self.strategy.block_open()}")
        self.indent_level += 1
        self.visit(ctx.block())
        self.indent_level -= 1
        self._emit(self.strategy.block_close())

    def visitReturnStmt(self, ctx: WovenParser.ReturnStmtContext):
        if ctx.expr():
            code = self.visit(ctx.expr()).code
            if isinstance(self.strategy, PythonStrategy):
                self._emit(f"return {code}")
            else:
                self._emit(f"return {code};")
        else:
            self._emit("return;" if not isinstance(self.strategy, PythonStrategy) else "return")

    def visitPrintStmt(self, ctx: WovenParser.PrintStmtContext):
        if not ctx.argList():
            payload = self.strategy.print_stmt(['""'], ["string"])
            self._emit(payload)
            return

        args = []
        types = []
        for expr in ctx.argList().expr():
            result = self.visit(expr)
            args.append(result.code)
            types.append(result.type_name)

        self._emit(self.strategy.print_stmt(args, types))

    def visitExprStmt(self, ctx: WovenParser.ExprStmtContext):
        expr = self.visit(ctx.expr()).code
        if isinstance(self.strategy, PythonStrategy):
            self._emit(expr)
        else:
            self._emit(f"{expr};")

    # ---------- expressions ----------
    def visitExpr(self, ctx: WovenParser.ExprContext):
        return self.visit(ctx.orExpr())

    def visitLogicalOr(self, ctx: WovenParser.LogicalOrContext):
        left = self.visit(ctx.orExpr())
        right = self.visit(ctx.andExpr())
        return ExprResult(f"{left.code} {self.strategy.or_op()} {right.code}", "bool")

    def visitAndExprAlt(self, ctx: WovenParser.AndExprAltContext):
        return self.visit(ctx.andExpr())

    def visitLogicalAnd(self, ctx: WovenParser.LogicalAndContext):
        left = self.visit(ctx.andExpr())
        right = self.visit(ctx.compExpr())
        return ExprResult(f"{left.code} {self.strategy.and_op()} {right.code}", "bool")

    def visitCompExprAlt(self, ctx: WovenParser.CompExprAltContext):
        return self.visit(ctx.compExpr())

    def visitBinaryOp(self, ctx: WovenParser.BinaryOpContext):
        left = self.visit(ctx.compExpr(0))
        right = self.visit(ctx.compExpr(1))
        op = ctx.op.text
        out_type = "float" if "float" in (left.type_name, right.type_name) else left.type_name
        if op in {"<", "<=", ">", ">=", "==", "!="}:
            out_type = "bool"
        return ExprResult(f"{left.code} {op} {right.code}", out_type)

    def visitComparison(self, ctx: WovenParser.ComparisonContext):
        left = self.visit(ctx.compExpr(0))
        right = self.visit(ctx.compExpr(1))
        return ExprResult(f"{left.code} {ctx.op.text} {right.code}", "bool")

    def visitUnaryOp(self, ctx: WovenParser.UnaryOpContext):
        value = self.visit(ctx.compExpr())
        op = ctx.op.text
        if op == "!":
            return ExprResult(f"{self._woven_not_op()} {value.code}", "bool")
        return ExprResult(f"-{value.code}", value.type_name)

    def visitAtomExpr(self, ctx: WovenParser.AtomExprContext):
        return self.visit(ctx.atom())

    def visitLiteralAtom(self, ctx: WovenParser.LiteralAtomContext):
        return self.visit(ctx.literal())

    def visitIdAtom(self, ctx: WovenParser.IdAtomContext):
        name = ctx.IDENTIFIER().getText()
        return ExprResult(name, self._lookup_type(name))

    def visitParenAtom(self, ctx: WovenParser.ParenAtomContext):
        inner = self.visit(ctx.expr())
        return ExprResult(f"({inner.code})", inner.type_name)

    def visitCallAtom(self, ctx: WovenParser.CallAtomContext):
        callee = self.visit(ctx.atom())
        args = []
        if ctx.argList():
            args = [self.visit(e) for e in ctx.argList().expr()]
        args_code = ", ".join(a.code for a in args)
        fn_name = callee.code
        ret = "void"
        if fn_name in self.functions:
            ret = self.functions[fn_name].returnType().getText()
        return ExprResult(f"{fn_name}({args_code})", ret)

    def visitLiteral(self, ctx: WovenParser.LiteralContext):
        if ctx.INT_LITERAL():
            return ExprResult(ctx.INT_LITERAL().getText(), "int")
        if ctx.FLOAT_LITERAL():
            return ExprResult(ctx.FLOAT_LITERAL().getText(), "float")
        if ctx.TRUE():
            if isinstance(self.strategy, PythonStrategy):
                return ExprResult("True", "bool")
            if isinstance(self.strategy, (JavaStrategy, CppStrategy)):
                return ExprResult("true", "bool")
            return ExprResult("true", "bool")
        if ctx.FALSE():
            if isinstance(self.strategy, PythonStrategy):
                return ExprResult("False", "bool")
            if isinstance(self.strategy, (JavaStrategy, CppStrategy)):
                return ExprResult("false", "bool")
            return ExprResult("false", "bool")
        if ctx.STRING_LITERAL():
            return ExprResult(ctx.STRING_LITERAL().getText(), "string")
        if ctx.STRING_INTERP():
            raw = ctx.STRING_INTERP().getText()[1:-1]
            expr_map = {}
            for m in re.finditer(r"\{([^}]*)\}", raw):
                original = m.group(1)
                expr_map[original] = self._translate_expr_text(original)
            return ExprResult(self.strategy.string_interp(raw, expr_map), "string")
        return ExprResult(ctx.getText(), "string")


def translate_woven(source: str, language: str) -> str:
    from interpreter_visitor import InterpreterVisitor

    lexer = WovenLexer(InputStream(source))
    stream = CommonTokenStream(lexer)
    parser = WovenParser(stream)
    tree = parser.program()

    # Obtener tabla de tipos del interprete
    interpreter = InterpreterVisitor()
    interpreter.visit(tree)
    type_table = interpreter.types[0]

    strategies = {
        "python": PythonStrategy(),
        "java": JavaStrategy(),
        "cpp": CppStrategy(),
    }
    translator = TranslatorVisitor(strategies[language], type_table)
    translator.visit(tree)
    return "\n".join(translator.lines)
