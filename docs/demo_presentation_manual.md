# SheetLang Project Demonstration & Faculty Evaluation Manual

This manual is a step-by-step presentation guide designed for demonstrating the **SheetLang** compiler, CSV reactivity engine, and telemetry analytics platform to faculty evaluators.

---

## 1. Project Summary & Elevator Pitch

> *"Most spreadsheet macro tools (like Excel VBA or Python scripts) are slow because they run inside an interpreter or virtual machine. **SheetLang** is a domain-specific compiler that treats CSV spreadsheets as reactive first-class memory cells ($A1, B2\dots$) and compiles formulas directly into **native machine code via LLVM 18**. This guarantees raw native C++ performance with full static type verification, circular-dependency detection, and sub-millisecond execution times."*

---

## 2. Architecture & 12-Stage Visual Pipeline

SheetLang provides complete transparency into how a compiler works from source to binary:

```
[ SheetLang Source + Attached CSV ]
             ↓
[ Stage 01 ] Flex Lexical Scanner       (Tokenizes characters, numbers, cells)
[ Stage 02 ] Bison LALR(1) Parser       (Validates grammar & constructs AST)
[ Stage 03 ] AST Construction           (Hierarchy of expression trees)
[ Stage 04 ] Symbol Resolver            (Scope, identifiers, and cell mappings)
[ Stage 05 ] Semantic Typecheck         (Type safety, function arity, declare-before-use)
[ Stage 06 ] Dependency Analysis        (Cycle detection and topological ordering)
[ Stage 07 ] LLVM 18 IR Generation      (SSA form verified via llvm::verifyModule)
[ Stage 08 ] Target Machine Assembly    (Hardware-specific assembly emission)
[ Stage 09 ] ELF Object Generation      (Machine code emission)
[ Stage 10 ] Native Host Linker         (Links with C runtime memory allocator)
[ Stage 11 ] Executable Binary          (Native executable created in sandboxed tmp)
[ Stage 12 ] Real Runtime Execution     (Direct execution with stdout/stderr capture)
             ↓
[ SQLite Telemetry ] → [ CSV Export ] → [ Power BI Desktop Analytics ]
```

---

## 3. Live Demonstration Walkthrough (3-Minute Script)

### Step 1: Launch the Platform
1. Open the terminal and run:
   ```bash
   # Terminal 1: Backend API (port 3001)
   cd backend && npm run dev

   # Terminal 2: Frontend Studio (port 5173)
   cd frontend && npm run dev
   ```
2. Navigate to `http://localhost:5173` in your browser.
3. Show the **Overview Page**:
   - Highlight the **10-stage architecture strip**.
   - Show the live **LLVM RUNTIME ONLINE** health probe in the navbar.

---

### Step 2: Live CSV Data Processing & Macro Aggregation
1. Click **Studio IDE** in the top navigation.
2. In the left **Program Scripts** explorer, click on **`csv_aggregations.sheet`** under the **CSV Features** category.
3. Click the **"Attach CSV"** button in the top dock and select `sample_data.csv`:
   - *Point out the reactive Data Grid:* The CSV renders side-by-side with columns labeled $A, B, C$ and row indices $1, 2, 3, 4$.
4. Show the code:
   ```sheetlang
   SHEET Aggregations

   // Range aggregations automatically map over the uploaded CSV
   LET total = SUM(A1:A5)
   LET average = AVG(A1:A5)
   LET count = COUNT(A1:A5)
   LET maximum = MAX(A1, A2)
   LET minimum = MIN(A1, A2)

   PRINT total
   PRINT average
   PRINT count
   PRINT maximum
   PRINT minimum

   END
   ```
5. Click **Build & Execute** (or press `Ctrl+Enter` / `Cmd+Enter`):
   - Show that **all 12 stages** pass with green checkmarks.
   - Point out the **Runtime Output** tab:
     - `total = 700.0` (sums $100 + 150 + 200 + 250$, skips empty row 5)
     - `average = 175.0`
     - `count = 4.0`
     - `maximum = 150.0`
     - `minimum = 100.0`
   - Point out the latency in the top dock: **~35ms total compile time**.

---

### Step 3: Native Dynamic String Operations
1. In the file explorer, click **`csv_string_operations.sheet`**.
2. Show the string cleaning functions:
   ```sheetlang
   SHEET StringOperations

   LET text1 = "  SheetLang  "
   LET text2 = "Rocks!"

   LET cleaned = TRIM(text1)
   LET upper_text = UPPER(cleaned)
   LET lower_text = LOWER(cleaned)
   LET final = CONCAT(CONCAT(cleaned, " "), text2)

   PRINT cleaned
   PRINT upper_text
   PRINT lower_text
   PRINT final

   END
   ```
3. Click **Build & Execute**:
   - Emphasize to the faculty that string pointers are dynamically allocated in heap memory using a custom C runtime (`runtime.c`) linked into the native binary.

---

### Step 4: Compiler Internals & LLVM Verification
1. Click **Compiler Core** in the top navigation (or inspect the right-hand tabs in the Studio IDE).
2. Show the faculty the actual generated artifacts:
   - **AST Tree:** Recursive syntax tree representation.
   - **Dependencies:** DAG displaying topological sort and cycle-checking.
   - **LLVM IR:** Real SSA-form LLVM Intermediate Representation verified by `llvm::verifyModule`.
   - **Assembly:** Actual x86_64 / ARM machine assembly code emitted for the CPU.

---

### Step 5: Power BI & Telemetry Reporting
1. Click **Audit Log** in the navbar:
   - Show the table of every compilation logged to SQLite (`backend/data/sheetlang.db`) with sub-millisecond stage breakdowns.
2. Click **Analytics** in the navbar:
   - Show the **Live SQLite Database Snapshot** with success rate and latency sparklines.
   - Click **Download dataset.csv** (or open `sheetlang_compilations.csv` from the repo root).
3. Open **Power BI Desktop** (on Windows):
   - Import `sheetlang_compilations.csv`.
   - Show the faculty the 4 pages defined in `docs/powerbi_setup.md`:
     1. **Executive Overview:** KPI cards (Total Compilations, Success Rate %, Latency Trend).
     2. **Compiler Internals:** Bar chart comparing average time per stage (`lexer_ms`, `parser_ms`, `llvm_ms`, etc.).
     3. **Error Distribution:** Breakdown of failed stages.

---

## 4. Key Questions Faculty May Ask & How to Answer

| Question | Strong Technical Answer |
|---|---|
| **"Why create a DSL instead of using Python or Pandas?"** | Python is an interpreted language with heavy runtime dependencies. SheetLang compiles spreadsheet expressions into standalone, native machine code via LLVM with zero VM overhead, guaranteeing sub-millisecond startup and predictable execution. |
| **"How does SheetLang handle circular references like `A1 = A1 + 1`?"** | During Stage 06 (Dependency Analysis), SheetLang constructs a directed acyclic graph (DAG) of all cell references. If a cycle or self-reference is detected, compilation halts before codegen with a clear cycle diagnostic error. |
| **"How are CSV files injected into the compiler?"** | When a CSV is attached, the backend preprocessor translates tabular rows into typed cell allocations ($A1 = 100, B1 = 250$). Range functions like `SUM(A1:A5)` are expanded into explicit topological operations, automatically skipping blank cells. |
| **"How are strings handled in LLVM?"** | Numbers are standard IEEE 754 64-bit doubles. For strings, SheetLang uses an external C runtime (`runtime.c`) that allocates `char*` buffers via `malloc`, allowing `CONCAT`, `UPPER`, `LOWER`, and `TRIM` to link against standard C library routines. |
