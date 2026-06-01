grammar Woven;

// Woven — lenguaje de convergencia sintáctica (Python / Java / C).
//
// Decisión de diseño: for usa sintaxis C for(init; cond; update) de forma intencional,
// alineada con Java/C en lugar del for-in de Python.
//
// Generar lexer y parser (desde la raíz del repo):
//   make generate

tokens { INDENT, DEDENT }

@lexer::header {
from WovenParser import WovenParser
}

@lexer::members {
def __init__(self, input=None, output=sys.stdout):
    super().__init__(input, output)
    self.checkVersion("4.13.2")
    self._interp = LexerATNSimulator(self, self.atn, self.decisionsToDFA, PredictionContextCache())
    self._actions = None
    self._predicates = None
    self.indents = []
    self.pending = []
    self.opened = 0

def emitPending(self, type_, text):
    from antlr4.Token import CommonToken
    t = CommonToken(type=type_)
    t.text = text
    t.line = self.line
    t.column = self.column
    self.pending.append(t)

def emitDedents(self, currentIndent):
    while len(self.indents) > 0 and self.indents[-1] > currentIndent:
        self.emitPending(WovenParser.DEDENT, "DEDENT")
        self.indents.pop()

def nextToken(self):
    if self.pending:
        return self.pending.pop(0)
    token = Lexer.nextToken(self)
    if token.type == Token.EOF:
        while len(self.indents) > 1:
            self.emitPending(WovenParser.DEDENT, "DEDENT")
            self.indents.pop()
        if self.pending:
            self.pending.append(token)
            return self.pending.pop(0)
    return token
}

// --- Parser ----------------------------------------------------------------

program
    : (NEWLINE | statement)* EOF
    ;

statement
    : compoundStmt
    | simpleStmt
    ;

simpleStmt
    : varDecl
    | assignment
    | returnStmt
    | printStmt
    | selfAssignment
    | indexAssignment
    | exprStmt
    | breakStmt
    | continueStmt
    | throwStmt
    ;

compoundStmt
    : functionDecl
    | ifStmt
    | forStmt
    | whileStmt
    | classDecl
    | tryStmt
    ;

functionDecl
    : FUNCTION returnType IDENTIFIER LPAREN paramList? RPAREN COLON block
    ;

paramList
    : param (COMMA param)*
    ;

param
    : typeName IDENTIFIER
    ;

returnType
    : typeName
    | VOID
    ;

varDecl
    : typeName IDENTIFIER (ASSIGN expr)?
    ;

typeName
    : INT
    | FLOAT
    | STRING
    | BOOL
    | IDENTIFIER
    | listType
    ;

listType
    : LIST LT typeName GT
    ;

block
    : NEWLINE INDENT (NEWLINE | statement)+ DEDENT
    ;

ifStmt
    : IF expr COLON block (ELSE COLON block)?
    ;

forStmt
    : FOR LPAREN forInit? SEMI expr? SEMI forUpdate? RPAREN COLON block
    ;

forInit
    : typeName IDENTIFIER ASSIGN expr
    | assignment
    ;

forUpdate
    : assignment
    | expr
    ;

whileStmt
    : WHILE LPAREN expr RPAREN COLON block
    ;

tryStmt
    : TRY COLON block
      CATCH LPAREN STRING IDENTIFIER RPAREN COLON block
    ;

classDecl
    : CLASS IDENTIFIER (EXTENDS IDENTIFIER)? COLON classBody
    ;

classBody
    : NEWLINE INDENT (NEWLINE | classMember)+ DEDENT
    ;

classMember
    : fieldDecl
    | constructorDecl
    | methodDecl
    ;

fieldDecl
    : typeName IDENTIFIER
    ;

constructorDecl
    : INIT LPAREN paramList? RPAREN COLON block
    ;

methodDecl
    : VIRTUAL? FUNCTION returnType IDENTIFIER LPAREN paramList? RPAREN COLON block
    ;

returnStmt
    : RETURN expr?
    ;

printStmt
    : PRINT LPAREN argList? RPAREN
    ;

breakStmt
    : BREAK
    ;

continueStmt
    : CONTINUE
    ;

throwStmt
    : THROW expr
    ;

assignment
    : IDENTIFIER ASSIGN expr
    ;

selfAssignment
    : SELF DOT IDENTIFIER ASSIGN expr
    ;

indexAssignment
    : IDENTIFIER LBRACK expr RBRACK ASSIGN expr
    | SELF DOT IDENTIFIER LBRACK expr RBRACK ASSIGN expr
    ;

exprStmt
    : expr
    ;

expr
    : orExpr
    ;

orExpr
    : orExpr OR andExpr                    # logicalOr
    | andExpr                              # andExprAlt
    ;

andExpr
    : andExpr AND compExpr                 # logicalAnd
    | compExpr                             # compExprAlt
    ;

compExpr
    : compExpr op=(MUL | DIV | MOD) unaryExpr       # binaryOp
    | compExpr op=(ADD | SUB) unaryExpr             # binaryOp
    | compExpr op=(LT | LE | GT | GE | EQ | NE) unaryExpr  # comparison
    | unaryExpr                                     # unaryExprAlt
    ;

unaryExpr
    : op=(SUB | NOT) unaryExpr                      # unaryOp
    | powerExpr                                     # powerExprAlt
    ;

powerExpr
    : atom POW powerExpr                            # powerOp
    | atom                                          # atomExpr
    ;

