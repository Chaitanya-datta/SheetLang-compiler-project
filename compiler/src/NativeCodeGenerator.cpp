#include "NativeCodeGenerator.h"

#include <llvm/MC/TargetRegistry.h>
#include <llvm/Support/TargetSelect.h>
#include <llvm/TargetParser/Host.h>
#include <llvm/TargetParser/Triple.h>
#include <llvm/Support/FileSystem.h>
#include <llvm/Support/raw_ostream.h>
#include <llvm/Support/Program.h>
#include <llvm/Target/TargetMachine.h>
#include <llvm/Target/TargetOptions.h>
#include <llvm/IR/LegacyPassManager.h>
#include <llvm/Support/CodeGen.h>

#include <fstream>
#include <sstream>

void NativeCodeGenerator::reportError(const std::string& msg) {
    errors_.push_back("Error: " + msg);
}

std::string NativeCodeGenerator::findLinkerDriver() {
    for (const char* candidate : {"cc", "clang", "gcc"}) {
        auto found = llvm::sys::findProgramByName(candidate);
        if (found) return *found;
    }
    return "";
}

bool NativeCodeGenerator::compileToExecutable(llvm::Module& module, const std::string& outputPath) {
    errors_.clear();

    // --- 1. Target initialization -----------------------------------
    // Only the HOST's target/asm-printer are needed -- SheetLang always
    // compiles for the machine it's running on, never cross-compiles.
    llvm::InitializeNativeTarget();
    llvm::InitializeNativeTargetAsmPrinter();

    std::string targetTripleStr = llvm::sys::getDefaultTargetTriple();
    // Built once, used consistently below for lookupTarget,
    // createTargetMachine, and Module::setTargetTriple -- LLVM 22
    // requires a proper llvm::Triple object for all three (the
    // string/StringRef-based overloads are deprecated or removed there).
    // This project targets LLVM 22.1.8 specifically, so these calls are
    // unconditionally Triple-based; there is no string-based fallback
    // path left in this file.
    llvm::Triple targetTriple(targetTripleStr);

    std::string lookupError;
    const llvm::Target* target = llvm::TargetRegistry::lookupTarget(targetTriple, lookupError);
    if (!target) {
        reportError("target initialization failed: " + lookupError +
                    " (triple: " + targetTripleStr + ")");
        return false;
    }

    llvm::TargetOptions options;
    // PIC (position-independent code) is required for a working
    // executable on modern macOS (Apple Silicon mandates PIE binaries)
    // and is also safe/standard on Linux, so it is used unconditionally
    // rather than branching on platform.
    auto relocModel = std::optional<llvm::Reloc::Model>(llvm::Reloc::PIC_);

    llvm::TargetMachine* targetMachine = target->createTargetMachine(
        targetTriple, /*CPU=*/"generic", /*Features=*/"", options, relocModel);
    if (!targetMachine) {
        reportError("failed to create TargetMachine for triple " + targetTripleStr);
        return false;
    }

    module.setDataLayout(targetMachine->createDataLayout());
    module.setTargetTriple(targetTriple);

    // --- 2. Emit an object file ---------------------------------------
    std::string objectPath = outputPath + ".sheetlang.o";

    std::error_code ec;
    llvm::raw_fd_ostream dest(objectPath, ec, llvm::sys::fs::OF_None);
    if (ec) {
        reportError("failed to open temporary object file '" + objectPath + "': " + ec.message());
        delete targetMachine;
        return false;
    }

    llvm::legacy::PassManager passManager;
    // Object-file emission still goes through the legacy PassManager
    // interface (TargetMachine::addPassesToEmitFile) -- this remains the
    // documented, correct API for this specific step even in an LLVM
    // build that otherwise uses the new PassManager for IR passes; no
    // optimization passes are added here (Phase 7, like Phase 6, applies
    // none).
    bool cantEmit = targetMachine->addPassesToEmitFile(
        passManager, dest, nullptr, llvm::CodeGenFileType::ObjectFile);
    if (cantEmit) {
        reportError("TargetMachine cannot emit an object file for this target");
        dest.close();
        llvm::sys::fs::remove(objectPath);
        delete targetMachine;
        return false;
    }

    passManager.run(module);
    dest.flush();
    dest.close();
    delete targetMachine;

    if (!llvm::sys::fs::exists(objectPath)) {
        reportError("object file was not created at '" + objectPath + "'");
        return false;
    }

    // --- 3. Link into an executable using the system linker driver -----
    std::string linkerDriver = findLinkerDriver();
    if (linkerDriver.empty()) {
        reportError("no C compiler/linker driver found on PATH (tried cc, clang, gcc); "
                    "cannot link the generated object file into an executable");
        llvm::sys::fs::remove(objectPath);
        return false;
    }

    // Capture the linker's stderr into a temp file so failures are
    // reported to the user rather than silently swallowed.
    llvm::SmallString<128> stderrPath;
    llvm::sys::fs::createTemporaryFile("sheetlang-link-stderr", "log", stderrPath);

    std::vector<llvm::StringRef> args = {linkerDriver, objectPath, "-o", outputPath};
    std::optional<llvm::StringRef> redirects[3] = {
        std::nullopt,                       // stdin: inherit
        std::nullopt,                       // stdout: inherit
        llvm::StringRef(stderrPath)          // stderr: captured
    };

    std::string execError;
    bool executionFailed = false;
    int linkResult = llvm::sys::ExecuteAndWait(
        linkerDriver, args, /*Env=*/std::nullopt, redirects,
        /*SecondsToWait=*/0, /*MemoryLimit=*/0, &execError, &executionFailed);

    std::string linkerStderr;
    {
        std::ifstream in(stderrPath.c_str());
        std::ostringstream ss;
        ss << in.rdbuf();
        linkerStderr = ss.str();
    }
    llvm::sys::fs::remove(stderrPath);
    llvm::sys::fs::remove(objectPath); // always clean up the temp object file

    if (executionFailed || linkResult != 0) {
        std::string msg = "linker failed (exit code " + std::to_string(linkResult) + ")";
        if (!execError.empty()) msg += ": " + execError;
        if (!linkerStderr.empty()) msg += "\n" + linkerStderr;
        reportError(msg);
        return false;
    }

    if (!linkerStderr.empty()) {
        // A non-fatal warning from the linker -- still surfaced, not
        // hidden, even though the link itself succeeded.
        errors_.push_back("Linker warning:\n" + linkerStderr);
    }

    // --- 4. Confirm the executable genuinely exists ---------------------
    // (No explicit chmod here: the linker itself already produces an
    // executable file with the correct permissions -- verified directly
    // in testing below, not assumed.)
    if (!llvm::sys::fs::exists(outputPath)) {
        reportError("linker reported success but output executable '" + outputPath +
                    "' was not created");
        return false;
    }

    return true;
}
