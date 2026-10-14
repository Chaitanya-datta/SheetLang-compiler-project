import { NavLink } from "react-router-dom";
import { useEffect, useState } from "react";
import { fetchHealth } from "../lib/api";
import type { HealthStatus } from "../lib/types";
import { Terminal, Activity, FileSpreadsheet, Sparkles, BookOpen, Info, ShieldCheck, Zap } from "lucide-react";

const LINKS = [
  { to: "/", label: "Overview", icon: Sparkles, end: true },
  { to: "/playground", label: "Studio IDE", icon: Terminal },
  { to: "/history", label: "Audit Log", icon: Activity },
  { to: "/internals", label: "Compiler Core", icon: ShieldCheck },
  { to: "/analytics", label: "Analytics", icon: Zap },
  { to: "/docs", label: "Docs", icon: BookOpen },
  { to: "/about", label: "Architecture", icon: Info },
];

export default function NavBar() {
  const [health, setHealth] = useState<HealthStatus | null>(null);

  useEffect(() => {
    fetchHealth().then(setHealth).catch(() => setHealth(null));
    const id = setInterval(() => {
      fetchHealth().then(setHealth).catch(() => setHealth(null));
    }, 30_000);
    return () => clearInterval(id);
  }, []);

  const connected = health?.compiler === "available";

  return (
    <header className="sticky top-0 z-50 border-b border-emerald-500/15 bg-[#05070a]/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1500px] items-center justify-between px-6 py-3">
        <div className="flex items-center gap-8">
          <NavLink to="/" className="group flex items-center gap-3">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-600 via-teal-500 to-cyan-400 p-[1px] shadow-lg shadow-emerald-500/20 group-hover:shadow-emerald-500/40 transition-all">
              <div className="flex h-full w-full items-center justify-center rounded-[11px] bg-[#090d16]">
                <FileSpreadsheet size={18} className="text-emerald-400 group-hover:scale-110 transition-transform" />
              </div>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold tracking-wider text-slate-100 font-mono">SHEET<span className="text-emerald-400">LANG</span></span>
                <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.2 text-[9px] font-semibold text-emerald-400 tracking-wide">LLVM</span>
              </div>
              <span className="text-[10px] text-slate-400 tracking-tight font-medium">Native Spreadsheet Engine</span>
            </div>
          </NavLink>

          <nav className="flex items-center gap-1.5 bg-slate-900/60 p-1 rounded-xl border border-white/5">
            {LINKS.map((l) => {
              const Icon = l.icon;
              return (
                <NavLink
                  key={l.to}
                  to={l.to}
                  end={l.end}
                  className={({ isActive }) =>
                    `flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                      isActive
                        ? "bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 text-emerald-300 shadow-sm shadow-emerald-950"
                        : "text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent"
                    }`
                  }
                >
                  <Icon size={13} className="shrink-0" />
                  {l.label}
                </NavLink>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-900/70 px-3.5 py-1.5 text-[11px]">
            <span className="relative flex h-2 w-2">
              {connected && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              )}
              <span className={`relative inline-flex h-2 w-2 rounded-full ${connected ? "bg-emerald-400" : "bg-rose-500"}`} />
            </span>
            <span className="font-mono text-slate-300">
              {health ? (connected ? "LLVM RUNTIME ONLINE" : "ENGINE DISCONNECTED") : "PROBING..."}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
