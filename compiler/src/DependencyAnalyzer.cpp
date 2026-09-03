#include "DependencyAnalyzer.h"
#include <algorithm>
#include <sstream>

bool DependencyAnalyzer::analyze(const ASTNode* root) {
    errors_.clear();
    graph_ = DependencyGraph();

    if (root && root->kind == ASTNodeKind::Program) {
        visitProgram(static_cast<const ProgramNode*>(root));
    }

    std::vector<std::string> cyclePath;
    if (graph_.hasCycle(&cyclePath)) {
        // cyclePath looks like {"A", "B", "A"} for A -> B -> A. Report the
        // first node's declaration line, which is deterministic since the
        // DFS always starts from the alphabetically-sorted node list.
        std::string involved = cyclePath.empty() ? "?" : cyclePath.front();
        int line = graph_.lineOf(involved);

        std::ostringstream chain;
        for (size_t i = 0; i < cyclePath.size(); ++i) {
            if (i > 0) chain << " -> ";
            chain << cyclePath[i];
        }

        std::ostringstream msg;
        msg << "Dependency Error: Circular dependency detected involving '"
            << involved << "' (cycle: " << chain.str() << ")";
        if (line >= 0) {
            msg << " at line " << line;
        }
        errors_.push_back(msg.str());
        return false;
    }

    return true;
}

void DependencyAnalyzer::visitProgram(const ProgramNode* node) {
    for (auto* stmt : node->statements) visitStatement(stmt);
}

void DependencyAnalyzer::visitStatementList(const StatementListNode* node) {
    for (auto* stmt : node->statements) visitStatement(stmt);
}

void DependencyAnalyzer::visitStatement(const ASTNode* node) {
    switch (node->kind) {
        case ASTNodeKind::Assignment:
            visitAssignment(static_cast<const AssignmentNode*>(node));
            break;
        case ASTNodeKind::Print:
            // PRINT never owns a symbol, so it doesn't add graph edges --
            // but it may reference names, which are already validated by
            // semantic analysis (which runs before this). Nothing to do.
            break;
        case ASTNodeKind::If:
            visitIf(static_cast<const IfNode*>(node));
            break;
        default:
            break;
    }
}

void DependencyAnalyzer::visitAssignment(const AssignmentNode* node) {
    std::string targetName;
    if (node->target->kind == ASTNodeKind::Identifier) {
        targetName = static_cast<const IdentifierNode*>(node->target)->name;
    } else if (node->target->kind == ASTNodeKind::Cell) {
        targetName = static_cast<const CellNode*>(node->target)->name;
    } else {
        return; // shouldn't happen given the grammar
    }

    graph_.addNode(targetName, node->line);

    std::set<std::string> refs;
    collectReferences(node->expr, refs);
    for (const auto& ref : refs) {
        // Deliberately NOT special-cased when ref == targetName: a
        // genuine self-reference (LET A = A + 1) becomes a real self-loop
        // edge here, which hasCycle() then reports as a circular
        // dependency -- exactly like any other cycle, no separate
        // "self-dependency" code path needed.
        graph_.addDependency(targetName, ref);
    }
}

void DependencyAnalyzer::visitIf(const IfNode* node) {
    // Phase 5 does not model condition references as graph edges (no
    // symbol owns an IF condition) -- but still descend into both blocks
    // so assignments nested inside IF/ELSE are discovered.
    visitStatementList(node->thenBlock);
    if (node->elseBlock) {
        visitStatementList(node->elseBlock);
    }
}

void DependencyAnalyzer::collectReferences(const ASTNode* expr, std::set<std::string>& outRefs) {
    switch (expr->kind) {
        case ASTNodeKind::Identifier:
            outRefs.insert(static_cast<const IdentifierNode*>(expr)->name);
            break;
        case ASTNodeKind::Cell:
            outRefs.insert(static_cast<const CellNode*>(expr)->name);
            break;
        case ASTNodeKind::BinaryExpr: {
            auto* b = static_cast<const BinaryExprNode*>(expr);
            collectReferences(b->left, outRefs);
            collectReferences(b->right, outRefs);
            break;
        }
        case ASTNodeKind::UnaryExpr:
            collectReferences(static_cast<const UnaryExprNode*>(expr)->operand, outRefs);
            break;
        case ASTNodeKind::Comparison: {
            auto* c = static_cast<const ComparisonNode*>(expr);
            collectReferences(c->left, outRefs);
            collectReferences(c->right, outRefs);
            break;
        }
        case ASTNodeKind::FunctionCall: {
            auto* f = static_cast<const FunctionCallNode*>(expr);
            for (auto* arg : f->args) collectReferences(arg, outRefs);
            break;
        }
        case ASTNodeKind::Number:
        case ASTNodeKind::StringLiteral:
        default:
            break; // no references
    }
}
