#pragma once
#include <llvm/IR/Module.h>
#include <string>
#include <vector>

// Turns an already-generated, already-verified llvm::Module (produced by
// LLVMCodeGenerator) into a real native executable. This is Phase 7's
// only new component; it does NOT touch the AST, does NOT re-run
// semantic/dependency analysis, and does NOT generate or modify LLVM IR
// itself -- LLVMCodeGenerator remains the single source of IR.
//
// Pipeline implemented here (the second half of Phase 7's full chain):
//
//   llvm::Module (verified)
//        -> TargetMachine (host target, via LLVM's target registry)
//        -> object file (.o), emitted through the legacy PassManager
//           object-emission interface -- this is still the documented,
//           correct way to emit object files even in an LLVM build that
//           otherwise uses the new PassManager for IR-level passes (which
//           SheetLang doesn't use anyway, since Phase 6/7 apply no
//           optimization passes at all)
//        -> system linker (invoked as an external process: `cc`, falling
//           back to `clang` or `gcc` if `cc` isn't on PATH), producing
//           the final executable
//
// The temporary object file is always cleaned up (deleted) after this
// class is done with it, whether linking succeeded or failed -- it is an
// internal implementation detail, not a Phase 7 deliverable. Diagnostic
// messages (including the linker's own stderr, on failure) are what the
// user is expected to rely on instead.
class NativeCodeGenerator {
public:
    // Compiles `module` into a native executable at `outputPath`.
    // Returns true only if the executable file actually exists at
    // `outputPath` afterward. All diagnostics are collected in errors().
    bool compileToExecutable(llvm::Module& module, const std::string& outputPath);

    const std::vector<std::string>& errors() const { return errors_; }

private:
    std::vector<std::string> errors_;

    void reportError(const std::string& msg);

    // Returns the path to a usable C compiler/linker driver ("cc",
    // falling back to "clang" then "gcc"), or an empty string if none is
    // found on PATH.
    std::string findLinkerDriver();
};
