# SheetLang — Phase 7

An LLVM-based compiler for SheetLang, a spreadsheet-inspired DSL.
This phase adds **native code generation and linking** on top of the
Phase 6 LLVM IR pipeline — SheetLang programs can now be compiled into
real, runnable executables.

## Compiler pipeline (current)

```
Source (.sheet)
   → Flex Lexer        (lexer/lexer.l)
   → Bison Parser       (parser/parser.y)
   → AST                (include/AST.h, src/AST.cpp)
   → Semantic Analysis    (include/SemanticAnalyzer.h, src/SemanticAnalyzer.cpp)
   → Symbol Table           (include/SymbolTable.h, src/SymbolTable.cpp)
   → Dependency Graph          (include/DependencyGraph.h, src/DependencyGraph.cpp)
   → Dependency Analysis          (include/DependencyAnalyzer.h, src/DependencyAnalyzer.cpp)
   → LLVM IR Generation               (include/LLVMCodeGenerator.h, src/LLVMCodeGenerator.cpp)
   → LLVM Module Verification            (llvm::verifyModule)
   → Native Object-File Generation           (include/NativeCodeGenerator.h, src/NativeCodeGenerator.cpp)
   → System Linker                              (external process: cc/clang/gcc)
   → Native Executable                             ← NEW in Phase 7
```

## Phase 1–6 rules are unchanged

`SemanticAnalyzer`, `SymbolTable`, `DependencyGraph`, `DependencyAnalyzer`,
and `LLVMCodeGenerator` were **not modified** for Phase 7. Declare-before-
use remains strict. The dependency-graph edge convention (`X -> Y` means
"X depends on Y") is unchanged. `LLVMCodeGenerator`'s source-order code
generation decision (documented in the Phase 6 README) is unchanged and
directly reused — `NativeCodeGenerator` never reorders or regenerates
anything; it only consumes the `llvm::Module` that `LLVMCodeGenerator`
already produced and verified.

`NativeCodeGenerator` is a genuinely new, separate component. It has no
knowledge of the AST, SheetLang syntax, or SheetLang semantics — its
input is exactly one `llvm::Module&`, already generated and already
verified by the unchanged Phase 6 code.

## `NativeCodeGenerator` design

### Pipeline

1. **Target initialization** — `llvm::InitializeNativeTarget()` +
   `InitializeNativeTargetAsmPrinter()`. Only the *host* target is
   initialized; SheetLang always compiles for the machine it's running
   on, never cross-compiles, so there's no reason to link in support for
   every architecture LLVM knows about.
2. **Target lookup** — `llvm::sys::getDefaultTargetTriple()` +
   `TargetRegistry::lookupTarget(...)`. If this fails, code generation
   stops immediately with `Error: target initialization failed: ...`.
3. **TargetMachine creation** — `Target::createTargetMachine(...)` with
   `Reloc::PIC_` (position-independent code). This is used
   unconditionally, not just on macOS: it's required for a working
   executable on Apple Silicon (which mandates PIE binaries) and is also
   the standard, safe choice on Linux, so there's no platform branch
   needed here at all.
4. **Object-file emission** — `module.setDataLayout(...)` /
   `setTargetTriple(...)` from the `TargetMachine`, then
   `TargetMachine::addPassesToEmitFile(...)` through a
   `legacy::PassManager`. This is still the documented, correct API for
   this specific step, even though no other part of the compiler uses
   the legacy pass manager (Phase 6/7 apply zero optimization passes of
   any kind). The object file is written to a temporary path
   (`<output>.sheetlang.o`, next to the requested executable).
5. **Linking** — an external linker driver (`cc`, falling back to
   `clang`, then `gcc` — see "Finding a linker" below) is invoked via
   `llvm::sys::ExecuteAndWait` as `<driver> <object-file> -o
   <output>`. This deliberately does **not** reimplement linking:
   handing the object file to the platform's own C compiler driver is
   what correctly finds the right C runtime start files, system
   libraries, and `printf` on whatever platform it runs on (Linux or
   macOS), without hardcoding any Homebrew or Xcode paths anywhere in
   this project.
6. **Verification the executable actually exists** — the function only
   returns `true` if `llvm::sys::fs::exists(outputPath)` is true
   *after* linking. A "linker exit code 0" is not, by itself, treated as
   success.

### Finding a linker

