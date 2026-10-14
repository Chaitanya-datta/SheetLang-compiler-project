import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, Download, ChevronDown, ChevronRight, Activity } from "lucide-react";
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
    return (
      <div className="flex h-[calc(100vh-65px)] items-center justify-center bg-[#05070a]">
        <div className="flex items-center gap-3 text-sm font-mono text-emerald-400">
          <Activity size={18} className="animate-spin" />
          <span>Polling SQLite Telemetry Records...</span>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex h-[calc(100vh-65px)] items-center justify-center bg-[#05070a]">
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-8 text-center max-w-md">
          <XCircle size={28} className="mx-auto text-rose-400 mb-3" />
          <div className="text-base font-semibold text-rose-200">Unable to load telemetry log</div>
          <p className="mt-2 text-xs text-rose-300/80">Check that the SheetLang backend API is running on port 3001.</p>
          <button 
            onClick={() => void load()} 
            className="mt-5 rounded-xl border border-white/10 bg-slate-800 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-65px)] max-w-[1450px] flex-col gap-6 overflow-y-auto p-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Activity size={18} className="text-emerald-400" />
            <h1 className="text-2xl font-bold tracking-tight text-slate-100 font-mono">Compilation Telemetry & Audit</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Persisted in SQLite database (<span className="text-emerald-400 font-mono">backend/data/sheetlang.db</span>) — recording exact sub-millisecond LLVM compiler execution.
          </p>
        </div>

        <a
          href="/api/export/csv"
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:brightness-110 shadow-md shadow-emerald-500/20 transition-all"
        >
          <Download size={14} />
          <span>Export Power BI Dataset (CSV)</span>
        </a>
      </div>

      {/* KPI Cards Strip */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="glass-panel rounded-2xl p-5 border border-white/10">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">Success Rate</span>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-3xl font-extrabold font-mono text-emerald-400">{stats.successRate}%</span>
              <span className="text-xs text-slate-500 font-mono">({stats.successful} / {stats.total})</span>
            </div>
            <div className="mt-3 h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
              <div className="h-full bg-emerald-400" style={{ width: `${stats.successRate}%` }} />
            </div>
          </div>

          <div className="glass-panel rounded-2xl p-5 border border-white/10">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">Total Compilations</span>
            <div className="mt-2 text-3xl font-extrabold font-mono text-slate-100">{stats.total}</div>
            <div className="text-xs text-slate-500 mt-2 font-mono">{stats.failed} failed builds logged</div>
          </div>

          <div className="glass-panel rounded-2xl p-5 border border-white/10">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">Avg Compile Latency</span>
            <div className="mt-2 text-3xl font-extrabold font-mono text-cyan-400">{stats.averageCompileTimeMs} <span className="text-base text-slate-500 font-normal">ms</span></div>
            <div className="text-xs text-slate-500 mt-2 font-mono">Sub-millisecond resolution</div>
          </div>

          <div className="glass-panel rounded-2xl p-5 border border-white/10">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">Compile Time Trend</span>
            <div className="mt-3">
              <Sparkline values={stats.recentCompileTimes.map((r) => r.compile_time_ms)} />
            </div>
            <div className="text-[10px] text-slate-500 mt-2 font-mono">Last {stats.recentCompileTimes.length} runs</div>
          </div>
        </div>
      )}

      {/* Main Split: Audit Table & Compilation Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[450px]">
        {/* Table Column */}
        <div className="lg:col-span-7 flex flex-col rounded-2xl border border-white/10 bg-[#080d16] overflow-hidden shadow-xl">
          <div className="flex items-center justify-between border-b border-white/5 bg-[#0c121e] px-4 py-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">
              Audit Records ({history.length})
            </span>
            <span className="text-[10px] font-mono text-slate-500">Sorted newest first</span>
          </div>

          <div className="flex-1 overflow-auto">
            <table className="w-full text-xs text-left border-collapse font-mono">
              <thead>
                <tr className="border-b border-white/5 text-[10px] uppercase text-slate-400 bg-slate-900/40">
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Time</th>
                  <th className="px-4 py-2.5">Latency</th>
                  <th className="px-4 py-2.5">Stage</th>
                  <th className="px-4 py-2.5 text-right">Tokens</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {history.map((record) => {
                  const isSelected = selected?.id === record.id;
                  const isOk = record.success === 1;
                  return (
                    <tr
                      key={record.id}
                      onClick={() => setSelected(record)}
                      className={`cursor-pointer transition-colors ${
                        isSelected 
                          ? "bg-emerald-500/10 border-l-2 border-emerald-400" 
                          : "hover:bg-white/[0.03]"
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {isOk ? (
                            <CheckCircle2 size={14} className="text-emerald-400" />
                          ) : (
                            <XCircle size={14} className="text-rose-400" />
                          )}
                          <span className={isOk ? "text-emerald-300 font-semibold" : "text-rose-300 font-semibold"}>
                            {isOk ? "OK" : "FAIL"}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-400">
                        {new Date(record.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </td>
                      <td className="px-4 py-3 text-cyan-300 font-bold">
                        {record.compile_time_ms.toFixed(1)}ms
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {record.failed_stage ? (
                          <span className="text-rose-400 font-bold">{record.failed_stage}</span>
                        ) : (
                          <span className="text-slate-500">All 12 stages</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-400">
                        {record.token_count ?? "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Selected Record Detail Column */}
        <div className="lg:col-span-5 flex flex-col rounded-2xl border border-white/10 bg-[#080d16] overflow-hidden shadow-xl">
          <div className="flex items-center justify-between border-b border-white/5 bg-[#0c121e] px-4 py-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">
              Build #{selected?.id ?? "-"} Telemetry Detail
            </span>
            {selected && (
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                selected.success ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"
              }`}>
                {selected.success ? "SUCCESS" : "FAILED"}
              </span>
            )}
          </div>

          {selected ? (
            <div className="flex-1 overflow-auto p-5 space-y-4 font-mono text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-900/60 p-3.5 rounded-xl border border-white/5">
                <div>
                  <div className="text-[10px] text-slate-500 uppercase">Timestamp</div>
                  <div className="text-slate-200 mt-0.5">{selected.timestamp}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 uppercase">Total Latency</div>
                  <div className="text-cyan-400 font-bold mt-0.5">{selected.compile_time_ms} ms</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 uppercase">Exit Code</div>
                  <div className="text-slate-200 mt-0.5">{selected.runtime_exit_code ?? "N/A"}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 uppercase">Token Count</div>
                  <div className="text-slate-200 mt-0.5">{selected.token_count ?? "N/A"}</div>
                </div>
              </div>

              {selected.error_message && (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-rose-300">
                  <div className="font-bold mb-1 text-[11px] text-rose-200 uppercase">Diagnostic Trace:</div>
                  <div className="whitespace-pre-wrap">{selected.error_message}</div>
                </div>
              )}

              {selected.runtime_output && (
                <div>
                  <div className="text-[11px] font-bold text-slate-400 uppercase mb-1.5">Runtime Standard Output:</div>
                  <pre className="rounded-xl border border-white/5 bg-[#04060a] p-3 text-emerald-400/90 overflow-x-auto whitespace-pre-wrap font-mono">
                    {selected.runtime_output}
                  </pre>
                </div>
              )}

              <div>
                <button
                  onClick={() => setSourceOpen(!sourceOpen)}
                  className="flex items-center gap-1.5 text-slate-400 hover:text-slate-200 transition-colors py-1"
                >
                  {sourceOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <span>{sourceOpen ? "Hide Source Payload" : "View Source Payload"}</span>
                </button>
                {sourceOpen && (
                  <pre className="mt-2 rounded-xl border border-white/5 bg-[#04060a] p-3 text-slate-300 overflow-x-auto whitespace-pre-wrap font-mono">
                    {selected.source_code}
                  </pre>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center p-8 text-center text-slate-500 text-xs font-mono">
              Select an audit record from the table to view execution details.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
