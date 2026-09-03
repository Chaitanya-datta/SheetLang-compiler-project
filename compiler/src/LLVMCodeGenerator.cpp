#include "LLVMCodeGenerator.h"
#include <llvm/IR/Verifier.h>
#include <llvm/IR/Constants.h>
#include <llvm/IR/Function.h>
#include <llvm/IR/BasicBlock.h>
#include <llvm/Support/raw_ostream.h>

void LLVMCodeGenerator::reportError(const std::string& msg) {
    errors_.push_back("Code Generation Error: " + msg);
}

std::unique_ptr<llvm::Module> LLVMCodeGenerator::generate(const ASTNode* root) {
    errors_.clear();
    numericVars_.clear();
    stringVars_.clear();
    stringLiteralGlobals_.clear();
    fmtNumeric_ = nullptr;
    fmtString_ = nullptr;

    if (!root || root->kind != ASTNodeKind::Program) {
        reportError("internal error: code generation given a non-Program AST root");
        return nullptr;
    }

    auto module = std::make_unique<llvm::Module>("SheetLangModule", context_);
    module_ = module.get();
    builder_ = std::make_unique<llvm::IRBuilder<>>(context_);

    llvm::FunctionType* mainTy = llvm::FunctionType::get(llvm::Type::getInt32Ty(context_), false);
    llvm::Function* mainFn = llvm::Function::Create(
        mainTy, llvm::Function::ExternalLinkage, "main", module_);
    llvm::BasicBlock* entry = llvm::BasicBlock::Create(context_, "entry", mainFn);
    builder_->SetInsertPoint(entry);
    // Phase 8: genIf/genFunctionDecl attach new basic blocks to
    // `currentFunction_`, so it must point at whichever LLVM function is
    // currently being generated into. Top-level statements (including
    // any top-level IF) are generated into `main`, so this must be set
    // here -- omitting it (an actual bug hit during Phase 8 testing,
    // confirmed via a real crash/verifier failure, see README "Bugs
    // found and fixed") left it null for any IF at the top level,
    // producing basic blocks with no parent function.
    currentFunction_ = mainFn;

    // Called AFTER SetInsertPoint: CreateGlobalString (used here) can
    // infer its target module from the builder's current insertion
    // point if not given one explicitly, and derefs a null block pointer
    // if called before any insertion point exists -- this crashed with a
    // real SEGV during testing when these were in the opposite order (see
    // README "Bugs found and fixed"). Explicit `module_` is now also
    // passed to every CreateGlobalString call as defense in depth.
    declarePrintfAndFormats();

    if (!genProgram(static_cast<const ProgramNode*>(root))) {
        return nullptr; // errors_ already populated
    }

    builder_->CreateRet(llvm::ConstantInt::get(llvm::Type::getInt32Ty(context_), 0));

    std::string verifyMessages;
    llvm::raw_string_ostream os(verifyMessages);
    bool broken = llvm::verifyModule(*module_, &os);
    os.flush();
    if (broken) {
        reportError("generated LLVM module failed verification:\n" + verifyMessages);
        return nullptr;
    }

    return module;
}

void LLVMCodeGenerator::declarePrintfAndFormats() {
    // printf(ptr, ...) -> i32, using an opaque pointer for the format
    // string argument (LLVM 22 default; also valid on the LLVM 18 used
    // to test this build -- see README "LLVM API notes").
    llvm::PointerType* ptrTy = llvm::PointerType::get(context_, 0);
    llvm::FunctionType* printfTy = llvm::FunctionType::get(
        llvm::Type::getInt32Ty(context_), {ptrTy}, /*isVarArg=*/true);
    printfFn_ = module_->getOrInsertFunction("printf", printfTy);

    fmtNumeric_ = builder_->CreateGlobalString("%f\n", "fmt.numeric", 0, module_);
    fmtString_ = builder_->CreateGlobalString("%s\n", "fmt.string", 0, module_);
}