```cpp
for (const char* candidate : {"cc", "clang", "gcc"})
```
`llvm::sys::findProgramByName` searches `PATH` for each in order. `cc` is
tried first since it's the portable standard name (resolves to Apple
clang via Xcode Command Line Tools on macOS, and to whatever the
system's default compiler is on Linux); `clang`/`gcc` are fallbacks for
minimal environments where `cc` itself isn't a symlink on `PATH`. If none
are found, compilation fails with a clear, specific error rather than a
confusing linker crash.

### Error handling and diagnostics

Every stage failure produces a specific `Error: ...` message (target
init, TargetMachine creation, object emission, missing linker, linker
failure, missing final executable) — never a generic "something went
wrong." The linker's own **stderr is captured** (via a temporary file
passed to `ExecuteAndWait`'s redirect parameters) and printed on failure,
so a real linker error is never silently swallowed. If the linker
succeeds but still printed something to stderr (e.g. a warning), that
text is also surfaced as a `Linker warning:` rather than discarded.

### Cleanup

The temporary object file (`<output>.sheetlang.o`) and the temporary
linker-stderr capture file are deleted **unconditionally** — on both
success and failure — since they are implementation details, not Phase 7
deliverables. This was directly verified: 10 repeated `--compile` runs
left zero leftover `.sheetlang.o` or `sheetlang-link-stderr-*` files in
the temp directory.

## `--compile` usage

```bash
./sheetc --compile ../examples/native_arithmetic.sheet -o native_arithmetic
./native_arithmetic
```

`-o`/`--output` is **required** for `--compile` (unlike `--ir`, where
it's optional) — omitting it produces exactly:
```
Error: --compile requires an output file via -o/--output.
```
rather than silently guessing a filename or overwriting something.

**stdout discipline:** like `--ir`, all progress messages (`Semantic
analysis succeeded.`, `Native code generation succeeded.`, etc.) go to
**stderr**. Unlike `--ir`, `--compile` does not print any LLVM IR at all
by default — `--ir` remains the only mode responsible for displaying IR
text, per the Phase 7 spec. `--compile`'s stdout is empty on success.

### Example run

```
$ ./sheetc --compile ../examples/native_arithmetic.sheet -o native_arithmetic
Semantic analysis succeeded.
Dependency analysis succeeded.
LLVM IR generation succeeded (module verified).
Native code generation succeeded.
Linking succeeded.
Executable written to native_arithmetic

$ ./native_arithmetic
30.000000
200.000000

$ echo $?
0
```

(`10 + 20 = 30`, `10 * 20 = 200` — matches `native_arithmetic.sheet`'s
source exactly; `%f` formatting is unchanged from Phase 6.)

## Requirements / Build

Same as Phase 6, plus additional LLVM components for target-machine and
object-file support:

```cmake
llvm_map_components_to_libnames(llvm_libs core native mc target support)
target_link_libraries(sheetc PRIVATE ${llvm_libs})
```

`native` is LLVM's pseudo-component meaning "whatever target this
machine actually is" — it resolves to the host's Target/AsmPrinter/MC
libraries automatically, so nothing in this project hardcodes x86-64,
AArch64, or any other specific architecture.

```bash
cd ~/SheetLang
rm -rf build
mkdir build
cd build
cmake ..
cmake --build . -j
```

At link/runtime, a working `cc`/`clang`/`gcc` on `PATH` is required (see
"Finding a linker" above). On macOS this means Xcode Command Line Tools
must be installed — the same requirement any C/C++ development on macOS
already has.

## CLI

```bash
./sheetc
./sheetc --tokens <file>
./sheetc --ast <file>
./sheetc --check <file>
./sheetc --deps <file>
./sheetc --graph-test
./sheetc --ir <file> [-o output.ll | --output output.ll]
./sheetc --compile <file> -o <executable>   [--output also accepted]
```

## Examples

| File | Tests |
|---|---|
| `native_arithmetic.sheet` | `+`, `*`, `PRINT` |
| `native_variables.sheet` | Multiple variables, `-`, `*`, `/` |
| `native_unary.sheet` | Unary minus, including on a parenthesized expression |
| `native_print.sheet` | `PRINT` of a literal, variables, and an inline expression |
| `native_string.sheet` | `PRINT` of two different string literals |
| `native_mixed.sheet` | A small realistic program: variables, arithmetic, numeric and string `PRINT` together |
| `native_semantic_error.sheet` | Duplicate declaration — must fail before any executable is produced |
| `native_syntax_error.sheet` | Invalid grammar — must fail before any executable is produced |
| `native_invalid_character.sheet` | Lexical error — must fail before any executable is produced |

## Testing performed before packaging

**Every valid example was actually compiled AND executed, not just
checked for file existence:**

| File | Compile exit | Executable exists | Runtime exit | stdout (verified by hand against source) |
|---|---|---|---|---|
| `native_arithmetic.sheet` | 0 | yes, `-rwxr-xr-x` | 0 | `30.000000` / `200.000000` |
| `native_variables.sheet` | 0 | yes | 0 | `60.000000` / `120.000000` / `3.000000` |
| `native_unary.sheet` | 0 | yes | 0 | `-15.000000` / `-20.000000` |
| `native_print.sheet` | 0 | yes | 0 | `99.000000` / `7.000000` / `6.000000` / `42.000000` |
| `native_string.sheet` | 0 | yes | 0 | `Hello, world` / `SheetLang` |
| `native_mixed.sheet` | 0 | yes | 0 | `Order Summary` / `150.000000` / `15.000000` / `135.000000` |

**Invalid inputs:** all 3 (`native_semantic_error.sheet`,
`native_syntax_error.sheet`, `native_invalid_character.sheet`) confirmed
exit 1, with the requested output file confirmed **not** to exist
afterward (checked directly, not assumed).

**`--compile` with no `-o`:** confirmed exact error message, exit 1.

**Full Phase 3/4/5/6 regression:** all 20 previously-verified tests
re-run and confirmed unchanged (`--tokens`, `--ast` × 2 valid/invalid,
`--check` × 6, `--deps` × 3, `--graph-test`, `--ir` × 6).

**Determinism:** the same source compiled 3 times in a row — compiler
exit code, generated stdout/stderr messages, and runtime output were all
identical across all 3 runs; the 3 resulting binaries were also
byte-identical (via `md5sum`) **in this specific test environment**. This
is **not** claimed as an architectural guarantee — object files can
contain build-path or timestamp metadata that varies across machines or
toolchain versions, so byte-for-byte binary determinism across different
environments is a weaker claim than "the compiler's own behavior and
generated IR are deterministic" (which Phase 6 already established and
this phase does not change).

