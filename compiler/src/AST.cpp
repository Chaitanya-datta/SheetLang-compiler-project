#include "AST.h"

ASTNode* g_astRoot = nullptr;

static std::string binaryOpLabel(const std::string& op) {
    if (op == "+") return "Add";
    if (op == "-") return "Subtract";
    if (op == "*") return "Multiply";
    if (op == "/") return "Divide";
    if (op == "%") return "Modulo";
    return "BinaryOp(" + op + ")";
}

static std::string comparisonOpLabel(const std::string& op) {
    if (op == ">")  return "GreaterThan";
    if (op == "<")  return "LessThan";
    if (op == ">=") return "GreaterOrEqual";
    if (op == "<=") return "LessOrEqual";
    if (op == "==") return "Equal";
    if (op == "!=") return "NotEqual";
    return "Comparison(" + op + ")";
}

std::string BinaryExprNode::label() const { return binaryOpLabel(op); }
std::string ComparisonNode::label() const { return comparisonOpLabel(op); }

static void printChild(const ASTNode* node, std::ostream& os, const std::string& prefix, bool isLast) {
    os << prefix << (isLast ? "└── " : "├── ") << node->label() << "\n";
    auto kids = node->children();
    std::string childPrefix = prefix + (isLast ? "    " : "│   ");
    for (size_t i = 0; i < kids.size(); ++i) {
        printChild(kids[i], os, childPrefix, i + 1 == kids.size());
    }
}

void printAST(const ASTNode* root, std::ostream& os) {
    os << root->label() << "\n";
    auto kids = root->children();
    for (size_t i = 0; i < kids.size(); ++i) {
        printChild(kids[i], os, "", i + 1 == kids.size());
    }
}
