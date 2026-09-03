#pragma once
#include "AST.h"
#include "DependencyGraph.h"
#include <vector>
#include <string>
#include <set>

// Walks the AST (after it has already passed semantic analysis -- see
// main.cpp's run_deps()) and builds a DependencyGraph from it, then
// checks that graph for cycles.
//
// SCOPE (Phase 5, deliberately limited -- see README):
// - Only Assignment statements (LET and CELL targets) create graph edges;
//   an assignment's target depends on every Identifier/Cell referenced in
//   its right-hand-side expression, including inside nested function
//   calls.
// - PRINT and IF-conditions are walked (so nested assignments inside IF
//   blocks are still discovered), but a bare reference inside a PRINT or
//   an IF condition does not itself create a graph edge, since neither
//   PRINT nor a condition "owns" a symbol to attach dependencies to.
//   Phase 5 intentionally does not model control-flow-based dependencies.
class DependencyAnalyzer {
public:
    // Builds the graph and checks it for cycles. Returns true if the
    // graph is cycle-free.
    bool analyze(const ASTNode* root);

    const DependencyGraph& graph() const { return graph_; }
    const std::vector<std::string>& errors() const { return errors_; }

private:
    DependencyGraph graph_;
    std::vector<std::string> errors_;

    void visitProgram(const ProgramNode* node);
    void visitStatementList(const StatementListNode* node);
    void visitStatement(const ASTNode* node);
    void visitAssignment(const AssignmentNode* node);
    void visitIf(const IfNode* node);

    // Recursively collects every Identifier/Cell name referenced anywhere
    // in `expr` into `outRefs` (BinaryExpr, UnaryExpr, Comparison, and
    // FunctionCall arguments are all descended into).
    void collectReferences(const ASTNode* expr, std::set<std::string>& outRefs);
};
