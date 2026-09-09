import { useEffect, useState } from "react";
import Header from "./components/Header";
import Sidebar from "./components/Sidebar";
import SourceEditor from "./components/SourceEditor";
import PipelineView from "./components/PipelineView";
import { TabBar, OutputPanel, type TabName } from "./components/OutputPanels";
import HistoryView from "./components/HistoryView";
import { compileSource, fetchExamples, fetchExampleSource, fetchHealth } from "./lib/api";
import type { CompileResult, ExampleMeta, HealthStatus } from "./lib/types";

const DEFAULT_SOURCE = `SHEET Student

LET Maths = 90
LET Physics = 85
LET Chemistry = 80

LET Total = Maths + Physics + Chemistry
LET Average = Total / 3

IF Average >= 85
    PRINT "Distinction"
ELSE
    PRINT "First Class"
ENDIF

PRINT Total
PRINT Average

END
`;

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

export default function App() {
  const [source, setSource] = useState(DEFAULT_SOURCE);
  const [result, setResult] = useState<CompileResult | null>(null);
  const [compiling, setCompiling] = useState(false);
  const [selectedStage, setSelectedStage] = useState<string | null>(null);
  const [tab, setTab] = useState<TabName>("Overview");
  const [examples, setExamples] = useState<ExampleMeta[]>([]);
  const [activeExampleId, setActiveExampleId] = useState<string | null>(null);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [demoRunning, setDemoRunning] = useState(false);
  const [view, setView] = useState<"playground" | "history">("playground");

  useEffect(() => {
    fetchExamples().then(setExamples).catch(() => setExamples([]));
    fetchHealth().then(setHealth).catch(() => setHealth(null));
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

  // Demo Mode: loads student.sheet, ACTUALLY compiles it (one real
  // backend request), then sequentially reveals tabs using that one real
  // result -- no re-compilation, no fabricated per-stage delay beyond a
  // short reveal pause, so nothing shown is invented.
  async function handleDemo() {
    setDemoRunning(true);
    try {
      setSource(DEFAULT_SOURCE);
      setActiveExampleId(null);
      const r = await runCompile(DEFAULT_SOURCE);
      const order: TabName[] = ["Overview", "Tokens", "AST", "Symbols", "Semantic", "Dependencies", "LLVM IR", "Assembly", "Build", "Runtime"];
      for (const t of order) {
        setTab(t);
        await new Promise((res) => setTimeout(res, 550));
      }
      void r;
    } finally {
      setDemoRunning(false);
    }
  }

  // Extract a real line number from the actual compiler error text (if
  // present) so Monaco can mark it -- never a guessed/fabricated line.
  let errorLine: number | null = null;
  let errorMessage: string | null = null;
  if (result && !result.success && result.error) {
    const m = result.error.match(/line\s+(\d+)/i);
    if (m) {
      errorLine = Number(m[1]);
      errorMessage = result.error;
    }
  }

  return (
    <div className="flex h-screen flex-col bg-[#0b0f14]">
      <Header
        status={status}
        health={health}
        onCompile={handleCompile}
        onReset={handleReset}
        onDemo={handleDemo}
        compiling={compiling || demoRunning}
        view={view}
        onChangeView={setView}
      />

      {view === "history" ? (
        <div className="flex-1 overflow-hidden p-3">
          <div className="h-full overflow-hidden rounded-lg border border-[#26313c] bg-[#111820]">
            <HistoryView />
          </div>
        </div>
      ) : (
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
      )}
    </div>
  );
}
