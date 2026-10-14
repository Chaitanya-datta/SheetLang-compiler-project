import { Info, Layers, Terminal, Cpu, Database, BarChart3, ShieldCheck } from "lucide-react";

const STACK = [
  { cat: "Frontend Studio", icon: Terminal, items: ["React 19", "TypeScript", "Vite 8", "Tailwind CSS v4", "Monaco Editor (VS Code)", "React Router 7"] },
  { cat: "Compiler Core", icon: Cpu, items: ["C++17", "Flex Scanner", "Bison LALR(1)", "CMake Toolchain"] },
  { cat: "Code Generation", icon: Layers, items: ["LLVM 18/22 TargetMachine", "SSA Form Builder", "llvm::verifyModule", "Native Host Linker (cc/clang/ld)"] },
  { cat: "Spreadsheet Runtime", icon: ShieldCheck, items: ["C Standard Library Memory Allocator", "CSV Injector", "Range Macro Expander"] },
  { cat: "Backend Server", icon: Database, items: ["Node.js v26", "Express API", "TypeScript", "Secure execFile Sandboxing"] },
  { cat: "Telemetry & Storage", icon: BarChart3, items: ["SQLite via node:sqlite", "Power BI Desktop Connector", "CSV Exporter"] },
];

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-[950px] p-8 space-y-6">
      <div className="border-b border-white/5 pb-4">
        <div className="flex items-center gap-2">
          <Info size={20} className="text-emerald-400" />
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 font-mono">System Architecture & Technology Stack</h1>
        </div>
        <p className="mt-1 text-xs text-slate-400">
          Complete breakdown of software engineering components powering the SheetLang compiler platform.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {STACK.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.cat} className="glass-card-interactive rounded-2xl border border-white/10 bg-[#080d16] p-5 shadow-xl">
              <div className="flex items-center gap-2 mb-3">
                <Icon size={16} className="text-emerald-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">{s.cat}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {s.items.map((i) => (
                  <span key={i} className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 text-xs font-mono text-emerald-300">
                    {i}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
