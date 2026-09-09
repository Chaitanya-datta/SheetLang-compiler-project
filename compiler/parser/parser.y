%{
#include <cstdio>
#include <cstdlib>
#include <string>
#include <vector>
#include "AST.h"

extern int yylex();
extern int g_token_line;
extern FILE* yyin;

void yyerror(const char* msg);
%}

%union {
    int ival;
    std::string* sval;
    ASTNode* node;
    std::vector<ASTNode*>* stmtList;
    std::vector<ASTNode*>* exprList;
    std::vector<std::string>* paramList;
}

%token SHEET END LET PRINT IF ELSE ENDIF
%token FUNCTION RETURN ENDFUNCTION
%token WHILE ENDWHILE
%token <sval> IDENTIFIER CELL STRING
%token <ival> NUMBER
%token PLUS MINUS MULTIPLY DIVIDE MOD
%token ASSIGN LPAREN RPAREN COMMA
%token GT LT GTE LTE EQ NEQ

/* Location tracking: Bison's built-in @N (per-symbol) and @$ (whole-rule)
 * locations are threaded through the parse stack at the moment each token
 * is SHIFTED, not re-read later. This is deliberately used instead of the
 * single mutable g_token_line global (still used only for --tokens output
 * and syntax-error reporting) because g_token_line gets overwritten by
 * Bison's one-token lookahead before a rule reduces -- confirmed via
 * testing to silently attach the WRONG line number (the next statement's
 * line, or END's line) to AST nodes built from multi-token expressions. */
%locations

%type <node> program stmt assignment print_stmt if_stmt
%type <node> expr term factor condition
%type <node> function_decl return_stmt
%type <node> while_stmt
%type <stmtList> stmt_list
%type <exprList> arg_list
%type <paramList> param_list

%right UMINUS

/* On a syntax error, Bison discards whatever symbols are still on the
 * parser stack without running their normal semantic actions. Without
 * these, any heap-allocated string, AST node, or vector already built
 * before the error point would leak (confirmed via AddressSanitizer).
 * %destructor tells Bison how to free each semantic-value type on
 * discard, whether at error recovery or (harmlessly) at normal
 * end-of-parse when a value has already been consumed elsewhere. */
%destructor { delete $$; } <sval>
%destructor { delete $$; } <node>
%destructor { for (auto* n : *$$) delete n; delete $$; } <stmtList>
%destructor { for (auto* n : *$$) delete n; delete $$; } <exprList>
%destructor { delete $$; } <paramList>

%%

program:
    SHEET IDENTIFIER stmt_list END {
        g_astRoot = new ProgramNode(*$2, std::move(*$3), @1.first_line);
        delete $2;
        delete $3;
        // Ownership of the tree is transferred to g_astRoot (read by
        // main.cpp after yyparse() returns). Bison's generated cleanup
        // code runs %destructor on whatever is left on the parse stack
        // when yyparse() exits, on BOTH success and failure -- including
        // the just-accepted start symbol. Leaving $$ non-null here would
        // mean that cleanup deletes the same ProgramNode g_astRoot points
        // to, causing a use-after-free the moment main.cpp reads it
        // (confirmed via AddressSanitizer). Setting $$ to nullptr makes
        // that cleanup's `delete $$` a safe no-op.
        $$ = nullptr;
    }
    ;

stmt_list:
    stmt_list stmt { $1->push_back($2); $$ = $1; }
    | /* empty */  { $$ = new std::vector<ASTNode*>(); }
    ;

stmt:
    assignment { $$ = $1; }
    | print_stmt { $$ = $1; }
    | if_stmt { $$ = $1; }
    | function_decl { $$ = $1; }
    | return_stmt { $$ = $1; }
    | while_stmt { $$ = $1; }
    | IDENTIFIER LPAREN arg_list RPAREN {
        /* Phase 8: a bare function call used as a statement (its return
         * value, if any, is discarded), e.g. `hello()`. Reuses the exact
         * same FunctionCallNode already used when a call appears inside
         * an expression -- see `factor` below -- so SemanticAnalyzer's
         * existing visitFunctionCall / LLVMCodeGenerator's existing call
         * codegen both handle this uniformly with no special-casing. */
        $$ = new FunctionCallNode(*$1, std::move(*$3), @1.first_line);
        delete $1; delete $3;
      }
    ;

function_decl:
    FUNCTION IDENTIFIER LPAREN param_list RPAREN stmt_list ENDFUNCTION {
        $$ = new FunctionDeclNode(*$2, std::move(*$4),
                new StatementListNode("Body", std::move(*$6), @1.first_line),
                @1.first_line);
        delete $2; delete $4; delete $6;
    }
    ;