llvm::Constant* LLVMCodeGenerator::getOrCreateStringGlobal(const std::string& text, const std::string& hint) {
    auto it = stringLiteralGlobals_.find(text);
    if (it != stringLiteralGlobals_.end()) return it->second;
    llvm::Constant* g = builder_->CreateGlobalString(text, hint, 0, module_);
    stringLiteralGlobals_[text] = g;
    return g;
}

llvm::AllocaInst* LLVMCodeGenerator::getOrCreateAlloca(const std::string& name) {
    auto it = numericVars_.find(name);
    if (it != numericVars_.end()) return it->second;
    llvm::AllocaInst* a = builder_->CreateAlloca(llvm::Type::getDoubleTy(context_), nullptr, name);
    numericVars_[name] = a;
    return a;
}

bool LLVMCodeGenerator::genProgram(const ProgramNode* node) {
    for (auto* stmt : node->statements) {
        if (!genStatement(stmt)) return false;
    }
    return true;
}

bool LLVMCodeGenerator::genStatementList(const StatementListNode* node) {
    for (auto* stmt : node->statements) {
        if (!genStatement(stmt)) return false;
    }
    return true;
}

bool LLVMCodeGenerator::genStatement(const ASTNode* node) {
    switch (node->kind) {
        case ASTNodeKind::Assignment:
            return genAssignment(static_cast<const AssignmentNode*>(node));
        case ASTNodeKind::Print:
            return genPrint(static_cast<const PrintNode*>(node));
        case ASTNodeKind::If:
            return genIf(static_cast<const IfNode*>(node));
        case ASTNodeKind::FunctionDecl:
            return genFunctionDecl(static_cast<const FunctionDeclNode*>(node));
        case ASTNodeKind::Return:
            return genReturn(static_cast<const ReturnNode*>(node));
        case ASTNodeKind::FunctionCall:
            // A bare function call used as a statement (e.g. `hello()`):
            // generate the call for its side effects and discard the
            // returned double.
            return genExpr(node) != nullptr;
        default:
            reportError("internal error: unsupported statement kind during code generation");
            return false;
    }
}

bool LLVMCodeGenerator::genAssignment(const AssignmentNode* node) {
    std::string name;
    if (node->target->kind == ASTNodeKind::Identifier) {
        name = static_cast<const IdentifierNode*>(node->target)->name;
    } else if (node->target->kind == ASTNodeKind::Cell) {
        name = static_cast<const CellNode*>(node->target)->name;
    } else {
        reportError("internal error: assignment target is neither Identifier nor Cell");
        return false;
    }

    if (node->expr->kind == ASTNodeKind::StringLiteral) {
        // STRING-valued assignment: no alloca is created for this name --
        // see header comment for why. If this name previously held a
        // NUMBER value (legal for a reassigned CELL under current
        // semantic rules), drop the stale numeric mapping so a later
        // PRINT uses the new string value, not the old numeric slot.
        stringVars_[name] = static_cast<const StringLiteralNode*>(node->expr)->value;
        numericVars_.erase(name);
        return true;
    }

    llvm::Value* val = genExpr(node->expr);
    if (!val) return false;

    // Symmetric to the case above: if this name previously held a STRING
    // value, drop it now that it holds a NUMBER.
    stringVars_.erase(name);
    llvm::AllocaInst* slot = getOrCreateAlloca(name);
    builder_->CreateStore(val, slot);
    return true;
}

bool LLVMCodeGenerator::genPrint(const PrintNode* node) {
    const ASTNode* expr = node->expr;

    if (expr->kind == ASTNodeKind::StringLiteral) {
        const auto& text = static_cast<const StringLiteralNode*>(expr)->value;
        llvm::Constant* strPtr = getOrCreateStringGlobal(text, "str");
        builder_->CreateCall(printfFn_, {fmtString_, strPtr});
        return true;
    }

    if (expr->kind == ASTNodeKind::Identifier || expr->kind == ASTNodeKind::Cell) {
        std::string name = (expr->kind == ASTNodeKind::Identifier)
            ? static_cast<const IdentifierNode*>(expr)->name
            : static_cast<const CellNode*>(expr)->name;

        auto sIt = stringVars_.find(name);
        if (sIt != stringVars_.end()) {
            llvm::Constant* strPtr = getOrCreateStringGlobal(sIt->second, "str");
            builder_->CreateCall(printfFn_, {fmtString_, strPtr});
            return true;
        }
        // Not a string variable -- fall through to the general numeric
        // path below via genExpr (handles the "undeclared" case too).
    }

    llvm::Value* val = genExpr(expr);
    if (!val) return false;
    builder_->CreateCall(printfFn_, {fmtNumeric_, val});
    return true;
}

