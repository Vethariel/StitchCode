# Generated from woven/Woven.g4 by ANTLR 4.13.2
from antlr4 import *
if "." in __name__:
    from .WovenParser import WovenParser
else:
    from WovenParser import WovenParser

# This class defines a complete generic visitor for a parse tree produced by WovenParser.

class WovenVisitor(ParseTreeVisitor):

    # Visit a parse tree produced by WovenParser#program.
    def visitProgram(self, ctx:WovenParser.ProgramContext):
        return self.visitChildren(ctx)


    # Visit a parse tree produced by WovenParser#statement.
    def visitStatement(self, ctx:WovenParser.StatementContext):
        return self.visitChildren(ctx)


    # Visit a parse tree produced by WovenParser#simpleStmt.
    def visitSimpleStmt(self, ctx:WovenParser.SimpleStmtContext):
        return self.visitChildren(ctx)


    # Visit a parse tree produced by WovenParser#compoundStmt.
    def visitCompoundStmt(self, ctx:WovenParser.CompoundStmtContext):
        return self.visitChildren(ctx)


    # Visit a parse tree produced by WovenParser#functionDecl.
    def visitFunctionDecl(self, ctx:WovenParser.FunctionDeclContext):
        return self.visitChildren(ctx)


    # Visit a parse tree produced by WovenParser#paramList.
    def visitParamList(self, ctx:WovenParser.ParamListContext):
        return self.visitChildren(ctx)


    # Visit a parse tree produced by WovenParser#param.
    def visitParam(self, ctx:WovenParser.ParamContext):
        return self.visitChildren(ctx)


    # Visit a parse tree produced by WovenParser#returnType.
    def visitReturnType(self, ctx:WovenParser.ReturnTypeContext):
        return self.visitChildren(ctx)


    # Visit a parse tree produced by WovenParser#varDecl.
    def visitVarDecl(self, ctx:WovenParser.VarDeclContext):
        return self.visitChildren(ctx)


    # Visit a parse tree produced by WovenParser#typeName.
    def visitTypeName(self, ctx:WovenParser.TypeNameContext):
        return self.visitChildren(ctx)


    # Visit a parse tree produced by WovenParser#listType.
    def visitListType(self, ctx:WovenParser.ListTypeContext):
        return self.visitChildren(ctx)


    # Visit a parse tree produced by WovenParser#block.
    def visitBlock(self, ctx:WovenParser.BlockContext):
        return self.visitChildren(ctx)


    # Visit a parse tree produced by WovenParser#ifStmt.
    def visitIfStmt(self, ctx:WovenParser.IfStmtContext):
        return self.visitChildren(ctx)


    # Visit a parse tree produced by WovenParser#forStmt.
    def visitForStmt(self, ctx:WovenParser.ForStmtContext):
        return self.visitChildren(ctx)


    # Visit a parse tree produced by WovenParser#forInit.
    def visitForInit(self, ctx:WovenParser.ForInitContext):
        return self.visitChildren(ctx)


    # Visit a parse tree produced by WovenParser#forUpdate.
    def visitForUpdate(self, ctx:WovenParser.ForUpdateContext):
        return self.visitChildren(ctx)


    # Visit a parse tree produced by WovenParser#whileStmt.
    def visitWhileStmt(self, ctx:WovenParser.WhileStmtContext):
        return self.visitChildren(ctx)


    # Visit a parse tree produced by WovenParser#tryStmt.
    def visitTryStmt(self, ctx:WovenParser.TryStmtContext):
        return self.visitChildren(ctx)


    # Visit a parse tree produced by WovenParser#classDecl.
    def visitClassDecl(self, ctx:WovenParser.ClassDeclContext):
        return self.visitChildren(ctx)


    # Visit a parse tree produced by WovenParser#classBody.
    def visitClassBody(self, ctx:WovenParser.ClassBodyContext):
        return self.visitChildren(ctx)


    # Visit a parse tree produced by WovenParser#classMember.
    def visitClassMember(self, ctx:WovenParser.ClassMemberContext):
        return self.visitChildren(ctx)


    # Visit a parse tree produced by WovenParser#fieldDecl.
    def visitFieldDecl(self, ctx:WovenParser.FieldDeclContext):
        return self.visitChildren(ctx)


    # Visit a parse tree produced by WovenParser#constructorDecl.
    def visitConstructorDecl(self, ctx:WovenParser.ConstructorDeclContext):
        return self.visitChildren(ctx)


    # Visit a parse tree produced by WovenParser#methodDecl.
    def visitMethodDecl(self, ctx:WovenParser.MethodDeclContext):
        return self.visitChildren(ctx)


    # Visit a parse tree produced by WovenParser#returnStmt.
    def visitReturnStmt(self, ctx:WovenParser.ReturnStmtContext):
        return self.visitChildren(ctx)


    # Visit a parse tree produced by WovenParser#printStmt.
    def visitPrintStmt(self, ctx:WovenParser.PrintStmtContext):
        return self.visitChildren(ctx)


    # Visit a parse tree produced by WovenParser#breakStmt.
    def visitBreakStmt(self, ctx:WovenParser.BreakStmtContext):
        return self.visitChildren(ctx)


    # Visit a parse tree produced by WovenParser#continueStmt.
    def visitContinueStmt(self, ctx:WovenParser.ContinueStmtContext):
        return self.visitChildren(ctx)


    # Visit a parse tree produced by WovenParser#throwStmt.
    def visitThrowStmt(self, ctx:WovenParser.ThrowStmtContext):
        return self.visitChildren(ctx)


    # Visit a parse tree produced by WovenParser#assignment.
    def visitAssignment(self, ctx:WovenParser.AssignmentContext):
        return self.visitChildren(ctx)


    # Visit a parse tree produced by WovenParser#selfAssignment.
    def visitSelfAssignment(self, ctx:WovenParser.SelfAssignmentContext):
        return self.visitChildren(ctx)


    # Visit a parse tree produced by WovenParser#indexAssignment.
    def visitIndexAssignment(self, ctx:WovenParser.IndexAssignmentContext):
        return self.visitChildren(ctx)


    # Visit a parse tree produced by WovenParser#exprStmt.
    def visitExprStmt(self, ctx:WovenParser.ExprStmtContext):
        return self.visitChildren(ctx)


    # Visit a parse tree produced by WovenParser#expr.
    def visitExpr(self, ctx:WovenParser.ExprContext):
        return self.visitChildren(ctx)


    # Visit a parse tree produced by WovenParser#logicalOr.
    def visitLogicalOr(self, ctx:WovenParser.LogicalOrContext):
        return self.visitChildren(ctx)


    # Visit a parse tree produced by WovenParser#andExprAlt.
    def visitAndExprAlt(self, ctx:WovenParser.AndExprAltContext):
        return self.visitChildren(ctx)


    # Visit a parse tree produced by WovenParser#compExprAlt.
    def visitCompExprAlt(self, ctx:WovenParser.CompExprAltContext):
        return self.visitChildren(ctx)


    # Visit a parse tree produced by WovenParser#logicalAnd.
    def visitLogicalAnd(self, ctx:WovenParser.LogicalAndContext):
        return self.visitChildren(ctx)


    # Visit a parse tree produced by WovenParser#binaryOp.
    def visitBinaryOp(self, ctx:WovenParser.BinaryOpContext):
        return self.visitChildren(ctx)


    # Visit a parse tree produced by WovenParser#comparison.
    def visitComparison(self, ctx:WovenParser.ComparisonContext):
        return self.visitChildren(ctx)


    # Visit a parse tree produced by WovenParser#atomExpr.
    def visitAtomExpr(self, ctx:WovenParser.AtomExprContext):
        return self.visitChildren(ctx)


    # Visit a parse tree produced by WovenParser#unaryOp.
    def visitUnaryOp(self, ctx:WovenParser.UnaryOpContext):
        return self.visitChildren(ctx)


    # Visit a parse tree produced by WovenParser#literalAtom.
    def visitLiteralAtom(self, ctx:WovenParser.LiteralAtomContext):
        return self.visitChildren(ctx)


    # Visit a parse tree produced by WovenParser#idAtom.
    def visitIdAtom(self, ctx:WovenParser.IdAtomContext):
        return self.visitChildren(ctx)


    # Visit a parse tree produced by WovenParser#newAtom.
    def visitNewAtom(self, ctx:WovenParser.NewAtomContext):
        return self.visitChildren(ctx)


    # Visit a parse tree produced by WovenParser#callAtom.
    def visitCallAtom(self, ctx:WovenParser.CallAtomContext):
        return self.visitChildren(ctx)


    # Visit a parse tree produced by WovenParser#memberCallAtom.
    def visitMemberCallAtom(self, ctx:WovenParser.MemberCallAtomContext):
        return self.visitChildren(ctx)


    # Visit a parse tree produced by WovenParser#selfCallAtom.
    def visitSelfCallAtom(self, ctx:WovenParser.SelfCallAtomContext):
        return self.visitChildren(ctx)


    # Visit a parse tree produced by WovenParser#parenAtom.
    def visitParenAtom(self, ctx:WovenParser.ParenAtomContext):
        return self.visitChildren(ctx)


    # Visit a parse tree produced by WovenParser#indexAtom.
    def visitIndexAtom(self, ctx:WovenParser.IndexAtomContext):
        return self.visitChildren(ctx)


    # Visit a parse tree produced by WovenParser#memberAccessAtom.
    def visitMemberAccessAtom(self, ctx:WovenParser.MemberAccessAtomContext):
        return self.visitChildren(ctx)


    # Visit a parse tree produced by WovenParser#selfFieldAtom.
    def visitSelfFieldAtom(self, ctx:WovenParser.SelfFieldAtomContext):
        return self.visitChildren(ctx)


    # Visit a parse tree produced by WovenParser#listLiteralAtom.
    def visitListLiteralAtom(self, ctx:WovenParser.ListLiteralAtomContext):
        return self.visitChildren(ctx)


    # Visit a parse tree produced by WovenParser#superCallAtom.
    def visitSuperCallAtom(self, ctx:WovenParser.SuperCallAtomContext):
        return self.visitChildren(ctx)


    # Visit a parse tree produced by WovenParser#argList.
    def visitArgList(self, ctx:WovenParser.ArgListContext):
        return self.visitChildren(ctx)


    # Visit a parse tree produced by WovenParser#literal.
    def visitLiteral(self, ctx:WovenParser.LiteralContext):
        return self.visitChildren(ctx)



del WovenParser