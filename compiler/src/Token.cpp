#include "Token.h"
#include "AST.h"   // parser.tab.h's %union references ASTNode*, so this
                   // must be included first
#include "parser.tab.h"

std::string tokenName(int tokenCode) {
    switch (tokenCode) {
        case SHEET:      return "SHEET";
        case END:        return "END";
        case LET:        return "LET";
        case PRINT:      return "PRINT";
        case IF:         return "IF";
        case ELSE:       return "ELSE";
        case ENDIF:      return "ENDIF";
        case FUNCTION:   return "FUNCTION";
        case RETURN:     return "RETURN";
        case ENDFUNCTION: return "ENDFUNCTION";
        case IDENTIFIER: return "IDENTIFIER";
        case CELL:       return "CELL";
        case NUMBER:     return "NUMBER";
        case STRING:     return "STRING";
        case PLUS:       return "PLUS";
        case MINUS:      return "MINUS";
        case MULTIPLY:   return "MULTIPLY";
        case DIVIDE:      return "DIVIDE";
        case MOD:         return "MOD";
        case ASSIGN:      return "ASSIGN";
        case LPAREN:      return "LPAREN";
        case RPAREN:      return "RPAREN";
        case COMMA:       return "COMMA";
        case GT:          return "GT";
        case LT:          return "LT";
        case GTE:         return "GTE";
        case LTE:         return "LTE";
        case EQ:          return "EQ";
        case NEQ:         return "NEQ";
        default:          return "UNKNOWN";
    }
}
