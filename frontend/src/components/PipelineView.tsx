import { CheckCircle2, XCircle, Circle, MinusCircle, Activity } from "lucide-react";
import type { StageResult } from "../lib/types";

const ALL_STAGES: [string, string][] = [
  ["source", "Raw Source"],
  ["lexer", "Lexical Tokenizer"],
  ["parser", "Syntactic Parser"],
  ["ast", "AST Tree Gen"],
  ["symbols", "Symbol Resolver"],
  ["semantic", "Type Validation"],
  ["dependencies", "Cycle Detection"],
  ["llvmIr", "LLVM IR Gen"],
  ["assembly", "Target Assembly"],
  ["object", "ELF Object Gen"],
  ["executable", "Linker Stage"],
  ["runtime", "Binary Execution"],
];

function iconFor(status: string) {
  switch (status) {
    case "success":
      return <CheckCircle2 size={14} className="text-emerald-400" />;
    case "failed":
      return <XCircle size={14} className="text-rose-400" />;
    case "skipped":
      return <MinusCircle size={14} className="text-slate-600" />;
    default:
      return <Circle size={14} className="text-slate-700" />;
  }
}

export default function PipelineView({
  stages,
  selected,
  onSelect,
}: {
  stages: StageResult[];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const byId = new Map(stages.map((s) => [s.id, s]));
  const completed = stages.filter((s) => s.status === "success").length;
  const total = ALL_STAGES.length;
  const pct = stages.length ? Math.round((completed / total) * 100) : 0;
  const hasFailure = stages.some((s) => s.status === "failed");

  return (
    <div className="flex h-full flex-col bg-[#080d16] border-r border-white/5 select-none">
      <div className="border-b border-white/5 bg-[#0c121e] px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Activity size={13} className="text-emerald-400" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300 font-mono">
              Pipeline Health
            </span>
          </div>
          <span className="text-[10px] font-mono font-bold text-slate-400">
            {completed}/{total}
          </span>
        </div>
        
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              hasFailure 
                ? "bg-gradient-to-r from-rose-500 to-amber-500" 
                : "bg-gradient-to-r from-emerald-500 to-teal-400"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {ALL_STAGES.map(([id, name], i) => {
          const info = byId.get(id);
          const status = info?.status ?? "pending";
          const isSelected = selected === id;
          return (
            <button
              key={id}
              onClick={() => info && status !== "pending" && onSelect(id)}
              disabled={!info || status === "pending"}
              className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs transition-all ${
                isSelected
                  ? "border border-emerald-500/30 bg-emerald-500/15 text-emerald-300 shadow-sm"
                  : "border border-transparent hover:bg-white/5 text-slate-400 hover:text-slate-200"
              } ${!info || status === "pending" ? "opacity-35 cursor-not-allowed" : "cursor-pointer"}`}
            >
              <span className="w-4 shrink-0 font-mono text-[10px] text-slate-500">
                {String(i + 1).padStart(2, "0")}
              </span>
              {iconFor(status)}
              <span className={`flex-1 truncate font-medium ${status === "failed" ? "text-rose-400 font-semibold" : ""}`}>
                {name}
              </span>
              {info && info.durationMs > 0 && (
                <span className="font-mono text-[10px] text-emerald-400/80 bg-emerald-500/10 px-1 rounded">
                  {info.durationMs.toFixed(1)}ms
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
