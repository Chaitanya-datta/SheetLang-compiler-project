#include <iostream>
#include <cstdio>
#include <cstdlib>
#include <string>
#include <vector>
#include "Token.h"
#include "Lexer.h"
#include "AST.h"
#include "SemanticAnalyzer.h"
#include "DependencyGraph.h"
#include "DependencyAnalyzer.h"
#include "LLVMCodeGenerator.h"
#include "NativeCodeGenerator.h"
#include "parser.tab.h"  // for token constants + yylval, used to free
                         // heap-allocated string tokens in --tokens mode
#include <llvm/IR/Module.h>
#include <llvm/Support/raw_ostream.h>
#include <llvm/Support/FileSystem.h>
#include <llvm/MC/TargetRegistry.h>
#include <llvm/Support/TargetSelect.h>
#include <llvm/TargetParser/Host.h>
#include <llvm/TargetParser/Triple.h>
#include <llvm/Target/TargetMachine.h>
#include <llvm/Target/TargetOptions.h>
#include <llvm/IR/LegacyPassManager.h>
#include <llvm/Support/CodeGen.h>

extern int yyparse();

static void run_token_dump(const std::string &path) {
    FILE *file = fopen(path.c_str(), "r");
    if (!file) {
        std::cerr << "Error: could not open file '" << path << "'" << std::endl;
        std::exit(1);
    }
    yyin = file;

    int rawToken;
    while ((rawToken = yylex()) != 0) {
        printf("%-14s %-12s line %-4d col %d\n",
               g_token_lexeme.c_str(),
               tokenName(rawToken).c_str(),
               g_token_line,
               g_token_column);

        // IDENTIFIER/CELL/STRING tokens carry a heap-allocated
        // std::string* (yylval.sval), normally freed by the Bison grammar
        // actions. --tokens mode calls yylex() directly without a parser,
        // so nothing else will ever free it -- free it here instead.
        if (rawToken == IDENTIFIER || rawToken == CELL || rawToken == STRING) {
            delete yylval.sval;
            yylval.sval = nullptr;
        }
    }

    fclose(file);
    if (g_lexHadError) {
        std::exit(1);
    }
}

static void run_ast_dump(const std::string &path) {
    FILE *file = fopen(path.c_str(), "r");
    if (!file) {
        std::cerr << "Error: could not open file '" << path << "'" << std::endl;
        std::exit(1);
    }
    yyin = file;

    int result = yyparse();
    fclose(file);

    if (result != 0 || g_astRoot == nullptr) {
        std::cerr << "Parsing failed." << std::endl;
        std::exit(1);
    }

    printAST(g_astRoot, std::cout);
    delete g_astRoot;
    g_astRoot = nullptr;
}

static void run_semantic_check(const std::string &path) {
    FILE *file = fopen(path.c_str(), "r");
    if (!file) {
        std::cerr << "Error: could not open file '" << path << "'" << std::endl;
        std::exit(1);
    }
    yyin = file;

    int result = yyparse();
    fclose(file);

    if (result != 0 || g_astRoot == nullptr) {
        // A syntax error, not a semantic one -- yyerror() already printed
        // details. Still exits non-zero, since the file is invalid either
        // way, but this is intentionally not reported as a "Semantic
        // Error" (it never reached semantic analysis).
        std::cerr << "Parsing failed." << std::endl;
        std::exit(1);
    }

    SemanticAnalyzer analyzer;
    bool ok = analyzer.analyze(g_astRoot);

    delete g_astRoot;
    g_astRoot = nullptr;

    if (ok) {
        std::cout << "Semantic analysis successful." << std::endl;
        return;
    }

    for (const auto& err : analyzer.errors()) {
        std::cerr << err << std::endl;
    }
    std::cout << "Semantic analysis failed." << std::endl;
    std::exit(1);
}

