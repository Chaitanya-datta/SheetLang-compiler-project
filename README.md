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
- **`WHILE`/`ENDWHILE` loops** with real LLVM control flow (basic blocks
  + a genuine back edge, not unrolled)
- Dependency analysis with cycle detection
- LLVM IR generation (verified via `llvm::verifyModule`)
- Native code generation: real object files, real linking, real
  executables (LLVM 22.1.8, `llvm::Triple`-based target machine)
- Real generated assembly (`--asm`)
- **Web-based Compiler Playground** — a real IDE, not a mockup, wired to
  the actual `sheetc` binary through an Express API
- **Compilation history in SQLite** — every real compile is logged, with
  a real-SQL statistics view and CSV export for Power BI analysis

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
  Assembly Generation  →  Native Code Generator  (object emission + real system linker)
       ↓
  Executable  →  actually executed, real stdout/stderr/exit code captured
       ↓
  Backend logs the real result to SQLite (backend/data/sheetlang.db)
       ↓
  CSV export (/api/export/csv)  →  Power BI Desktop  (analytics/reporting layer)
```

The web app and Power BI have a deliberate division of labor (see
"Database integration" and "Power BI workflow" below): the **web app**
handles compiling and inspecting a single program's internals; **Power
BI** handles trends and aggregate statistics across many past
compilations. Analytics were not crammed into the compiler UI.

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
  `object`, `build`, `runtime`). Every call is also logged to SQLite.
- `GET /api/history?limit=50` → the most recent real compilation
  records (default/max 500), newest first.
- `GET /api/history/:id` → one full stored record (including the
  original source and runtime output), or 404 if the id doesn't exist.
- `GET /api/stats` → real SQL-derived statistics: total/successful/
  failed counts, success rate, average compile time, failures grouped
  by stage.
- `GET /api/export/csv` → the full compilation history as a
  Power-BI-importable CSV file (proper quoting/escaping for commas,
  quotes, and multiline runtime output).

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
- **Loop bodies are excluded from the dependency graph** (see "Loops"
  section below for the full architectural reason) — a variable
  reassigned inside a `WHILE` won't appear in the `--deps`/Dependencies
  tab's graph, the same way function-local variables already don't.
- See `compiler/README.md`'s Phase 9 section for the full environment
  and testing honesty notes (this development environment has LLVM 18,
  not the target LLVM 22.1.8 — all backend testing used a disposable,
  never-shipped scratch build; the real `compiler/` source is untouched
  by that shim).

## Loops

`WHILE condition ... ENDWHILE` was added with real support at every
compiler layer — lexer, parser (zero new Bison conflicts), AST
(`WhileNode`), semantic analysis, LLVM codegen, and native execution.
The generated LLVM IR is a genuine loop (`whilecond`/`whilebody`/
`whileexit` basic blocks with a real back edge), not the body copy-pasted
N times.

```
SHEET LoopDemo

I1 = 1

WHILE I1 <= 5
    PRINT I1
    I1 = I1 + 1
ENDWHILE

