const STACK = [
  { cat: "Frontend", items: ["React", "TypeScript", "Vite", "Tailwind CSS", "Monaco Editor", "React Router"] },
  { cat: "Backend", items: ["Node.js", "Express", "TypeScript"] },
  { cat: "Compiler", items: ["C++17", "Flex", "Bison", "CMake"] },
  { cat: "Code Generation", items: ["LLVM 22.1.8", "llvm::Triple-based TargetMachine", "system linker (cc/clang/gcc)"] },
  { cat: "Database", items: ["SQLite via node:sqlite"] },
  { cat: "Analytics", items: ["CSV export", "Power BI Desktop"] },
];

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-[820px] p-8">
      <div className="text-lg font-semibold text-slate-100">SheetLang</div>
      <p className="mt-2 max-w-xl text-[13px] text-slate-500">
        A lightweight programming language and compiler analytics platform — built as a real
        compiler (lexer through native code generation), with a web-based playground and
        SQLite-backed compilation analytics.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {STACK.map((s) => (
          <div key={s.cat} className="rounded-lg border border-[#26313c] bg-[#111820] p-4">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{s.cat}</div>
            <div className="flex flex-wrap gap-1.5">
              {s.items.map((i) => (
                <span key={i} className="rounded bg-white/5 px-2 py-1 text-[12px] text-slate-300">{i}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
