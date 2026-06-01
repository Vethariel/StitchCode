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

    def type_name(self, woven_type: str, known_classes: set) -> str:
        raise NotImplementedError

    def function_signature(self, name, return_type, params, known_classes: set) -> str:
        raise NotImplementedError

    def class_signature(self, name, parent):
        raise NotImplementedError

    def constructor_signature(self, class_name, params, known_classes: set) -> str:
        raise NotImplementedError

    def method_signature(self, name, return_type, params, is_virtual, known_classes: set) -> str:
        raise NotImplementedError

    def print_stmt(self, args: list, types: list) -> str:
        raise NotImplementedError

    def and_op(self) -> str:
        raise NotImplementedError

    def or_op(self) -> str:
        raise NotImplementedError

    def not_op(self) -> str:
        raise NotImplementedError

    def string_interp(self, template: str, exprs: list) -> str:
        raise NotImplementedError

    def break_stmt(self) -> str:
        raise NotImplementedError

    def continue_stmt(self) -> str:
        raise NotImplementedError

    def throw_stmt(self, expr_code: str) -> str:
        raise NotImplementedError


class PythonStrategy(LanguageStrategy):
    def _map_primitive(self, t):
        return {
            "int": "int",
            "float": "float",
            "string": "str",
            "bool": "bool",
            "void": "None",
        }.get(t, t)

    def type_name(self, woven_type: str, known_classes: set) -> str:
        if woven_type.startswith("list<") and woven_type.endswith(">"):
            inner = woven_type[5:-1]
            return f"list[{self.type_name(inner, known_classes)}]"
        return self._map_primitive(woven_type)

    def function_signature(self, name, return_type, params, known_classes: set) -> str:
        names = ", ".join(p_name for p_name, _ in params)
        return f"def {name}({names}) -> {self.type_name(return_type, known_classes)}:"

    def class_signature(self, name, parent):
        return f"class {name}({parent})" if parent else f"class {name}"

    def constructor_signature(self, class_name, params, known_classes: set) -> str:
        names = ", ".join(p_name for p_name, _ in params)
        sig = "self" + (", " + names if names else "")
        return f"def __init__({sig}):"

    def method_signature(self, name, return_type, params, is_virtual, known_classes: set) -> str:
        names = ", ".join(p_name for p_name, _ in params)
        sig = "self" + (", " + names if names else "")
        return f"def {name}({sig}) -> {self.type_name(return_type, known_classes)}:"

    def print_stmt(self, args: list, types: list) -> str:
        return f"print({', '.join(args)})"

    def and_op(self) -> str:
        return "and"

    def or_op(self) -> str:
        return "or"

    def not_op(self) -> str:
        return "not"

    def string_interp(self, template: str, exprs: list) -> str:
        rendered = template
        for original, code, _ in exprs:
            rendered = rendered.replace("{" + original + "}", "{" + code + "}")
        return f'f"{rendered}"'

    def break_stmt(self) -> str:
        return "break"

    def continue_stmt(self) -> str:
        return "continue"

    def throw_stmt(self, expr_code: str) -> str:
        return f"raise Exception({expr_code})"


class JavaStrategy(LanguageStrategy):
    def _map_primitive(self, t):
        return {
            "int": "int",
            "float": "double",
            "string": "String",
            "bool": "boolean",
            "void": "void",
        }.get(t, t)

    def _boxed(self, t):
        return {
            "int": "Integer",
            "double": "Double",
            "boolean": "Boolean",
            "String": "String",
        }.get(t, t)

    def type_name(self, woven_type: str, known_classes: set) -> str:
        if woven_type.startswith("list<") and woven_type.endswith(">"):
            inner = woven_type[5:-1]
            inner_java = self.type_name(inner, known_classes)
            return f"ArrayList<{self._boxed(inner_java)}>"
        return self._map_primitive(woven_type)

    def function_signature(self, name, return_type, params, known_classes: set) -> str:
        p = ", ".join(f"{self.type_name(t, known_classes)} {n}" for n, t in params)
        return f"public static {self.type_name(return_type, known_classes)} {name}({p})"

    def class_signature(self, name, parent):
        return f"static class {name} extends {parent}" if parent else f"static class {name}"

    def constructor_signature(self, class_name, params, known_classes: set) -> str:
        p = ", ".join(f"{self.type_name(t, known_classes)} {n}" for n, t in params)
        return f"public {class_name}({p})"

    def method_signature(self, name, return_type, params, is_virtual, known_classes: set) -> str:
        p = ", ".join(f"{self.type_name(t, known_classes)} {n}" for n, t in params)
        return f"public {self.type_name(return_type, known_classes)} {name}({p})"

    def print_stmt(self, args: list, types: list) -> str:
        payload = args[0] if len(args) == 1 else " + \" \" + ".join(args)
        return f"System.out.println({payload});"

    def and_op(self) -> str:
        return "&&"

    def or_op(self) -> str:
        return "||"

    def not_op(self) -> str:
        return "!"

    def string_interp(self, template: str, exprs: list) -> str:
        fmt = re.sub(r"\{[^}]*\}", "%s", template)
        args = [code for _, code, _ in exprs]
        return f'String.format("{fmt}", {", ".join(args)})' if args else f'"{template}"'

    def break_stmt(self) -> str:
        return "break;"

    def continue_stmt(self) -> str:
        return "continue;"

    def throw_stmt(self, expr_code: str) -> str:
        return f"throw new RuntimeException({expr_code});"


