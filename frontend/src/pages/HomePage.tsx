import { Link } from "react-router-dom";
import {
  FileSpreadsheet, Terminal, Cpu, Database, ArrowRight,
  ShieldCheck, Sparkles, Zap, Layers, Activity
} from "lucide-react";

const CAPABILITIES = [
  { 
    icon: FileSpreadsheet, 
    badge: "CORE ENGINE", 
    title: "Native CSV & Grid Reactor", 
    desc: "Ingests CSV datasets directly as reactive variables (A1, B2). Automatically updates and recalculates tabular memory without interpretation overhead." 
  },
  { 
    icon: Cpu, 
    badge: "LLVM CODEGEN", 
    title: "Native Machine Compilation", 
    desc: "Bypasses slow VM interpreters. Emits highly optimized LLVM IR, generates target machine assembly, and builds native binaries via system linkers." 
  },
  { 
    icon: Zap, 
    badge: "OPERATIONS", 
    title: "Spreadsheet Standard Library", 
    desc: "Built-in aggregates (SUM, AVG, COUNT, MIN, MAX) and string operations (CONCAT, UPPER, LOWER, TRIM) running natively on raw C-memory buffers." 
  },
  { 
    icon: ShieldCheck, 
    badge: "ANALYSIS", 
    title: "Dependency Graph & Cycles", 
    desc: "Builds a topological execution plan before code generation. Automatically prevents and reports circular references in spreadsheet cells." 
  },
  { 
    icon: Layers, 
    badge: "PIPELINE", 
    title: "12-Stage Visual Compiler", 
    desc: "Exposes every step from Flex tokenization and Bison AST generation to symbol tables, LLVM IR, and native machine assembly." 
  },
  { 
    icon: Database, 
    badge: "PERSISTENCE", 
    title: "Real-time Telemetry & SQLite", 
    desc: "Zero mocked stats. Every single compilation is logged to SQLite with stage duration metrics (sub-millisecond accuracy) and Power BI CSV export." 
  },
];

const COMPILER_STAGES = [
  "Raw Source & CSV",
  "Flex Scanner",
  "Bison Grammar",
  "AST Builder",
  "Semantic Typecheck",
  "Dependency Analyzer",
  "LLVM 18 IR Gen",
  "Target Assembly",
  "Native Linker",
  "Native Execution"
];