param_list:
    param_list COMMA IDENTIFIER { $1->push_back(*$3); delete $3; $$ = $1; }
    | IDENTIFIER { $$ = new std::vector<std::string>(); $$->push_back(*$1); delete $1; }
    | /* empty */ { $$ = new std::vector<std::string>(); }
    ;

return_stmt:
    RETURN expr { $$ = new ReturnNode($2, @1.first_line); }
    ;

assignment:
    LET IDENTIFIER ASSIGN expr {
        $$ = new AssignmentNode(new IdentifierNode(*$2, @1.first_line), $4, @1.first_line);
        delete $2;
    }
    | CELL ASSIGN expr {
        $$ = new AssignmentNode(new CellNode(*$1, @1.first_line), $3, @1.first_line);
        delete $1;
    }
    ;

print_stmt:
    PRINT expr { $$ = new PrintNode($2, @1.first_line); }
    ;

if_stmt:
    IF condition stmt_list ELSE stmt_list ENDIF {
        $$ = new IfNode($2,
                new StatementListNode("Then", std::move(*$3), @1.first_line),
                new StatementListNode("Else", std::move(*$5), @1.first_line),
                @1.first_line);
        delete $3; delete $5;
    }
    | IF condition stmt_list ENDIF {
        $$ = new IfNode($2,
                new StatementListNode("Then", std::move(*$3), @1.first_line),
                nullptr,
                @1.first_line);
        delete $3;
    }
    ;

while_stmt:
    WHILE condition stmt_list ENDWHILE {
        $$ = new WhileNode($2,
                new StatementListNode("Body", std::move(*$3), @1.first_line),
                @1.first_line);
        delete $3;
    }
    ;

condition:
    expr GT expr  { $$ = new ComparisonNode(">", $1, $3, @2.first_line); }
    | expr LT expr  { $$ = new ComparisonNode("<", $1, $3, @2.first_line); }
    | expr GTE expr { $$ = new ComparisonNode(">=", $1, $3, @2.first_line); }
    | expr LTE expr { $$ = new ComparisonNode("<=", $1, $3, @2.first_line); }
    | expr EQ expr  { $$ = new ComparisonNode("==", $1, $3, @2.first_line); }
    | expr NEQ expr { $$ = new ComparisonNode("!=", $1, $3, @2.first_line); }
    ;

expr:
    expr PLUS term   { $$ = new BinaryExprNode("+", $1, $3, @2.first_line); }
    | expr MINUS term { $$ = new BinaryExprNode("-", $1, $3, @2.first_line); }
    | term             { $$ = $1; }
    ;

term:
    term MULTIPLY factor { $$ = new BinaryExprNode("*", $1, $3, @2.first_line); }
    | term DIVIDE factor  { $$ = new BinaryExprNode("/", $1, $3, @2.first_line); }
    | term MOD factor     { $$ = new BinaryExprNode("%", $1, $3, @2.first_line); }
    | factor               { $$ = $1; }
    ;

factor:
    NUMBER { $$ = new NumberNode($1, @1.first_line); }
    | IDENTIFIER { $$ = new IdentifierNode(*$1, @1.first_line); delete $1; }
    | CELL { $$ = new CellNode(*$1, @1.first_line); delete $1; }
    | STRING {
        /* Phase 4 addition: STRING is now a valid factor, not just a
         * PRINT-only literal. This lets `LET B = "hello"` PARSE
         * successfully (as Phase 4's semantic test suite requires), while
         * the SemanticAnalyzer -- not the grammar -- is what rejects
         * mixing STRING with arithmetic. See README "Phase 4 vs the
         * original Phase 1 type-system decision" for the full rationale. */
        $$ = new StringLiteralNode(*$1, @1.first_line); delete $1;
      }
    | MINUS factor %prec UMINUS { $$ = new UnaryExprNode("-", $2, @1.first_line); }
    | LPAREN expr RPAREN { $$ = $2; }
    | IDENTIFIER LPAREN arg_list RPAREN {
        $$ = new FunctionCallNode(*$1, std::move(*$3), @1.first_line);
        delete $1; delete $3;
    }
    ;

arg_list:
    arg_list COMMA expr { $1->push_back($3); $$ = $1; }
    | expr { $$ = new std::vector<ASTNode*>(); $$->push_back($1); }
    | /* empty */ { $$ = new std::vector<ASTNode*>(); }
    ;

%%

void yyerror(const char* msg) {
    fprintf(stderr, "Syntax Error: %s at line %d\n", msg, g_token_line);
}
