# SheetLang — Educational Compiler + Web IDE

A from-scratch compiler for **SheetLang**, a spreadsheet-inspired DSL,
paired with a real, backend-connected **Compiler Playground**: a web IDE
where you type SheetLang source and watch it move through the actual
compiler pipeline — real tokens, real AST, real semantic diagnostics,
real dependency graph, real LLVM IR, real assembly, real native
compilation, and real execution.

Full per-phase compiler documentation (Phases 1–8: lexer → parser → AST
→ semantic analysis → dependency analysis → LLVM IR → native code
generation) lives in `compiler/README.md`. This file covers the Phase 9
web IDE and how to run the whole stack.

## Features

- Custom hand-written lexer (Flex) and parser (Bison)
- AST construction with a real tree printer
- Semantic analysis: declare-before-use, type checking, function
  arity/duplicate/scope checking
- Dependency analysis with cycle detection
- LLVM IR generation (verified via `llvm::verifyModule`)
- Native code generation: real object files, real linking, real
  executables (LLVM 22.1.8, `llvm::Triple`-based target machine)
- Real generated assembly (`--asm`, added in Phase 9)
- **Web-based Compiler Playground** — a real IDE, not a mockup, wired to
  the actual `sheetc` binary through an Express API

## Architecture

```
React Frontend  (Monaco editor, pipeline view, real-data output tabs)
       ↓  fetch("/api/compile", { source })
Express Backend  (TypeScript, child_process.execFile — argument arrays only)
       ↓  spawns the real, unmodified sheetc binary, once per stage
sheetc
       ↓
  Lexer  →  Parser  →  AST  →  Semantic Analyzer  →  Dependency Analyzer
       ↓
  LLVM IR Generation  →  llvm::verifyModule
       ↓
  Native Code Generator  (object emission + real system linker)
       ↓
  Executable  →  actually executed, real stdout/stderr/exit code captured
```

Every field the frontend renders traces back to a real `sheetc`
invocation for that specific request. There is no second lexer, parser,
semantic analyzer, or LLVM-IR generator anywhere in `backend/` or
`frontend/` — see `compiler/README.md`'s Phase 9 section and
`backend/src/parsers.ts` for the exact, narrow adapter logic used to
turn the compiler's real text output into structured JSON.

## Project structure

```
SheetLang9/
├── compiler/     Phases 1-8 (frozen; one additive Phase 9 CLI mode: --asm)
├── backend/      Node.js + Express + TypeScript API
├── frontend/     React + TypeScript + Vite + Tailwind + Monaco
├── docs/
├── README.md     (this file)
└── .gitignore
```

## Run instructions

### 1. Build the compiler

```bash
cd compiler
rm -rf build
mkdir build
cd build
cmake ..
cmake --build . -j 2
```

This produces `compiler/build/sheetc`. Requires LLVM 22.1.8, Flex ≥2.6,
Bison ≥3.x, and CMake — see `compiler/README.md` for the full toolchain
and platform notes (this project targets macOS/Apple Silicon).

### 2. Configure the backend

```bash
cd ../../backend
cp .env.example .env
```

Edit `.env` and set `SHEETC_PATH` to the **absolute** path of the binary
built in step 1, e.g.:

```
SHEETC_PATH=/Users/you/SheetLang9/compiler/build/sheetc
PORT=3001
```

### 3. Install and run the backend

```bash
npm install
npm run dev
```

This starts the API on `http://localhost:3001`. Check
`http://localhost:3001/api/health` — it should report
`"compiler": "available"`. If it reports `"unavailable"`, the console
will print exactly why (missing/invalid `SHEETC_PATH`).

### 4. Install and run the frontend

```bash
cd ../frontend
npm install
npm run dev
```

### 5. Open the browser

Visit `http://localhost:5173`. The Vite dev server proxies `/api/*` to
`http://localhost:3001` (see `frontend/vite.config.ts`).

## API

- `GET /api/health` → `{ status, compiler: "available"|"unavailable", sheetcPath, reason? }`
  — `compiler` reflects a real filesystem check (`fs.access(..., X_OK)`)
  against `SHEETC_PATH`, not a hardcoded value.
- `GET /api/examples` → list of `{ id, label, file, category }`, read
  from a fixed whitelist mapped to real files in `compiler/examples/`.
- `GET /api/examples/:id` → `{ id, label, category, source }` — the
  **real file content**, read from disk on every request (id is
  regex-validated and whitelist-checked; the resolved path is verified
  to stay inside `compiler/examples/` before reading, as defense in
  depth against path traversal).
- `POST /api/compile` → body `{ source: string }`, returns the full
  structured real pipeline result (see `backend/src/pipeline.ts` for the
  exact response shape: `stages[]`, `tokens`, `ast`, `symbols`,
  `semantic`, `dependencies`, `llvmIr`, `assembly`, `optimization`,
  `object`, `build`, `runtime`).

## Security

- `child_process.execFile` with **argument arrays** everywhere — never a
  concatenated/interpolated shell string. Nothing in a user's SheetLang
  source can ever reach a shell interpreter.
- Every compile request gets its own `os.tmpdir()/sheetlang/<uuid>/`
  directory; deleted unconditionally (success or failure) after the
  request completes.
- Compiler-stage timeout: 10 seconds. Runtime (executing the produced
  program) timeout: 5 seconds. Both enforced via `execFile`'s built-in
  `timeout` option.
- Output cap: 1MB per invocation (`maxBuffer`).
- Source size cap: 100KB, enforced both at the JSON body-parser level
  and again explicitly inside `compile()`.
- Example IDs are validated against `^[a-z0-9_]+$` and checked against a
  fixed whitelist before any filesystem access; the resolved path is
  additionally verified to remain inside the examples directory.
- No generic "run a command" endpoint exists. The only executable ever
  run is either the fixed `sheetc` binary or a program `sheetc` itself
  just produced inside that request's own temp directory — never a
  user-supplied path.

## Known honest limitations

- **No LLVM optimization passes are run.** The LLVM IR tab and the Build
  tab both say so explicitly (`optimization.enabled: false` in the API
  response) rather than claiming constant folding / DCE / etc. happened.
- **No dedicated compiler symbol-table dump exists.** The Symbols tab is
  explicitly labeled "AST-derived" and shows identifiers extracted from
  the real `--ast` output, with no line numbers (the text AST printer
  doesn't emit them).
- **Object files are not retained or downloadable.** `NativeCodeGenerator`
  deletes its temporary `.o` immediately after linking (unchanged
  Phase 7 behavior) — the Build tab labels this honestly rather than
  offering a broken download.
- Dependency graph is a real-data **list** view (depends-on / used-by /
  evaluation order), not a draggable node-graph library — a stated time
  tradeoff, not a silent shortcut.
- See `compiler/README.md`'s Phase 9 section for the full environment
  and testing honesty notes (this development environment has LLVM 18,
  not the target LLVM 22.1.8 — all backend testing used a disposable,
  never-shipped scratch build; the real `compiler/` source is untouched
  by that shim).