atom
    : literal                              # literalAtom
    | SELF DOT IDENTIFIER LPAREN argList? RPAREN # selfCallAtom
    | SELF DOT IDENTIFIER                  # selfFieldAtom
    | NEW IDENTIFIER LPAREN argList? RPAREN # newAtom
    | IDENTIFIER LPAREN argList? RPAREN    # callAtom
    | IDENTIFIER                           # idAtom
    | LPAREN expr RPAREN                   # parenAtom
    | atom LBRACK expr RBRACK              # indexAtom
    | atom DOT IDENTIFIER LPAREN argList? RPAREN # memberCallAtom
    | atom DOT IDENTIFIER                  # memberAccessAtom
    | LBRACK argList? RBRACK               # listLiteralAtom
    | SUPER LPAREN argList? RPAREN         # superCallAtom
    ;

argList
    : expr (COMMA expr)*
    ;

literal
    : INT_LITERAL
    | FLOAT_LITERAL
    | STRING_LITERAL
    | STRING_INTERP
    | TRUE
    | FALSE
    | NULL
    ;

// STRING_INTERP — traducción por lenguaje destino:
//   Python → f-string:  f"El valor es {x}"
//   Java   → String.format("El valor es %s", x)
//   C      → printf("El valor es %d", x)  (requiere tabla de tipos)

// --- Lexer -----------------------------------------------------------------

FUNCTION  : 'function' ;
CLASS     : 'class' ;
EXTENDS   : 'extends' ;
INIT      : 'init' ;
SELF      : 'self' ;
SUPER     : 'super' ;
VIRTUAL   : 'virtual' ;
NEW       : 'new' ;
LIST      : 'list' ;
INT       : 'int' ;
FLOAT     : 'float' ;
STRING    : 'string' ;
BOOL      : 'bool' ;
VOID      : 'void' ;
IF        : 'if' ;
ELSE      : 'else' ;
FOR       : 'for' ;
WHILE     : 'while' ;
RETURN    : 'return' ;
PRINT     : 'print' ;
BREAK     : 'break' ;
CONTINUE  : 'continue' ;
TRY       : 'try' ;
CATCH     : 'catch' ;
THROW     : 'throw' ;
TRUE      : 'true' ;
FALSE     : 'false' ;
NULL      : 'null' ;

LPAREN    : '(' { self.opened += 1 } ;
RPAREN    : ')' { self.opened -= 1 } ;
LBRACK    : '[' { self.opened += 1 } ;
RBRACK    : ']' { self.opened -= 1 } ;
LBRACE    : '{' { self.opened += 1 } ;
RBRACE    : '}' { self.opened -= 1 } ;

COLON     : ':' ;
SEMI      : ';' ;
COMMA     : ',' ;
ASSIGN    : '=' ;
DOT       : '.' ;

ADD       : '+' ;
SUB       : '-' ;
POW       : '**' ;
MUL       : '*' ;
DIV       : '/' ;
MOD       : '%' ;

LT        : '<' ;
LE        : '<=' ;
GT        : '>' ;
GE        : '>=' ;
EQ        : '==' ;
NE        : '!=' ;

AND       : 'and' ;
OR        : 'or' ;
NOT       : '!' ;

BLOCK_COMMENT
    : '/*' ( BLOCK_COMMENT | ~[*] | '*' ~[/] )* '*/' -> channel(HIDDEN)
    ;

LINE_COMMENT
    : '//' ~[\r\n]* -> channel(HIDDEN)
    ;

HASH_COMMENT
    : '#' ~[\r\n]* -> channel(HIDDEN)
    ;

IDENTIFIER
    : [a-zA-Z_] [a-zA-Z0-9_]*
    ;

INT_LITERAL
    : [0-9]+
    ;

FLOAT_LITERAL
    : [0-9]+ '.' [0-9]+ ([eE] [+-]? [0-9]+)?
    | [0-9]+ [eE] [+-]? [0-9]+
    ;

STRING_INTERP
    : '"' ( ESC | ~["\\{] )* ('{' ~[}]* '}' ( ESC | ~["\\{] )*)+ '"'
    ;

STRING_LITERAL
    : '"' ( ESC | ~["\\] )* '"'
    | '\'' ( ESC | ~['\\] )* '\''
    ;

fragment ESC
    : '\\' [btnfr"'\\]
    ;

SKIP_NEWLINE
    : { self.opened > 0 }? ( '\r'? '\n' | '\r' | '\f' ) -> skip
    ;

NEWLINE
    : ( '\r'? '\n' | '\r' | '\f' )
      {
        currentIndent = 0
        while True:
            la = self._input.LA(1)
            if la == ord(' '):
                currentIndent += 1
                self._input.consume()
            elif la == ord('\t'):
                currentIndent += 4
                self._input.consume()
            elif la == ord('\f'):
                self._input.consume()
            else:
                break
        la = self._input.LA(1)
        if la in (ord('\r'), ord('\n')):
            pass
        elif la == ord('#'):
            pass
        elif la == ord('/') and self._input.LA(2) in (ord('/'), ord('*')):
            pass
        else:
            if not self.indents:
                self.indents.append(0)
            previous = self.indents[-1]
            if currentIndent > previous:
                self.indents.append(currentIndent)
                self.emitPending(WovenParser.INDENT, "INDENT")
            else:
                self.emitDedents(currentIndent)
                if currentIndent != self.indents[-1]:
                    from antlr4.error.Errors import LexerNoViableAltException
                    raise LexerNoViableAltException(self, self._input, self._tokenStartCharIndex, None)
      }
    ;

WS
    : [ \t]+ -> skip
    ;
