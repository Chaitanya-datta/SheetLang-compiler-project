#pragma once
#include "AST.h"
#include "SymbolTable.h"
#include <vector>
#include <string>
#include <unordered_map>

// Walks the AST produced by the real Bison parser and checks it for
// semantic errors: duplicate declarations, undefined identifiers, type
// mismatches, and literal division-by-zero. Does NOT do code generation,
// optimization, or dependency-graph analysis -- those are later phases.
//
// Enforces strict declare-before-use: an identifier or cell must have
// been assigned by an earlier statement (textual order) before it can be
// referenced. This is the original Phase 4 rule, unchanged in Phase 5 --
// see README "Declare-before-use is preserved" for why Phase 5's
// dependency-graph cycle detection is instead tested at the graph level
// (--graph-test) rather than through source examples.
//
// Phase 8 addition: user-defined FUNCTION declarations, calls, and
// RETURN, using the same declare-before-use discipline as variables (see
// visitFunctionDecl for why this also makes recursion a semantic error
// rather than a special-cased check).
class SemanticAnalyzer {
public:
    // Runs semantic analysis on `root` (expected to be a ProgramNode).
    // Returns true if no semantic errors were found. All errors found
    // during the traversal are collected in errors() rather than stopping
    // at the first one, so a single run reports everything wrong with the
    // file -- closer to how a real compiler front-end behaves.
    bool analyze(const ASTNode* root);

    const std::vector<std::string>& errors() const { return errors_; }

private:
    SymbolTable symbols_;
    std::vector<std::string> errors_;

    // Phase 8: user-defined function signatures, keyed by name. Populated
    // as FUNCTION declarations are encountered in sequential (textual)
    // order -- see visitFunctionDecl.
    struct FunctionSignature {
        std::string name;
        size_t arity;
        int line;
    };
    std::unordered_map<std::string, FunctionSignature> functions_;

    // True while analyzing the body of a FUNCTION declaration; used to
    // reject RETURN outside a function.
    bool insideFunction_ = false;

    void visitProgram(const ProgramNode* node);
    void visitStatementList(const StatementListNode* node);
    void visitStatement(const ASTNode* node);
    void visitAssignment(const AssignmentNode* node);
    void visitPrint(const PrintNode* node);
    void visitIf(const IfNode* node);
    void visitFunctionDecl(const FunctionDeclNode* node);
    void visitReturn(const ReturnNode* node);

    // Returns the inferred type of an expression subtree. Returns
    // SemanticType::Unknown when an error was already reported for that
    // subtree, so callers can avoid reporting a second, derivative error
    // for the same root cause.
    SemanticType visitExpr(const ASTNode* node);
    SemanticType visitBinaryExpr(const BinaryExprNode* node);
    SemanticType visitUnaryExpr(const UnaryExprNode* node);
    SemanticType visitComparison(const ComparisonNode* node);
    SemanticType visitFunctionCall(const FunctionCallNode* node);

    void reportError(int line, const std::string& message);

    // Fixed-arity table for SheetLang's built-in functions (locked design
    // from earlier phases: SUM=3, AVG=3, MAX=2, MIN=2, ABS=1 args --
    // no variadic functions in v1). Returns false for any name that isn't
    // one of these five.
    static bool builtinArity(const std::string& name, size_t& arity);
};