**Repeated compilation / temp-file cleanup:** 10 back-to-back
`--compile` runs left zero leftover `.sheetlang.o` or linker-stderr temp
files.

**Memory safety:** full build under `-fsanitize=address,undefined`, then
ran: all 6 valid examples through `--compile` (checking the *compiler
process itself*, not the generated binaries, for sanitizer errors), all
3 invalid examples, 5 repeated compilations of the same file, and the
entire existing Phase 3–6 mode matrix (`--tokens`, `--ast`, `--check`,
`--deps`, `--graph-test`, `--ir`) for every relevant example file. Zero
sanitizer errors anywhere.

## Bugs found and fixed during Phase 7 development

- **Build failure: `llvm/Support/Host.h` not found.** In the LLVM version
  available for local testing, `getDefaultTargetTriple()`'s declaration
  has moved to `llvm/TargetParser/Host.h`. Fixed by updating the
  `#include`. (If LLVM 22.1.8 on the user's Mac still has the old path
  available as a compatibility forwarding header, this include would
  work either way; if not, this fix is required there too.)
- **Build failure: `llvm::sys::fs::perms::all` / `set_permissions` not
  found.** An initial version of this code tried to explicitly chmod the
  output executable after linking. This used APIs that don't exist in
  the tested LLVM version. Rather than chase version-specific
  permission-API names, this code was **removed entirely** — the linker
  itself already produces an executable file with correct permissions,
  which was directly confirmed (`ls -la` showing `-rwxr-xr-x` on every
  produced binary in testing) rather than assumed.

## LLVM API notes / platform testing honesty

**Tested on:** Linux (the sandbox environment), LLVM **18.1.3**, `cc`
resolving to system GCC/Clang. This is the same environment-availability
constraint as Phase 6.

**NOT tested:** macOS, Apple Silicon, LLVM 22.1.8, or Xcode Command Line
Tools' `cc`. The design was made deliberately platform-generic
specifically to minimize risk on the untested target — no Homebrew paths,
no macOS-specific linker flags, no assumption about which architecture
`native` resolves to, and `Reloc::PIC_` used unconditionally because it
is required on Apple Silicon (not merely "harmless" there). The `native`
LLVM pseudo-component and `TargetParser/Host.h` path are both
longstanding LLVM API shapes that are expected to hold on version 22, but
that expectation has not been verified against a real LLVM 22.1.8 build,
and this README says so explicitly rather than implying otherwise.

## Known Phase 7 limitations

- No optimization passes are applied at any stage (unchanged from Phase
  6, deliberately out of scope).
- `IF`/comparisons and built-in function calls remain un-code-generated
  (unchanged from Phase 6) — a SheetLang program using them fails at the
  LLVM-generation stage, before `--compile` ever reaches native code
  generation.
