import { useEffect, useState } from "react";
import { Download, BarChart3, FileSpreadsheet, Zap, TrendingUp } from "lucide-react";
import { fetchStats } from "../lib/api";
import Sparkline from "../components/Sparkline";
import type { Stats } from "../lib/types";

export default function AnalyticsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats().then(setStats).catch(() => setStats(null)).finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-[1100px] space-y-8 p-8">
      <div>
        <div className="flex items-center gap-2">
          <BarChart3 size={20} className="text-emerald-400" />
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 font-mono">Telemetry & Power BI Analytics</h1>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-slate-400 max-w-2xl">
          Detailed trend analysis across historical compilations is powered by SQLite telemetry and exported to 
          <strong className="text-emerald-300"> Power BI Desktop</strong>. Download the generated CSV dataset below to inspect stage execution distributions and compilation success metrics.
        </p>
      </div>

      {/* Snapshot Card */}
      <div className="rounded-2xl border border-white/10 bg-[#080d16] p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-3">
          <div className="flex items-center gap-2">
            <Zap size={15} className="text-emerald-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-200 font-mono">
              Live SQLite Database Snapshot
            </span>
          </div>
          <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
            Real Telemetry
          </span>
        </div>

        {loading ? (
          <div className="text-xs font-mono text-slate-500 py-6 text-center">Loading database metrics...</div>
        ) : !stats ? (
          <div className="text-xs font-mono text-rose-400 py-6 text-center">Unable to load database metrics.</div>
        ) : stats.total === 0 ? (
          <div className="text-xs font-mono text-slate-500 py-6 text-center">No compilations recorded yet in the database.</div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="bg-slate-900/40 p-4 rounded-xl border border-white/5">
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Success Rate</div>
              <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">{stats.successRate}%</div>
              <div className="text-[10px] text-slate-500 mt-1">{stats.successful} successful builds</div>
            </div>
            <div className="bg-slate-900/40 p-4 rounded-xl border border-white/5">
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Total Executions</div>
              <div className="text-2xl font-bold font-mono text-slate-100 mt-1">{stats.total}</div>
              <div className="text-[10px] text-slate-500 mt-1">{stats.failed} failed runs</div>
            </div>
            <div className="bg-slate-900/40 p-4 rounded-xl border border-white/5">
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Average Compile Time</div>
              <div className="text-2xl font-bold font-mono text-cyan-400 mt-1">{stats.averageCompileTimeMs} <span className="text-xs text-slate-500 font-normal">ms</span></div>
              <div className="text-[10px] text-slate-500 mt-1">End-to-end pipeline</div>
            </div>
            <div className="bg-slate-900/40 p-4 rounded-xl border border-white/5">
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Recent Latency Trend</div>
              <div className="mt-2">
                <Sparkline values={stats.recentCompileTimes.map((r) => r.compile_time_ms)} />
              </div>
              <div className="text-[10px] text-slate-500 mt-1">Last {stats.recentCompileTimes.length} runs</div>
            </div>
          </div>
        )}
      </div>

      {/* Export & Power BI Guide */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-slate-900/90 to-slate-950/90 p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <FileSpreadsheet size={18} className="text-emerald-400" />
              <h3 className="text-base font-bold text-slate-100 font-mono">Export Power BI Dataset</h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed mb-6">
              Download the complete structured compilation history as a formatted CSV file. Contains all stage-level latency metrics (Flex, Bison, Semantic, Dependency, LLVM, Exec) ready for ingestion.
            </p>
          </div>
          <a
            href="/api/export/csv"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-3 text-xs font-semibold text-slate-950 hover:brightness-110 shadow-lg shadow-emerald-500/20 transition-all"
          >
            <Download size={14} />
            <span>Download dataset.csv</span>
          </a>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#080d16] p-6 shadow-xl">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={18} className="text-cyan-400" />
            <h3 className="text-base font-bold text-slate-100 font-mono">Power BI Pipeline Workflow</h3>
          </div>
          <ol className="space-y-3 text-xs text-slate-400 list-decimal pl-4 leading-relaxed">
            <li>Download the real telemetry CSV using the export button.</li>
            <li>In Power BI Desktop, select <strong className="text-slate-200">Get Data &gt; Text/CSV</strong>.</li>
            <li>Import the exported CSV and review stage-timing columns (<code className="text-emerald-300 font-mono">lexer_ms</code>, <code className="text-emerald-300 font-mono">parser_ms</code>, etc.).</li>
            <li>Create visual cards for KPI benchmarks, success distribution donuts, and latency histograms.</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
