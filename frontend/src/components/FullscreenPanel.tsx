import { useState } from "react";
import { Maximize2, Minimize2 } from "lucide-react";

export default function FullscreenPanel({ children }: { children: (fullscreen: boolean) => React.ReactNode }) {
  const [full, setFull] = useState(false);
  return (
    <div className={full ? "fixed inset-0 z-50 flex flex-col bg-[#0d1017] p-4" : "relative"}>
      <button
        onClick={() => setFull((f) => !f)}
        className="absolute right-3 top-1 z-10 flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-slate-300 hover:bg-white/10"
        title={full ? "Exit fullscreen" : "Fullscreen"}
      >
        {full ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
      </button>
      <div className={full ? "flex-1 overflow-auto" : ""}>{children(full)}</div>
    </div>
  );
}
