%{
#include <cstdio>
#include <cstdlib>
#include <string>
#include "AST.h"
#include "parser.tab.h"

int g_token_line = 1;
int g_token_column = 1;
std::string g_token_lexeme;
bool g_lexHadError = false;

static int g_current_column = 1;

#define YY_USER_ACTION                        \
    g_token_line = yylineno;                  \
    g_token_column = g_current_column;        \
    g_current_column += yyleng;               \
    g_token_lexeme = yytext;                  \
    yylloc.first_line = yylloc.last_line = yylineno; \
    yylloc.first_column = g_token_column;     \
    yylloc.last_column = g_token_column + yyleng - 1;

static void report_lexical_error(const char *ch);
%}

%option noyywrap
%option yylineno

DIGIT   [0-9]
CELLTOK [A-Z]+[0-9]+
IDENT   [A-Za-z_][A-Za-z0-9_]*

%%

"SHEET"       { return SHEET; }
"END"         { return END; }
"LET"         { return LET; }
"PRINT"       { return PRINT; }
"IF"          { return IF; }
"ELSE"        { return ELSE; }
"ENDIF"       { return ENDIF; }
"FUNCTION"    { return FUNCTION; }
"WHILE"       { return WHILE; }
"ENDWHILE"    { return ENDWHILE; }
"RETURN"      { return RETURN; }
"ENDFUNCTION" { return ENDFUNCTION; }

{CELLTOK}     { yylval.sval = new std::string(yytext); return CELL; }
{IDENT}       { yylval.sval = new std::string(yytext); return IDENTIFIER; }
{DIGIT}+      { yylval.ival = atoi(yytext); return NUMBER; }

\"[^\"\n]*\"  {
                  std::string raw(yytext);
                  yylval.sval = new std::string(raw.substr(1, raw.size() - 2));
                  return STRING;
              }

">="          { return GTE; }
"<="          { return LTE; }
"=="          { return EQ; }
"!="          { return NEQ; }
">"           { return GT; }
"<"           { return LT; }

"+"           { return PLUS; }
"-"           { return MINUS; }
"*"           { return MULTIPLY; }
"/"           { return DIVIDE; }
"%"           { return MOD; }
"="           { return ASSIGN; }
"("           { return LPAREN; }
")"           { return RPAREN; }
","           { return COMMA; }

"//".*        { /* single-line comment: column already advanced */ }
[ \t\r]+      { /* whitespace: column already advanced above */ }
\n            { g_current_column = 1; }

.             { report_lexical_error(yytext); }

%%

static void report_lexical_error(const char *ch) {
    g_lexHadError = true;
    fprintf(stderr,
            "Lexical Error: Unexpected character '%s' at line %d, column %d\n",
            ch, g_token_line, g_token_column);
}