static void run_deps(const std::string &path) {
    FILE *file = fopen(path.c_str(), "r");
    if (!file) {
        std::cerr << "Error: could not open file '" << path << "'" << std::endl;
        std::exit(1);
    }
    yyin = file;

    int result = yyparse();
    fclose(file);

    if (result != 0 || g_astRoot == nullptr) {
        std::cerr << "Parsing failed." << std::endl;
        std::exit(1);
    }

    // Pipeline order per Phase 5 spec: dependency analysis only runs on an
    // AST that has ALREADY passed semantic analysis. If semantic analysis
    // fails, we stop here and never touch the dependency graph.
    SemanticAnalyzer semantic;
    bool semanticOk = semantic.analyze(g_astRoot);

    if (!semanticOk) {
        for (const auto& err : semantic.errors()) {
            std::cerr << err << std::endl;
        }
        std::cout << "Semantic analysis failed." << std::endl;
        delete g_astRoot;
        g_astRoot = nullptr;
        std::exit(1);
    }
    std::cout << "Semantic analysis successful." << std::endl;

    DependencyAnalyzer depAnalyzer;
    bool depsOk = depAnalyzer.analyze(g_astRoot);

    delete g_astRoot;
    g_astRoot = nullptr;

    if (!depsOk) {
        for (const auto& err : depAnalyzer.errors()) {
            std::cerr << err << std::endl;
        }
        std::cout << "Dependency analysis failed." << std::endl;
        std::exit(1);
    }

    const DependencyGraph& graph = depAnalyzer.graph();

    std::cout << "Dependency Graph:" << std::endl;
    bool anyEdges = false;
    for (const auto& node : graph.nodes()) {
        auto deps = graph.dependenciesOf(node);
        if (deps.empty()) continue;
        anyEdges = true;
        std::cout << node << " -> ";
        bool first = true;
        for (const auto& dep : deps) {
            if (!first) std::cout << ", ";
            std::cout << dep;
            first = false;
        }
        std::cout << std::endl;
    }
    if (!anyEdges) {
        std::cout << "(no dependencies)" << std::endl;
    }

    std::vector<std::string> order;
    graph.topologicalOrder(order); // known cycle-free at this point

    std::cout << std::endl << "Evaluation Order:" << std::endl;
    for (const auto& n : order) {
        std::cout << n << std::endl;
    }
}

// --------------------------------------------------------------------
// --ir: full pipeline through LLVM IR generation.
//
// IMPORTANT stdout discipline: unlike --check and --deps, this mode's
// stdout is meant to be a genuinely valid, pipeable .ll file when no
// -o/--output is given (e.g. `./sheetc --ir foo.sheet > foo.ll` must
// produce a file LLVM tools can read). So ALL progress/status messages
// here go to stderr, and stdout carries ONLY the LLVM IR text itself (or
// nothing, if -o/--output was given and the IR was written to a file
// instead).
// --------------------------------------------------------------------

static void run_ir(const std::string &path, const std::string &outputFile) {
    FILE *file = fopen(path.c_str(), "r");
    if (!file) {
        std::cerr << "Error: could not open file '" << path << "'" << std::endl;
        std::exit(1);
    }
    yyin = file;

    int result = yyparse();
    fclose(file);

    if (result != 0 || g_astRoot == nullptr) {
        std::cerr << "Parsing failed." << std::endl;
        std::exit(1);
    }

    // Pipeline order per Phase 6 spec: semantic analysis, THEN dependency
    // analysis, THEN LLVM generation -- IR is never generated for a
    // program that failed an earlier stage.
    SemanticAnalyzer semantic;
    if (!semantic.analyze(g_astRoot)) {
        for (const auto& err : semantic.errors()) {
            std::cerr << err << std::endl;
        }
        std::cerr << "Semantic analysis failed." << std::endl;
        delete g_astRoot;
        g_astRoot = nullptr;
        std::exit(1);
    }
    std::cerr << "Semantic analysis successful." << std::endl;

    // Dependency analysis is still run and respected here, even though
    // under SheetLang's strict declare-before-use rule it can never
    // actually report a cycle for a program that already passed semantic
    // analysis (see README "Declare-before-use is preserved"). Skipping
    // this step would be cheaper but would silently stop "respecting"
    // the Phase 5 pipeline stage the way the Phase 6 spec requires.
    DependencyAnalyzer depAnalyzer;
    if (!depAnalyzer.analyze(g_astRoot)) {
        for (const auto& err : depAnalyzer.errors()) {
            std::cerr << err << std::endl;
        }
        std::cerr << "Dependency analysis failed." << std::endl;
        delete g_astRoot;
        g_astRoot = nullptr;
        std::exit(1);
    }
    std::cerr << "Dependency analysis successful." << std::endl;

    LLVMCodeGenerator codegen;
    std::unique_ptr<llvm::Module> module = codegen.generate(g_astRoot);

    delete g_astRoot;
    g_astRoot = nullptr;

    if (!module) {
        for (const auto& err : codegen.errors()) {
            std::cerr << err << std::endl;
        }
        std::cerr << "LLVM IR generation failed." << std::endl;
        std::exit(1);
    }
    std::cerr << "LLVM IR generation successful (module verified)." << std::endl;

    if (!outputFile.empty()) {
        std::error_code ec;
        llvm::raw_fd_ostream out(outputFile, ec, llvm::sys::fs::OF_Text);
        if (ec) {
            std::cerr << "Error: could not open output file '" << outputFile
                       << "': " << ec.message() << std::endl;
            std::exit(1);
        }
        module->print(out, nullptr);
        std::cerr << "LLVM IR written to " << outputFile << std::endl;
    } else {
        module->print(llvm::outs(), nullptr);
    }
}

