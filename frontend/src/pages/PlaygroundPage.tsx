import { useEffect, useState, useRef } from "react";
import {
  Play, RotateCcw, Sparkles, Upload,
  FileSpreadsheet, Layers,
  PanelLeftClose, PanelLeft
} from "lucide-react";
import Sidebar from "../components/Sidebar";
import SourceEditor from "../components/SourceEditor";
import PipelineView from "../components/PipelineView";
import DataGrid from "../components/DataGrid";
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

type WorkspaceViewMode = "split" | "editor-only" | "grid-only";

export default function PlaygroundPage() {
  const { source, setSource, result, setResult } = useCompileState();
  const [compiling, setCompiling] = useState(false);
  const [selectedStage, setSelectedStage] = useState<string | null>(null);
  const [tab, setTab] = useState<TabName>("Overview");
  const [examples, setExamples] = useState<ExampleMeta[]>([]);
  const [activeExampleId, setActiveExampleId] = useState<string | null>(null);
  const [demoRunning, setDemoRunning] = useState(false);
  const [csvData, setCsvData] = useState<string | null>(null);
  const [csvFileName, setCsvFileName] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [viewMode, setViewMode] = useState<WorkspaceViewMode>("split");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchExamples().then(setExamples).catch(() => setExamples([]));
  }, []);

  const status: "ready" | "compiling" | "success" | "failed" = compiling
    ? "compiling"
    : result
    ? result.success ? "success" : "failed"
    : "ready";

  async function runCompile(src: string, data?: string): Promise<CompileResult> {
    setCompiling(true);
    setResult(null);
    try {
      const r = await compileSource(src, data);
      if (r.updatedCsvData) {
        setCsvData(r.updatedCsvData);
      }
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
    void runCompile(source, csvData ?? undefined);
  }

  function handleReset() {
    setSource(DEFAULT_SOURCE);
    setResult(null);
    setSelectedStage(null);
    setTab("Overview");
    setActiveExampleId(null);
    setCsvData(null);
    setCsvFileName(null);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      setCsvData(evt.target?.result as string);
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleDownloadCsv() {
    if (!csvData) return;
    const blob = new Blob([csvData], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = csvFileName || 'data.csv';
    a.click();
    URL.revokeObjectURL(url);
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

  const statusMeta: Record<typeof status, { label: string; dot: string; border: string }> = {
    ready: { label: "Ready to Compile", dot: "bg-slate-400", border: "border-slate-700/50" },
    compiling: { label: "Compiling LLVM...", dot: "bg-amber-400 animate-ping", border: "border-amber-500/40 text-amber-300" },
    success: { label: "Native Exec OK", dot: "bg-emerald-400", border: "border-emerald-500/40 text-emerald-300" },
    failed: { label: "Stage Error", dot: "bg-rose-400", border: "border-rose-500/40 text-rose-300" },
  };
  const s = statusMeta[status];
  const totalDuration = result?.stages.reduce((acc, st) => acc + st.durationMs, 0) ?? 0;

  return (
    <div className="flex h-[calc(100vh-65px)] flex-col bg-[#04070d] overflow-hidden select-none">
      {/* 1. TOP STUDIO DOCK (Header & Quick Actions) */}
      <div className="flex items-center justify-between border-b border-white/[0.08] bg-[#070c16]/90 px-4 py-2 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            title={sidebarOpen ? "Collapse Project Explorer" : "Expand Project Explorer"}
            className="flex items-center justify-center h-8 w-8 rounded-lg border border-white/5 bg-slate-900/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            {sidebarOpen ? <PanelLeftClose size={15} /> : <PanelLeft size={15} />}
          </button>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold tracking-wider text-slate-200">
              STUDIO WORKBENCH
            </span>
            <div className={`flex items-center gap-1.5 rounded-full border bg-slate-900/60 px-2.5 py-0.5 text-[10.5px] font-mono ${s.border}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
              <span>{s.label}</span>
            </div>
          </div>

          {result && (
            <div className="hidden md:flex items-center gap-2 font-mono text-[11px] text-slate-400 border-l border-white/10 pl-3">
              <span>Latency: <strong className="text-emerald-400 font-semibold">{totalDuration.toFixed(1)}ms</strong></span>
              {result.runtime && (
                <span>Code: <strong className={result.runtime.exitCode === 0 ? "text-emerald-400" : "text-rose-400"}>{result.runtime.exitCode}</strong></span>
              )}
            </div>
          )}
        </div>

        {/* View Switchers & Primary Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Workspace Layout Selector */}
          <div className="hidden sm:flex items-center gap-1 rounded-lg border border-white/5 bg-slate-900/80 p-0.5">
            <button
              onClick={() => setViewMode("split")}
              title="Split View (Code + Grid)"
              className={`px-2 py-1 rounded text-[11px] font-mono transition-all ${
                viewMode === "split" ? "bg-emerald-500/20 text-emerald-300 font-semibold shadow-sm" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Split View
            </button>
            <button
              onClick={() => setViewMode("editor-only")}
              title="Editor View Only"
              className={`px-2 py-1 rounded text-[11px] font-mono transition-all ${
                viewMode === "editor-only" ? "bg-emerald-500/20 text-emerald-300 font-semibold shadow-sm" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Code Only
            </button>
            <button
              onClick={() => setViewMode("grid-only")}
              title="CSV Data Grid Only"
              className={`px-2 py-1 rounded text-[11px] font-mono transition-all ${
                viewMode === "grid-only" ? "bg-emerald-500/20 text-emerald-300 font-semibold shadow-sm" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Grid Only
            </button>
          </div>

          <button
            onClick={handleDemo}
            disabled={compiling || demoRunning}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-slate-900/60 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-800 transition-all disabled:opacity-40"
          >
            <Sparkles size={12} className="text-cyan-400" />
            <span className="hidden sm:inline">Tour Demo</span>
          </button>

          <input 
            type="file" 
            accept=".csv" 
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden" 
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={compiling || demoRunning}
            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-mono transition-all ${
              csvFileName 
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40 shadow-sm shadow-emerald-950' 
                : 'bg-slate-900/60 text-slate-300 border-white/10 hover:bg-slate-800'
            }`}
          >
            <Upload size={12} className="text-emerald-400" />
            <span className="max-w-[110px] truncate">{csvFileName ? csvFileName : "Upload CSV"}</span>
          </button>

          <button
            onClick={handleReset}
            title="Reset to default script"
            className="flex items-center gap-1 rounded-lg border border-white/10 bg-slate-900/60 px-2.5 py-1.5 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all"
          >
            <RotateCcw size={12} />
          </button>

          <button
            onClick={handleCompile}
            disabled={compiling || demoRunning}
            className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 px-3.5 py-1.5 text-xs font-bold text-slate-950 hover:brightness-110 shadow-md shadow-emerald-500/20 disabled:opacity-50 transition-all active:scale-95"
          >
            <Play size={12} fill="currentColor" />
            <span>{compiling ? "Compiling..." : "Build & Execute"}</span>
          </button>
        </div>
      </div>

      {/* 2. MAIN 3-TIER EXPANDABLE WORKSPACE */}
      <div className="flex flex-1 overflow-hidden">
        {/* Tier A: Collapsible Sidebar Explorer */}
        {sidebarOpen && (
          <div className="w-[210px] shrink-0 border-r border-white/[0.08] bg-[#060a12] flex flex-col h-full animate-in slide-in-from-left duration-200">
            <Sidebar examples={examples} onSelect={handleSelectExample} activeId={activeExampleId} />
          </div>
        )}

        {/* Tier B: Primary Central Workspace (Source & Spreadsheet) */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#04070d] p-2 gap-2">
          {/* Split Mode: Code & Spreadsheet Side by Side or Top/Bottom */}
          {viewMode === "split" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 flex-1 min-h-0">
              <div className="flex flex-col min-h-0 rounded-xl overflow-hidden border border-white/10 shadow-lg bg-[#070b14]">
                <SourceEditor
                  value={source}
                  onChange={(v) => { setSource(v); setActiveExampleId(null); }}
                  onCompile={handleCompile}
                  errorLine={errorLine}
                  errorMessage={errorMessage}
                />
              </div>

              <div className="flex flex-col min-h-0 rounded-xl overflow-hidden border border-emerald-500/20 shadow-lg bg-[#070b14]">
                {csvData ? (
                  <DataGrid csvData={csvData} onDownload={handleDownloadCsv} />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-[#070b14]/60">
                    <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-3">
                      <FileSpreadsheet size={22} />
                    </div>
                    <div className="text-sm font-semibold text-slate-200 font-mono">No Active CSV Attached</div>
                    <p className="text-xs text-slate-400 mt-1 max-w-xs leading-relaxed">
                      Upload a CSV file or load the <span className="text-emerald-400 font-mono">csv_aggregations</span> example to view and edit live tabular data.
                    </p>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="mt-4 flex items-center gap-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 text-xs font-mono font-medium text-emerald-300 hover:bg-emerald-500/20 transition-all"
                    >
                      <Upload size={12} /> Attach CSV File
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* View Mode: Editor Only */}
          {viewMode === "editor-only" && (
            <div className="flex-1 flex flex-col min-h-0 rounded-xl overflow-hidden border border-white/10 shadow-lg bg-[#070b14]">
              <SourceEditor
                value={source}
                onChange={(v) => { setSource(v); setActiveExampleId(null); }}
                onCompile={handleCompile}
                errorLine={errorLine}
                errorMessage={errorMessage}
              />
            </div>
          )}

          {/* View Mode: Data Grid Only */}
          {viewMode === "grid-only" && (
            <div className="flex-1 flex flex-col min-h-0 rounded-xl overflow-hidden border border-emerald-500/20 shadow-lg bg-[#070b14]">
              {csvData ? (
                <DataGrid csvData={csvData} onDownload={handleDownloadCsv} />
              ) : (
                <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-[#070b14]/60">
                  <FileSpreadsheet size={26} className="text-emerald-400 mb-2" />
                  <div className="text-sm font-semibold text-slate-200 font-mono">No CSV Dataset Loaded</div>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-3 flex items-center gap-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 text-xs font-mono text-emerald-300 hover:bg-emerald-500/20 transition-all"
                  >
                    <Upload size={12} /> Choose CSV
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Tier C: Right-Hand Diagnostic Console & Compiler Inspector */}
        <div className="w-[340px] shrink-0 border-l border-white/[0.08] bg-[#060a12] flex flex-col h-full">
          {/* Header Strip with Mini Pipeline Meter */}
          <div className="border-b border-white/[0.08] bg-[#090e1a] px-3 py-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Layers size={13} className="text-emerald-400" />
              <span className="text-[11px] font-mono font-bold tracking-wider uppercase text-slate-300">
                Compiler Telemetry
              </span>
            </div>
            {result && (
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                result.success ? "text-emerald-300 bg-emerald-500/10" : "text-rose-300 bg-rose-500/10"
              }`}>
                {result.stages.filter(s => s.status === "success").length}/12 OK
              </span>
            )}
          </div>

          {/* Top Half of Right Pane: Real-time Pipeline Progress */}
          <div className="h-[210px] shrink-0 border-b border-white/[0.08] overflow-hidden">
            <PipelineView stages={result?.stages ?? []} selected={selectedStage} onSelect={setSelectedStage} />
          </div>

          {/* Bottom Half: Interactive Diagnostic Output Tabs */}
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-[#050810]">
            <TabBar active={tab} onSelect={setTab} />
            <div className="flex-1 overflow-y-auto p-2">
              <OutputPanel tab={tab} result={result} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