llvm::Value* LLVMCodeGenerator::genCondition(const ComparisonNode* node) {
    llvm::Value* lhs = genExpr(node->left);
    llvm::Value* rhs = genExpr(node->right);
    if (!lhs || !rhs) return nullptr;

    // Ordered floating-point comparisons (the "O" in FCmpO*): SheetLang
    // NUMBERs are never NaN (they only ever come from integer literals
    // or arithmetic on them), so ordered vs. unordered comparison
    // semantics don't matter for any valid SheetLang program -- ordered
    // is used because it matches normal mathematical comparison
    // intuition (an unordered compare would treat a NaN operand as
    // making `!=` true and every other comparison false, which isn't a
    // case SheetLang can actually produce).
    if (node->op == ">")  return builder_->CreateFCmpOGT(lhs, rhs, "cmptmp");
    if (node->op == "<")  return builder_->CreateFCmpOLT(lhs, rhs, "cmptmp");
    if (node->op == ">=") return builder_->CreateFCmpOGE(lhs, rhs, "cmptmp");
    if (node->op == "<=") return builder_->CreateFCmpOLE(lhs, rhs, "cmptmp");
    if (node->op == "==") return builder_->CreateFCmpOEQ(lhs, rhs, "cmptmp");
    if (node->op == "!=") return builder_->CreateFCmpONE(lhs, rhs, "cmptmp");

    reportError("internal error: unsupported comparison operator '" + node->op + "' during code generation");
    return nullptr;
}

bool LLVMCodeGenerator::genIf(const IfNode* node) {
    // The grammar guarantees an IF condition is always a ComparisonNode
    // (see parser.y's `condition` production) -- this cast is therefore
    // safe, not a defensive assumption.
    llvm::Value* condVal = genCondition(static_cast<const ComparisonNode*>(node->condition));
    if (!condVal) return false;

    llvm::Function* fn = currentFunction_;
    llvm::BasicBlock* thenBB = llvm::BasicBlock::Create(context_, "then", fn);
    llvm::BasicBlock* elseBB = node->elseBlock ? llvm::BasicBlock::Create(context_, "else", fn) : nullptr;
    llvm::BasicBlock* mergeBB = llvm::BasicBlock::Create(context_, "ifcont", fn);

    builder_->CreateCondBr(condVal, thenBB, elseBB ? elseBB : mergeBB);

    builder_->SetInsertPoint(thenBB);
    if (!genStatementList(node->thenBlock)) return false;
    // A RETURN inside the then-block already terminates thenBB with a
    // `ret`; only add the fallthrough branch to mergeBB if the block
    // doesn't already have a terminator (a basic block can have exactly
    // one).
    if (!builder_->GetInsertBlock()->getTerminator()) {
        builder_->CreateBr(mergeBB);
    }

    if (elseBB) {
        builder_->SetInsertPoint(elseBB);
        if (!genStatementList(node->elseBlock)) return false;
        if (!builder_->GetInsertBlock()->getTerminator()) {
            builder_->CreateBr(mergeBB);
        }
    }

    builder_->SetInsertPoint(mergeBB);
    return true;
}

