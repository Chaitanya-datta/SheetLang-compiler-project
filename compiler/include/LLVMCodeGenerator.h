#pragma once
#include "AST.h"
#include <llvm/IR/LLVMContext.h>
#include <llvm/IR/Module.h>
#include <llvm/IR/IRBuilder.h>
#include <memory>
#include <string>
#include <vector>
#include <unordered_map>

// Generates LLVM IR from the AST produced by the existing Bison parser.
// This is the ONLY consumer of llvm::* types in the project -- the AST,
// SemanticAnalyzer, and DependencyGraph/DependencyAnalyzer remain
// completely LLVM-agnostic, as they were in Phases 1-5.
//
// SCOPE (Phase 6, deliberately limited -- see README "Known limitations"
// for the full rationale on each cut):
// - SheetLang NUMBER is represented in LLVM as `double` throughout, never
//   `i32` -- even though NUMBER literals are parsed as C++ `int` at the
//   AST level (unchanged from earlier phases), they are promoted to
//   double at code-generation time.
// - Variables (LET and CELL) are `alloca double` slots in a symbol->
//   AllocaInst* map maintained ONLY inside this class -- this is
//   deliberately NOT the semantic SymbolTable (see README "Variable
//   storage" for why those two are kept separate).
// - STRING-valued variables (from `LET X = "literal"`) get NO alloca at
//   all; their literal text is remembered directly, since the only two
//   legal uses of a STRING value in the current language are being
//   assigned and being PRINTed -- there is no string arithmetic, so no
//   LLVM storage representation is needed for them.
// - Built-in function calls (SUM, AVG, MAX, MIN, ABS) remain OUT OF
//   SCOPE (not listed as required in any phase so far) and are reported
//   as a clean compiler error rather than silently skipped or
//   mis-generated.
//
// PHASE 8 ADDITIONS:
// - IF/ELSE and comparisons (>, <, >=, <=, ==, !=) now generate real
//   LLVM basic blocks / fcmp instructions -- these were part of the
//   grammar and AST since Phase 3, but never had codegen until now.
// - User-defined FUNCTION declarations, calls, and RETURN. Every
//   user function has LLVM signature `double(double, double, ...)`
//   (one double parameter per SheetLang parameter) -- see genFunctionDecl
//   for why functions with no explicit RETURN on some path implicitly
//   return 0.0 rather than requiring a separate void type.
class LLVMCodeGenerator {
public:
    // Generates a full LLVM module (with a single `define i32 @main()`,
    // plus one LLVM function per user-defined SheetLang FUNCTION)
    // from `root` (expected to be a ProgramNode that has ALREADY passed
    // semantic analysis -- this class does not re-check semantic rules).
    // Returns nullptr on failure; see errors() for details. The returned
    // Module is owned by the caller and must not outlive this
    // LLVMCodeGenerator's LLVMContext (see context()).
    std::unique_ptr<llvm::Module> generate(const ASTNode* root);

    const std::vector<std::string>& errors() const { return errors_; }

    // The LLVMContext that owns all types/constants used by the
    // generated module. Must stay alive as long as the Module is used.
    llvm::LLVMContext& context() { return context_; }

private:
    llvm::LLVMContext context_;
    std::unique_ptr<llvm::IRBuilder<>> builder_;
    llvm::Module* module_ = nullptr; // non-owning; owned by generate()'s caller
    std::vector<std::string> errors_;

    // LLVM-side storage, intentionally separate from SemanticAnalyzer's
    // SymbolTable (which tracks language-level types, not LLVM values).
    // These are function-local in effect: genFunctionDecl saves/clears/
    // restores both maps around generating a user function's body, so a
    // function's local variables (including its parameters) never leak
    // into the surrounding scope's maps, and vice versa.
    std::unordered_map<std::string, llvm::AllocaInst*> numericVars_;
    std::unordered_map<std::string, std::string> stringVars_; // name -> literal text
    std::unordered_map<std::string, llvm::Constant*> stringLiteralGlobals_; // text -> deduped global

    // Phase 8: user-defined SheetLang functions, keyed by name, mapped to
    // the llvm::Function generated for them. Populated as each
    // FunctionDeclNode is generated (in textual order, same as
    // SemanticAnalyzer's `functions_`).
    std::unordered_map<std::string, llvm::Function*> userFunctions_;

    // The LLVM function currently being generated into (initially
    // `main`; temporarily switched to a user function's own
    // llvm::Function while generating its body).
    llvm::Function* currentFunction_ = nullptr;

    llvm::Constant* fmtNumeric_ = nullptr; // cached "%f\n" global, for PRINT of numbers
    llvm::Constant* fmtString_ = nullptr;  // cached "%s\n" global, for PRINT of strings
    llvm::FunctionCallee printfFn_;

    void reportError(const std::string& msg);

    bool genProgram(const ProgramNode* node);
    bool genStatementList(const StatementListNode* node);
    bool genStatement(const ASTNode* node);
    bool genAssignment(const AssignmentNode* node);
    bool genPrint(const PrintNode* node);
    bool genIf(const IfNode* node);
    bool genFunctionDecl(const FunctionDeclNode* node);
    bool genReturn(const ReturnNode* node);

    // Returns nullptr on failure (an error is already recorded in
    // errors_ at that point).
    llvm::Value* genExpr(const ASTNode* expr);

    // Evaluates a ComparisonNode to an i1 (LLVM boolean), for use
    // directly as a branch condition. Only ever called from genIf (an
    // IF condition is always a ComparisonNode per the grammar) --
    // NOT from genExpr's general Comparison case, which remains an
    // error, since a comparison used as a general double-producing
    // value has no defined meaning in SheetLang (there is no boolean
    // value type).
    llvm::Value* genCondition(const ComparisonNode* node);

    llvm::Constant* getOrCreateStringGlobal(const std::string& text, const std::string& hint);
    llvm::AllocaInst* getOrCreateAlloca(const std::string& name);
    void declarePrintfAndFormats();
};
