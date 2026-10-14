#include "SemanticAnalyzer.h"

void SemanticAnalyzer::reportError(int line, const std::string& message) {
    errors_.push_back("Semantic Error: " + message + " at line " + std::to_string(line));
}

bool SemanticAnalyzer::builtinArity(const std::string& name, size_t& arity) {
    if (name == "SUM") { arity = 3; return true; }
    if (name == "AVG") { arity = 3; return true; }
    if (name == "MAX") { arity = 2; return true; }
    if (name == "MIN") { arity = 2; return true; }
    if (name == "ABS") { arity = 1; return true; }
    if (name == "CONCAT") { arity = 2; return true; }
    if (name == "UPPER") { arity = 1; return true; }
    if (name == "LOWER") { arity = 1; return true; }
    if (name == "TRIM") { arity = 1; return true; }
    return false;
}

bool SemanticAnalyzer::analyze(const ASTNode* root) {
    symbols_.clear();
    errors_.clear();
    functions_.clear();
    insideFunction_ = false;
    if (root && root->kind == ASTNodeKind::Program) {
        visitProgram(static_cast<const ProgramNode*>(root));
    }
    return errors_.empty();
}

void SemanticAnalyzer::visitProgram(const ProgramNode* node) {
    for (auto* stmt : node->statements) visitStatement(stmt);
}

void SemanticAnalyzer::visitStatementList(const StatementListNode* node) {
    for (auto* stmt : node->statements) visitStatement(stmt);
}

void SemanticAnalyzer::visitStatement(const ASTNode* node) {
    switch (node->kind) {
        case ASTNodeKind::Assignment:
            visitAssignment(static_cast<const AssignmentNode*>(node));
            break;
        case ASTNodeKind::Print:
            visitPrint(static_cast<const PrintNode*>(node));
            break;
        case ASTNodeKind::If:
            visitIf(static_cast<const IfNode*>(node));
            break;
        case ASTNodeKind::While:
            visitWhile(static_cast<const WhileNode*>(node));
            break;
        case ASTNodeKind::FunctionDecl:
            visitFunctionDecl(static_cast<const FunctionDeclNode*>(node));
            break;
        case ASTNodeKind::Return:
            visitReturn(static_cast<const ReturnNode*>(node));
            break;
        case ASTNodeKind::FunctionCall:
            // A bare function call used as a statement (e.g. `hello()`);
            // its return value, if any, is discarded. visitExpr already
            // does everything a call needs checked (exists, correct
            // arity, argument types).
            visitExpr(node);
            break;
        default:
            // The grammar only ever produces the kinds above as
            // top-level statements; anything else would be a parser bug,
            // not a semantic one, so there is nothing to check here.
            break;
    }
}

void SemanticAnalyzer::visitAssignment(const AssignmentNode* node) {
    SemanticType exprType = visitExpr(node->expr);
    // If the RHS already produced an error (e.g. an undefined identifier),
    // still declare the symbol -- defaulting to NUMBER, the common case --
    // so that later legitimate uses of this name don't ALSO get flagged
    // as "undefined identifier" on top of the real, original error.
    SemanticType declType = (exprType == SemanticType::Unknown) ? SemanticType::Number : exprType;

    if (node->target->kind == ASTNodeKind::Identifier) {
        auto* id = static_cast<const IdentifierNode*>(node->target);
        if (!symbols_.declare(id->name, declType, node->line)) {
            reportError(node->line, "Duplicate declaration of '" + id->name + "'");
        }
    } else if (node->target->kind == ASTNodeKind::Cell) {
        auto* cell = static_cast<const CellNode*>(node->target);
        // Cells behave like spreadsheet cells, not LET variables:
        // reassignment (A1 = ...; later A1 = ...) is normal and expected,
        // so there is no duplicate-declaration check for CELL targets.
        symbols_.declareOrUpdate(cell->name, declType, node->line);
    }
}

void SemanticAnalyzer::visitPrint(const PrintNode* node) {
    // PRINT accepts any well-typed expression or string literal; the only
    // thing that can go wrong here is inside the expression itself
    // (undefined identifier, bad function call, etc.), which visitExpr
    // already reports.
    visitExpr(node->expr);
}

void SemanticAnalyzer::visitIf(const IfNode* node) {
    visitExpr(node->condition);
    visitStatementList(node->thenBlock);
    if (node->elseBlock) {
        visitStatementList(node->elseBlock);
    }
}

