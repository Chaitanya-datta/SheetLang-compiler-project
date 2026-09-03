#pragma once
#include <cstdio>
#include <string>

extern int g_token_line;
extern int g_token_column;
extern std::string g_token_lexeme;
extern bool g_lexHadError;
extern FILE* yyin;

int yylex();