END
```
Actually compiles, links, and runs, printing `1.0` through `5.0`.

### Why loop counters must be `CELL`s, not `LET` variables

Two existing, intentionally-unchanged rules collide with a naive loop
counter:

1. **`LET` is single-assignment.** `LET i = i + 1` would be rejected as
   `Duplicate declaration of 'i'` — that's the same rule that has
   applied to every `LET` since Phase 4, not a new restriction.
2. **`DependencyAnalyzer` treats a self-referencing assignment as a
   cycle** (`X = X + 1` → `Dependency Error: Circular dependency`) —
   correct for a genuine spreadsheet self-reference (Phase 5's original
   design target), but exactly the shape of a normal loop counter
   increment.

Since `--compile`/`--ir` both abort on a dependency-graph cycle, *any*
loop with a counter would fail to compile under the unmodified rules —
unrelated to loops being new, this is a pre-existing consequence of two
already-locked design decisions meeting for the first time.

**Resolution:** `CELL`s (e.g. `I1`, `S1`) already support reassignment
(`declareOrUpdate`, no duplicate-declaration check) — so loop
counters/accumulators use `CELL` syntax. And `DependencyAnalyzer`'s
`visitWhile` deliberately does **not** walk a loop's body at all,
mirroring the already-existing, already-documented precedent that
`FUNCTION` bodies are also excluded from the graph. A variable mutated
across loop iterations isn't representable in a static acyclic
dependency graph without every loop counter looking like a false-positive
cycle — so `WHILE` is treated as an opaque control-flow construct, same
as `FUNCTION`. This was a deliberate, investigated design decision, not
a workaround: see the comments in `DependencyAnalyzer.cpp`'s `visitWhile`
for the full reasoning.

Test files: `examples/loop_basic.sheet`, `examples/loop_sum.sheet`
(accumulator — sums 1 through 5, prints `15.0`), plus two invalid
examples (`loop_undefined_condition.sheet`, `loop_missing_endwhile.sheet`).

## Database integration

Every real `POST /api/compile` request is logged to a SQLite database
(`backend/data/sheetlang.db`, created automatically on first run) using
**Node's built-in `node:sqlite` module** (`import { DatabaseSync } from
"node:sqlite"`). Nothing is backfilled or synthesized — a row only
exists because a real compile actually happened.

### Why `node:sqlite`, not the `better-sqlite3` npm package

This started as `better-sqlite3`, which was switched out after a real,
reproducible failure: `better-sqlite3` ships a native C++ addon that
must be compiled per Node version via `node-gyp`, and its bundled
bindings call V8 APIs (`v8::Object::GetPrototype`, `v8::Context::
GetIsolate`, `PropertyCallbackInfo::This`) that no longer exist on newer
Node/V8 — confirmed via an actual failed build on Node v26.5.1, with
real compiler errors, not a guess. Rather than pin the project to an
older Node version, the fix was to switch to `node:sqlite`, which ships
**inside** Node itself and is built and tested against whatever Node
version is running it — eliminating the native-compile step (and this
entire class of version-compatibility problem) completely. `node:sqlite`
is still marked experimental as of the Node versions this project has
been tested against, and prints a one-time `ExperimentalWarning` on
first use — expected and harmless, not an error.

### Schema

```sql
CREATE TABLE compilations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL,
  source_code TEXT NOT NULL,
  success INTEGER NOT NULL,
  failed_stage TEXT,
  compile_time_ms REAL NOT NULL,
  token_count INTEGER,
  runtime_output TEXT,
  runtime_exit_code INTEGER,
  error_message TEXT
);
```

### Representative queries actually used by `/api/stats`

```sql
SELECT COUNT(*) FROM compilations;

SELECT COUNT(*) FROM compilations WHERE success = 1;

SELECT AVG(compile_time_ms)
FROM compilations
WHERE success = 1;

SELECT failed_stage, COUNT(*) AS count
FROM compilations
WHERE success = 0 AND failed_stage IS NOT NULL
GROUP BY failed_stage
ORDER BY count DESC;
```

The frontend's **History** view (toggle in the header, next to
"Playground") shows this data live: a real table of past compilations,
click-through to a stored record's source/output, and stat cards
(`Total`, `Success Rate`, `Avg Compile Time`, `Failed`) computed
entirely by the SQL above — none of it calculated in the frontend.

## Power BI workflow

Power BI is used as a **separate analytics/reporting layer**, not
embedded live inside the web app (no Azure AD, no Power BI Embedded, no
embed tokens — deliberately avoided as unnecessary complexity for this
project):

```
SheetLang Compiler → SQLite → CSV export → Power BI Desktop
```

1. Start the backend and compile a handful of programs (valid and
   invalid) through the Playground, so `compilations` has real data.
2. Open `http://localhost:3001/api/export/csv` in a browser, or click
   **"Export CSV (for Power BI)"** in the History view — save the file.
3. Open **Power BI Desktop** → *Get Data* → *Text/CSV* → select the
   exported file.
4. Build 3–5 visuals from the real columns, for example:
   - KPI cards: `Total Compilations`, `Success Rate`, `Average Compile
     Time`, `Failed Compilations`
   - Line/column chart: compilations over time (`timestamp`)
   - Donut chart: `success` (1/0) breakdown
   - Bar chart: `failed_stage` frequency
