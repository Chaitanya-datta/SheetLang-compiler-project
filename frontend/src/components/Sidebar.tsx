import { useState } from "react";
import { ChevronRight, ChevronDown, FileCode, FolderClosed, Sparkles } from "lucide-react";
import type { ExampleMeta } from "../lib/types";

export default function Sidebar({
  examples,
  onSelect,
  activeId,
}: {
  examples: ExampleMeta[];
  onSelect: (id: string) => void;
  activeId: string | null;
}) {
  const categories = Array.from(new Set(examples.map((e) => e.category)));
  const [open, setOpen] = useState<Record<string, boolean>>(
    Object.fromEntries(categories.map((c) => [c, true]))
  );

  return (
    <div className="flex h-full flex-col bg-[#080d16] border-r border-white/5 select-none">
      <div className="flex items-center justify-between border-b border-white/5 px-4 py-3 bg-[#0c121e]">
        <div className="flex items-center gap-2">
          <FolderClosed size={14} className="text-emerald-400" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300 font-mono">
            Program Scripts
          </span>
        </div>
        <span className="text-[10px] font-mono text-emerald-400/80 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
          {examples.length} Files
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {categories.map((cat) => {
          const isOpen = open[cat];
          const isCsvCat = cat.toLowerCase().includes("csv");
          return (
            <div key={cat} className="rounded-lg overflow-hidden">
              <button
                onClick={() => setOpen((o) => ({ ...o, [cat]: !o[cat] }))}
                className={`flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-[11.5px] font-medium transition-colors ${
                  isCsvCat 
                    ? "text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20" 
                    : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                }`}
              >
                <div className="flex items-center gap-1.5 truncate">
                  {isOpen ? <ChevronDown size={12} className="text-slate-400" /> : <ChevronRight size={12} className="text-slate-400" />}
                  <span className="truncate">{cat}</span>
                </div>
                {isCsvCat && (
                  <Sparkles size={11} className="text-emerald-400 shrink-0" />
                )}
              </button>

              {isOpen && (
                <div className="mt-0.5 ml-2 border-l border-emerald-500/20 pl-1.5 space-y-0.5">
                  {examples
                    .filter((e) => e.category === cat)
                    .map((e) => {
                      const isActive = activeId === e.id;
                      return (
                        <button
                          key={e.id}
                          onClick={() => onSelect(e.id)}
                          className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] font-mono transition-all ${
                            isActive
                              ? "bg-gradient-to-r from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 text-emerald-300 shadow-sm"
                              : "text-slate-400 hover:bg-white/5 hover:text-slate-200 border border-transparent"
                          }`}
                        >
                          <FileCode size={13} className={`shrink-0 ${isActive ? "text-emerald-400" : "text-slate-500"}`} />
                          <span className="truncate">{e.label}</span>
                        </button>
                      );
                    })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