void SemanticAnalyzer::visitWhile(const WhileNode* node) {
    // Mirrors visitIf exactly: the condition is checked (undefined
    // identifiers / type errors inside it are reported the same way as
    // an IF condition), then the body is walked with the same
    // visitStatementList used everywhere else -- WHILE introduces no new
    // scope, so a variable assigned inside the loop body is an ordinary
    // global assignment, subject to the same declare-before-use and
    // duplicate-declaration rules as any other statement.
    visitExpr(node->condition);
    visitStatementList(node->body);
}

void SemanticAnalyzer::visitFunctionDecl(const FunctionDeclNode* node) {
    bool isDuplicate = functions_.count(node->name) > 0;
    if (isDuplicate) {
        reportError(node->line, "Duplicate declaration of function '" + node->name + "'");
    }

    // Function-local scope: analyze the body against a SAVED COPY of the
    // current global symbol table (so it can see every global declared
    // before this function -- consistent with declare-before-use) with
    // this function's own parameters added on top (always NUMBER; a
    // parameter shadows a same-named global for the duration of the
    // body, using declareOrUpdate rather than declare so shadowing never
    // triggers a spurious "duplicate declaration" error). SymbolTable is
    // a simple value type (just wraps an unordered_map<string, Symbol>),
    // so a plain copy is a real, independent snapshot -- restoring
    // symbols_ afterward discards everything the body declared,
    // including the parameters themselves, so none of it leaks into the
    // global scope.
    //
    // IMPORTANT: this function's OWN name is only added to `functions_`
    // AFTER its body has been fully analyzed (see bottom of this
    // function) -- while the body is being checked, a call to this same
    // function's name is therefore indistinguishable from a call to a
    // function that was never declared, and is correctly rejected as
    // "Unknown function". This is what makes recursion a semantic error
    // here without any separate, special-cased recursion check.
    SymbolTable savedGlobal = symbols_;
    for (const auto& param : node->params) {
        symbols_.declareOrUpdate(param, SemanticType::Number, node->line);
    }

    bool savedInsideFunction = insideFunction_;
    insideFunction_ = true;

    visitStatementList(node->body);

    insideFunction_ = savedInsideFunction;
    symbols_ = savedGlobal;

    if (!isDuplicate) {
        functions_[node->name] = FunctionSignature{node->name, node->params.size(), node->line};
    }
}

void SemanticAnalyzer::visitReturn(const ReturnNode* node) {
    if (!insideFunction_) {
        reportError(node->line, "RETURN used outside a function");
        // Still type-check the expression so any additional real error
        // inside it (e.g. an undefined identifier) is also reported,
        // rather than swallowed by the RETURN-placement error alone.
    }
    visitExpr(node->expr);
}

SemanticType SemanticAnalyzer::visitExpr(const ASTNode* node) {
    switch (node->kind) {
        case ASTNodeKind::Number:
            return SemanticType::Number;

        case ASTNodeKind::StringLiteral:
            return SemanticType::String;

        case ASTNodeKind::Identifier: {
            auto* id = static_cast<const IdentifierNode*>(node);
            const Symbol* sym = symbols_.lookup(id->name);
            if (!sym) {
                reportError(node->line, "Undefined identifier '" + id->name + "'");
                return SemanticType::Unknown;
            }
            return sym->type;
        }

        case ASTNodeKind::Cell: {
            auto* cell = static_cast<const CellNode*>(node);
            const Symbol* sym = symbols_.lookup(cell->name);
            if (!sym) {
                reportError(node->line, "Undefined cell '" + cell->name + "'");
                return SemanticType::Unknown;
            }
            return sym->type;
        }

        case ASTNodeKind::BinaryExpr:
            return visitBinaryExpr(static_cast<const BinaryExprNode*>(node));

        case ASTNodeKind::UnaryExpr:
            return visitUnaryExpr(static_cast<const UnaryExprNode*>(node));

        case ASTNodeKind::Comparison:
            return visitComparison(static_cast<const ComparisonNode*>(node));

        case ASTNodeKind::FunctionCall:
            return visitFunctionCall(static_cast<const FunctionCallNode*>(node));

        default:
            return SemanticType::Unknown;
    }
}