- No cross-compilation support — `NativeCodeGenerator` always targets the
  host machine it's running on.
- Binary-level determinism (byte-identical executables) is not an
  architectural guarantee (see "Determinism" above) — only compiler
  behavior, error handling, and generated LLVM IR are.
- Linking depends on an external `cc`/`clang`/`gcc` being present on
  `PATH`; if none is found, `--compile` fails with a clear, specific
  error rather than attempting a fallback linking strategy.

# Phase 8 — Control Flow and Functions

Phase 8 adds **user-defined functions** to SheetLang and gives the
**already-existing** `IF`/`ELSE`/comparison constructs real LLVM code
generation for the first time. There is no externally supplied Phase 8
spec for this project; the scope below was defined for this development
cycle (control flow + functions), per the project owner's instruction.

## A design decision made before writing any code

The originally suggested syntax for this phase (`IF cond { } ELSE { }`,
bare `X = ...` assignment) directly conflicts with what SheetLang already
has: **`IF`/`ELSE`/`ENDIF` and all six comparison operators
(`> < >= <= == !=`) have existed in the grammar, AST, and semantic
analyzer since Phase 3** — `ComparisonNode` and `IfNode` were already
fully built; only LLVM codegen was ever missing (Phase 6/7 explicitly
deferred it, see their READMEs). Building a second, brace-delimited IF
construct alongside the working keyword-delimited one would mean a
parallel compiler path for the same feature — exactly what this project
has consistently avoided since Phase 4 (see that README's "STRING as
factor" decision for the same kind of call made the same way).

**Decision:** keep the existing `IF condition ... [ELSE ...] ENDIF`
syntax and existing `LET` requirement completely unchanged. Phase 8's
only grammar-level addition is the genuinely new construct — functions —
using `FUNCTION name(params) ... ENDFUNCTION`, consistent with the
existing `SHEET...END` / `IF...ENDIF` keyword-terminated block
convention, rather than introducing a second, inconsistent
brace-delimited block style into the same language.

## New syntax

```
FUNCTION name(param1, param2, ...)
    statements
    RETURN expr        -- optional; see "Functions without RETURN" below
ENDFUNCTION
```

- Zero, one, or many parameters (`FUNCTION hello()`, `FUNCTION square(A)`,
  `FUNCTION add(A, B)`).
- Calling a function is exactly the existing function-call syntax
  (`name(args)`), reused unchanged from `SUM`/`AVG`/etc. — a user
  function call can appear anywhere an expression can (`LET X =
  square(5) + 10`, `PRINT add(10, 20)`), and can also appear as a bare
  statement to call it for side effects only (`hello()`), discarding any
  return value.
- `RETURN expr` is only legal inside a function body — used elsewhere, it
  is a semantic error (`RETURN used outside a function`), not silently
  accepted.

`IF`/`ELSE`/comparisons: unchanged syntax, now with real code generation:

```
IF A > B
    PRINT A
ELSE
    PRINT B
ENDIF
```

## Functions without RETURN

SheetLang has no `void` type. A function whose body falls off the end
without executing a `RETURN` on that path implicitly returns `0.0` —
this is generated automatically (an implicit `ret double 0.0` is emitted
if the current block has no terminator when the body finishes). Calling
such a function as a bare statement (`hello()`) simply discards the
returned `0.0`, exactly like discarding the result of any other
expression. This is the simplest naturally-supported "void-like"
behavior given SheetLang's single value type, rather than inventing a
second function-return-type system.

## Function scoping

A function body is analyzed and generated against a **snapshot** of the
enclosing scope at the point the function is declared, plus its own
parameters (always `NUMBER` — there are no parameter type annotations).
Concretely:

- **Semantic analysis:** `SymbolTable` is a plain value type (just wraps
  an `unordered_map<string, Symbol>`), so the analyzer copies it before
  analyzing a function body, adds the parameters to the copy (shadowing
  any same-named global for the duration of the body), analyzes the
  body against that copy, then **discards** the copy and restores the
  real one — so nothing the body declares (including its own parameters)
  leaks into the global scope, while the body can still see every global
  declared *before* the function (consistent with declare-before-use).
- **Code generation:** the same idea, at the LLVM level — `numericVars_`/
  `stringVars_` are saved, cleared, repopulated with the function's
  parameter allocas, used while generating the body, then restored.

Global variables declared **after** a function are correctly invisible
to that function's body — this is just declare-before-use, unchanged.

## Recursion is a semantic error, not a special-cased check

A function's own name is added to the semantic analyzer's function table
**only after its body has finished being analyzed** — while the body is
being checked, a call to the function's own name is indistinguishable
from a call to a function that doesn't exist yet, and is correctly
rejected as `Unknown function`. The same ordering is unnecessary in
`LLVMCodeGenerator` (it never runs on a program that failed semantic
analysis, so a would-be-recursive call can never reach codegen in the
first place). This means recursion — explicitly out of scope for Phase
8 — falls out naturally from the existing declare-before-use rule rather
than needing a dedicated "no recursion" check.

## LLVM IR generation

- **Comparisons:** `CreateFCmpOGT/OLT/OGE/OLE/OEQ/ONE` (ordered
  floating-point compares — SheetLang `NUMBER`s can never be NaN, so
  ordered vs. unordered semantics don't actually differ for any valid
  program; ordered was chosen because it matches normal mathematical
  comparison intuition). Only ever generated for an `IF` condition
  (`genCondition`, called from `genIf`) — a comparison used as a general
  expression value remains an explicit, documented error, since
  SheetLang has no boolean value type to hold one.
- **IF/ELSE:** real basic blocks (`then` / optional `else` / `ifcont`)
  and a `CreateCondBr`. A block that already ends in a `ret` (from a
  `RETURN` inside that branch) is not given a second, illegal terminator
  — checked via `getTerminator()` before adding the fallthrough branch to
  `ifcont`.
- **Functions:** every user function has LLVM signature
  `double(double, double, ...)` — one `double` parameter per SheetLang
  parameter, `InternalLinkage` (never called from outside the generated
  module). Parameters are stored into their own `alloca`s immediately on
  entry, so the rest of code generation treats them identically to any
  other variable.
- **Calls:** `CreateCall` to the corresponding `llvm::Function*`, looked
  up by name in a `userFunctions_` map populated as each `FUNCTION` is
  generated.
- **Return:** `CreateRet`.
- `llvm::verifyModule` still runs before any native code generation,
  exactly as in Phase 6/7 — unchanged.

## Dependency analysis: no changes needed

Per the project's existing dependency-graph architecture, **zero changes
were made** to `DependencyGraph`/`DependencyAnalyzer`. This is
deliberate, not an oversight:

- `DependencyAnalyzer::visitStatement`'s `switch` already has a
  `default: break` for any statement kind it doesn't recognize — new
  Phase 8 statement kinds (`FunctionDecl`, `Return`, a bare function-call
  statement) safely fall through it untouched, confirmed by testing (no
  crash, no incorrect edges).
- A function **call** used as the right-hand side of a variable
  assignment (`LET X = square(A)`) already produces correct dependency
  edges with **no changes at all** — `collectReferences` already
  recursively walks `FunctionCallNode`'s arguments (this is existing
  Phase 5 behavior), so `LET X = square(A)` correctly creates edge
  `X -> A`, exactly as if `square(A)` were any other expression.
