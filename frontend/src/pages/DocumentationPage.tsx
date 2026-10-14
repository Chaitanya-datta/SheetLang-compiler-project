import { BookOpen, FileSpreadsheet, Cpu, Layers, Terminal } from "lucide-react";

function Sec({ title, icon: Icon, children }: { title: string; icon?: any; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-[#080d16] p-6 shadow-xl">
      <div className="flex items-center gap-2 mb-3 border-b border-white/5 pb-2">
        {Icon && <Icon size={16} className="text-emerald-400" />}
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200 font-mono">{title}</h2>
      </div>
      <div className="space-y-3 text-xs leading-relaxed text-slate-400">{children}</div>
    </section>
  );
}

function Code({ children }: { children: string }) {
  return <pre className="overflow-auto rounded-xl bg-[#04060a] border border-white/5 p-3.5 font-mono text-xs text-emerald-400/90">{children}</pre>;
}

export default function DocumentationPage() {
  return (
    <div className="mx-auto max-w-[900px] p-8 space-y-6">
      <div className="border-b border-white/5 pb-4">
        <div className="flex items-center gap-2">
          <BookOpen size={20} className="text-emerald-400" />
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 font-mono">Documentation & Specifications</h1>
        </div>
        <p className="text-xs text-slate-400 mt-1">Verified architectural overview of the SheetLang compiler & CSV engine.</p>
      </div>

      <Sec title="Overview & Architecture" icon={Terminal}>
        <p>
          SheetLang is a high-performance Domain Specific Language (DSL) specifically designed to eliminate interpreter overhead when operating on spreadsheet cells and CSV data. 
          Unlike interpreted macros, SheetLang executes through a native LLVM compiler: hand-written Flex scanner, Bison LALR(1) parser, verified AST, semantic type checking, cycle-detecting dependency analysis, LLVM 18 IR generation, and native machine object linking.
        </p>
      </Sec>

      <Sec title="12-Stage Compiler Flow" icon={Layers}>
        <Code>{`Raw Source & Attached CSV
   ↓
Lexical Scanner (Flex)
   ↓
Grammar Parser (Bison) → AST Nodes
   ↓
Semantic Analyzer (Typecheck & Scoping)
   ↓
Dependency Analyzer (Topological Sort & Cycle Detection)
   ↓
LLVM 18 IR Generation → llvm::verifyModule
   ↓
Native Code Generation (Assembly + System Linker)
   ↓
Machine Executable (Direct Execution with stdout/stderr capture)`}</Code>
      </Sec>

      <Sec title="Supported Language Syntax" icon={Cpu}>
        <ul className="list-disc space-y-2 pl-5 font-mono text-xs">
          <li><code>SHEET Name ... END</code> — Root program block</li>
          <li><code>LET var = expr</code> — Single-assignment immutable variables</li>
          <li><code>A1 = expr, B2 = expr</code> — Spreadsheet cell assignment & update</li>
          <li><code>+ - * / %</code> — Native 64-bit IEEE 754 floating point arithmetic</li>
          <li><code>&gt; &lt; &gt;= &lt;= == !=</code> — Relational comparisons</li>
          <li><code>IF condition ... [ELSE ...] ENDIF</code> — Conditional branching</li>
          <li><code>WHILE condition ... ENDWHILE</code> — Native LLVM loop basic blocks with back-edge</li>
          <li><code>FUNCTION f(p) ... RETURN expr ENDFUNC</code> — Subroutines with stack frames</li>
          <li><code>PRINT expr</code> — Formatted stdout emission for numbers and strings</li>
        </ul>
      </Sec>

      <Sec title="CSV & Spreadsheet Standard Library" icon={FileSpreadsheet}>
        <ul className="list-disc space-y-2 pl-5 font-mono text-xs">
          <li><code>SUM(A1:A10), AVG(B1:B20), COUNT(C1:C50)</code> — Native range aggregation with automatic empty-cell skipping</li>
          <li><code>MIN(a, b), MAX(a, b)</code> — Fast scalar reductions</li>
          <li><code>CONCAT(str1, str2)</code> — C runtime string concatenation with dynamic buffer allocation</li>
          <li><code>UPPER(str), LOWER(str), TRIM(str)</code> — In-place text sanitization</li>
        </ul>
      </Sec>
    </div>
  );
}
