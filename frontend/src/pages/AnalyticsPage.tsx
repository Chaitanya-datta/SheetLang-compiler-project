import { useEffect, useState } from "react";
import { Download, ExternalLink } from "lucide-react";
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
    <div className="mx-auto max-w-[1000px] space-y-8 p-8">
      <div>
        <div className="text-lg font-semibold text-slate-100">Analytics</div>
        <p className="mt-2 max-w-2xl text-[13px] text-slate-500">
          The Playground and History pages handle compiling and inspecting individual programs.
          Deeper trend analysis — comparisons over time, distributions, filtering — is handled by
          <strong className="text-slate-300"> Power BI</strong>, using a CSV export of the real
          SQLite compilation history. There is no live connection between this app and Power BI;
          you export a fresh CSV and re-import/refresh it in Power BI Desktop whenever you want
          updated numbers.
        </p>
      </div>

      <div className="rounded-lg border border-[#26313c] bg-[#111820] p-5">
        <div className="mb-3 text-[13px] font-medium text-slate-200">Live snapshot (from this backend right now)</div>
        {loading ? (
          <div className="text-sm text-slate-500">Loading…</div>
        ) : !stats ? (
          <div className="text-sm text-rose-400">Unable to load statistics.</div>
        ) : stats.total === 0 ? (
          <div className="text-sm text-slate-500">No compilations recorded yet.</div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-slate-500">Success Rate</div>
              <div className="text-xl font-semibold text-slate-100">{stats.successRate}%</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-slate-500">Total</div>
              <div className="text-xl font-semibold text-slate-100">{stats.total}</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-slate-500">Avg Compile Time</div>
              <div className="text-xl font-semibold text-slate-100">{stats.averageCompileTimeMs} ms</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-slate-500">Recent Trend</div>
              <Sparkline values={stats.recentCompileTimes.map((r) => r.compile_time_ms)} />
            </div>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-[#26313c] bg-[#111820] p-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-[13px] font-medium text-slate-200">Step 1 — Export the real data</div>
          <a href="/api/export/csv" className="flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500">
            <Download size={13} /> Export CSV
          </a>
        </div>
        <p className="text-[12.5px] text-slate-500">
          Downloads every real compilation record: timestamp, success/failure, failed stage, compile
          time, execution time, token count, per-stage timings (lexer/parser/semantic/dependency/llvm/execution),
          runtime output, and error message.
        </p>
      </div>

      <div className="rounded-lg border border-[#26313c] bg-[#111820] p-5">
        <div className="mb-3 text-[13px] font-medium text-slate-200">Step 2 — Build the dashboard in Power BI Desktop</div>
        <ol className="list-decimal space-y-1.5 pl-5 text-[12.5px] text-slate-400">
          <li>Open Power BI Desktop → <em>Get Data</em> → <em>Text/CSV</em> → select the exported file.</li>
          <li>Build <strong>Page 1 — Executive Overview</strong>: KPI cards (Total, Success Rate, Failed, Avg Compile Time), a line chart of compilations over time, a donut of success vs. failure, and a compile-time trend line.</li>
          <li>Build <strong>Page 2 — Compilation Analytics</strong>: compilation count over time, success/failure trend, average compile time trend, and a token-count distribution histogram (from the real <code>token_count</code> column). Add Date and Status slicers.</li>
          <li>Build <strong>Page 3 — Compiler Internals</strong>: a stage-duration comparison (bar chart of average <code>lexer_ms</code>/<code>parser_ms</code>/<code>semantic_ms</code>/<code>dependency_ms</code>/<code>llvm_ms</code>/<code>execution_ms</code> — all real, persisted per compile).</li>
          <li>Build <strong>Page 4 — Error Analysis</strong>: a horizontal bar chart of failures by <code>failed_stage</code> (the real, existing classification — there is no separate "error type" field, so this is used as-is rather than inventing categories), a failure trend over time, and a table of recent failed compilations with their <code>error_message</code>.</li>
        </ol>
        <p className="mt-3 text-[11.5px] text-slate-500">
          Full column-by-column build instructions are in the <a href="/docs" className="text-indigo-400 hover:underline">Documentation</a> page.
        </p>
      </div>

      <a
        href="https://www.microsoft.com/en-us/power-platform/products/power-bi/downloads"
        target="_blank" rel="noreferrer"
        className="flex w-fit items-center gap-1.5 text-[12.5px] text-indigo-400 hover:underline"
      >
        Download Power BI Desktop <ExternalLink size={12} />
      </a>
    </div>
  );
}