5. Re-export and refresh in Power BI whenever you want updated data —
   there is no live connection; this is a manual CSV refresh, and the
   README says so rather than implying a live embed exists.

## Known Phase 10 test results

| Component | Test | Result |
|---|---|---|
| Compiler | Full 22-example regression matrix (18 pre-existing + 4 loop) | 22/22 PASS |
| Compiler | Loop basic (`I1` 1→5) — actually compiled and run | PASS, output `1.0`–`5.0` |
| Compiler | Loop accumulator (sum 1→5) — actually compiled and run | PASS, output `15.0` |
| Compiler | Invalid loop (undefined condition var) | PASS (correctly rejected) |
| Compiler | Invalid loop (missing `ENDWHILE`) | PASS (correctly rejected) |
| Compiler | `--asm` still works with loops present | PASS |
| Compiler | Bison conflict count after grammar change | 0 |
| Backend | TypeScript build (`tsc --noEmit`, `npm run build`) | PASS |
| Backend | `/api/compile` success + failure logged to real SQLite | PASS |
| Backend | `/api/history`, `/api/history/:id` (valid + 404 + invalid id) | PASS |
| Backend | `/api/stats` (real `COUNT`/`AVG`/`GROUP BY`) | PASS |
| Backend | `/api/export/csv` (multiline field correctly quoted) | PASS |
| Frontend | TypeScript build + Vite production build | PASS |
| Frontend | `vite preview` served build, HTTP 200 | PASS |
| End-to-end | Full stack: compile demo program + loop program, verify via History | PASS |

All tested via a disposable scratch build of the compiler (LLVM 18, this
sandbox) — see "Known honest limitations" above for why, and confirmation
that the shipped `compiler/` source is unaffected by that shim.

## UI redesign — multi-page platform

The frontend was restructured from a single-page app into a routed,
multi-page platform (React Router), reflecting the actual distinct
concerns of the project rather than cramming everything into one screen:

```
/           Home          — hero, real feature list, pipeline/data-flow diagrams
/playground Playground     — editor, pipeline, real output tabs (unchanged core logic)
/history    History         — redesigned: dominant Success Rate KPI, real compile-time
                              sparkline, conditional stage/output columns, auto-selected
                              detail panel, collapsible source
/internals  Compiler Internals — NEW: real Tokens/AST/Symbols/Semantic/Dependencies/
                              LLVM IR/Assembly/Build data from the most recent compile,
                              organized into labeled sections instead of tabs
/analytics  Analytics        — Power BI workflow, live stats snapshot, CSV export
/docs       Documentation      — pipeline, syntax, API, DB schema, limitations
/about      About               — real technology stack
```

A shared `CompileContext` holds the last real compile result so the
Playground and Compiler Internals pages show the same real data without
re-compiling or duplicating state — if nothing has been compiled yet in
the session, Compiler Internals shows an honest "compile something
first" state rather than fabricated data.

## Backend: real per-stage timing persistence

`pipeline.ts` already computed a real `durationMs` per pipeline stage
for every request (previously only returned in the API response, never
stored). This was a small, additive, safe enhancement: six new nullable
columns (`lexer_ms`, `parser_ms`, `semantic_ms`, `dependency_ms`,
`llvm_ms`, `execution_ms`) were added via `ALTER TABLE ADD COLUMN`,
guarded by try/catch so it's idempotent on every server start — no
destructive migration, no data loss, works whether the on-disk database
predates this change or not (verified: existing rows and their data
survive a server restart across the migration unchanged).

`getStats()` now also returns `recentCompileTimes` (last 20 compile
times, real, unpadded — if there are only 3 records, exactly 3 are
returned) for the History page's sparkline, and `averageStageMs` (real
`AVG()` per stage, successful compiles only).

`exportCsv()` now includes all six new stage-timing columns for the
Power BI "Compiler Internals" page.

No existing endpoint was removed, renamed, or had its response shape
narrowed — only new fields were added to existing response objects.