export default function HomePage() {
  return (
    <div className="relative min-h-[calc(100vh-65px)] pb-24 overflow-hidden">
      {/* Decorative ambient lighting elements */}
      <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 w-[1000px] h-[400px] bg-gradient-to-b from-emerald-500/10 via-cyan-500/5 to-transparent blur-3xl -z-10" />

      {/* Hero Section */}
      <div className="mx-auto max-w-[1200px] px-6 pt-16 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1 text-xs font-semibold tracking-wide text-emerald-300 backdrop-blur-md mb-6">
          <Sparkles size={13} className="text-emerald-400" />
          <span>NEXT-GEN SPREADSHEET COMPILER & CSV ACCELERATOR</span>
        </div>

        <h1 className="text-5xl font-extrabold tracking-tight text-slate-100 sm:text-6xl lg:text-7xl">
          Supercharge CSV Data with <br />
          <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
            Native LLVM Compilation
          </span>
        </h1>

        <p className="mx-auto mt-6 max-w-3xl text-base leading-relaxed text-slate-400 sm:text-lg">
          SheetLang transforms spreadsheet and CSV manipulation into high-performance native machine code. 
          Write Excel-style formulas and transformations that compile directly to native binaries with zero VM overhead, backed by a live visual compiler inspection studio.
        </p>

        {/* Action CTAs */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link
            to="/playground"
            className="group flex items-center gap-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-7 py-3.5 text-sm font-semibold text-slate-950 hover:brightness-110 shadow-lg shadow-emerald-500/25 transition-all hover:-translate-y-0.5"
          >
            <Terminal size={17} />
            <span>Launch Studio IDE</span>
            <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
          </Link>
          <Link
            to="/history"
            className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-900/60 backdrop-blur-md px-6 py-3.5 text-sm font-medium text-slate-300 hover:bg-slate-800/80 hover:text-white transition-all"
          >
            <Activity size={16} className="text-cyan-400" />
            <span>Telemetry & Audit Logs</span>
          </Link>
          <Link
            to="/internals"
            className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-900/60 backdrop-blur-md px-6 py-3.5 text-sm font-medium text-slate-300 hover:bg-slate-800/80 hover:text-white transition-all"
          >
            <Cpu size={16} className="text-emerald-400" />
            <span>Inspect Compiler Core</span>
          </Link>
        </div>

        {/* Live Metrics strip */}
        <div className="mt-14 grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-4xl mx-auto">
          <div className="rounded-2xl border border-white/5 bg-slate-900/40 p-4 text-center backdrop-blur-sm">
            <div className="text-2xl font-bold font-mono text-emerald-400">100% Native</div>
            <div className="text-xs text-slate-400 mt-1">Direct LLVM 18 IR & Linker</div>
          </div>
          <div className="rounded-2xl border border-white/5 bg-slate-900/40 p-4 text-center backdrop-blur-sm">
            <div className="text-2xl font-bold font-mono text-cyan-400">Reactive CSV</div>
            <div className="text-xs text-slate-400 mt-1">Live In-Memory Spreadsheet Grid</div>
          </div>
          <div className="rounded-2xl border border-white/5 bg-slate-900/40 p-4 text-center backdrop-blur-sm">
            <div className="text-2xl font-bold font-mono text-teal-400">12 Stages</div>
            <div className="text-xs text-slate-400 mt-1">Full End-to-End Visual Pipeline</div>
          </div>
          <div className="rounded-2xl border border-white/5 bg-slate-900/40 p-4 text-center backdrop-blur-sm">
            <div className="text-2xl font-bold font-mono text-slate-200">Zero Mocking</div>
            <div className="text-xs text-slate-400 mt-1">Real Sub-ms SQLite Telemetry</div>
          </div>
        </div>
      </div>

      {/* Compiler Pipeline Flowchart Strip */}
      <div className="mx-auto mt-24 max-w-[1300px] px-6">
        <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-b from-slate-900/80 to-slate-950/80 p-6 backdrop-blur-xl shadow-2xl">
          <div className="flex flex-col sm:flex-row items-center justify-between pb-6 border-b border-white/5 gap-4">
            <div>
              <span className="text-[11px] font-bold tracking-widest uppercase text-emerald-400 font-mono">PIPELINE ARCHITECTURE</span>
              <h3 className="text-lg font-semibold text-slate-100">End-to-End Compilation Pipeline</h3>
            </div>
            <span className="text-xs text-slate-400 bg-white/5 px-3 py-1.5 rounded-full border border-white/5">
              Verified with <span className="text-emerald-400 font-mono">llvm::verifyModule</span>
            </span>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            {COMPILER_STAGES.map((step, i) => (
              <div key={step} className="flex items-center gap-2">
                <div className="flex items-center gap-2 rounded-xl border border-emerald-500/15 bg-slate-800/40 px-3.5 py-2 text-xs font-medium text-slate-200 shadow-sm">
                  <span className="text-[10px] font-mono text-emerald-400">0{i+1}</span>
                  <span>{step}</span>
                </div>
                {i < COMPILER_STAGES.length - 1 && (
                  <ArrowRight size={13} className="text-emerald-500/40 shrink-0" />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Feature Capabilities Grid */}
      <div className="mx-auto mt-24 max-w-[1300px] px-6">
        <div className="text-center mb-12">
          <span className="text-xs font-bold uppercase tracking-widest text-emerald-400 font-mono">TECHNICAL CAPABILITIES</span>
          <h2 className="text-3xl font-bold tracking-tight text-slate-100 mt-1">Built to Outperform Generic Scripting</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {CAPABILITIES.map((c) => {
            const Icon = c.icon;
            return (
              <div key={c.title} className="glass-card-interactive rounded-2xl p-6 relative group overflow-hidden">
                <div className="flex items-center justify-between mb-4">
                  <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:bg-emerald-500 group-hover:text-slate-950 transition-all duration-300">
                    <Icon size={20} />
                  </div>
                  <span className="text-[10px] font-mono font-bold tracking-wider px-2 py-0.5 rounded-md bg-white/5 border border-white/5 text-slate-400">
                    {c.badge}
                  </span>
                </div>
                <h3 className="text-base font-semibold text-slate-100 mb-2">{c.title}</h3>
                <p className="text-xs leading-relaxed text-slate-400">{c.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