bool LLVMCodeGenerator::genFunctionDecl(const FunctionDeclNode* node) {
    // Every user function has LLVM signature double(double, ...) -- one
    // double parameter per SheetLang parameter, returning double. There
    // is no SheetLang void type, so a function that falls off the end of
    // its body without an explicit RETURN on that path implicitly
    // returns 0.0 (added below) rather than requiring a second,
    // void-returning function shape; calling such a function as a bare
    // statement (`hello()`) simply discards the returned value, exactly
    // like any other discarded expression result.
    std::vector<llvm::Type*> paramTypes(node->params.size(), llvm::Type::getDoubleTy(context_));
    llvm::FunctionType* fnType = llvm::FunctionType::get(
        llvm::Type::getDoubleTy(context_), paramTypes, /*isVarArg=*/false);

    // Internal linkage: user-defined SheetLang functions are only ever
    // called from within this same generated module (from `main` or from
    // other SheetLang functions), never from outside it -- unlike `main`
    // itself and the external `printf`, which must stay externally
    // visible for the linker.
    llvm::Function* fn = llvm::Function::Create(
        fnType, llvm::Function::InternalLinkage, node->name, module_);

    size_t idx = 0;
    for (auto& arg : fn->args()) {
        arg.setName(node->params[idx++]);
    }

    userFunctions_[node->name] = fn;

    // Save the surrounding generation context (whichever function/block
    // we were generating into before this declaration, plus its
    // variable maps) so it can be restored once this function's body is
    // fully generated -- a SheetLang function's local variables
    // (including its parameters) must not leak into the caller's scope,
    // and generation must resume exactly where it left off afterward.
    llvm::Function* savedFunction = currentFunction_;
    llvm::BasicBlock* savedInsertBlock = builder_->GetInsertBlock();
    auto savedNumericVars = numericVars_;
    auto savedStringVars = stringVars_;

    currentFunction_ = fn;
    numericVars_.clear();
    stringVars_.clear();

    llvm::BasicBlock* entryBB = llvm::BasicBlock::Create(context_, "entry", fn);
    builder_->SetInsertPoint(entryBB);

    // Store each incoming SSA parameter value into its own alloca
    // immediately -- this keeps genExpr's Identifier-lookup logic
    // completely uniform between global variables and function
    // parameters/locals, since both are backed by AllocaInst* in the
    // same numericVars_ map, just populated differently up front.
    idx = 0;
    for (auto& arg : fn->args()) {
        const std::string& paramName = node->params[idx++];
        llvm::AllocaInst* slot = builder_->CreateAlloca(llvm::Type::getDoubleTy(context_), nullptr, paramName);
        builder_->CreateStore(&arg, slot);
        numericVars_[paramName] = slot;
    }

    bool bodyOk = genStatementList(node->body);

    if (bodyOk && !builder_->GetInsertBlock()->getTerminator()) {
        // Fell off the end without an explicit RETURN on this path --
        // see the function-level comment above for why this returns 0.0
        // rather than being treated as an error.
        builder_->CreateRet(llvm::ConstantFP::get(llvm::Type::getDoubleTy(context_), 0.0));
    }

    // Restore the surrounding context regardless of success/failure, so
    // a failure deep inside a function body doesn't leave the builder
    // pointed at a stale/wrong block for any error-reporting code that
    // runs afterward.
    currentFunction_ = savedFunction;
    numericVars_ = savedNumericVars;
    stringVars_ = savedStringVars;
    if (savedInsertBlock) {
        builder_->SetInsertPoint(savedInsertBlock);
    }

    return bodyOk;
}

bool LLVMCodeGenerator::genReturn(const ReturnNode* node) {
    llvm::Value* val = genExpr(node->expr);
    if (!val) return false;
    builder_->CreateRet(val);
    return true;
}

