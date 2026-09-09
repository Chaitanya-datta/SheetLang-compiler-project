#pragma once
#include <string>
#include <vector>
#include <ostream>

enum class ASTNodeKind {
    Program, Assignment, Print, If, While, StatementList,
    Number, Identifier, Cell, StringLiteral,
    BinaryExpr, UnaryExpr, Comparison, FunctionCall,
    FunctionDecl, Return
};

// Ownership model: every node OWNS its children (raw pointers, deleted in
// destructor). Kept deliberately simple/manual rather than smart pointers
// because Bison's C-style semantic actions build the tree via `new` through
// a plain union, and unique_ptr doesn't fit cleanly in a %union.
struct ASTNode {
    ASTNodeKind kind;
    int line;
    ASTNode(ASTNodeKind k, int ln) : kind(k), line(ln) {}
    virtual ~ASTNode() = default;
    virtual std::string label() const = 0;
    virtual std::vector<ASTNode*> children() const { return {}; }
};

struct NumberNode : ASTNode {
    int value;
    NumberNode(int v, int ln) : ASTNode(ASTNodeKind::Number, ln), value(v) {}
    std::string label() const override { return std::to_string(value); }
};

struct IdentifierNode : ASTNode {
    std::string name;
    IdentifierNode(std::string n, int ln) : ASTNode(ASTNodeKind::Identifier, ln), name(std::move(n)) {}
    std::string label() const override { return name; }
};

struct CellNode : ASTNode {
    std::string name;
    CellNode(std::string n, int ln) : ASTNode(ASTNodeKind::Cell, ln), name(std::move(n)) {}
    std::string label() const override { return name; }
};

struct StringLiteralNode : ASTNode {
    std::string value;
    StringLiteralNode(std::string v, int ln) : ASTNode(ASTNodeKind::StringLiteral, ln), value(std::move(v)) {}
    std::string label() const override { return "\"" + value + "\""; }
};

struct BinaryExprNode : ASTNode {
    std::string op;
    ASTNode* left;
    ASTNode* right;
    BinaryExprNode(std::string o, ASTNode* l, ASTNode* r, int ln)
        : ASTNode(ASTNodeKind::BinaryExpr, ln), op(std::move(o)), left(l), right(r) {}
    ~BinaryExprNode() override { delete left; delete right; }
    std::string label() const override;
    std::vector<ASTNode*> children() const override { return {left, right}; }
};

struct UnaryExprNode : ASTNode {
    std::string op;
    ASTNode* operand;
    UnaryExprNode(std::string o, ASTNode* v, int ln)
        : ASTNode(ASTNodeKind::UnaryExpr, ln), op(std::move(o)), operand(v) {}
    ~UnaryExprNode() override { delete operand; }
    std::string label() const override { return "Negate"; }
    std::vector<ASTNode*> children() const override { return {operand}; }
};

struct ComparisonNode : ASTNode {
    std::string op;
    ASTNode* left;
    ASTNode* right;
    ComparisonNode(std::string o, ASTNode* l, ASTNode* r, int ln)
        : ASTNode(ASTNodeKind::Comparison, ln), op(std::move(o)), left(l), right(r) {}
    ~ComparisonNode() override { delete left; delete right; }
    std::string label() const override;
    std::vector<ASTNode*> children() const override { return {left, right}; }
};

struct FunctionCallNode : ASTNode {
    std::string name;
    std::vector<ASTNode*> args;
    FunctionCallNode(std::string n, std::vector<ASTNode*> a, int ln)
        : ASTNode(ASTNodeKind::FunctionCall, ln), name(std::move(n)), args(std::move(a)) {}
    ~FunctionCallNode() override { for (auto* a : args) delete a; }
    std::string label() const override { return "Call(" + name + ")"; }
    std::vector<ASTNode*> children() const override { return args; }
};

struct AssignmentNode : ASTNode {
    ASTNode* target; // IdentifierNode or CellNode
    ASTNode* expr;
    AssignmentNode(ASTNode* t, ASTNode* e, int ln)
        : ASTNode(ASTNodeKind::Assignment, ln), target(t), expr(e) {}
    ~AssignmentNode() override { delete target; delete expr; }
    std::string label() const override { return "Assignment"; }
    std::vector<ASTNode*> children() const override { return {target, expr}; }
};

