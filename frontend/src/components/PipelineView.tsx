import { CheckCircle2, XCircle, Circle, MinusCircle } from "lucide-react";
import type { StageResult } from "../lib/types";

const ALL_STAGES: [string, string][] = [
  ["source", "Source"],
  ["lexer", "Lexical Analysis"],
  ["parser", "Syntax Analysis"],
  ["ast", "AST Construction"],
  ["symbols", "Symbol Table"],
  ["semantic", "Semantic Analysis"],
  ["dependencies", "Dependency Analysis"],
  ["llvmIr", "LLVM IR Generation"],
  ["assembly", "Assembly Generation"],
  ["object", "Object Generation"],
  ["executable", "Executable Generation"],
  ["runtime", "Runtime"],
];

function iconFor(status: string) {
  switch (status) {
    case "success":
      return <CheckCircle2 size={15} className="text-emerald-400" />;
    case "failed":
      return <XCircle size={15} className="text-rose-400" />;
    case "skipped":
      return <MinusCircle size={15} className="text-slate-600" />;
    default:
      return <Circle size={15} className="text-slate-700" />;
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
    <div className="flex h-full flex-col">
      <div className="px-4 pb-3 pt-4">
        <div className="mb-1.5 flex items-center justify-between text-[11px] text-slate-400">
          <span>Compilation Progress</span>
          <span>{completed} / {total} stages</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
          <div
            className={`h-full rounded-full transition-all duration-300 ${hasFailure ? "bg-rose-500" : "bg-indigo-500"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {ALL_STAGES.map(([id, name], i) => {
          const info = byId.get(id);
          const status = info?.status ?? "pending";
          const isSelected = selected === id;
          return (
            <button
              key={id}
              onClick={() => info && status !== "pending" && onSelect(id)}
              disabled={!info || status === "pending"}
              className={`mb-0.5 flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px] transition-colors ${
                isSelected ? "border border-indigo-500/30 bg-indigo-500/15" : "border border-transparent hover:bg-white/5"
              } ${!info ? "opacity-40" : ""}`}
            >
              <span className="w-5 shrink-0 text-[10px] font-mono text-slate-600">{String(i + 1).padStart(2, "0")}</span>
              {iconFor(status)}
              <span className={`flex-1 ${status === "failed" ? "text-rose-300" : "text-slate-200"}`}>{name}</span>
              {info && info.durationMs > 0 && (
                <span className="font-mono text-[10px] text-slate-500">{info.durationMs.toFixed(1)}ms</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