llvm::Value* LLVMCodeGenerator::genExpr(const ASTNode* expr) {
    switch (expr->kind) {
        case ASTNodeKind::Number: {
            auto* num = static_cast<const NumberNode*>(expr);
            return llvm::ConstantFP::get(llvm::Type::getDoubleTy(context_),
                                          static_cast<double>(num->value));
        }

        case ASTNodeKind::Identifier:
        case ASTNodeKind::Cell: {
            std::string name = (expr->kind == ASTNodeKind::Identifier)
                ? static_cast<const IdentifierNode*>(expr)->name
                : static_cast<const CellNode*>(expr)->name;

            auto numIt = numericVars_.find(name);
            if (numIt != numericVars_.end()) {
                return builder_->CreateLoad(llvm::Type::getDoubleTy(context_), numIt->second, name);
            }
            if (stringVars_.count(name)) {
                reportError("cannot use STRING variable '" + name + "' in a numeric expression");
                return nullptr;
            }
            reportError("internal error: reference to undeclared symbol '" + name +
                        "' during code generation (should have been caught by semantic analysis)");
            return nullptr;
        }

        case ASTNodeKind::BinaryExpr: {
            auto* b = static_cast<const BinaryExprNode*>(expr);
            llvm::Value* lhs = genExpr(b->left);
            llvm::Value* rhs = genExpr(b->right);
            if (!lhs || !rhs) return nullptr;

            if (b->op == "+") return builder_->CreateFAdd(lhs, rhs, "addtmp");
            if (b->op == "-") return builder_->CreateFSub(lhs, rhs, "subtmp");
            if (b->op == "*") return builder_->CreateFMul(lhs, rhs, "multmp");
            if (b->op == "/") return builder_->CreateFDiv(lhs, rhs, "divtmp");
            if (b->op == "%") return builder_->CreateFRem(lhs, rhs, "modtmp");

            reportError("internal error: unsupported binary operator '" + b->op + "' during code generation");
            return nullptr;
        }

        case ASTNodeKind::UnaryExpr: {
            auto* u = static_cast<const UnaryExprNode*>(expr);
            llvm::Value* operand = genExpr(u->operand);
            if (!operand) return nullptr;
            if (u->op == "-") return builder_->CreateFNeg(operand, "negtmp");

            reportError("internal error: unsupported unary operator '" + u->op + "' during code generation");
            return nullptr;
        }

        case ASTNodeKind::StringLiteral:
            // Only reachable if a string literal appears somewhere other
            // than a direct assignment RHS or a direct PRINT argument
            // (e.g. inside arithmetic) -- semantic analysis already
            // rejects that, so this is a defensive-only path.
            reportError("a string literal cannot be used as a numeric value");
            return nullptr;

        case ASTNodeKind::Comparison:
            // Comparisons only ever appear as an IF condition in the
            // current grammar (see genIf/genCondition, which handle that
            // case directly and never call genExpr on a Comparison).
            // A comparison used as a general double-producing value has
            // no defined meaning in SheetLang -- there is no boolean
            // value type -- so this path is unreachable for any valid
            // program, but is handled defensively rather than asserting
            // or crashing.
            reportError("comparison expressions are not supported as a general value "
                        "(a comparison may only appear directly as an IF condition)");
            return nullptr;

        case ASTNodeKind::FunctionCall: {
            auto* f = static_cast<const FunctionCallNode*>(expr);

            auto userIt = userFunctions_.find(f->name);
            if (userIt != userFunctions_.end()) {
                std::vector<llvm::Value*> argVals;
                argVals.reserve(f->args.size());
                for (auto* argExpr : f->args) {
                    llvm::Value* v = genExpr(argExpr);
                    if (!v) return nullptr;
                    argVals.push_back(v);
                }
                return builder_->CreateCall(userIt->second, argVals, "calltmp");
            }

            // Not a user-defined function -- must be one of the fixed
            // builtins (SUM/AVG/MAX/MIN/ABS), which remain out of scope
            // for code generation (unchanged since Phase 6/7; semantic
            // analysis validates their arity/types, but no LLVM codegen
            // exists for them).
            reportError("function call code generation ('" + f->name +
                        "') is not implemented for built-in functions "
                        "(out of scope: SUM/AVG/MAX/MIN/ABS are validated semantically "
                        "but not code-generated; only user-defined FUNCTION declarations are)");
            return nullptr;
        }

        default:
            reportError("internal error: unknown expression kind during code generation");
            return nullptr;
    }
}
