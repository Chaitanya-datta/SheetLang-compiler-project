import { useEffect, useState } from "react";
import { Play, RotateCcw, Sparkles } from "lucide-react";
import Sidebar from "../components/Sidebar";
import SourceEditor from "../components/SourceEditor";
import PipelineView from "../components/PipelineView";
import { TabBar, OutputPanel, type TabName } from "../components/OutputPanels";
import { compileSource, fetchExamples, fetchExampleSource } from "../lib/api";
import { useCompileState, DEFAULT_SOURCE } from "../lib/CompileContext";
import type { CompileResult, ExampleMeta } from "../lib/types";

const EMPTY_RESULT: CompileResult = {
  success: false,
  stages: [],
  tokens: null,
  ast: null,
  symbols: null,
  semantic: null,
  dependencies: null,
  llvmIr: null,
  assembly: null,
  optimization: { enabled: false, note: "" },
  object: { generated: false, note: "" },
  build: null,
  runtime: null,
};

export default function PlaygroundPage() {
  const { source, setSource, result, setResult } = useCompileState();
  const [compiling, setCompiling] = useState(false);
  const [selectedStage, setSelectedStage] = useState<string | null>(null);
  const [tab, setTab] = useState<TabName>("Overview");
  const [examples, setExamples] = useState<ExampleMeta[]>([]);
  const [activeExampleId, setActiveExampleId] = useState<string | null>(null);
  const [demoRunning, setDemoRunning] = useState(false);

  useEffect(() => {
    fetchExamples().then(setExamples).catch(() => setExamples([]));
  }, []);

  const status: "ready" | "compiling" | "success" | "failed" = compiling
    ? "compiling"
    : result
    ? result.success ? "success" : "failed"
    : "ready";

  async function runCompile(src: string): Promise<CompileResult> {
    setCompiling(true);
    setResult(null);
    try {
      const r = await compileSource(src);
      setResult(r);
      setSelectedStage(r.stages.find((s) => s.status !== "pending")?.id ?? null);
      return r;
    } catch (err) {
      const failed: CompileResult = {
        ...EMPTY_RESULT,
        stage: "network",
        error: err instanceof Error ? err.message : "Request failed",
      };
      setResult(failed);
      return failed;
    } finally {
      setCompiling(false);
    }
  }

  function handleCompile() {
    setTab("Overview");
    void runCompile(source);
  }

  function handleReset() {
    setSource(DEFAULT_SOURCE);
    setResult(null);
    setSelectedStage(null);
    setTab("Overview");
    setActiveExampleId(null);
  }

  async function handleSelectExample(id: string) {
    try {
      const ex = await fetchExampleSource(id);
      setSource(ex.source);
      setResult(null);
      setSelectedStage(null);
      setActiveExampleId(id);
      setTab("Overview");
    } catch {
      /* ignore */
    }
  }

  async function handleDemo() {
    setDemoRunning(true);
    try {
      setSource(DEFAULT_SOURCE);
      setActiveExampleId(null);
      await runCompile(DEFAULT_SOURCE);
      const order: TabName[] = ["Overview", "Tokens", "AST", "Symbols", "Semantic", "Dependencies", "LLVM IR", "Assembly", "Build", "Runtime"];
      for (const t of order) {
        setTab(t);
        await new Promise((res) => setTimeout(res, 550));
      }
    } finally {
      setDemoRunning(false);
    }
  }

  let errorLine: number | null = null;
  let errorMessage: string | null = null;
  if (result && !result.success && result.error) {
    const m = result.error.match(/line\s+(\d+)/i);
    if (m) {
      errorLine = Number(m[1]);
      errorMessage = result.error;
    }
  }

  const statusMeta: Record<typeof status, { label: string; dot: string }> = {
    ready: { label: "Ready", dot: "bg-slate-400" },
    compiling: { label: "Compiling", dot: "bg-amber-400 animate-pulse" },
    success: { label: "Success", dot: "bg-emerald-400" },
    failed: { label: "Failed", dot: "bg-rose-400" },
  };
  const s = statusMeta[status];

  return (
    <div className="flex h-[calc(100vh-49px)] flex-col bg-[#0b0f14]">
      <div className="flex items-center justify-between border-b border-[#26313c] bg-[#0d1017] px-5 py-2.5">
        <div className="flex items-center gap-2">
          <div className="text-[13px] font-semibold text-slate-200">Compiler Playground</div>
          <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[11px] text-slate-300">
            <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} /> {s.label}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDemo}
            disabled={compiling || demoRunning}
            className="flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/10 disabled:opacity-40"
          >
            <Sparkles size={13} /> Demo Mode
          </button>
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/10"
          >
            <RotateCcw size={13} /> Reset
          </button>
          <button
            onClick={handleCompile}
            disabled={compiling || demoRunning}
            className="flex items-center gap-1.5 rounded-md bg-indigo-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            <Play size={13} /> {compiling ? "Compiling…" : "Compile & Run"}
          </button>
        </div>
      </div>

      <div className="flex flex-1 gap-3 overflow-hidden p-3">
        <div className="w-[16%] min-w-[180px] overflow-hidden rounded-lg border border-[#26313c] bg-[#111820]">
          <Sidebar examples={examples} onSelect={handleSelectExample} activeId={activeExampleId} />
        </div>

        <div className="flex w-[38%] flex-col gap-2">
          <div className="px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Source Code</div>
          <div className="flex-1 overflow-hidden">
            <SourceEditor
              value={source}
              onChange={(v) => { setSource(v); setActiveExampleId(null); }}
              onCompile={handleCompile}
              errorLine={errorLine}
              errorMessage={errorMessage}
            />
          </div>
        </div>

        <div className="flex w-[18%] flex-col overflow-hidden rounded-lg border border-[#26313c] bg-[#111820]">
          <div className="border-b border-[#26313c] px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Compiler Pipeline
          </div>
          <div className="flex-1 overflow-hidden">
            <PipelineView stages={result?.stages ?? []} selected={selectedStage} onSelect={setSelectedStage} />
          </div>
        </div>

        <div className="flex flex-1 flex-col overflow-hidden rounded-lg border border-[#26313c] bg-[#111820]">
          <TabBar active={tab} onSelect={setTab} />
          <div className="flex-1 overflow-y-auto">
            <OutputPanel tab={tab} result={result} />
          </div>
        </div>
      </div>
    </div>
  );
}
