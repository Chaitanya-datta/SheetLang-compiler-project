import { NavLink } from "react-router-dom";
import { useEffect, useState } from "react";
import { fetchHealth } from "../lib/api";
import type { HealthStatus } from "../lib/types";

const LINKS = [
  { to: "/", label: "Home", end: true },
  { to: "/playground", label: "Playground" },
  { to: "/history", label: "History" },
  { to: "/internals", label: "Compiler Internals" },
  { to: "/analytics", label: "Analytics" },
  { to: "/docs", label: "Documentation" },
  { to: "/about", label: "About" },
];

export default function NavBar() {
  const [health, setHealth] = useState<HealthStatus | null>(null);

  useEffect(() => {
    fetchHealth().then(setHealth).catch(() => setHealth(null));
    const id = setInterval(() => {
      fetchHealth().then(setHealth).catch(() => setHealth(null));
    }, 30_000); // occasional re-check, not a tight poll
    return () => clearInterval(id);
  }, []);

  const connected = health?.compiler === "available";

  return (
    <header className="sticky top-0 z-40 border-b border-[#26313c] bg-[#0d1017]/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between px-5 py-2.5">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-indigo-500 to-cyan-500 text-[11px] font-bold">
              SL
            </div>
            <span className="text-[13px] font-semibold tracking-wide text-slate-100">SHEETLANG</span>
          </div>

          <nav className="flex items-center gap-1">
            {LINKS.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                className={({ isActive }) =>
                  `rounded-md px-2.5 py-1.5 text-[12.5px] font-medium transition-colors ${
                    isActive ? "bg-indigo-500/15 text-indigo-300" : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                  }`
                }
              >
                {l.label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-slate-300">
          <span className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-emerald-400" : "bg-rose-400"}`} />
          {health ? (connected ? "Compiler Connected" : "Compiler Offline") : "Checking…"}
        </div>
      </div>
    </header>
  );
}