class CppStrategy(LanguageStrategy):
    def _map_primitive(self, t):
        return {
            "int": "int",
            "float": "double",
            "string": "std::string",
            "bool": "bool",
            "void": "void",
        }.get(t, t)

    def type_name(self, woven_type: str, known_classes: set) -> str:
        if woven_type.startswith("list<") and woven_type.endswith(">"):
            inner = woven_type[5:-1]
            return f"std::vector<{self.type_name(inner, known_classes)}>"
        if woven_type in known_classes:
            return f"std::shared_ptr<{woven_type}>"
        return self._map_primitive(woven_type)

    def function_signature(self, name, return_type, params, known_classes: set) -> str:
        p = ", ".join(f"{self.type_name(t, known_classes)} {n}" for n, t in params)
        return f"{self.type_name(return_type, known_classes)} {name}({p})"

    def class_signature(self, name, parent):
        return f"class {name} : public {parent}" if parent else f"class {name}"

    def constructor_signature(self, class_name, params, known_classes: set) -> str:
        p = ", ".join(f"{self.type_name(t, known_classes)} {n}" for n, t in params)
        return f"{class_name}({p})"

    def method_signature(self, name, return_type, params, is_virtual, known_classes: set) -> str:
        p = ", ".join(f"{self.type_name(t, known_classes)} {n}" for n, t in params)
        prefix = "virtual " if is_virtual else ""
        return f"{prefix}{self.type_name(return_type, known_classes)} {name}({p})"

    def print_stmt(self, args: list, types: list) -> str:
        if len(args) == 1 and args[0].startswith("__CPP_INTERP__|"):
            _, tmpl, expr_blob = args[0].split("|", 2)
            segs = tmpl.split("%s")
            encoded = expr_blob.split(chr(30)) if expr_blob else []
            exprs = [x.split("\x1f", 1)[0] for x in encoded]
            parts = []
            for i, seg in enumerate(segs):
                if seg:
                    esc = seg.replace("\\", "\\\\").replace('"', '\\"')
                    parts.append(f'"{esc}"')
                if i < len(exprs):
                    parts.append(exprs[i])
            chain = " << ".join(parts) if parts else '""'
            return f"std::cout << {chain} << std::endl;"

        if len(args) == 1:
            payload = f"({args[0]})" if ("&&" in args[0] or "||" in args[0]) else args[0]
            return f"std::cout << {payload} << std::endl;"
        return f'std::cout << {" << \" \" << ".join(args)} << std::endl;'

    def and_op(self) -> str:
        return "&&"

    def or_op(self) -> str:
        return "||"

    def not_op(self) -> str:
        return "!"

    def string_interp(self, template: str, exprs: list) -> str:
        fmt = re.sub(r"\{[^}]*\}", "%s", template)
        # Encode args with code+type so return statements can format correctly.
        encoded = [f"{code}\x1f{t}" for _, code, t in exprs]
        return f"__CPP_INTERP__|{fmt}|{chr(30).join(encoded)}"

    def break_stmt(self) -> str:
        return "break;"

    def continue_stmt(self) -> str:
        return "continue;"

    def throw_stmt(self, expr_code: str) -> str:
        return f"throw std::runtime_error({expr_code});"