- A function's **body** (its own internal statements) is intentionally
  **not** walked into the global dependency graph at all — a
  `FunctionDeclNode` is simply an unrecognized statement kind from
  `DependencyAnalyzer`'s point of view, so its internal `LET`s never
  become global spreadsheet-style dependency nodes. This is correct:
  function-local variables aren't global cells/variables and shouldn't
  appear in the same graph as them.
- Undefined function references are rejected by `SemanticAnalyzer`
  (which runs before `DependencyAnalyzer` in every pipeline mode), not
  by the dependency graph — consistent with how undefined *variable*
  references have always been the semantic analyzer's job, not the
  dependency graph's.

## Example commands

```bash
./sheetc --check ../examples/phase8_function_call.sheet
./sheetc --ir ../examples/phase8_combined.sheet
./sheetc --compile ../examples/phase8_combined.sheet -o phase8_combined
./phase8_combined
```

## Test programs

| File | Tests |
|---|---|
| `phase8_if.sheet` | `IF` with no `ELSE` |
| `phase8_if_else.sheet` | `IF`/`ELSE`, both branches |
| `phase8_comparison.sheet` | All six comparison operators |
| `phase8_function.sheet` | Zero-argument function, called as a statement |
| `phase8_function_args.sheet` | One-argument function, called in an expression |
| `phase8_function_call.sheet` | Multi-argument function |
| `phase8_combined.sheet` | Functions containing `IF`/`ELSE` with `RETURN` in each branch; function calls composed into arithmetic |
| `phase8_invalid_function.sheet` | Call to an undefined function |
| `phase8_wrong_args.sheet` | Wrong argument count |
| `phase8_return_outside_function.sheet` | `RETURN` outside any function |
| `phase8_duplicate_function.sheet` | Duplicate function declaration |
| `phase8_undefined_in_function.sheet` | Undefined variable referenced inside a function body |

