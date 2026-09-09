import { Play, RotateCcw, Sparkles, Database } from "lucide-react";
import type { HealthStatus } from "../lib/types";

interface Props {
  status: "ready" | "compiling" | "success" | "failed";
  health: HealthStatus | null;
  onCompile: () => void;
  onReset: () => void;
  onDemo: () => void;
  compiling: boolean;
  view: "playground" | "history";
  onChangeView: (v: "playground" | "history") => void;
}

const statusMeta: Record<Props["status"], { label: string; dot: string }> = {
  ready: { label: "Ready", dot: "bg-slate-400" },
  compiling: { label: "Compiling", dot: "bg-amber-400 animate-pulse" },
  success: { label: "Compilation Successful", dot: "bg-emerald-400" },
  failed: { label: "Compilation Failed", dot: "bg-rose-400" },
};

export default function Header({ status, health, onCompile, onReset, onDemo, compiling, view, onChangeView }: Props) {
  const s = statusMeta[status];
  const connected = health?.compiler === "available";

  return (
    <header className="flex items-center justify-between border-b border-[#26313c] bg-[#0d1017] px-5 py-3">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br from-indigo-500 to-cyan-500 font-bold text-sm">
          SL
        </div>
        <div>
          <div className="text-sm font-semibold tracking-wide text-slate-100">
            SHEETLANG <span className="font-normal text-slate-400">Compiler Playground</span>
          </div>
          <div className="text-[11px] text-slate-500">C++ • LLVM • Real sheetc integration</div>
        </div>

        <div className="ml-4 flex items-center gap-1 rounded-md border border-white/10 bg-white/5 p-0.5">
          <button
            onClick={() => onChangeView("playground")}
            className={`rounded px-3 py-1 text-xs transition-colors ${view === "playground" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"}`}
          >
            Playground
          </button>
          <button
            onClick={() => onChangeView("history")}
            className={`flex items-center gap-1 rounded px-3 py-1 text-xs transition-colors ${view === "history" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"}`}
          >
            <Database size={12} /> History
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
          <span className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-emerald-400" : "bg-rose-400"}`} />
          {health ? (connected ? "Compiler Connected" : "Compiler Offline") : "Checking…"}
        </div>

        {view === "playground" && (
          <>
            <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
              <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
              {s.label}
            </div>

            <button
              onClick={onDemo}
              disabled={compiling || !connected}
              className="flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/10 disabled:opacity-40 transition-colors"
            >
              <Sparkles size={13} /> Demo Mode
            </button>

            <button
              onClick={onReset}
              className="flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/10 transition-colors"
            >
              <RotateCcw size={13} /> Reset
            </button>

            <button
              onClick={onCompile}
              disabled={compiling || !connected}
              className="flex items-center gap-1.5 rounded-md bg-indigo-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Play size={13} /> {compiling ? "Compiling…" : "Compile & Run"}
            </button>
          </>
        )}
      </div>
    </header>
  );
}
