import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, Download, ChevronDown, ChevronRight } from "lucide-react";
import { fetchHistory, fetchStats } from "../lib/api";
import Sparkline from "../components/Sparkline";
import type { CompilationRecord, Stats } from "../lib/types";

export default function HistoryPage() {
  const [history, setHistory] = useState<CompilationRecord[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [selected, setSelected] = useState<CompilationRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [sourceOpen, setSourceOpen] = useState(false);

  async function load() {
    setLoading(true);
    setLoadError(false);
    try {
      const [h, s] = await Promise.all([fetchHistory(), fetchStats()]);
      setHistory(h);
      setStats(s);
      // Auto-select the most recent compilation so the detail panel is
      // never blank on load (Part 8) -- but don't override a selection
      // the user already made.
      setSelected((prev) => prev ?? h[0] ?? null);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  if (loading) {
    return <div className="p-10 text-center text-sm text-slate-500">Loading compilation analytics…</div>;
  }
  if (loadError) {
    return (
      <div className="p-10 text-center text-sm text-rose-400">
        Unable to load compilation history. Please try again.
        <div className="mt-3">
          <button onClick={() => void load()} className="rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/10">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-49px)] max-w-[1400px] flex-col gap-5 overflow-y-auto p-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-lg font-semibold text-slate-100">Compilation History</div>
          <div className="text-[12px] text-slate-500">
            Persisted in SQLite (<span className="font-mono">backend/data/sheetlang.db</span>) — every row is a real
            past compile, logged the moment it ran.
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => void load()} className="rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/10">
            Refresh
          </button>
          <a href="/api/export/csv" className="flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/10">
            <Download size={13} /> Export CSV
          </a>
        </div>
      </div>

      {history.length === 0 ? (
        <div className="rounded-lg border border-[#26313c] bg-[#111820] p-10 text-center text-sm text-slate-500">
          No compilation history available yet — compile something in the Playground first.
        </div>
      ) : (
        <>
          {/* KPI hierarchy: Success Rate is dominant, others secondary */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1.4fr_1fr_1fr_1fr]">
            <div className="rounded-lg border border-indigo-500/30 bg-gradient-to-br from-indigo-500/10 to-transparent p-5">
              <div className="text-[11px] uppercase tracking-wider text-indigo-300">Success Rate</div>
              <div className="mt-1 text-4xl font-semibold text-slate-100">{stats?.successRate}%</div>
              <div className="mt-1 text-[11.5px] text-slate-500">{stats?.successful} of {stats?.total} compilations succeeded</div>
            </div>
            <div className="rounded-lg border border-[#26313c] bg-[#111820] p-5">
              <div className="text-[11px] uppercase tracking-wider text-slate-500">Total Compilations</div>
              <div className="mt-1 text-2xl font-semibold text-slate-100">{stats?.total}</div>
            </div>
            <div className="rounded-lg border border-[#26313c] bg-[#111820] p-5">
              <div className="text-[11px] uppercase tracking-wider text-slate-500">Failed</div>
              <div className="mt-1 text-2xl font-semibold text-slate-100">{stats?.failed}</div>
            </div>
            <div className="rounded-lg border border-[#26313c] bg-[#111820] p-5">
              <div className="flex items-center justify-between">
                <div className="text-[11px] uppercase tracking-wider text-slate-500">Avg Compile Time</div>
              </div>
              <div className="mt-1 text-2xl font-semibold text-slate-100">{stats?.averageCompileTimeMs} ms</div>
              <div className="mt-1">
                <Sparkline values={(stats?.recentCompileTimes ?? []).map((r) => r.compile_time_ms)} />
              </div>
            </div>
          </div>

          {stats && stats.failuresByStage.length > 0 && (
            <div className="rounded-lg border border-[#26313c] bg-[#111820] p-4">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Failures by Stage</div>
              <div className="flex flex-wrap gap-2">
                {stats.failuresByStage.map((f) => (
                  <span key={f.stage} className="rounded bg-rose-500/10 px-2.5 py-1 text-[12px] text-rose-300">
                    {f.stage}: {f.count}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-1 gap-4 overflow-hidden">
            <div className="w-3/5 overflow-auto rounded-lg border border-[#26313c] bg-[#111820]">
              <table className="w-full text-[12.5px]">
                <thead className="sticky top-0 bg-[#111820]">
                  <tr className="border-b border-[#26313c] text-left text-slate-500">
                    <th className="px-3 py-2">Time</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Compile Time</th>
                    <th className="px-3 py-2">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h) => (
                    <tr
                      key={h.id}
                      onClick={() => { setSelected(h); setSourceOpen(false); }}
                      className={`cursor-pointer border-b border-white/5 hover:bg-white/5 ${selected?.id === h.id ? "bg-indigo-500/10" : ""}`}
                    >
                      <td className="px-3 py-1.5 font-mono text-slate-400">{new Date(h.timestamp).toLocaleTimeString()}</td>
                      <td className="px-3 py-1.5">
                        {h.success ? (
                          <span className="flex items-center gap-1 text-emerald-400"><CheckCircle2 size={13} /> Success</span>
                        ) : (
                          <span className="flex items-center gap-1 text-rose-400"><XCircle size={13} /> Failed</span>
                        )}
                      </td>
                      <td className="px-3 py-1.5 font-mono text-slate-300">{h.compile_time_ms.toFixed(1)} ms</td>
                      <td className="px-3 py-1.5 text-slate-400">
                        {h.success
                          ? `Exit ${h.runtime_exit_code}${h.execution_ms !== null ? ` · ${h.execution_ms.toFixed(1)} ms run` : ""}`
                          : `Failed at ${h.failed_stage ?? "unknown stage"}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="w-2/5 overflow-auto rounded-lg border border-[#26313c] bg-[#111820] p-4">
              {!selected ? (
                <div className="text-sm text-slate-500">Select a compilation to view details.</div>
              ) : (
                <div className="space-y-4 text-[12.5px]">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Compilation #{selected.id}</div>
                    <div className="mt-1 text-slate-400">{new Date(selected.timestamp).toLocaleString()}</div>
                    <div className={`mt-1 font-medium ${selected.success ? "text-emerald-400" : "text-rose-400"}`}>
                      {selected.success ? "✓ SUCCESS" : "✗ FAILED"}
                    </div>
                  </div>

                  <div>
                    <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Performance</div>
                    <div className="grid grid-cols-2 gap-2 text-slate-300">
                      <div>Compile Time: <span className="font-mono">{selected.compile_time_ms.toFixed(1)} ms</span></div>
                      {selected.execution_ms !== null && (
                        <div>Execution Time: <span className="font-mono">{selected.execution_ms.toFixed(1)} ms</span></div>
                      )}
                      {selected.lexer_ms !== null && <div>Lexer: <span className="font-mono">{selected.lexer_ms.toFixed(1)} ms</span></div>}
                      {selected.parser_ms !== null && <div>Parser: <span className="font-mono">{selected.parser_ms.toFixed(1)} ms</span></div>}
                      {selected.semantic_ms !== null && <div>Semantic: <span className="font-mono">{selected.semantic_ms.toFixed(1)} ms</span></div>}
                      {selected.llvm_ms !== null && <div>LLVM IR: <span className="font-mono">{selected.llvm_ms.toFixed(1)} ms</span></div>}
                    </div>
                  </div>

                  {selected.success ? (
                    <div>
                      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Runtime Output</div>
                      <pre className="max-h-32 overflow-auto rounded bg-black/40 p-2 font-mono text-[11.5px] text-slate-200">
                        {selected.runtime_output || "(no output)"}
                      </pre>
                      <div className="mt-1 text-[11px] text-slate-500">Exit code: {selected.runtime_exit_code}</div>
                    </div>
                  ) : (
                    <div>
                      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-rose-400">Error</div>
                      <div className="rounded bg-rose-500/10 p-2 text-rose-300">{selected.error_message}</div>
                      <div className="mt-1 text-[11px] text-slate-500">Failed stage: {selected.failed_stage}</div>
                    </div>
                  )}

                  <div>
                    <button
                      onClick={() => setSourceOpen((o) => !o)}
                      className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400 hover:text-slate-200"
                    >
                      {sourceOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />} Source Code
                    </button>
                    {sourceOpen && (
                      <pre className="mt-2 max-h-56 overflow-auto rounded bg-black/40 p-2 font-mono text-[11.5px] text-slate-300">
                        {selected.source_code}
                      </pre>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