struct PrintNode : ASTNode {
    ASTNode* expr;
    PrintNode(ASTNode* e, int ln) : ASTNode(ASTNodeKind::Print, ln), expr(e) {}
    ~PrintNode() override { delete expr; }
    std::string label() const override { return "Print"; }
    std::vector<ASTNode*> children() const override { return {expr}; }
};

struct StatementListNode : ASTNode {
    std::string label_;
    std::vector<ASTNode*> statements;
    StatementListNode(std::string lbl, std::vector<ASTNode*> stmts, int ln)
        : ASTNode(ASTNodeKind::StatementList, ln), label_(std::move(lbl)), statements(std::move(stmts)) {}
    ~StatementListNode() override { for (auto* s : statements) delete s; }
    std::string label() const override { return label_; }
    std::vector<ASTNode*> children() const override { return statements; }
};

struct IfNode : ASTNode {
    ASTNode* condition;
    StatementListNode* thenBlock;
    StatementListNode* elseBlock; // nullptr when no ELSE
    IfNode(ASTNode* cond, StatementListNode* thenB, StatementListNode* elseB, int ln)
        : ASTNode(ASTNodeKind::If, ln), condition(cond), thenBlock(thenB), elseBlock(elseB) {}
    ~IfNode() override { delete condition; delete thenBlock; delete elseBlock; }
    std::string label() const override { return "If"; }
    std::vector<ASTNode*> children() const override {
        std::vector<ASTNode*> out{condition, thenBlock};
        if (elseBlock) out.push_back(elseBlock);
        return out;
    }
};

// Phase 10 addition: a WHILE loop. Mirrors IfNode's shape exactly
// (condition + single StatementList body) -- WHILE introduces no new
// scope, so its body is analyzed/generated with the exact same
// visitStatementList/genStatementList machinery already used for IF's
// then/else blocks.
struct WhileNode : ASTNode {
    ASTNode* condition;
    StatementListNode* body;
    WhileNode(ASTNode* cond, StatementListNode* b, int ln)
        : ASTNode(ASTNodeKind::While, ln), condition(cond), body(b) {}
    ~WhileNode() override { delete condition; delete body; }
    std::string label() const override { return "While"; }
    std::vector<ASTNode*> children() const override { return {condition, body}; }
};

// Phase 8 addition: a user-defined FUNCTION declaration. Parameters are
// always NUMBER (no parameter type annotations in SheetLang) -- stored
// here as plain names; the semantic analyzer and code generator each
// bind them to a local slot (a SymbolTable entry / an LLVM alloca
// respectively) when analyzing/generating the function body.
struct FunctionDeclNode : ASTNode {
    std::string name;
    std::vector<std::string> params;
    StatementListNode* body;
    FunctionDeclNode(std::string n, std::vector<std::string> p, StatementListNode* b, int ln)
        : ASTNode(ASTNodeKind::FunctionDecl, ln), name(std::move(n)), params(std::move(p)), body(b) {}
    ~FunctionDeclNode() override { delete body; }
    std::string label() const override {
        std::string s = "Function " + name + "(";
        for (size_t i = 0; i < params.size(); ++i) {
            if (i) s += ", ";
            s += params[i];
        }
        s += ")";
        return s;
    }
    std::vector<ASTNode*> children() const override { return {body}; }
};

// Phase 8 addition: RETURN expr. Only valid inside a FunctionDeclNode's
// body -- enforced by SemanticAnalyzer (a RETURN elsewhere is a semantic
// error), not by the grammar, since RETURN needs to be syntactically
// legal anywhere a `stmt` can appear.
struct ReturnNode : ASTNode {
    ASTNode* expr;
    ReturnNode(ASTNode* e, int ln) : ASTNode(ASTNodeKind::Return, ln), expr(e) {}
    ~ReturnNode() override { delete expr; }
    std::string label() const override { return "Return"; }
    std::vector<ASTNode*> children() const override { return {expr}; }
};

struct ProgramNode : ASTNode {
    std::string name;
    std::vector<ASTNode*> statements;
    ProgramNode(std::string n, std::vector<ASTNode*> stmts, int ln)
        : ASTNode(ASTNodeKind::Program, ln), name(std::move(n)), statements(std::move(stmts)) {}
    ~ProgramNode() override { for (auto* s : statements) delete s; }
    std::string label() const override { return "SHEET " + name; }
    std::vector<ASTNode*> children() const override { return statements; }
};

// Set by the parser's `program` rule; owned by whoever reads it (main.cpp
// deletes it after printing).
extern ASTNode* g_astRoot;

void printAST(const ASTNode* root, std::ostream& os);