### Actual verified output

```
$ ./phase8_function_args     # square(5)
25.000000

$ ./phase8_function_call     # add(10, 20)
30.000000

$ ./phase8_combined          # square(5) + 10, then classify(20), classify(3)
35.000000
1.000000
0.000000
```

## Bugs found and fixed during Phase 8 development

- **Real crash / LLVM verifier failure on every top-level `IF`.**
  `genIf` creates new basic blocks attached to `currentFunction_`, but
  `generate()` never initialized `currentFunction_` to `mainFn` when
  starting top-level code generation — it stayed `nullptr` for any `IF`
  outside a user function. This produced basic blocks with no parent
  function, which either crashed outright (confirmed via a real SIGSEGV,
  exit code 139) or failed LLVM's module verifier with "Referring to a
  basic block in another function!" / "parentless instruction", depending
  on the exact program. Root cause found and fixed by setting
  `currentFunction_ = mainFn` immediately after creating `main` in
  `generate()`. Retested: all 7 valid Phase 8 examples now generate,
  verify, compile, and run correctly.

## Known Phase 8 limitations

- `ELSE IF` is not implemented (out of scope, per this cycle's
  definition) — use nested `IF`/`ELSE` instead.
- No loops (`WHILE`/`FOR`), recursion, arrays, structs, classes,
  closures, function pointers, higher-order functions, or logical
  operators (`&&`/`||`/`!`) — all explicitly out of scope for this cycle.
- Built-in functions (`SUM`/`AVG`/`MAX`/`MIN`/`ABS`) still have no LLVM
  codegen (unchanged since Phase 6) — only user-defined `FUNCTION`s are
  code-generated.
- A function whose every path returns (e.g. an `IF`/`ELSE` where both
  branches `RETURN`) still gets a trailing, unreachable `ifcont` block
  with an implicit `ret double 0.0` — harmless (LLVM permits unreachable
  blocks with terminators; module verification passes), but not
  eliminated, since dead-block removal is an optimization and Phase 6/7
  established that this project applies zero optimization passes.
- Duplicate **parameter names** within one function's own signature
  (e.g. `FUNCTION f(A, A)`) are not specially detected — not required by
  any test case, not implemented, documented here rather than silently
  left unspecified.
- Function declarations nested inside an `IF` block are grammatically
  legal (a `FUNCTION` is just another `stmt` alternative) but were not
  tested — all required/example programs declare functions at the
  top level of the `SHEET` body.
- As with Phase 7's `NativeCodeGenerator`, this sandbox has LLVM 18, not
  the target LLVM 22.1.8 — see the LLVM API notes above; the same
  scratch-copy testing methodology was used for `--compile` verification
  in this phase too, with the real project's LLVM-22-only
  `NativeCodeGenerator.cpp` left untouched throughout.


# Phase 9 — Interactive Compiler IDE

Phase 9 adds a web-based **SheetLang Compiler Playground**: a browser IDE
that lets someone type SheetLang source, click Compile, and watch it move
through the real compiler pipeline — real tokens, real AST, real semantic
diagnostics, real dependency graph, real LLVM IR, real assembly, real
native compilation, and real execution. This is a presentation/
integration layer on top of the compiler, not a second implementation of
it.

## Architecture

```
Browser
   ↓
Frontend (React + TypeScript + Vite + Tailwind + Monaco)
   ↓  fetch("/api/compile", { source })
Backend (Node.js + Express)
   ↓  child_process.execFile(SHEETC_PATH, [...argv])   -- argument arrays, never shell strings
sheetc  (this project's real, unmodified-except-one-mode compiler)
   ↓
LLVM 22.1.8
   ↓
Native executable  →  actually run, real stdout/exit code captured
```

**Project layout:**
```
SheetLang9/
├── compiler/     Phase 1-8 project (this README lives here), plus one
│                 additive CLI mode for Phase 9 (--asm, see below)
├── backend/      Node/Express API wrapping sheetc
├── frontend/     React/Vite/TS/Tailwind/Monaco IDE
└── docs/
```

## The one compiler change: `--asm`

