import { useState } from "react";
import { ChevronRight, ChevronDown, FileCode } from "lucide-react";
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
    Object.fromEntries(categories.map((c) => [c, c !== "Error Cases"]))
  );

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="border-b border-white/10 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        Examples
      </div>
      <div className="flex-1 px-2 py-2">
        {categories.map((cat) => (
          <div key={cat} className="mb-1">
            <button
              onClick={() => setOpen((o) => ({ ...o, [cat]: !o[cat] }))}
              className="flex w-full items-center gap-1.5 rounded px-1.5 py-1.5 text-[12px] font-medium text-slate-400 hover:text-slate-200"
            >
              {open[cat] ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              {cat}
            </button>
            {open[cat] && (
              <div className="ml-1 border-l border-white/5 pl-2">
                {examples
                  .filter((e) => e.category === cat)
                  .map((e) => (
                    <button
                      key={e.id}
                      onClick={() => onSelect(e.id)}
                      className={`flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-[12.5px] transition-colors ${
                        activeId === e.id ? "bg-indigo-500/15 text-indigo-300" : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                      }`}
                    >
                      <FileCode size={12} className="shrink-0" />
                      <span className="truncate">{e.label}</span>
                    </button>
                  ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