class TranslatorVisitor(WovenVisitor):
    def __init__(self, strategy: LanguageStrategy, type_table: dict):
        self.strategy = strategy
        self.type_table = dict(type_table or {})
        self.lines = []
        self.indent_level = 0

        self.functions = {}
        self.class_defs = {}  # name -> parent
        self.class_fields = {}  # name -> set(fields)
        self.class_methods = {}  # name -> set(methods)
        self.current_class_name = None
        self.current_class_parent = None
        self._inside_cpp_ctor = False
        self._cpp_ctor_super = None

        self.scope_types = [dict(self.type_table)]

        self.top_level_functions = []
        self.top_level_classes = []
        self.top_level_stmts = []
        self.top_level_order = []

    # ---------- helpers ----------
    def _emit(self, line=""):
        self.lines.append(("    " * self.indent_level) + line if line else "")

    def _push_scope(self):
        self.scope_types.append({})

    def _pop_scope(self):
        self.scope_types.pop()

    def _declare_type(self, name, t):
        self.scope_types[-1][name] = t

    def _lookup_type(self, name):
        for i in range(len(self.scope_types) - 1, -1, -1):
            if name in self.scope_types[i]:
                return self.scope_types[i][name]
        return self.type_table.get(name, "int")

    def _is_list_type(self, t):
        return t.startswith("list<") or t == "list"

    def _is_class_type(self, t):
        if t.startswith("std::shared_ptr<") and t.endswith(">"):
            raw = t[len("std::shared_ptr<") : -1]
            return raw in self.class_defs
        raw = t[:-1] if t.endswith("*") else t
        return raw in self.class_defs

    def _cpp_interp_to_string_expr(self, marker):
        # marker: __CPP_INTERP__|fmt%s...|code<US>type<RS>...
        _, tmpl, payload = marker.split("|", 2)
        segments = tmpl.split("%s")
        entries = payload.split(chr(30)) if payload else []
        parts = []
        for i, seg in enumerate(segments):
            if seg:
                esc = seg.replace("\\", "\\\\").replace('"', '\\"')
                parts.append(f'std::string("{esc}")')
            if i < len(entries):
                code, typ = entries[i].split("\x1f", 1)
                if typ == "string":
                    parts.append(f"std::string({code})")
                elif typ == "bool":
                    parts.append(f"std::string(({code}) ? \"true\" : \"false\")")
                else:
                    parts.append(f"std::to_string({code})")
        if not parts:
            return 'std::string("")'
        return " + ".join(parts)

    def _translated_type(self, woven_type):
        return self.strategy.type_name(woven_type, set(self.class_defs.keys()))

    def _capture_visit(self, node):
        prev_lines = self.lines
        prev_indent = self.indent_level
        self.lines = []
        self.indent_level = 0
        self.visit(node)
        out = self.lines
        self.lines = prev_lines
        self.indent_level = prev_indent
        return out

    @staticmethod
    def _append_lines(target, lines, prefix=""):
        for line in lines:
            target.append(f"{prefix}{line}" if line else "")

    def _assemble_program(self):
        if isinstance(self.strategy, PythonStrategy):
            out = []
            for kind, idx in self.top_level_order:
                if kind == "class":
                    self._append_lines(out, self.top_level_classes[idx])
                elif kind == "function":
                    self._append_lines(out, self.top_level_functions[idx])
                else:
                    self._append_lines(out, self.top_level_stmts[idx])
            self.lines = out
            return

        if isinstance(self.strategy, JavaStrategy):
            out = ["import java.util.ArrayList;", "import java.util.Arrays;", "", "public class Main {", ""]
            for cls in self.top_level_classes:
                self._append_lines(out, cls, "    ")
                out.append("")
            for fn in self.top_level_functions:
                self._append_lines(out, fn, "    ")
                out.append("")
            out.append("    public static void main(String[] args) {")
            for st in self.top_level_stmts:
                self._append_lines(out, st, "        ")
            out.append("    }")
            out.append("}")
            self.lines = out
            return

        if isinstance(self.strategy, CppStrategy):
            out = [
                "#include <iostream>",
                "#include <string>",
                "#include <vector>",
                "#include <memory>",
                "#include <stdexcept>",
                "",
                "using namespace std;",
                "",
            ]
            for cls in self.top_level_classes:
                self._append_lines(out, cls)
                out.append("")
            for fn in self.top_level_functions:
                self._append_lines(out, fn)
                out.append("")
            out.append("int main() {")
            for st in self.top_level_stmts:
                self._append_lines(out, st, "    ")
            out.append("    return 0;")
            out.append("}")
            self.lines = out
            return

    def _parse_params(self, param_list_ctx):
        params = []
        if not param_list_ctx:
            return params
        for p in param_list_ctx.param():
            params.append((p.IDENTIFIER().getText(), p.typeName().getText()))
        return params

    # ---------- top ----------
    def visitProgram(self, ctx: WovenParser.ProgramContext):
        self.top_level_functions = []
        self.top_level_classes = []
        self.top_level_stmts = []
        self.top_level_order = []

        for stmt in ctx.statement():
            comp = stmt.compoundStmt()
            if not comp:
                continue
            if comp.functionDecl():
                fn = comp.functionDecl()
                self.functions[fn.IDENTIFIER().getText()] = fn
            elif comp.classDecl():
                ids = comp.classDecl().IDENTIFIER()
                name = ids[0].getText()
                parent = ids[1].getText() if len(ids) > 1 else None
                self.class_defs[name] = parent
                fields = set()
                methods = set()
                for m in comp.classDecl().classBody().classMember():
                    if m.fieldDecl():
                        fields.add(m.fieldDecl().IDENTIFIER().getText())
                    elif m.methodDecl():
                        methods.add(m.methodDecl().IDENTIFIER().getText())
                self.class_fields[name] = fields
                self.class_methods[name] = methods

        for stmt in ctx.statement():
            comp = stmt.compoundStmt()
            if comp and comp.functionDecl():
                lines = self._capture_visit(comp.functionDecl())
                self.top_level_functions.append(lines)
                self.top_level_order.append(("function", len(self.top_level_functions) - 1))
            elif comp and comp.classDecl():
                lines = self._capture_visit(comp.classDecl())
                self.top_level_classes.append(lines)
                self.top_level_order.append(("class", len(self.top_level_classes) - 1))
            else:
                lines = self._capture_visit(stmt)
                self.top_level_stmts.append(lines)
                self.top_level_order.append(("stmt", len(self.top_level_stmts) - 1))

        self._assemble_program()
        return "\n".join(self.lines)

    def visitStatement(self, ctx):
        if ctx.compoundStmt():
            return self.visit(ctx.compoundStmt())
        return self.visit(ctx.simpleStmt())

    def visitSimpleStmt(self, ctx):
        return self.visit(ctx.getChild(0))

    def visitCompoundStmt(self, ctx):
        return self.visit(ctx.getChild(0))

    def visitBlock(self, ctx):
        for s in ctx.statement():
            self.visit(s)

    # ---------- class/function ----------
    def visitFunctionDecl(self, ctx):
        name = ctx.IDENTIFIER().getText()
        ret = ctx.returnType().getText()
        params = self._parse_params(ctx.paramList())
        sig = self.strategy.function_signature(name, ret, params, set(self.class_defs.keys()))
        self._emit(sig if isinstance(self.strategy, PythonStrategy) else f"{sig} {{")
        self.indent_level += 1
        self._push_scope()
        for p_name, p_type in params:
            self._declare_type(p_name, p_type)
        self.visit(ctx.block())
        self._pop_scope()
        self.indent_level -= 1
        if not isinstance(self.strategy, PythonStrategy):
            self._emit("}")

    def visitClassDecl(self, ctx):
        ids = ctx.IDENTIFIER()
        name = ids[0].getText()
        parent = ids[1].getText() if len(ids) > 1 else None
        self.current_class_name = name
        self.current_class_parent = parent

        sig = self.strategy.class_signature(name, parent)
        self._emit(sig + (":" if isinstance(self.strategy, PythonStrategy) else " {"))
        self.indent_level += 1
        if isinstance(self.strategy, CppStrategy):
            self._emit("public:")
        self._push_scope()
        for member in ctx.classBody().classMember():
            self.visit(member)
        self._pop_scope()
        self.indent_level -= 1
        if isinstance(self.strategy, CppStrategy):
            self._emit("};")
        elif not isinstance(self.strategy, PythonStrategy):
            self._emit("}")

        self.current_class_name = None
        self.current_class_parent = None

    def visitClassMember(self, ctx):
        return self.visit(ctx.getChild(0))

    def visitFieldDecl(self, ctx):
        t = ctx.typeName().getText()
        n = ctx.IDENTIFIER().getText()
        self._declare_type(n, t)
        if isinstance(self.strategy, PythonStrategy):
            self._emit(f"{n} = None")
        else:
            self._emit(f"{self._translated_type(t)} {n};")

    def visitConstructorDecl(self, ctx):
        params = self._parse_params(ctx.paramList())
        sig = self.strategy.constructor_signature(self.current_class_name, params, set(self.class_defs.keys()))

        if isinstance(self.strategy, PythonStrategy):
            self._emit(sig)
            self.indent_level += 1
            self._push_scope()
            self._declare_type("self", self.current_class_name)
            for p_name, p_type in params:
                self._declare_type(p_name, p_type)
            self.visit(ctx.block())
            self._pop_scope()
            self.indent_level -= 1
            return

        if isinstance(self.strategy, CppStrategy):
            self._inside_cpp_ctor = True
            self._cpp_ctor_super = None
            lines = self._capture_visit(ctx.block())
            self._inside_cpp_ctor = False
            init = f" : {self.current_class_parent}({self._cpp_ctor_super})" if self._cpp_ctor_super else ""
            self._emit(f"{sig}{init} {{")
            self.indent_level += 1
            self._append_lines(self.lines, lines, "    " * self.indent_level)
            self.indent_level -= 1
            self._emit("}")
            return

        self._emit(f"{sig} {{")
        self.indent_level += 1
        self._push_scope()
        self._declare_type("self", self.current_class_name)
        for p_name, p_type in params:
            self._declare_type(p_name, p_type)
        self.visit(ctx.block())
        self._pop_scope()
        self.indent_level -= 1
        self._emit("}")

    def visitMethodDecl(self, ctx):
        name = ctx.IDENTIFIER().getText()
        ret = ctx.returnType().getText()
        params = self._parse_params(ctx.paramList())
        is_virtual = ctx.VIRTUAL() is not None
        sig = self.strategy.method_signature(name, ret, params, is_virtual, set(self.class_defs.keys()))

        self._emit(sig if isinstance(self.strategy, PythonStrategy) else f"{sig} {{")
        self.indent_level += 1
        self._push_scope()
        self._declare_type("self", self.current_class_name)
        for p_name, p_type in params:
            self._declare_type(p_name, p_type)
        self.visit(ctx.block())
        self._pop_scope()
        self.indent_level -= 1
        if not isinstance(self.strategy, PythonStrategy):
            self._emit("}")

    # ---------- stmts ----------
    def visitVarDecl(self, ctx):
        t = ctx.typeName().getText()
        n = ctx.IDENTIFIER().getText()
        self._declare_type(n, t)
        if ctx.expr():
            expr = self.visit(ctx.expr()).code
            if isinstance(self.strategy, PythonStrategy):
                if self._is_list_type(t):
                    self._emit(f"{n}: {self._translated_type(t)} = {expr}")
                else:
                    self._emit(f"{n} = {expr}")
            else:
                self._emit(f"{self._translated_type(t)} {n} = {expr};")
            return

        if self._is_list_type(t):
            if isinstance(self.strategy, PythonStrategy):
                self._emit(f"{n}: {self._translated_type(t)} = []")
            elif isinstance(self.strategy, JavaStrategy):
                self._emit(f"{self._translated_type(t)} {n} = new {self._translated_type(t)}();")
            else:
                self._emit(f"{self._translated_type(t)} {n};")
            return

        defaults = {"int": "0", "float": "0.0", "string": '""', "bool": "False" if isinstance(self.strategy, PythonStrategy) else "false"}
        if t in defaults:
            dv = defaults[t]
        elif isinstance(self.strategy, PythonStrategy):
            dv = "None"
        elif isinstance(self.strategy, JavaStrategy):
            dv = "null"
        else:
            dv = "nullptr"
        if isinstance(self.strategy, PythonStrategy):
            self._emit(f"{n} = {dv}")
        else:
            self._emit(f"{self._translated_type(t)} {n} = {dv};")

    def visitAssignment(self, ctx):
        n = ctx.IDENTIFIER().getText()
        e = self.visit(ctx.expr()).code
        if isinstance(self.strategy, PythonStrategy):
            self._emit(f"{n} = {e}")
        else:
            self._emit(f"{n} = {e};")

    def visitSelfAssignment(self, ctx):
        f = ctx.IDENTIFIER().getText()
        e = self.visit(ctx.expr()).code
        if isinstance(self.strategy, PythonStrategy):
            self._emit(f"self.{f} = {e}")
        elif isinstance(self.strategy, JavaStrategy):
            self._emit(f"this.{f} = {e};")
        else:
            self._emit(f"this->{f} = {e};")

    def visitIndexAssignment(self, ctx):
        idx = self.visit(ctx.expr(0)).code
        val = self.visit(ctx.expr(1)).code
        if ctx.SELF():
            arr = ctx.IDENTIFIER().getText()
            if isinstance(self.strategy, PythonStrategy):
                self._emit(f"self.{arr}[{idx}] = {val}")
            elif isinstance(self.strategy, JavaStrategy):
                self._emit(f"this.{arr}.set({idx}, {val});")
            else:
                self._emit(f"this->{arr}[{idx}] = {val};")
            return

        arr = ctx.IDENTIFIER().getText()
        arr_t = self._lookup_type(arr)
        if isinstance(self.strategy, JavaStrategy) and self._is_list_type(arr_t):
            self._emit(f"{arr}.set({idx}, {val});")
        else:
            suffix = "" if isinstance(self.strategy, PythonStrategy) else ";"
            self._emit(f"{arr}[{idx}] = {val}{suffix}")

    def visitIfStmt(self, ctx):
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
        self._emit(f"if ({cond}) {{")
        self.indent_level += 1
        self.visit(ctx.block(0))
        self.indent_level -= 1
        self._emit("}")
        if len(ctx.block()) > 1:
            self._emit("else {")
            self.indent_level += 1
            self.visit(ctx.block(1))
            self.indent_level -= 1
            self._emit("}")

    def visitForStmt(self, ctx):
        # Reusar estilo anterior.
        if isinstance(self.strategy, PythonStrategy):
            if ctx.forInit() and ctx.forInit().typeName() and ctx.expr() and ctx.forUpdate() and ctx.forUpdate().assignment():
                i_name = ctx.forInit().IDENTIFIER().getText()
                start = self.visit(ctx.forInit().expr()).code
                cond = self.visit(ctx.expr()).code
                up_assign = ctx.forUpdate().assignment()
                up_expr = self.visit(up_assign.expr()).code
                m1 = re.match(rf"{re.escape(i_name)}\s*<\s*(.+)$", cond)
                m2 = re.match(rf"{re.escape(i_name)}\s*\+\s*1$", up_expr)
                if m1 and m2:
                    self._emit(f"for {i_name} in range({start}, {m1.group(1)}):")
                    self.indent_level += 1
                    self.visit(ctx.block())
                    self.indent_level -= 1
                    return
            if ctx.forInit():
                self.visit(ctx.forInit())
            cond = self.visit(ctx.expr()).code if ctx.expr() else "True"
            self._emit(f"while {cond}:")
            self.indent_level += 1
            self.visit(ctx.block())
            if ctx.forUpdate():
                self.visit(ctx.forUpdate())
            self.indent_level -= 1
            return

        init = ""
        if ctx.forInit():
            if ctx.forInit().typeName():
                t = ctx.forInit().typeName().getText()
                n = ctx.forInit().IDENTIFIER().getText()
                init = f"{self._translated_type(t)} {n} = {self.visit(ctx.forInit().expr()).code}"
                self._declare_type(n, t)
            else:
                a = ctx.forInit().assignment()
                init = f"{a.IDENTIFIER().getText()} = {self.visit(a.expr()).code}"
        cond = self.visit(ctx.expr()).code if ctx.expr() else ""
        upd = ""
        if ctx.forUpdate():
            if ctx.forUpdate().assignment():
                a = ctx.forUpdate().assignment()
                upd = f"{a.IDENTIFIER().getText()} = {self.visit(a.expr()).code}"
            else:
                upd = self.visit(ctx.forUpdate().expr()).code
        self._emit(f"for ({init}; {cond}; {upd}) {{")
        self.indent_level += 1
        self.visit(ctx.block())
        self.indent_level -= 1
        self._emit("}")

    def visitWhileStmt(self, ctx):
        cond = self.visit(ctx.expr()).code
        if isinstance(self.strategy, PythonStrategy):
            self._emit(f"while {cond}:")
            self.indent_level += 1
            self.visit(ctx.block())
            self.indent_level -= 1
            return
        self._emit(f"while ({cond}) {{")
        self.indent_level += 1
        self.visit(ctx.block())
        self.indent_level -= 1
        self._emit("}")

    def visitTryStmt(self, ctx):
        catch_var = ctx.IDENTIFIER().getText()
        if isinstance(self.strategy, PythonStrategy):
            self._emit("try:")
            self.indent_level += 1
            self.visit(ctx.block(0))
            self.indent_level -= 1
            self._emit(f"except Exception as {catch_var}:")
            self.indent_level += 1
            self.visit(ctx.block(1))
            self.indent_level -= 1
            return

        self._emit("try {")
        self.indent_level += 1
        self.visit(ctx.block(0))
        self.indent_level -= 1
        if isinstance(self.strategy, JavaStrategy):
            self._emit("} catch (Exception __woven_e) {")
            self.indent_level += 1
            self._emit(f"String {catch_var} = __woven_e.getMessage();")
            self.visit(ctx.block(1))
            self.indent_level -= 1
            self._emit("}")
            return

        self._emit("} catch (std::exception& __woven_e) {")
        self.indent_level += 1
        self._emit(f"std::string {catch_var} = __woven_e.what();")
        self.visit(ctx.block(1))
        self.indent_level -= 1
        self._emit("}")

    def visitReturnStmt(self, ctx):
        if not ctx.expr():
            self._emit("return" if isinstance(self.strategy, PythonStrategy) else "return;")
            return
        e_res = self.visit(ctx.expr())
        e = e_res.code
        if isinstance(self.strategy, CppStrategy) and e.startswith("__CPP_INTERP__|"):
            e = self._cpp_interp_to_string_expr(e)
        self._emit(f"return {e}" if isinstance(self.strategy, PythonStrategy) else f"return {e};")

    def visitPrintStmt(self, ctx):
        if not ctx.argList():
            self._emit(self.strategy.print_stmt(['""'], ["string"]))
            return
        args, types = [], []
        for e in ctx.argList().expr():
            r = self.visit(e)
            args.append(r.code)
            types.append(r.type_name)
        self._emit(self.strategy.print_stmt(args, types))

    def visitExprStmt(self, ctx):
        e = self.visit(ctx.expr()).code
        if isinstance(self.strategy, PythonStrategy):
            self._emit(e)
        else:
            self._emit(f"{e};")

    # ---------- expr ----------
    def visitExpr(self, ctx):
        return self.visit(ctx.orExpr())

    def visitLogicalOr(self, ctx):
        l = self.visit(ctx.orExpr())
        r = self.visit(ctx.andExpr())
        return ExprResult(f"{l.code} {self.strategy.or_op()} {r.code}", "bool")

    def visitAndExprAlt(self, ctx):
        return self.visit(ctx.andExpr())

    def visitLogicalAnd(self, ctx):
        l = self.visit(ctx.andExpr())
        r = self.visit(ctx.compExpr())
        return ExprResult(f"{l.code} {self.strategy.and_op()} {r.code}", "bool")

    def visitCompExprAlt(self, ctx):
        return self.visit(ctx.compExpr())

    def visitBinaryOp(self, ctx):
        l = self.visit(ctx.compExpr())
        r = self.visit(ctx.unaryExpr())
        t = "bool" if ctx.op.text in {"<", "<=", ">", ">=", "==", "!="} else ("float" if "float" in (l.type_name, r.type_name) else l.type_name)
        return ExprResult(f"{l.code} {ctx.op.text} {r.code}", t)

    def visitComparison(self, ctx):
        l = self.visit(ctx.compExpr())
        r = self.visit(ctx.unaryExpr())
        return ExprResult(f"{l.code} {ctx.op.text} {r.code}", "bool")

    def visitUnaryExprAlt(self, ctx):
        return self.visit(ctx.unaryExpr())

    def visitUnaryOp(self, ctx):
        v = self.visit(ctx.unaryExpr())
        if ctx.op.text == "!":
            not_token = self.strategy.not_op()
            sep = " " if not_token and not_token[-1].isalnum() else ""
            return ExprResult(f"{not_token}{sep}{v.code}", "bool")
        return ExprResult(f"-{v.code}", v.type_name)

    def visitPowerExprAlt(self, ctx):
        return self.visit(ctx.powerExpr())

    def visitPowerOp(self, ctx):
        l = self.visit(ctx.atom())
        r = self.visit(ctx.powerExpr())
        t = "float" if "float" in (l.type_name, r.type_name) else "int"
        if isinstance(self.strategy, PythonStrategy):
            return ExprResult(f"{l.code} ** {r.code}", t)
        if isinstance(self.strategy, JavaStrategy):
            return ExprResult(f"(int)Math.pow({l.code}, {r.code})", t)
        return ExprResult(f"std::pow({l.code}, {r.code})", t)

    def visitAtomExpr(self, ctx):
        return self.visit(ctx.atom())

    # ---------- atom ----------
    def visitLiteralAtom(self, ctx):
        return self.visit(ctx.literal())

    def visitIdAtom(self, ctx):
        n = ctx.IDENTIFIER().getText()
        return ExprResult(n, self._lookup_type(n))

    def visitParenAtom(self, ctx):
        inner = self.visit(ctx.expr())
        return ExprResult(f"({inner.code})", inner.type_name)

    def visitCallAtom(self, ctx):
        args = [self.visit(e) for e in (ctx.argList().expr() if ctx.argList() else [])]
        name = ctx.IDENTIFIER().getText()
        ret = self.functions[name].returnType().getText() if name in self.functions else "void"
        return ExprResult(f"{name}({', '.join(a.code for a in args)})", ret)

    def visitSelfFieldAtom(self, ctx):
        f = ctx.IDENTIFIER().getText()
        if isinstance(self.strategy, PythonStrategy):
            return ExprResult(f"self.{f}", self._lookup_type(f))
        if isinstance(self.strategy, JavaStrategy):
            return ExprResult(f"this.{f}", self._lookup_type(f))
        return ExprResult(f"this->{f}", self._lookup_type(f))

    def visitSelfCallAtom(self, ctx):
        m = ctx.IDENTIFIER().getText()
        args = [self.visit(e).code for e in (ctx.argList().expr() if ctx.argList() else [])]
        if isinstance(self.strategy, PythonStrategy):
            return ExprResult(f"self.{m}({', '.join(args)})", "void")
        if isinstance(self.strategy, JavaStrategy):
            return ExprResult(f"this.{m}({', '.join(args)})", "void")
        return ExprResult(f"this->{m}({', '.join(args)})", "void")

    def visitMemberAccessAtom(self, ctx):
        base = self.visit(ctx.atom())
        member = ctx.IDENTIFIER().getText()
        if self._is_list_type(base.type_name) and member == "length":
            if isinstance(self.strategy, PythonStrategy):
                return ExprResult(f"len({base.code})", "int")
            return ExprResult(f"{base.code}.size()", "int")
        if self._is_list_type(base.type_name) and member in {"append", "remove"}:
            return ExprResult(f"{base.code}\x1f{member}", "__list_method_ref__")

        base_raw = base.type_name[:-1] if base.type_name.endswith("*") else base.type_name
        if base_raw in self.class_defs and member in self.class_methods.get(base_raw, set()):
            return ExprResult(f"{base.code}\x1f{member}\x1f{base.type_name}", "__object_method_ref__")

        if isinstance(self.strategy, PythonStrategy):
            return ExprResult(f"{base.code}.{member}", self._lookup_type(member))
        if isinstance(self.strategy, JavaStrategy):
            return ExprResult(f"{base.code}.{member}", self._lookup_type(member))

        op = "->" if self._is_class_type(base.type_name) else "."
        return ExprResult(f"{base.code}{op}{member}", self._lookup_type(member))

    def visitMemberCallAtom(self, ctx):
        base = self.visit(ctx.atom())
        name = ctx.IDENTIFIER().getText()
        args = [self.visit(e).code for e in (ctx.argList().expr() if ctx.argList() else [])]

        if self._is_list_type(base.type_name):
            if isinstance(self.strategy, PythonStrategy):
                if name == "append":
                    return ExprResult(f"{base.code}.append({args[0]})", "void")
                if name == "remove":
                    return ExprResult(f"{base.code}.pop({args[0]})", "void")
            if isinstance(self.strategy, JavaStrategy):
                if name == "append":
                    return ExprResult(f"{base.code}.add({args[0]})", "void")
                if name == "remove":
                    return ExprResult(f"{base.code}.remove({args[0]})", "void")
            if isinstance(self.strategy, CppStrategy):
                if name == "append":
                    return ExprResult(f"{base.code}.push_back({args[0]})", "void")
                if name == "remove":
                    return ExprResult(f"{base.code}.erase({base.code}.begin() + {args[0]})", "void")

        if isinstance(self.strategy, PythonStrategy):
            return ExprResult(f"{base.code}.{name}({', '.join(args)})", "void")
        if isinstance(self.strategy, JavaStrategy):
            return ExprResult(f"{base.code}.{name}({', '.join(args)})", "void")
        op = "->" if self._is_class_type(base.type_name) else "."
        return ExprResult(f"{base.code}{op}{name}({', '.join(args)})", "void")

    def visitIndexAtom(self, ctx):
        base = self.visit(ctx.atom())
        idx = self.visit(ctx.expr()).code
        inner_type = "int"
        if self._is_list_type(base.type_name) and base.type_name.startswith("list<") and base.type_name.endswith(">"):
            inner_type = base.type_name[5:-1]
            if isinstance(self.strategy, CppStrategy) and inner_type in self.class_defs:
                inner_type = f"std::shared_ptr<{inner_type}>"
        if isinstance(self.strategy, JavaStrategy) and self._is_list_type(base.type_name):
            return ExprResult(f"{base.code}.get({idx})", inner_type)
        return ExprResult(f"{base.code}[{idx}]", inner_type)

    def visitListLiteralAtom(self, ctx):
        elems = [self.visit(e) for e in (ctx.argList().expr() if ctx.argList() else [])]
        inner = elems[0].type_name if elems else "any"
        t = f"list<{inner}>"
        if isinstance(self.strategy, PythonStrategy):
            return ExprResult(f"[{', '.join(e.code for e in elems)}]", t)
        if isinstance(self.strategy, JavaStrategy):
            if elems:
                return ExprResult(f"new ArrayList<>(Arrays.asList({', '.join(e.code for e in elems)}))", t)
            return ExprResult("new ArrayList<>()", t)
        return ExprResult(f"{{{', '.join(e.code for e in elems)}}}", t)

    def visitNewAtom(self, ctx):
        cls = ctx.IDENTIFIER().getText()
        args = [self.visit(e).code for e in (ctx.argList().expr() if ctx.argList() else [])]
        if isinstance(self.strategy, CppStrategy):
            return ExprResult(f"std::make_shared<{cls}>({', '.join(args)})", f"std::shared_ptr<{cls}>")
        return ExprResult(f"{cls}({', '.join(args)})" if isinstance(self.strategy, PythonStrategy) else f"new {cls}({', '.join(args)})", cls)

    def visitSuperCallAtom(self, ctx):
        args = [self.visit(e).code for e in (ctx.argList().expr() if ctx.argList() else [])]
        joined = ", ".join(args)
        if isinstance(self.strategy, PythonStrategy):
            return ExprResult(f"super().__init__({joined})", "void")
        if isinstance(self.strategy, JavaStrategy):
            return ExprResult(f"super({joined})", "void")
        return ExprResult(f"__CPP_SUPER__:{joined}", "void")

    # ---------- literals ----------
    def visitLiteral(self, ctx):
        if ctx.INT_LITERAL():
            return ExprResult(ctx.INT_LITERAL().getText(), "int")
        if ctx.FLOAT_LITERAL():
            return ExprResult(ctx.FLOAT_LITERAL().getText(), "float")
        if ctx.NULL():
            if isinstance(self.strategy, PythonStrategy):
                return ExprResult("None", "null")
            if isinstance(self.strategy, JavaStrategy):
                return ExprResult("null", "null")
            return ExprResult("nullptr", "null")
        if ctx.TRUE():
            return ExprResult("True" if isinstance(self.strategy, PythonStrategy) else "true", "bool")
        if ctx.FALSE():
            return ExprResult("False" if isinstance(self.strategy, PythonStrategy) else "false", "bool")
        if ctx.STRING_LITERAL():
            return ExprResult(ctx.STRING_LITERAL().getText(), "string")
        if ctx.STRING_INTERP():
            raw = ctx.STRING_INTERP().getText()[1:-1]
            parts = []
            for m in re.finditer(r"\{([^}]*)\}", raw):
                expr_text = m.group(1).strip()
                expr_res = self.visit(WovenParser(CommonTokenStream(WovenLexer(InputStream(expr_text)))).expr())
                parts.append((m.group(1), expr_res.code, expr_res.type_name))
            return ExprResult(self.strategy.string_interp(raw, parts), "string")
        return ExprResult(ctx.getText(), "string")

    # ---------- specials ----------
    def visitExprStmt(self, ctx):
        e = self.visit(ctx.expr()).code
        if isinstance(self.strategy, CppStrategy) and self._inside_cpp_ctor and e.startswith("__CPP_SUPER__:"):
            self._cpp_ctor_super = e.split(":", 1)[1]
            return
        if isinstance(self.strategy, PythonStrategy):
            self._emit(e)
        else:
            self._emit(f"{e};")

    def visitBreakStmt(self, ctx):
        self._emit(self.strategy.break_stmt())

    def visitContinueStmt(self, ctx):
        self._emit(self.strategy.continue_stmt())

    def visitThrowStmt(self, ctx):
        expr = self.visit(ctx.expr()).code
        self._emit(self.strategy.throw_stmt(expr))


def translate_woven(source: str, language: str) -> str:
    from interpreter_visitor import InterpreterVisitor

    lexer = WovenLexer(InputStream(source))
    stream = CommonTokenStream(lexer)
    parser = WovenParser(stream)
    tree = parser.program()

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
