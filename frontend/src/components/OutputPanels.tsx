import { useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import type { CompileResult } from "../lib/types";
import CopyButton from "./CopyButton";
import AstTree from "./AstTree";
import FullscreenPanel from "./FullscreenPanel";

const TABS = [
  "Overview", "Tokens", "AST", "Symbols", "Semantic",
  "Dependencies", "LLVM IR", "Assembly", "Build", "Runtime",
] as const;
export type TabName = (typeof TABS)[number];

export function TabBar({ active, onSelect }: { active: TabName; onSelect: (t: TabName) => void }) {
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-[#26313c] bg-[#0d1017] px-3">
      {TABS.map((t) => (
        <button
          key={t}
          onClick={() => onSelect(t)}
          className={`whitespace-nowrap border-b-2 px-3 py-2.5 text-xs font-medium transition-colors ${
            active === t ? "border-indigo-500 text-indigo-300" : "border-transparent text-slate-500 hover:text-slate-300"
          }`}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return <div className="p-6 text-sm text-slate-500">{label} — not available (an earlier real stage did not run or failed).</div>;
}

function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 pt-3 pb-2">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{children}</div>
      {action}
    </div>
  );
}

const STAGE_ORDER = [
  ["source", "Source"], ["lexer", "Lexer"], ["parser", "Parser"], ["ast", "AST"],
  ["symbols", "Symbols"], ["semantic", "Semantic Analysis"], ["dependencies", "Dependency Analysis"],
  ["llvmIr", "LLVM IR"], ["assembly", "Assembly"], ["object", "Object"],
  ["executable", "Executable"], ["runtime", "Runtime"],
] as const;

export function OutputPanel({ tab, result }: { tab: TabName; result: CompileResult | null }) {
  const [astFilter, setAstFilter] = useState("");

  if (!result) {
    return <div className="p-6 text-sm text-slate-500">Compile a program to see real compiler output here.</div>;
  }

  switch (tab) {
    case "Overview": {
      const totalMs = result.stages.reduce((a, s) => a + s.durationMs, 0);
      const completed = result.stages.filter((s) => s.status === "success").length;
      return (
        <div className="p-5">
          <div className="mb-5 flex items-center gap-3">
            {result.success ? (
              <CheckCircle2 size={22} className="text-emerald-400" />
            ) : (
              <XCircle size={22} className="text-rose-400" />
            )}
            <div>
              <div className={`text-base font-semibold ${result.success ? "text-emerald-300" : "text-rose-300"}`}>
                {result.success ? "Compilation Successful" : "Compilation Failed"}
              </div>
              <div className="text-[12px] text-slate-500">
                {completed} stages completed &nbsp;·&nbsp; total time {totalMs.toFixed(1)} ms
                {result.runtime && <> &nbsp;·&nbsp; exit code {result.runtime.exitCode}</>}
              </div>
            </div>
          </div>

          <div className="mb-5 space-y-1">
            {STAGE_ORDER.map(([id, label]) => {
              const s = result.stages.find((x) => x.id === id);
              const status = s?.status ?? "pending";
              const symbol = status === "success" ? "✓" : status === "failed" ? "✕" : status === "skipped" ? "○" : "○";
              const color =
                status === "success" ? "text-emerald-400" : status === "failed" ? "text-rose-400" : "text-slate-600";
              return (
                <div key={id} className={`flex items-center gap-2 font-mono text-[12.5px] ${color}`}>
                  <span className="w-4">{symbol}</span>
                  <span>{label}</span>
                  {s && s.durationMs > 0 && <span className="text-slate-600">({s.durationMs.toFixed(1)} ms)</span>}
                </div>
              );
            })}
          </div>

          {!result.success && result.error && (
            <div className="mb-5 rounded-md border border-rose-500/30 bg-rose-500/10 p-3 text-[13px] text-rose-300">
              <div className="font-medium">Stopped at: {result.stage}</div>
              <div className="mt-1">{result.error}</div>
            </div>
          )}

          {result.runtime && (
            <div>
              <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Program Output</div>
              <div className="rounded-md bg-black/40 p-3 font-mono text-[13px] text-slate-200">
                <pre className="whitespace-pre-wrap">{result.runtime.stdout || "(no output)"}</pre>
              </div>
            </div>
          )}
        </div>
      );
    }

    case "Tokens": {
      if (!result.tokens) return <Empty label="Token stream" />;
      const raw = result.tokens.tokens.map((t) => `${t.lexeme}\t${t.token}\tline ${t.line} col ${t.col}`).join("\n");
      return (
        <div>
          <SectionTitle action={<CopyButton text={raw} />}>
            Token Stream — {result.tokens.count} tokens, {result.tokens.errors.length} lexical errors
          </SectionTitle>
          <div className="max-h-[420px] overflow-auto px-4 pb-4">
            <table className="w-full font-mono text-[12.5px]">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="w-10 pb-1.5">#</th><th className="pb-1.5">Token</th>
                  <th className="pb-1.5">Lexeme</th><th className="pb-1.5">Line</th><th className="pb-1.5">Col</th>
                </tr>
              </thead>
              <tbody>
                {result.tokens.tokens.map((t, i) => (
                  <tr key={i} className="border-t border-white/5 text-slate-300">
                    <td className="py-1 text-slate-600">{i + 1}</td>
                    <td className="py-1 text-indigo-300">{t.token}</td>
                    <td className="py-1">{t.lexeme}</td>
                    <td className="py-1 text-slate-500">{t.line}</td>
                    <td className="py-1 text-slate-500">{t.col}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {result.tokens.errors.map((e, i) => (
              <div key={i} className="mt-2 rounded border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-[12.5px] text-rose-300">{e}</div>
            ))}
          </div>
        </div>
      );
    }

    case "AST": {
      if (!result.ast) return <Empty label="AST" />;
      return (
        <FullscreenPanel>
          {() => (
            <div>
              <SectionTitle action={<CopyButton text={result.ast!.raw} />}>Abstract Syntax Tree (real parser output)</SectionTitle>
              <div className="px-4 pb-2">
                <input
                  value={astFilter}
                  onChange={(e) => setAstFilter(e.target.value)}
                  placeholder="Filter nodes…"
                  className="w-full rounded-md border border-white/10 bg-black/30 px-2.5 py-1.5 text-[12.5px] text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50"
                />
              </div>
              <div className="max-h-[420px] overflow-auto">
                <AstTree root={result.ast!.tree} filter={astFilter} />
              </div>
            </div>
          )}
        </FullscreenPanel>
      );
    }

    case "Symbols": {
      if (!result.symbols) return <Empty label="Symbol information" />;
      const { symbols, functions } = result.symbols;
      return (
        <div className="p-4">
          <div className="mb-3 flex items-center gap-2">
            <span className="rounded bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-300">
              AST-derived
            </span>
            <span className="text-[11px] text-slate-500">
              Declared identifiers extracted from real --ast output. Not a compiler symbol-table dump (sheetc has no such mode) — no line numbers, since the text AST doesn't include them.
            </span>
          </div>
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="text-left text-slate-500"><th className="pb-1.5">Identifier</th><th className="pb-1.5">Declaration</th></tr>
            </thead>
            <tbody>
              {symbols.map((s, i) => (
                <tr key={i} className="border-t border-white/5 text-slate-300">
                  <td className="py-1 font-mono">{s.name}</td>
                  <td className="py-1 text-slate-500">{s.kind}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {functions.length > 0 && (
            <>
              <div className="mt-4 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Functions ({functions.length})</div>
              {functions.map((f, i) => (
                <div key={i} className="border-t border-white/5 py-1 font-mono text-[12.5px] text-slate-300">{f.signature}</div>
              ))}
            </>
          )}
        </div>
      );
    }

    case "Semantic": {
      if (!result.semantic) return <Empty label="Semantic diagnostics" />;
      const sem = result.semantic;
      return (
        <div className="p-4">
          {sem.passed ? (
            <div className="space-y-1.5 text-[13px] text-emerald-300">
              <div>✓ No semantic errors found</div>
              <div>✓ All identifiers resolved</div>
              <div>✓ No duplicate declarations</div>
              <div>✓ Function calls valid</div>
              <div>✓ Scope rules satisfied</div>
              <div className="mt-3 text-slate-400">Semantic Errors: 0</div>
            </div>
          ) : (
            <div className="space-y-2">
              {sem.errors.map((e, i) => (
                <div key={i} className="rounded-md border border-rose-500/30 bg-rose-500/10 p-3">
                  <div className="text-[13px] font-medium text-rose-300">Semantic Error</div>
                  <div className="mt-1 text-[13px] text-slate-200">{e.message}</div>
                  <div className="mt-1 font-mono text-[11px] text-slate-500">Line {e.line}</div>
                </div>
              ))}
              <div className="text-[12px] text-slate-500">Compilation stopped — real compiler diagnostic.</div>
            </div>
          )}
        </div>
      );
    }

    case "Dependencies": {
      if (!result.dependencies) return <Empty label="Dependency analysis" />;
      const { edges, order, usedBy, errors } = result.dependencies;
      return (
        <div className="p-4">
          {errors.length > 0 && (
            <div className="mb-3 rounded-md border border-rose-500/30 bg-rose-500/10 p-3 text-[13px] text-rose-300">{errors.join("\n")}</div>
          )}
          <div className="mb-4">
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Dependencies ({edges.length})</div>
            {edges.length === 0 ? (
              <div className="text-sm text-slate-500">No inter-variable dependencies.</div>
            ) : (
              edges.map((e, i) => (
                <div key={i} className="border-t border-white/5 py-1.5 font-mono text-[13px]">
                  <span className="text-indigo-300">{e.from}</span>
                  <span className="text-slate-500"> depends on </span>
                  <span className="text-slate-200">{e.to.join(", ")}</span>
                </div>
              ))
            )}
          </div>
          {Object.keys(usedBy).length > 0 && (
            <div className="mb-4">
              <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Used By (reverse dependencies)</div>
              {Object.entries(usedBy).map(([name, users], i) => (
                <div key={i} className="border-t border-white/5 py-1.5 font-mono text-[13px]">
                  <span className="text-indigo-300">{name}</span>
                  <span className="text-slate-500"> used by </span>
                  <span className="text-slate-200">{users.join(", ")}</span>
                </div>
              ))}
            </div>
          )}
          <div>
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Evaluation Order</div>
            <div className="flex flex-wrap gap-1.5">
              {order.map((o, i) => (
                <span key={i} className="rounded bg-white/5 px-2 py-0.5 font-mono text-[12.5px] text-slate-200">
                  {o}{i < order.length - 1 && <span className="ml-1.5 text-slate-600">→</span>}
                </span>
              ))}
            </div>
          </div>
        </div>
      );
    }

    case "LLVM IR": {
      if (!result.llvmIr) return <Empty label="LLVM IR" />;
      const ir = result.llvmIr;
      return (
        <FullscreenPanel>
          {() => (
            <div>
              <SectionTitle action={<CopyButton text={ir.text} />}>LLVM IR</SectionTitle>
              <div className="flex flex-wrap gap-4 px-4 pb-2 text-[11px] text-slate-400">
                <span>Verification: {ir.verified ? <span className="text-emerald-400">Passed</span> : <span className="text-rose-400">Failed</span>}</span>
                <span>Functions: {ir.functionCount}</span>
                <span>Basic Blocks: {ir.basicBlockCount}</span>
                <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-amber-300">
                  Optimization: {result.optimization.enabled ? "Enabled" : "Not enabled"}
                </span>
              </div>
              <pre className="max-h-[520px] overflow-auto whitespace-pre px-4 pb-4 font-mono text-[12px] leading-5 text-slate-300">
                {ir.text.split("\n").map((line, i) => (
                  <div key={i} className="flex">
                    <span className="mr-3 select-none text-slate-700">{String(i + 1).padStart(3, " ")}</span>
                    <span>{line}</span>
                  </div>
                ))}
              </pre>
            </div>
          )}
        </FullscreenPanel>
      );
    }

    case "Assembly": {
      if (!result.assembly) return <Empty label="Assembly" />;
      if (result.assembly.error) {
        return <div className="p-4 text-sm text-rose-300">Assembly generation failed: {result.assembly.error}</div>;
      }
      return (
        <FullscreenPanel>
          {() => (
            <div>
              <SectionTitle action={<CopyButton text={result.assembly!.text} />}>Generated Assembly (real TargetMachine output)</SectionTitle>
              <pre className="max-h-[520px] overflow-auto whitespace-pre px-4 pb-4 font-mono text-[12px] leading-5 text-slate-300">
                {result.assembly!.text}
              </pre>
            </div>
          )}
        </FullscreenPanel>
      );
    }

    case "Build": {
      const b = result.build;
      return (
        <FullscreenPanel>
          {() => (
            <div className="p-4 space-y-4 text-[13px]">
              <div>
                <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Object Generation</div>
                <div className={result.object.generated ? "text-emerald-300" : "text-slate-400"}>
                  {result.object.generated ? "✓" : "○"} {result.object.generated ? "Handled internally by native code generation" : "Not generated"}
                </div>
                <div className="mt-1 text-[11.5px] text-slate-500">{result.object.note}</div>
              </div>
              <div>
                <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Optimization</div>
                <div className="text-slate-400">○ Not enabled</div>
                <div className="mt-1 text-[11.5px] text-slate-500">{result.optimization.note}</div>
              </div>
              <div>
                <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Linking</div>
                {b ? (
                  <div className={b.linked ? "text-emerald-300" : "text-rose-300"}>{b.linked ? "✓ Linking succeeded" : "✕ Linking failed"}</div>
                ) : (
                  <div className="text-slate-500">Not reached</div>
                )}
                {b?.error && <div className="mt-2 rounded border border-rose-500/30 bg-rose-500/10 p-3 text-rose-300">{b.error}</div>}
              </div>
            </div>
          )}
        </FullscreenPanel>
      );
    }

    case "Runtime": {
      if (!result.runtime) return <Empty label="Execution" />;
      const ex = result.runtime;
      return (
        <FullscreenPanel>
          {() => (
            <div className="p-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Program Output</div>
                <CopyButton text={ex.stdout} />
              </div>
              <div className="rounded-md bg-black/40 p-3 font-mono text-[13px] text-slate-200">
                <div className="text-slate-500">$ ./program</div>
                <pre className="mt-1 whitespace-pre-wrap">{ex.stdout || "(no output)"}</pre>
                {ex.stderr && <pre className="mt-1 whitespace-pre-wrap text-rose-300">{ex.stderr}</pre>}
              </div>
              <div className="mt-3 flex gap-4 text-[12px] text-slate-400">
                <span>Exit Code: <span className={ex.exitCode === 0 ? "text-emerald-400" : "text-rose-400"}>{ex.exitCode}</span></span>
                <span>Execution Time: {ex.durationMs.toFixed(2)} ms</span>
                {ex.timedOut && <span className="text-rose-400">Timed out</span>}
              </div>
            </div>
          )}
        </FullscreenPanel>
      );
    }

    default:
      return null;
  }
}