`NativeCodeGenerator` only ever emits an **object file** (never a `.s`
text file) — there was no existing way to show real assembly in the UI.
Rather than modify `NativeCodeGenerator.cpp`/`.h` (explicitly told not to
unless genuinely necessary), a new, self-contained `--asm <file> [-o
out.s]` CLI mode was added directly in `main.cpp`, mirroring the existing
`--ir` mode's structure exactly: same pipeline (parse → semantic →
dependency → LLVM IR), then a local `TargetMachine` (built the same
`llvm::Triple`-based way as `NativeCodeGenerator`, for LLVM 22
consistency) emits `CodeGenFileType::AssemblyFile` instead of
`CodeGenFileType::ObjectFile`. `NativeCodeGenerator.cpp`/`.h` are
completely untouched. **This is the only compiler source change made in
Phase 9.**

## How the website actually invokes `sheetc`

For a single `/api/compile` request, the backend:
1. Validates the source (non-empty, ≤20KB).
2. Creates an isolated `os.tmpdir()/sheetlang/<uuid>/` directory (a fresh
   UUID per request — one request can never see or overwrite another's
   files).
3. Writes `source.sheet` into that directory.
4. Runs the **real** `sheetc` binary, once per stage, via
   `child_process.execFile` with an **argument array**
   (`["--tokens", "source.sheet"]`, etc.) — never a concatenated shell
   string, so nothing in the user's source can ever be interpreted as a
   shell command.
5. Stops at the first stage that actually fails (mirroring the compiler's
   own real behavior), marking every remaining stage `"skipped"`.
6. On a fully successful compile, actually **executes** the produced
   binary (same `execFile`-with-timeout pattern) and captures its real
   stdout/stderr/exit code.
7. Deletes the entire job directory afterward, success or failure.

Every field in the JSON the frontend receives is either raw `sheetc`
output or a light parse of that output (see `backend/src/parsers.js`) —
there is no separate frontend or backend implementation of lexing,
parsing, semantic analysis, or code generation anywhere in this layer.

## Running it

**Compiler** (unchanged process, plus the new `--asm` mode):
```bash
cd compiler
rm -rf build && mkdir build && cd build
cmake .. && cmake --build . -j
```

**Backend:**
```bash
cd backend
npm install
SHEETC_PATH=../compiler/build/sheetc npm start
# listens on http://localhost:4000
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
# http://localhost:5173, proxies /api to http://localhost:4000 (see vite.config.ts)
```

## API

- `POST /api/compile` — body `{ "source": "SHEET ... END" }`, returns the
  full structured pipeline result (stages, tokens, ast, symbols,
  semantic, dependencies, llvmIr, assembly, build, execution).
- `GET /api/examples` — list of `{ id, label, file }` for every bundled
  example (a curated subset of `compiler/examples/*.sheet`).
- `GET /api/examples/:id` — `{ id, label, source }`, real file content
  read from disk on every request (never cached/inlined into the
  frontend).
- `GET /api/health` — `{ ok, sheetcPath, sheetcExecutable }`.

## Security

- `execFile` with argument arrays only — no shell string interpolation
  anywhere in the backend.
- Per-request UUID temp directory; deleted unconditionally after the
  request (`fs.rm(..., { recursive: true, force: true })` in a `finally`-
  equivalent path covering both success and error).
- Hard timeout on every `sheetc` invocation (8s) and on running the
  produced executable (5s) — `execFile`'s built-in `timeout` option,
  which sends the process a kill signal.
- Request body capped at 64KB (`express.json({ limit: "64kb" })`);
  source itself additionally capped at 20KB inside `compile()`.
- Output capped at 2MB per stage (`maxBuffer`) so a pathological program
  can't exhaust server memory.
- No arbitrary file paths accepted from the frontend — the only path
  handed to `execFile` for execution is the one the backend itself just
  produced inside that request's own temp directory.

## Honest scoping decisions

- **Dependency graph is list-based, not a draggable node graph.** Time
  tradeoff, stated here rather than discovered later: the panel shows
  real `depends on` / evaluation-order data parsed from actual `--deps`
  output, but as a clean list rather than a React Flow canvas.
- **Symbol table is derived from real `--ast` output**, not a dedicated
  compiler symbol-table dump (no such mode exists in `sheetc`). It lists
  declared identifiers (assignment targets) with no line numbers, since
  the text AST printer doesn't include them — labeled explicitly as
  "declared identifiers, derived from the compiler's real AST output" in
  the UI, not presented as more than that.
- **No parse-tree-vs-AST distinction** — `sheetc` only has one `--ast`
  mode; the UI shows that one real tree, not a fabricated second one.
- **Object files are not downloadable** — `NativeCodeGenerator` deletes
  its temporary `.o` file immediately after linking (unchanged Phase 7
  behavior), so there is nothing on disk to serve; the Build panel labels
  this explicitly rather than offering a broken download link.