// --------------------------------------------------------------------
// --asm: same pipeline as --ir, but emits target ASSEMBLY text instead
// of LLVM IR text. Deliberately self-contained here rather than added to
// NativeCodeGenerator (which only ever emits an object file, never
// assembly) -- this keeps NativeCodeGenerator.cpp/.h completely
// untouched (Phase 9 instruction: don't modify existing compiler files
// unless a very small integration change is genuinely required). The
// target-machine setup mirrors NativeCodeGenerator's own Triple-based
// LLVM 22 approach exactly (see that file for the full rationale).
// --------------------------------------------------------------------

static void run_asm(const std::string &path, const std::string &outputFile) {
    FILE *file = fopen(path.c_str(), "r");
    if (!file) {
        std::cerr << "Error: could not open file '" << path << "'" << std::endl;
        std::exit(1);
    }
    yyin = file;

    int result = yyparse();
    fclose(file);

    if (result != 0 || g_astRoot == nullptr) {
        std::cerr << "Parsing failed." << std::endl;
        std::exit(1);
    }

    SemanticAnalyzer semantic;
    if (!semantic.analyze(g_astRoot)) {
        for (const auto& err : semantic.errors()) std::cerr << err << std::endl;
        std::cerr << "Semantic analysis failed." << std::endl;
        delete g_astRoot; g_astRoot = nullptr;
        std::exit(1);
    }
    std::cerr << "Semantic analysis successful." << std::endl;

    DependencyAnalyzer depAnalyzer;
    if (!depAnalyzer.analyze(g_astRoot)) {
        for (const auto& err : depAnalyzer.errors()) std::cerr << err << std::endl;
        std::cerr << "Dependency analysis failed." << std::endl;
        delete g_astRoot; g_astRoot = nullptr;
        std::exit(1);
    }
    std::cerr << "Dependency analysis successful." << std::endl;

    LLVMCodeGenerator codegen;
    std::unique_ptr<llvm::Module> module = codegen.generate(g_astRoot);
    delete g_astRoot; g_astRoot = nullptr;

    if (!module) {
        for (const auto& err : codegen.errors()) std::cerr << err << std::endl;
        std::cerr << "LLVM IR generation failed." << std::endl;
        std::exit(1);
    }
    std::cerr << "LLVM IR generation successful (module verified)." << std::endl;

    llvm::InitializeNativeTarget();
    llvm::InitializeNativeTargetAsmPrinter();

    std::string targetTripleStr = llvm::sys::getDefaultTargetTriple();
    llvm::Triple targetTriple(targetTripleStr);

    std::string lookupError;
    const llvm::Target* target = llvm::TargetRegistry::lookupTarget(targetTriple, lookupError);
    if (!target) {
        std::cerr << "Error: target initialization failed: " << lookupError << std::endl;
        std::exit(1);
    }

    llvm::TargetOptions options;
    auto relocModel = std::optional<llvm::Reloc::Model>(llvm::Reloc::PIC_);
    llvm::TargetMachine* targetMachine = target->createTargetMachine(
        targetTriple, "generic", "", options, relocModel);
    if (!targetMachine) {
        std::cerr << "Error: failed to create TargetMachine." << std::endl;
        std::exit(1);
    }

    module->setDataLayout(targetMachine->createDataLayout());
    module->setTargetTriple(targetTriple);

    llvm::SmallString<0> asmBuf;
    llvm::raw_svector_ostream asmStream(asmBuf);
    llvm::legacy::PassManager passManager;
    bool cantEmit = targetMachine->addPassesToEmitFile(
        passManager, asmStream, nullptr, llvm::CodeGenFileType::AssemblyFile);
    if (cantEmit) {
        std::cerr << "Error: TargetMachine cannot emit assembly for this target." << std::endl;
        delete targetMachine;
        std::exit(1);
    }
    passManager.run(*module);
    delete targetMachine;

    std::cerr << "Assembly generation successful." << std::endl;

    if (!outputFile.empty()) {
        std::error_code ec;
        llvm::raw_fd_ostream out(outputFile, ec, llvm::sys::fs::OF_Text);
        if (ec) {
            std::cerr << "Error: could not open output file '" << outputFile
                       << "': " << ec.message() << std::endl;
            std::exit(1);
        }
        out << asmBuf;
        std::cerr << "Assembly written to " << outputFile << std::endl;
    } else {
        llvm::outs() << asmBuf;
    }
}

