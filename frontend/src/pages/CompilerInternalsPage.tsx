import { useState } from "react";
import { ChevronDown, ChevronRight, Cpu, Terminal } from "lucide-react";
import { useCompileState } from "../lib/CompileContext";
import { OutputPanel } from "../components/OutputPanels";
import type { TabName } from "../components/OutputPanels";
import { Link } from "react-router-dom";

function Section({
  title, subtitle, stageNum, children, defaultOpen = true,
}: { title: string; subtitle: string; stageNum: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl border border-white/10 bg-[#080d16] overflow-hidden shadow-xl transition-all">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-6 py-4 text-left hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
            STAGE {stageNum}
          </span>
          <div>
            <div className="text-sm font-bold text-slate-100 font-mono">{title}</div>
            <div className="text-xs text-slate-400">{subtitle}</div>
          </div>
        </div>
        {open ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
      </button>
      {open && <div className="border-t border-white/5 bg-[#050810] p-4">{children}</div>}
    </div>
  );
}

export default function CompilerInternalsPage() {
  const { result } = useCompileState();

  if (!result) {
    return (
      <div className="mx-auto max-w-[850px] p-16 text-center">
        <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mx-auto mb-4">
          <Cpu size={24} />
        </div>
        <h2 className="text-2xl font-bold text-slate-100 font-mono">No Active Compiler Session</h2>
        <p className="mt-3 text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
          The compiler internals view displays raw, un-mocked diagnostic data from the active compilation pipeline. Please compile a script in the studio first.
        </p>
        <Link 
          to="/playground" 
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-2.5 text-xs font-semibold text-slate-950 hover:brightness-110 shadow-lg shadow-emerald-500/20 transition-all"
        >
          <Terminal size={14} />
          <span>Launch Studio Playground</span>
        </Link>
      </div>
    );
  }

  const wrap = (tab: TabName) => <OutputPanel tab={tab} result={result} />;

  return (
    <div className="mx-auto max-w-[1200px] space-y-5 p-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-white/5 gap-2">
        <div>
          <div className="flex items-center gap-2">
            <Cpu size={18} className="text-emerald-400" />
            <h1 className="text-2xl font-bold tracking-tight text-slate-100 font-mono">Compiler Internal Pipeline States</h1>
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Real internal representations extracted from the most recent <span className="font-mono text-emerald-400">sheetc</span> binary execution.
          </div>
        </div>

        <div className={`px-3 py-1 rounded-full text-xs font-mono border ${
          result.success ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-rose-500/30 bg-rose-500/10 text-rose-300"
        }`}>
          {result.success ? "PIPELINE VERIFIED" : `HALTED AT ${(result.stage ?? "COMPILER").toUpperCase()}`}
        </div>
      </div>

      <div className="space-y-4">
        <Section stageNum="01" title="Lexical Token Stream" subtitle="Tokenized via Flex (fast lexical analysis)">
          {wrap("Tokens")}
        </Section>

        <Section stageNum="02" title="Abstract Syntax Tree (AST)" subtitle="Constructed using Bison LALR(1) grammar rules">
          {wrap("AST")}
        </Section>

        <Section stageNum="03" title="Symbol Table Extraction" subtitle="Resolved identifiers, cells, and scope declarations">
          {wrap("Symbols")}
        </Section>

        <Section stageNum="04" title="Semantic Analysis Diagnostics" subtitle="Type-checking, function arity, and declare-before-use verification">
          {wrap("Semantic")}
        </Section>

        <Section stageNum="05" title="Dependency Graph & Cycle Detection" subtitle="Topological ordering and circular reference prevention">
          {wrap("Dependencies")}
        </Section>

        <Section stageNum="06" title="LLVM 18 Intermediate Representation" subtitle="Target-independent SSA form verified by llvm::verifyModule">
          {wrap("LLVM IR")}
        </Section>

        <Section stageNum="07" title="Target Machine Assembly" subtitle="Emitted native assembly instructions for the host architecture">
          {wrap("Assembly")}
        </Section>

        <Section stageNum="08" title="Native Linker & Executable Runtime" subtitle="Direct machine execution output and exit status">
          {wrap("Runtime")}
        </Section>
      </div>
    </div>
  );
}
