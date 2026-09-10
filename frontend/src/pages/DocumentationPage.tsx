function Sec({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="mb-3 text-[15px] font-semibold text-slate-100">{title}</h2>
      <div className="space-y-3 text-[13px] leading-relaxed text-slate-400">{children}</div>
    </section>
  );
}

function Code({ children }: { children: string }) {
  return <pre className="overflow-auto rounded-md bg-black/40 p-3 font-mono text-[12.5px] text-slate-300">{children}</pre>;
}

export default function DocumentationPage() {
  return (
    <div className="mx-auto max-w-[820px] p-8">
      <div className="mb-8">
        <div className="text-lg font-semibold text-slate-100">Documentation</div>
        <div className="text-[12.5px] text-slate-500">Everything on this page reflects what is actually implemented.</div>
      </div>

      <Sec title="What is SheetLang?">
        <p>
          SheetLang is a small, spreadsheet-inspired programming language with a real compiler:
          hand-written lexer (Flex) and parser (Bison), an AST, semantic analysis, dependency
          analysis, LLVM IR generation, and native code generation producing a real executable that
          actually runs.
        </p>
      </Sec>

      <Sec title="Compiler Pipeline">
        <Code>{`Source Code
   ↓
Lexer (Flex)
   ↓
Parser (Bison) → AST
   ↓
Semantic Analysis
   ↓
Dependency Analysis
   ↓
LLVM IR Generation → llvm::verifyModule
   ↓
Native Code Generation (object emission + system linker)
   ↓
Executable → actually executed`}</Code>
      </Sec>

      <Sec title="Supported Constructs">
        <ul className="list-disc space-y-1 pl-5">
          <li><code>SHEET name ... END</code> — program structure</li>
          <li><code>LET name = expr</code> and <code>CELL = expr</code> (e.g. <code>A1 = 5</code>) — variable/cell assignment</li>
          <li>Arithmetic: <code>+ - * / %</code>, unary minus, parentheses</li>
          <li>Comparisons: <code>&gt; &lt; &gt;= &lt;= == !=</code></li>
          <li><code>IF condition ... [ELSE ...] ENDIF</code></li>
          <li><code>WHILE condition ... ENDWHILE</code> — real LLVM loop control flow with a back edge</li>
          <li><code>FUNCTION name(params) ... ENDFUNCTION</code>, <code>RETURN expr</code>, function calls</li>
          <li><code>PRINT expr</code> (numbers and string literals)</li>
        </ul>
        <p className="text-amber-200/80">
          Not supported: <code>ELSE IF</code>, recursion, arrays, structs, built-in function code
          generation (SUM/AVG/MAX/MIN/ABS are semantically validated but not code-generated), LLVM
          optimization passes.
        </p>
      </Sec>

      <Sec title="Database Architecture">
        <p>Every real compilation is logged to SQLite (<code>backend/data/sheetlang.db</code>) via Node's built-in <code>node:sqlite</code> module:</p>
        <Code>{`compilations
├── id, timestamp, source_code
├── success, failed_stage, error_message
├── compile_time_ms, token_count
├── runtime_output, runtime_exit_code
└── lexer_ms, parser_ms, semantic_ms,
    dependency_ms, llvm_ms, execution_ms`}</Code>
      </Sec>

      <Sec title="API Overview">
        <ul className="list-disc space-y-1 pl-5">
          <li><code>GET /api/health</code> — real filesystem check of the compiler binary</li>
          <li><code>GET /api/examples</code>, <code>GET /api/examples/:id</code></li>
          <li><code>POST /api/compile</code> — runs the full real pipeline, logs the result</li>
          <li><code>GET /api/history</code>, <code>GET /api/history/:id</code></li>
          <li><code>GET /api/stats</code> — real SQL aggregates</li>
          <li><code>GET /api/export/csv</code> — full history as CSV</li>
        </ul>
      </Sec>

      <Sec title="Power BI Workflow">
        <p>See the <a href="/analytics" className="text-indigo-400 hover:underline">Analytics</a> page for the full step-by-step build guide. Summary: export CSV → import into Power BI Desktop → build 4 pages from real columns → re-export/re-import to refresh (no live connection).</p>
      </Sec>

      <Sec title="Future Enhancements">
        <ul className="list-disc space-y-1 pl-5">
          <li>ELSE IF, recursion, arrays</li>
          <li>Built-in function (SUM/AVG/MAX/MIN/ABS) code generation</li>
          <li>Optional LLVM optimization pass</li>
        </ul>
      </Sec>
    </div>
  );
}
