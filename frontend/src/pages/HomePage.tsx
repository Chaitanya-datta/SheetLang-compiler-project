import { Link } from "react-router-dom";
import {
  Type, GitBranch, ShieldCheck, Share2, Cpu, Play, Database, BarChart3, ArrowRight,
} from "lucide-react";

const FEATURES = [
  { icon: Type, title: "Lexer", desc: "Tokenizes SheetLang source code with a hand-written Flex scanner." },
  { icon: GitBranch, title: "Parser", desc: "Builds the program structure and AST using a Bison grammar." },
  { icon: ShieldCheck, title: "Semantic Analysis", desc: "Validates declarations, types, scope, and function calls before codegen." },
  { icon: Share2, title: "Dependency Analysis", desc: "Analyzes variable dependencies and detects cycles." },
  { icon: Cpu, title: "LLVM Code Generation", desc: "Generates verified LLVM IR from the validated AST." },
  { icon: Play, title: "Native Execution", desc: "Compiles to a real object file, links, and actually runs the program." },
  { icon: Database, title: "SQLite Analytics", desc: "Persists every real compilation with per-stage timing." },
  { icon: BarChart3, title: "Power BI Analytics", desc: "Exports compilation history as CSV for deeper analysis in Power BI." },
];

const PIPELINE = ["Source Code", "Lexer", "Parser", "AST", "Semantic Analysis", "Dependency Analysis", "LLVM Code Generation", "Native Execution"];
const DATA_FLOW = ["Compilation", "SQLite", "CSV Export", "Power BI"];

export default function HomePage() {
  return (
    <div className="mx-auto max-w-[1100px] px-6 py-16">
      {/* Hero */}
      <div className="text-center">
        <div className="mb-3 text-[13px] font-medium uppercase tracking-[0.2em] text-indigo-400">
          SheetLang
        </div>
        <h1 className="text-4xl font-semibold tracking-tight text-slate-100 sm:text-5xl">
          Compile. Analyze. Execute.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-[15px] leading-relaxed text-slate-400">
          A lightweight programming language and compiler platform with lexical analysis, parsing,
          semantic analysis, dependency analysis, LLVM code generation, native execution, and
          compilation analytics.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link
            to="/playground"
            className="flex items-center gap-1.5 rounded-md bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-500"
          >
            Open Playground <ArrowRight size={15} />
          </Link>
          <Link
            to="/analytics"
            className="rounded-md border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-medium text-slate-200 hover:bg-white/10"
          >
            View Analytics
          </Link>
        </div>
      </div>

      {/* Features */}
      <div className="mt-24">
        <h2 className="mb-8 text-center text-[13px] font-semibold uppercase tracking-wider text-slate-500">
          What SheetLang Actually Does
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-lg border border-[#26313c] bg-[#111820] p-5">
              <f.icon size={18} className="mb-3 text-indigo-400" />
              <div className="mb-1 text-[14px] font-medium text-slate-100">{f.title}</div>
              <div className="text-[12.5px] leading-relaxed text-slate-500">{f.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Architecture */}
      <div className="mt-24">
        <h2 className="mb-8 text-center text-[13px] font-semibold uppercase tracking-wider text-slate-500">
          Compiler Pipeline
        </h2>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {PIPELINE.map((step, i) => (
            <div key={step} className="flex items-center gap-2">
              <div className="rounded-md border border-[#26313c] bg-[#111820] px-3.5 py-2 text-[12.5px] text-slate-200">
                {step}
              </div>
              {i < PIPELINE.length - 1 && <ArrowRight size={14} className="text-slate-600" />}
            </div>
          ))}
        </div>

        <h2 className="mb-8 mt-16 text-center text-[13px] font-semibold uppercase tracking-wider text-slate-500">
          Analytics Data Flow
        </h2>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {DATA_FLOW.map((step, i) => (
            <div key={step} className="flex items-center gap-2">
              <div className="rounded-md border border-[#26313c] bg-[#111820] px-3.5 py-2 text-[12.5px] text-slate-200">
                {step}
              </div>
              {i < DATA_FLOW.length - 1 && <ArrowRight size={14} className="text-slate-600" />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