// --------------------------------------------------------------------
// --compile: full pipeline through to a native executable. Reuses
// LLVMCodeGenerator (unchanged from Phase 6) for IR generation, then
// hands the resulting verified module to NativeCodeGenerator (new in
// Phase 7) for object-file emission and linking. --ir remains the only
// mode that displays LLVM IR text; --compile deliberately does not dump
// IR by default (per the Phase 7 spec) -- use --ir separately to inspect
// it.
// --------------------------------------------------------------------

static void run_compile(const std::string &path, const std::string &outputFile) {
    if (outputFile.empty()) {
        std::cerr << "Error: --compile requires an output file via -o/--output." << std::endl;
        std::exit(1);
    }

    FILE *file = fopen(path.c_str(), "r");
    if (!file) {
        std::cerr << "Error: could not open file '" << path << "'" << std::endl;
        std::exit(1);
    }
    yyin = file;

    int result = yyparse();
    fclose(file);

    if (result != 0 || g_astRoot == nullptr) {
        std::cerr << "Error: parsing failed; native code generation aborted." << std::endl;
        std::exit(1);
    }

    SemanticAnalyzer semantic;
    if (!semantic.analyze(g_astRoot)) {
        for (const auto& err : semantic.errors()) {
            std::cerr << err << std::endl;
        }
        std::cerr << "Error: semantic analysis failed; native code generation aborted." << std::endl;
        delete g_astRoot;
        g_astRoot = nullptr;
        std::exit(1);
    }
    std::cerr << "Semantic analysis succeeded." << std::endl;

    DependencyAnalyzer depAnalyzer;
    if (!depAnalyzer.analyze(g_astRoot)) {
        for (const auto& err : depAnalyzer.errors()) {
            std::cerr << err << std::endl;
        }
        std::cerr << "Error: dependency analysis failed; native code generation aborted." << std::endl;
        delete g_astRoot;
        g_astRoot = nullptr;
        std::exit(1);
    }
    std::cerr << "Dependency analysis succeeded." << std::endl;

    LLVMCodeGenerator codegen;
    std::unique_ptr<llvm::Module> module = codegen.generate(g_astRoot);

    delete g_astRoot;
    g_astRoot = nullptr;

    if (!module) {
        for (const auto& err : codegen.errors()) {
            std::cerr << err << std::endl;
        }
        std::cerr << "Error: LLVM IR generation/verification failed; native code generation aborted." << std::endl;
        std::exit(1);
    }
    std::cerr << "LLVM IR generation succeeded (module verified)." << std::endl;

    NativeCodeGenerator native;
    bool ok = native.compileToExecutable(*module, outputFile);

    // Print everything collected -- on success this is only non-fatal
    // linker warnings (if any); on failure it's the actual error chain.
    for (const auto& msg : native.errors()) {
        std::cerr << msg << std::endl;
    }

    if (!ok) {
        std::cerr << "Error: native code generation failed; no executable was produced." << std::endl;
        std::exit(1);
    }

    std::cerr << "Native code generation succeeded." << std::endl;
    std::cerr << "Linking succeeded." << std::endl;
    std::cerr << "Executable written to " << outputFile << std::endl;
}

// --------------------------------------------------------------------
// --graph-test: direct, programmatic tests of DependencyGraph's cycle
// detection, constructed by hand rather than through the SheetLang
// parser/semantic-analysis pipeline.
//
// WHY THIS EXISTS: SheetLang enforces strict declare-before-use (see
// README). Under that rule, a genuinely cyclic dependency between LET
// variables cannot be expressed in valid SheetLang source -- any attempt
// to write one is rejected as an "Undefined identifier" error before a
// cycle could ever reach the dependency graph. DependencyGraph's cycle
// detection is still required compiler-architecture (and needed for any
// future language evolution that relaxes declare-before-use), so it is
// tested here directly against hand-built graphs instead of through
// unreachable source examples.
// --------------------------------------------------------------------