## Testing performed

**Backend, actually tested** against a real compiled `sheetc` binary
(see "Environment" below for why a scratch build was used instead of the
shipped project):
- `/api/health`, `/api/examples`, `/api/examples/:id` — all return real
  data.
- Full valid compile (`student.sheet` content) through all 11 stages —
  real 42-token stream, real AST-derived symbols, real dependency graph
  (`Average → Total → {Chemistry, Maths, Physics}`), real verified LLVM
  IR (1 function, 4 basic blocks), real native compile + link + run,
  real stdout `Distinction / 255.000000 / 85.000000` (hand-verified
  against the source).
- Semantic error, syntax error, and lexical error cases — pipeline stops
  at the correct real stage each time, later stages `"skipped"`, real
  error text and line numbers (e.g. `"Undefined identifier 'Unknown'" at
  line 4`).
- **Full integration matrix** (all 12 required valid examples + all 8
  required invalid examples from the Phase 9 spec, run against the
  actual `/api/compile` endpoint): 12/12 valid examples compiled and
  executed with exit code 0; 8/8 invalid examples correctly returned
  `success: false` with no executable produced. One real bug was found
  and fixed during this pass (below).
- Repeated compiles leave no leftover temp directories (`fs.rm` cleanup
  verified).

**Frontend, actually tested:**
- `tsc --noEmit` — zero type errors.
- `npm run build` — succeeds, produces a working `dist/`.
- `vite preview` on the built output — serves HTTP 200.
- Not tested: interactive browser exercise of every UI control (clicking
  through tabs, dragging, etc.) — this environment has no browser/display
  to drive; the build+serve smoke test above and the component code
  itself are what was verified, not a full manual click-through.

**Compiler regression:** all Phase 3–8 example categories (`--tokens`,
`--ast` ×2, `--check` ×2, `--deps`, `--graph-test`, `--ir`, `--compile` ×3
including one Phase 8 function+control-flow program) re-run via the
scratch binary — all unchanged from their Phase 8 results.

## Bug found and fixed during Phase 9 testing

`phase8_invalid_function.sheet` (the "Undefined Function" required test
case) was missing from the backend's `EXAMPLES` list — `GET
/api/examples/phase8_invalid_function` returned 404. Found during the
required integration test matrix, not assumed correct. Fixed by adding
the missing entry; retested and confirmed the endpoint now returns the
real file content and the compile endpoint correctly reports `Unknown
function 'unknown'` at line 3.

## Environment honesty

This sandbox has **LLVM 18.1.3**, not the target **LLVM 22.1.8** (same
constraint as every prior phase in this project). All backend/integration
testing above used a **disposable scratch build** of `sheetc` — a copy of
this exact `compiler/` tree with a temporary, version-gated
`#if LLVM_VERSION_MAJOR < 22` shim applied *only* to that scratch copy,
built, pointed at via the backend's `SHEETC_PATH` environment variable,
tested, and then deleted. The shim was never applied to, and never
included in, the shipped `compiler/` source — confirmed by `grep
LLVM_VERSION_MAJOR` returning no matches in the real project both before
and after this testing pass. The real, shipped `compiler/` continues to
use the unconditional `llvm::Triple`-based LLVM 22 API calls established
in the earlier Phase 7 LLVM-22-compatibility fix, unchanged.

**Not tested:** the actual website running against a real LLVM
22.1.8/macOS/Apple Silicon build of `sheetc`, or in an actual web browser.
Both are expected to work given the backend only shells out to whatever
binary `SHEETC_PATH` points at, but neither has been verified directly.

## Known limitations

- Dependency graph and symbol table are intentionally simpler than the
  spec's suggested draggable-graph/full-table designs (see "Honest
  scoping decisions" above).
- No download endpoints for LLVM IR/assembly/object files were
  implemented (copy-to-clipboard is implemented for tokens, AST, LLVM IR,
  and assembly via the `CopyButton` component) — a reasonable Phase 9.1
  addition, not built here due to time.
- No automated frontend test suite (e.g. Playwright/Vitest component
  tests) — verified via TypeScript compilation, production build, and a
  build-output smoke test instead.
- The UI's "Pending → Running → Success/Failed/Skipped" stage states are
  driven by the real backend response after it completes, not a live
  streaming update per stage as the compiler runs (the backend currently
  returns one complete JSON response per compile request, not a
  streaming/WebSocket connection) — the progression animation in the UI
  plays back the real per-stage results and real per-stage timings
  received, rather than an artificial delay.
