# Generated from Woven.g4 by ANTLR 4.13.2
from antlr4 import *
if "." in __name__:
    from .WovenParser import WovenParser
else:
    from WovenParser import WovenParser

# This class defines a complete listener for a parse tree produced by WovenParser.
class WovenListener(ParseTreeListener):

    # Enter a parse tree produced by WovenParser#program.
    def enterProgram(self, ctx:WovenParser.ProgramContext):
        pass

    # Exit a parse tree produced by WovenParser#program.
    def exitProgram(self, ctx:WovenParser.ProgramContext):
        pass


    # Enter a parse tree produced by WovenParser#statement.
    def enterStatement(self, ctx:WovenParser.StatementContext):
        pass

    # Exit a parse tree produced by WovenParser#statement.
    def exitStatement(self, ctx:WovenParser.StatementContext):
        pass


    # Enter a parse tree produced by WovenParser#simpleStmt.
    def enterSimpleStmt(self, ctx:WovenParser.SimpleStmtContext):
        pass

    # Exit a parse tree produced by WovenParser#simpleStmt.
    def exitSimpleStmt(self, ctx:WovenParser.SimpleStmtContext):
        pass


    # Enter a parse tree produced by WovenParser#compoundStmt.
    def enterCompoundStmt(self, ctx:WovenParser.CompoundStmtContext):
        pass

    # Exit a parse tree produced by WovenParser#compoundStmt.
    def exitCompoundStmt(self, ctx:WovenParser.CompoundStmtContext):
        pass


    # Enter a parse tree produced by WovenParser#functionDecl.
    def enterFunctionDecl(self, ctx:WovenParser.FunctionDeclContext):
        pass

    # Exit a parse tree produced by WovenParser#functionDecl.
    def exitFunctionDecl(self, ctx:WovenParser.FunctionDeclContext):
        pass


    # Enter a parse tree produced by WovenParser#paramList.
    def enterParamList(self, ctx:WovenParser.ParamListContext):
        pass

    # Exit a parse tree produced by WovenParser#paramList.
    def exitParamList(self, ctx:WovenParser.ParamListContext):
        pass


    # Enter a parse tree produced by WovenParser#param.
    def enterParam(self, ctx:WovenParser.ParamContext):
        pass

    # Exit a parse tree produced by WovenParser#param.
    def exitParam(self, ctx:WovenParser.ParamContext):
        pass


    # Enter a parse tree produced by WovenParser#returnType.
    def enterReturnType(self, ctx:WovenParser.ReturnTypeContext):
        pass

    # Exit a parse tree produced by WovenParser#returnType.
    def exitReturnType(self, ctx:WovenParser.ReturnTypeContext):
        pass


    # Enter a parse tree produced by WovenParser#varDecl.
    def enterVarDecl(self, ctx:WovenParser.VarDeclContext):
        pass

    # Exit a parse tree produced by WovenParser#varDecl.
    def exitVarDecl(self, ctx:WovenParser.VarDeclContext):
        pass


    # Enter a parse tree produced by WovenParser#typeName.
    def enterTypeName(self, ctx:WovenParser.TypeNameContext):
        pass

    # Exit a parse tree produced by WovenParser#typeName.
    def exitTypeName(self, ctx:WovenParser.TypeNameContext):
        pass


    # Enter a parse tree produced by WovenParser#listType.
    def enterListType(self, ctx:WovenParser.ListTypeContext):
        pass

    # Exit a parse tree produced by WovenParser#listType.
    def exitListType(self, ctx:WovenParser.ListTypeContext):
        pass


    # Enter a parse tree produced by WovenParser#block.
    def enterBlock(self, ctx:WovenParser.BlockContext):
        pass

    # Exit a parse tree produced by WovenParser#block.
    def exitBlock(self, ctx:WovenParser.BlockContext):
        pass


    # Enter a parse tree produced by WovenParser#ifStmt.
    def enterIfStmt(self, ctx:WovenParser.IfStmtContext):
        pass

    # Exit a parse tree produced by WovenParser#ifStmt.
    def exitIfStmt(self, ctx:WovenParser.IfStmtContext):
        pass


    # Enter a parse tree produced by WovenParser#forStmt.
    def enterForStmt(self, ctx:WovenParser.ForStmtContext):
        pass

    # Exit a parse tree produced by WovenParser#forStmt.
    def exitForStmt(self, ctx:WovenParser.ForStmtContext):
        pass


    # Enter a parse tree produced by WovenParser#forInit.
    def enterForInit(self, ctx:WovenParser.ForInitContext):
        pass

    # Exit a parse tree produced by WovenParser#forInit.
    def exitForInit(self, ctx:WovenParser.ForInitContext):
        pass


    # Enter a parse tree produced by WovenParser#forUpdate.
    def enterForUpdate(self, ctx:WovenParser.ForUpdateContext):
        pass

    # Exit a parse tree produced by WovenParser#forUpdate.
    def exitForUpdate(self, ctx:WovenParser.ForUpdateContext):
        pass


    # Enter a parse tree produced by WovenParser#whileStmt.
    def enterWhileStmt(self, ctx:WovenParser.WhileStmtContext):
        pass

    # Exit a parse tree produced by WovenParser#whileStmt.
    def exitWhileStmt(self, ctx:WovenParser.WhileStmtContext):
        pass


    # Enter a parse tree produced by WovenParser#tryStmt.
    def enterTryStmt(self, ctx:WovenParser.TryStmtContext):
        pass

    # Exit a parse tree produced by WovenParser#tryStmt.
    def exitTryStmt(self, ctx:WovenParser.TryStmtContext):
        pass


    # Enter a parse tree produced by WovenParser#classDecl.
    def enterClassDecl(self, ctx:WovenParser.ClassDeclContext):
        pass

    # Exit a parse tree produced by WovenParser#classDecl.
    def exitClassDecl(self, ctx:WovenParser.ClassDeclContext):
        pass


    # Enter a parse tree produced by WovenParser#classBody.
    def enterClassBody(self, ctx:WovenParser.ClassBodyContext):
        pass

    # Exit a parse tree produced by WovenParser#classBody.
    def exitClassBody(self, ctx:WovenParser.ClassBodyContext):
        pass


    # Enter a parse tree produced by WovenParser#classMember.
    def enterClassMember(self, ctx:WovenParser.ClassMemberContext):
        pass

    # Exit a parse tree produced by WovenParser#classMember.
    def exitClassMember(self, ctx:WovenParser.ClassMemberContext):
        pass


    # Enter a parse tree produced by WovenParser#fieldDecl.
    def enterFieldDecl(self, ctx:WovenParser.FieldDeclContext):
        pass

    # Exit a parse tree produced by WovenParser#fieldDecl.
    def exitFieldDecl(self, ctx:WovenParser.FieldDeclContext):
        pass


    # Enter a parse tree produced by WovenParser#constructorDecl.
    def enterConstructorDecl(self, ctx:WovenParser.ConstructorDeclContext):
        pass

    # Exit a parse tree produced by WovenParser#constructorDecl.
    def exitConstructorDecl(self, ctx:WovenParser.ConstructorDeclContext):
        pass


    # Enter a parse tree produced by WovenParser#methodDecl.
    def enterMethodDecl(self, ctx:WovenParser.MethodDeclContext):
        pass

    # Exit a parse tree produced by WovenParser#methodDecl.
    def exitMethodDecl(self, ctx:WovenParser.MethodDeclContext):
        pass


    # Enter a parse tree produced by WovenParser#returnStmt.
    def enterReturnStmt(self, ctx:WovenParser.ReturnStmtContext):
        pass

    # Exit a parse tree produced by WovenParser#returnStmt.
    def exitReturnStmt(self, ctx:WovenParser.ReturnStmtContext):
        pass


    # Enter a parse tree produced by WovenParser#printStmt.
    def enterPrintStmt(self, ctx:WovenParser.PrintStmtContext):
        pass

    # Exit a parse tree produced by WovenParser#printStmt.
    def exitPrintStmt(self, ctx:WovenParser.PrintStmtContext):
        pass


    # Enter a parse tree produced by WovenParser#breakStmt.
    def enterBreakStmt(self, ctx:WovenParser.BreakStmtContext):
        pass

    # Exit a parse tree produced by WovenParser#breakStmt.
    def exitBreakStmt(self, ctx:WovenParser.BreakStmtContext):
        pass


    # Enter a parse tree produced by WovenParser#continueStmt.
    def enterContinueStmt(self, ctx:WovenParser.ContinueStmtContext):
        pass

    # Exit a parse tree produced by WovenParser#continueStmt.
    def exitContinueStmt(self, ctx:WovenParser.ContinueStmtContext):
        pass


    # Enter a parse tree produced by WovenParser#throwStmt.
    def enterThrowStmt(self, ctx:WovenParser.ThrowStmtContext):
        pass

    # Exit a parse tree produced by WovenParser#throwStmt.
    def exitThrowStmt(self, ctx:WovenParser.ThrowStmtContext):
        pass


    # Enter a parse tree produced by WovenParser#assignment.
    def enterAssignment(self, ctx:WovenParser.AssignmentContext):
        pass

    # Exit a parse tree produced by WovenParser#assignment.
    def exitAssignment(self, ctx:WovenParser.AssignmentContext):
        pass


    # Enter a parse tree produced by WovenParser#selfAssignment.
    def enterSelfAssignment(self, ctx:WovenParser.SelfAssignmentContext):
        pass

    # Exit a parse tree produced by WovenParser#selfAssignment.
    def exitSelfAssignment(self, ctx:WovenParser.SelfAssignmentContext):
        pass


    # Enter a parse tree produced by WovenParser#indexAssignment.
    def enterIndexAssignment(self, ctx:WovenParser.IndexAssignmentContext):
        pass

    # Exit a parse tree produced by WovenParser#indexAssignment.
    def exitIndexAssignment(self, ctx:WovenParser.IndexAssignmentContext):
        pass


    # Enter a parse tree produced by WovenParser#exprStmt.
    def enterExprStmt(self, ctx:WovenParser.ExprStmtContext):
        pass

    # Exit a parse tree produced by WovenParser#exprStmt.
    def exitExprStmt(self, ctx:WovenParser.ExprStmtContext):
        pass


    # Enter a parse tree produced by WovenParser#expr.
    def enterExpr(self, ctx:WovenParser.ExprContext):
        pass

    # Exit a parse tree produced by WovenParser#expr.
    def exitExpr(self, ctx:WovenParser.ExprContext):
        pass


    # Enter a parse tree produced by WovenParser#logicalOr.
    def enterLogicalOr(self, ctx:WovenParser.LogicalOrContext):
        pass

    # Exit a parse tree produced by WovenParser#logicalOr.
    def exitLogicalOr(self, ctx:WovenParser.LogicalOrContext):
        pass


    # Enter a parse tree produced by WovenParser#andExprAlt.
    def enterAndExprAlt(self, ctx:WovenParser.AndExprAltContext):
        pass

    # Exit a parse tree produced by WovenParser#andExprAlt.
    def exitAndExprAlt(self, ctx:WovenParser.AndExprAltContext):
        pass


    # Enter a parse tree produced by WovenParser#compExprAlt.
    def enterCompExprAlt(self, ctx:WovenParser.CompExprAltContext):
        pass

    # Exit a parse tree produced by WovenParser#compExprAlt.
    def exitCompExprAlt(self, ctx:WovenParser.CompExprAltContext):
        pass


    # Enter a parse tree produced by WovenParser#logicalAnd.
    def enterLogicalAnd(self, ctx:WovenParser.LogicalAndContext):
        pass

    # Exit a parse tree produced by WovenParser#logicalAnd.
    def exitLogicalAnd(self, ctx:WovenParser.LogicalAndContext):
        pass


    # Enter a parse tree produced by WovenParser#binaryOp.
    def enterBinaryOp(self, ctx:WovenParser.BinaryOpContext):
        pass

    # Exit a parse tree produced by WovenParser#binaryOp.
    def exitBinaryOp(self, ctx:WovenParser.BinaryOpContext):
        pass


    # Enter a parse tree produced by WovenParser#comparison.
    def enterComparison(self, ctx:WovenParser.ComparisonContext):
        pass

    # Exit a parse tree produced by WovenParser#comparison.
    def exitComparison(self, ctx:WovenParser.ComparisonContext):
        pass


    # Enter a parse tree produced by WovenParser#unaryExprAlt.
    def enterUnaryExprAlt(self, ctx:WovenParser.UnaryExprAltContext):
        pass

    # Exit a parse tree produced by WovenParser#unaryExprAlt.
    def exitUnaryExprAlt(self, ctx:WovenParser.UnaryExprAltContext):
        pass


    # Enter a parse tree produced by WovenParser#unaryOp.
    def enterUnaryOp(self, ctx:WovenParser.UnaryOpContext):
        pass

    # Exit a parse tree produced by WovenParser#unaryOp.
    def exitUnaryOp(self, ctx:WovenParser.UnaryOpContext):
        pass


    # Enter a parse tree produced by WovenParser#powerExprAlt.
    def enterPowerExprAlt(self, ctx:WovenParser.PowerExprAltContext):
        pass

    # Exit a parse tree produced by WovenParser#powerExprAlt.
    def exitPowerExprAlt(self, ctx:WovenParser.PowerExprAltContext):
        pass


    # Enter a parse tree produced by WovenParser#powerOp.
    def enterPowerOp(self, ctx:WovenParser.PowerOpContext):
        pass

    # Exit a parse tree produced by WovenParser#powerOp.
    def exitPowerOp(self, ctx:WovenParser.PowerOpContext):
        pass


    # Enter a parse tree produced by WovenParser#atomExpr.
    def enterAtomExpr(self, ctx:WovenParser.AtomExprContext):
        pass

    # Exit a parse tree produced by WovenParser#atomExpr.
    def exitAtomExpr(self, ctx:WovenParser.AtomExprContext):
        pass


    # Enter a parse tree produced by WovenParser#literalAtom.
    def enterLiteralAtom(self, ctx:WovenParser.LiteralAtomContext):
        pass

    # Exit a parse tree produced by WovenParser#literalAtom.
    def exitLiteralAtom(self, ctx:WovenParser.LiteralAtomContext):
        pass


    # Enter a parse tree produced by WovenParser#idAtom.
    def enterIdAtom(self, ctx:WovenParser.IdAtomContext):
        pass

    # Exit a parse tree produced by WovenParser#idAtom.
    def exitIdAtom(self, ctx:WovenParser.IdAtomContext):
        pass


    # Enter a parse tree produced by WovenParser#newAtom.
    def enterNewAtom(self, ctx:WovenParser.NewAtomContext):
        pass

    # Exit a parse tree produced by WovenParser#newAtom.
    def exitNewAtom(self, ctx:WovenParser.NewAtomContext):
        pass


    # Enter a parse tree produced by WovenParser#callAtom.
    def enterCallAtom(self, ctx:WovenParser.CallAtomContext):
        pass

    # Exit a parse tree produced by WovenParser#callAtom.
    def exitCallAtom(self, ctx:WovenParser.CallAtomContext):
        pass


    # Enter a parse tree produced by WovenParser#memberCallAtom.
    def enterMemberCallAtom(self, ctx:WovenParser.MemberCallAtomContext):
        pass

    # Exit a parse tree produced by WovenParser#memberCallAtom.
    def exitMemberCallAtom(self, ctx:WovenParser.MemberCallAtomContext):
        pass


    # Enter a parse tree produced by WovenParser#selfCallAtom.
    def enterSelfCallAtom(self, ctx:WovenParser.SelfCallAtomContext):
        pass

    # Exit a parse tree produced by WovenParser#selfCallAtom.
    def exitSelfCallAtom(self, ctx:WovenParser.SelfCallAtomContext):
        pass


    # Enter a parse tree produced by WovenParser#parenAtom.
    def enterParenAtom(self, ctx:WovenParser.ParenAtomContext):
        pass

    # Exit a parse tree produced by WovenParser#parenAtom.
    def exitParenAtom(self, ctx:WovenParser.ParenAtomContext):
        pass


    # Enter a parse tree produced by WovenParser#indexAtom.
    def enterIndexAtom(self, ctx:WovenParser.IndexAtomContext):
        pass

    # Exit a parse tree produced by WovenParser#indexAtom.
    def exitIndexAtom(self, ctx:WovenParser.IndexAtomContext):
        pass


    # Enter a parse tree produced by WovenParser#memberAccessAtom.
    def enterMemberAccessAtom(self, ctx:WovenParser.MemberAccessAtomContext):
        pass

    # Exit a parse tree produced by WovenParser#memberAccessAtom.
    def exitMemberAccessAtom(self, ctx:WovenParser.MemberAccessAtomContext):
        pass


    # Enter a parse tree produced by WovenParser#selfFieldAtom.
    def enterSelfFieldAtom(self, ctx:WovenParser.SelfFieldAtomContext):
        pass

    # Exit a parse tree produced by WovenParser#selfFieldAtom.
    def exitSelfFieldAtom(self, ctx:WovenParser.SelfFieldAtomContext):
        pass


    # Enter a parse tree produced by WovenParser#listLiteralAtom.
    def enterListLiteralAtom(self, ctx:WovenParser.ListLiteralAtomContext):
        pass

    # Exit a parse tree produced by WovenParser#listLiteralAtom.
    def exitListLiteralAtom(self, ctx:WovenParser.ListLiteralAtomContext):
        pass


    # Enter a parse tree produced by WovenParser#superCallAtom.
    def enterSuperCallAtom(self, ctx:WovenParser.SuperCallAtomContext):
        pass

    # Exit a parse tree produced by WovenParser#superCallAtom.
    def exitSuperCallAtom(self, ctx:WovenParser.SuperCallAtomContext):
        pass


    # Enter a parse tree produced by WovenParser#argList.
    def enterArgList(self, ctx:WovenParser.ArgListContext):
        pass

    # Exit a parse tree produced by WovenParser#argList.
    def exitArgList(self, ctx:WovenParser.ArgListContext):
        pass


    # Enter a parse tree produced by WovenParser#literal.
    def enterLiteral(self, ctx:WovenParser.LiteralContext):
        pass

    # Exit a parse tree produced by WovenParser#literal.
    def exitLiteral(self, ctx:WovenParser.LiteralContext):
        pass



del WovenParser