static bool run_one_graph_test(const std::string& label,
                                const DependencyGraph& graph,
                                bool expectCycle,
                                const std::string& expectedPathDescription) {
    std::vector<std::string> cyclePath;
    bool gotCycle = graph.hasCycle(&cyclePath);

    std::cout << "Graph Test: " << label << std::endl;
    std::cout << "  hasCycle: " << (gotCycle ? "true" : "false")
               << " (expected: " << (expectCycle ? "true" : "false") << ")";

    bool pass = (gotCycle == expectCycle);

    if (gotCycle) {
        std::cout << " -- cycle path: ";
        for (size_t i = 0; i < cyclePath.size(); ++i) {
            if (i > 0) std::cout << " -> ";
            std::cout << cyclePath[i];
        }
    } else {
        std::vector<std::string> order;
        bool ok = graph.topologicalOrder(order);
        if (ok) {
            std::cout << " -- topological order: ";
            for (size_t i = 0; i < order.size(); ++i) {
                if (i > 0) std::cout << ", ";
                std::cout << order[i];
            }
        }
    }

    std::cout << "  [" << (pass ? "PASS" : "FAIL") << "]" << std::endl;
    (void)expectedPathDescription;
    return pass;
}

static void run_graph_tests() {
    bool allPassed = true;

    // Test 1: self-cycle, A -> A
    {
        DependencyGraph g;
        g.addDependency("A", "A");
        allPassed &= run_one_graph_test("Self-cycle (A -> A)", g, true, "A -> A");
    }

    // Test 2: two-node cycle, A -> B -> A
    {
        DependencyGraph g;
        g.addDependency("A", "B");
        g.addDependency("B", "A");
        allPassed &= run_one_graph_test("Two-node cycle (A -> B -> A)", g, true, "A -> B -> A");
    }

    // Test 3: three-node (longer) cycle, A -> B -> C -> A
    {
        DependencyGraph g;
        g.addDependency("A", "B");
        g.addDependency("B", "C");
        g.addDependency("C", "A");
        allPassed &= run_one_graph_test("Three-node cycle (A -> B -> C -> A)", g, true, "A -> B -> C -> A");
    }

    // Test 4: acyclic graph, for contrast -- confirms hasCycle() correctly
    // returns false (not just "always true") and topologicalOrder()
    // succeeds. B depends on A, C depends on B, D depends on A and C.
    {
        DependencyGraph g;
        g.addDependency("B", "A");
        g.addDependency("C", "B");
        g.addDependency("D", "A");
        g.addDependency("D", "C");
        allPassed &= run_one_graph_test("Acyclic (B->A, C->B, D->A, D->C)", g, false, "");
    }

    std::cout << std::endl;
    if (allPassed) {
        std::cout << "All graph tests passed." << std::endl;
    } else {
        std::cout << "One or more graph tests FAILED." << std::endl;
        std::exit(1);
    }
}

int main(int argc, char** argv) {
    if (argc == 1) {
        std::cout << "SheetLang Compiler v0.1" << std::endl;
        return 0;
    }

    // --graph-test takes no file argument -- handle it before the
    // filepath-required check below.
    if (argc == 2 && std::string(argv[1]) == "--graph-test") {
        run_graph_tests();
        return 0;
    }

    std::string mode, filepath, outputFile;
    for (int i = 1; i < argc; ++i) {
        std::string arg = argv[i];
        if (arg == "--tokens") {
            mode = "tokens";
        } else if (arg == "--ast") {
            mode = "ast";
        } else if (arg == "--check") {
            mode = "check";
        } else if (arg == "--deps") {
            mode = "deps";
        } else if (arg == "--ir") {
            mode = "ir";
        } else if (arg == "--asm") {
            mode = "asm";
        } else if (arg == "--compile") {
            mode = "compile";
        } else if (arg == "-o" || arg == "--output") {
            if (i + 1 < argc) {
                outputFile = argv[++i];
            } else {
                std::cerr << "Error: " << arg << " requires a path argument" << std::endl;
                return 1;
            }
        } else {
            filepath = arg;
        }
    }

    if (filepath.empty()) {
        std::cerr << "Error: expected a file path" << std::endl;
        return 1;
    }

    if (mode == "tokens") {
        run_token_dump(filepath);
        return 0;
    }
    if (mode == "ast") {
        run_ast_dump(filepath);
        return 0;
    }
    if (mode == "check") {
        run_semantic_check(filepath);
        return 0;
    }
    if (mode == "deps") {
        run_deps(filepath);
        return 0;
    }
    if (mode == "ir") {
        run_ir(filepath, outputFile);
        return 0;
    }
    if (mode == "asm") {
        run_asm(filepath, outputFile);
        return 0;
    }
    if (mode == "compile") {
        run_compile(filepath, outputFile);
        return 0;
    }

    std::cerr << "Unknown usage. Try: ./sheetc --tokens <file>  or  ./sheetc --ast <file>  or  ./sheetc --check <file>  or  ./sheetc --deps <file>  or  ./sheetc --ir <file> [-o output.ll]  or  ./sheetc --compile <file> -o <executable>  or  ./sheetc --graph-test" << std::endl;
    return 1;
}