SemanticType SemanticAnalyzer::visitBinaryExpr(const BinaryExprNode* node) {
    SemanticType lt = visitExpr(node->left);
    SemanticType rt = visitExpr(node->right);

    // Literal division/modulo by zero is detectable at compile time
    // regardless of operand types, and is checked independently of the
    // type-compatibility check below. Only a literal `0` on the RHS is
    // caught here (per Phase 4 scope) -- `LET B = 0; LET C = A / B` would
    // need constant propagation, which is out of scope for Phase 4.
    if (node->op == "/" || node->op == "%") {
        if (node->right->kind == ASTNodeKind::Number) {
            auto* num = static_cast<const NumberNode*>(node->right);
            if (num->value == 0) {
                reportError(node->line, "Division by zero");
            }
        }
    }

    if (lt == SemanticType::Unknown || rt == SemanticType::Unknown) {
        // Root cause already reported further down; don't cascade.
        return SemanticType::Unknown;
    }

    if (lt == SemanticType::Number && rt == SemanticType::Number) {
        return SemanticType::Number;
    }

    // SheetLang v1 deliberately does not support string concatenation or
    // any other mixed-type arithmetic (locked design: everything at
    // runtime is i32). STRING + STRING is therefore also rejected here,
    // not just NUMBER + STRING.
    reportError(node->line, "Type mismatch for operator '" + node->op + "'");
    return SemanticType::Unknown;
}

SemanticType SemanticAnalyzer::visitUnaryExpr(const UnaryExprNode* node) {
    SemanticType t = visitExpr(node->operand);
    if (t == SemanticType::Unknown) return SemanticType::Unknown;
    if (t != SemanticType::Number) {
        reportError(node->line, "Unary '-' requires a NUMBER operand");
        return SemanticType::Unknown;
    }
    return SemanticType::Number;
}

SemanticType SemanticAnalyzer::visitComparison(const ComparisonNode* node) {
    SemanticType lt = visitExpr(node->left);
    SemanticType rt = visitExpr(node->right);
    if (lt == SemanticType::Unknown || rt == SemanticType::Unknown) {
        return SemanticType::Unknown;
    }

    bool ordering = (node->op == ">" || node->op == "<" ||
                      node->op == ">=" || node->op == "<=");
    if (ordering) {
        // Ordering only makes sense for NUMBER (SheetLang has no defined
        // lexicographic ordering for STRING).
        if (lt != SemanticType::Number || rt != SemanticType::Number) {
            reportError(node->line,
                "Type mismatch for operator '" + node->op +
                "' (ordering comparisons require NUMBER operands)");
            return SemanticType::Unknown;
        }
    } else {
        // == and != accept same-type operands of either type.
        if (lt != rt) {
            reportError(node->line,
                "Type mismatch for operator '" + node->op +
                "' (operands must be the same type)");
            return SemanticType::Unknown;
        }
    }

    // A condition's own "value" is never used as an expression elsewhere
    // in SheetLang v1 (it can only follow IF directly), so Number here is
    // just the internal not-Unknown marker, not a meaningful return type.
    return SemanticType::Number;
}

SemanticType SemanticAnalyzer::visitFunctionCall(const FunctionCallNode* node) {
    size_t expectedArity;
    if (builtinArity(node->name, expectedArity)) {
        if (node->args.size() != expectedArity) {
            reportError(node->line,
                "Function '" + node->name + "' expects " +
                std::to_string(expectedArity) + " argument(s), got " +
                std::to_string(node->args.size()));
        }

        bool isStringFunc = (node->name == "CONCAT" || node->name == "UPPER" || node->name == "LOWER" || node->name == "TRIM");
        bool hasWrongArg = false;
        
        for (auto* arg : node->args) {
            SemanticType t = visitExpr(arg);
            if (isStringFunc && t == SemanticType::Number) hasWrongArg = true;
            if (!isStringFunc && t == SemanticType::String) hasWrongArg = true;
        }
        
        if (hasWrongArg) {
            reportError(node->line, "Function '" + node->name + "' requires " + 
                std::string(isStringFunc ? "STRING" : "NUMBER") + " arguments");
        }

        return isStringFunc ? SemanticType::String : SemanticType::Number;
    }

    // Phase 8: user-defined function. Checked the same way as a builtin
    // -- arity, NUMBER-only arguments -- but looked up in `functions_`
    // instead of the fixed builtin table.
    auto userIt = functions_.find(node->name);
    if (userIt != functions_.end()) {
        if (node->args.size() != userIt->second.arity) {
            reportError(node->line,
                "Function '" + node->name + "' expects " +
                std::to_string(userIt->second.arity) + " argument(s), got " +
                std::to_string(node->args.size()));
        }

        bool hasStringArg = false;
        for (auto* arg : node->args) {
            SemanticType t = visitExpr(arg);
            if (t == SemanticType::String) hasStringArg = true;
        }
        if (hasStringArg) {
            reportError(node->line, "Function '" + node->name + "' requires NUMBER arguments");
        }

        return SemanticType::Number;
    }

    reportError(node->line, "Unknown function '" + node->name + "'");
    // Still walk the arguments so unrelated errors inside them (e.g.
    // an undefined identifier) are reported too, rather than swallowed.
    for (auto* arg : node->args) visitExpr(arg);
    return SemanticType::Unknown;
}
