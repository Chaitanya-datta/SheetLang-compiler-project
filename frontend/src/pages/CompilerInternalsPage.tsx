import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useCompileState } from "../lib/CompileContext";
import { OutputPanel } from "../components/OutputPanels";
import type { TabName } from "../components/OutputPanels";
import { Link } from "react-router-dom";

function Section({
  title, subtitle, children, defaultOpen = true,
}: { title: string; subtitle: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-lg border border-[#26313c] bg-[#111820]">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-5 py-3.5 text-left"
      >
        <div>
          <div className="text-[14px] font-medium text-slate-100">{title}</div>
          <div className="text-[11.5px] text-slate-500">{subtitle}</div>
        </div>
        {open ? <ChevronDown size={16} className="text-slate-500" /> : <ChevronRight size={16} className="text-slate-500" />}
      </button>
      {open && <div className="border-t border-[#26313c]">{children}</div>}
    </div>
  );
}

export default function CompilerInternalsPage() {
  const { result } = useCompileState();

  if (!result) {
    return (
      <div className="mx-auto max-w-[900px] p-10 text-center">
        <div className="text-lg font-semibold text-slate-100">Compiler Internals</div>
        <p className="mt-3 text-sm text-slate-500">
          No compilation has been run yet in this session. Compile a program in the Playground first
          — this page shows the real internal state of whatever was compiled most recently.
        </p>
        <Link to="/playground" className="mt-5 inline-block rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500">
          Open Playground
        </Link>
      </div>
    );
  }

  const wrap = (tab: TabName) => <OutputPanel tab={tab} result={result} />;

  return (
    <div className="mx-auto max-w-[1100px] space-y-4 p-6">
      <div>
        <div className="text-lg font-semibold text-slate-100">Compiler Internals</div>
        <div className="text-[12px] text-slate-500">
          Real internal state from the most recent compilation in this session
          {!result.success && <span className="text-rose-400"> — this compilation failed at "{result.stage}", so later stages below show "not available."</span>}
        </div>
      </div>

      <Section title="A. Lexical Analysis" subtitle="Real token stream from the Flex-generated lexer.">
        {wrap("Tokens")}
      </Section>

      <Section title="B. Syntax Analysis" subtitle="Real AST from the Bison-generated parser.">
        {wrap("AST")}
      </Section>

      <Section title="Symbol Information (AST-derived)" subtitle="Declared identifiers extracted from the real AST — not a dedicated compiler symbol-table dump.">
        {wrap("Symbols")}
      </Section>

      <Section title="C. Semantic Analysis" subtitle="Real validation result from the semantic analyzer.">
        {wrap("Semantic")}
      </Section>

      <Section title="D. Dependency Analysis" subtitle="Real variable dependency graph and evaluation order.">
        {wrap("Dependencies")}
      </Section>

      <Section title="E. Code Generation" subtitle="Real LLVM IR, assembly, and native build status." defaultOpen={false}>
        <div className="grid grid-cols-1 divide-y divide-[#26313c] lg:grid-cols-2 lg:divide-x lg:divide-y-0">
          <div>{wrap("LLVM IR")}</div>
          <div>{wrap("Assembly")}</div>
        </div>
        <div className="border-t border-[#26313c]">{wrap("Build")}</div>
      </Section>
    </div>
  );
}
