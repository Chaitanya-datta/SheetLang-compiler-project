import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, Download } from "lucide-react";
import { fetchHistory, fetchStats } from "../lib/api";
import type { CompilationRecord, Stats } from "../lib/types";

function StatCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[#26313c] bg-[#111820] p-4">
      <div className="text-[11px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-slate-100">{value}</div>
    </div>
  );
}

export default function HistoryView() {
  const [history, setHistory] = useState<CompilationRecord[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [selected, setSelected] = useState<CompilationRecord | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [h, s] = await Promise.all([fetchHistory(), fetchStats()]);
    setHistory(h);
    setStats(s);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-base font-semibold text-slate-100">Compilation History &amp; Statistics</div>
          <div className="text-[12px] text-slate-500">
            Persisted in SQLite (<span className="font-mono">backend/data/sheetlang.db</span>) — every row is a real
            past <span className="font-mono">/api/compile</span> request, logged by the backend the moment it ran.
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => void load()}
            className="rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/10"
          >
            Refresh
          </button>
          <a
            href="/api/export/csv"
            className="flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/10"
          >
            <Download size={13} /> Export CSV (for Power BI)
          </a>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Total Compilations" value={stats.total} />
          <StatCard label="Success Rate" value={`${stats.successRate}%`} />
          <StatCard label="Avg Compile Time" value={`${stats.averageCompileTimeMs} ms`} />
          <StatCard label="Failed" value={stats.failed} />
        </div>
      )}

      {stats && stats.failuresByStage.length > 0 && (
        <div className="rounded-lg border border-[#26313c] bg-[#111820] p-4">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Most Common Failure Stage (SQL: GROUP BY failed_stage)
          </div>
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
                <th className="px-3 py-2">Tokens</th>
                <th className="px-3 py-2">Stage</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={5} className="px-3 py-4 text-slate-500">Loading…</td></tr>
              )}
              {!loading && history.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-4 text-slate-500">No compilations recorded yet — compile something in the Playground first.</td></tr>
              )}
              {history.map((h) => (
                <tr
                  key={h.id}
                  onClick={() => setSelected(h)}
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
                  <td className="px-3 py-1.5 font-mono text-slate-300">{h.token_count ?? "—"}</td>
                  <td className="px-3 py-1.5 text-slate-400">{h.failed_stage ?? "Runtime"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="w-2/5 overflow-auto rounded-lg border border-[#26313c] bg-[#111820] p-4">
          {!selected ? (
            <div className="text-sm text-slate-500">Click a row to view its stored source and result.</div>
          ) : (
            <div className="space-y-3 text-[12.5px]">
              <div>
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Source</div>
                <pre className="max-h-40 overflow-auto rounded bg-black/40 p-2 font-mono text-[11.5px] text-slate-300">
                  {selected.source_code}
                </pre>
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
                  <div className="mt-1 text-[11px] text-slate-500">Stopped at: {selected.failed_stage}</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
