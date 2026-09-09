import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import type { CompileResponse } from "./pipeline.js";

// Uses Node's OWN BUILT-IN SQLite module (node:sqlite), not the
// better-sqlite3 npm package. This is a deliberate choice: better-sqlite3
// ships a native C++ addon that must be COMPILED PER NODE VERSION via
// node-gyp, and its bundled bindings target an older V8 API that no
// longer exists in newer Node releases (confirmed: it fails to build
// from source on Node 26 with real compiler errors like "no member
// named 'GetPrototype' in 'v8::Object'"). node:sqlite ships INSIDE Node
// itself and needs zero separate compilation step.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");
const DB_PATH = path.join(DATA_DIR, "sheetlang.db");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new DatabaseSync(DB_PATH);
db.exec("PRAGMA journal_mode = WAL;");

// Real relational schema. One row per POST /api/compile request, written
// by recordCompilation() below -- never fabricated, never backfilled
// with synthetic rows.
db.exec(`
  CREATE TABLE IF NOT EXISTS compilations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    source_code TEXT NOT NULL,
    success INTEGER NOT NULL,
    failed_stage TEXT,
    compile_time_ms REAL NOT NULL,
    token_count INTEGER,
    runtime_output TEXT,
    runtime_exit_code INTEGER,
    error_message TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_compilations_timestamp ON compilations(timestamp);
  CREATE INDEX IF NOT EXISTS idx_compilations_success ON compilations(success);
`);

// Safe, additive migration: persists the REAL per-stage durations that
// pipeline.ts already computes in `stages[]` for every request (they
// were previously only returned in the API response, never stored).
// Uses ALTER TABLE ADD COLUMN, guarded by a try/catch against "duplicate
// column" so this is idempotent on every server start -- no destructive
// migration, no data loss, works whether the on-disk DB predates this
// change or not.
const STAGE_TIMING_COLUMNS = [
  "lexer_ms", "parser_ms", "semantic_ms", "dependency_ms", "llvm_ms", "execution_ms",
] as const;
for (const col of STAGE_TIMING_COLUMNS) {
  try {
    db.exec(`ALTER TABLE compilations ADD COLUMN ${col} REAL;`);
  } catch {
    // Column already exists from a previous run -- expected, not an error.
  }
}

export interface CompilationRecord {
  id: number;
  timestamp: string;
  source_code: string;
  success: number;
  failed_stage: string | null;
  compile_time_ms: number;
  token_count: number | null;
  runtime_output: string | null;
  runtime_exit_code: number | null;
  error_message: string | null;
  lexer_ms: number | null;
  parser_ms: number | null;
  semantic_ms: number | null;
  dependency_ms: number | null;
  llvm_ms: number | null;
  execution_ms: number | null;
}

const insertStmt = db.prepare(`
  INSERT INTO compilations
    (timestamp, source_code, success, failed_stage, compile_time_ms, token_count,
     runtime_output, runtime_exit_code, error_message,
     lexer_ms, parser_ms, semantic_ms, dependency_ms, llvm_ms, execution_ms)
  VALUES (@timestamp, @source_code, @success, @failed_stage, @compile_time_ms, @token_count,
     @runtime_output, @runtime_exit_code, @error_message,
     @lexer_ms, @parser_ms, @semantic_ms, @dependency_ms, @llvm_ms, @execution_ms)
`);

function stageDuration(result: CompileResponse, stageId: string): number | null {
  const s = result.stages.find((x) => x.id === stageId);
  return s ? s.durationMs : null;
}

// Called once per real /api/compile request, after the real pipeline
// has finished (success or failure) -- logs exactly what actually
// happened, nothing invented. Per-stage timings come directly from the
// same `stages[]` array the API response itself is built from.
export function recordCompilation(source: string, result: CompileResponse): number {
  const totalMs = result.stages.reduce((a, s) => a + s.durationMs, 0);
  const info = insertStmt.run({
    timestamp: new Date().toISOString(),
    source_code: source,
    success: result.success ? 1 : 0,
    failed_stage: result.success ? null : (result.stage ?? null),
    compile_time_ms: totalMs,
    token_count: result.tokens ? result.tokens.count : null,
    runtime_output: result.runtime ? result.runtime.stdout : null,
    runtime_exit_code: result.runtime ? result.runtime.exitCode : null,
    error_message: result.success ? null : (result.error ?? null),
    lexer_ms: stageDuration(result, "lexer"),
    parser_ms: stageDuration(result, "parser"),
    semantic_ms: stageDuration(result, "semantic"),
    dependency_ms: stageDuration(result, "dependencies"),
    llvm_ms: stageDuration(result, "llvmIr"),
    execution_ms: stageDuration(result, "runtime"),
  });
  return Number(info.lastInsertRowid);
}

export function getHistory(limit = 50): CompilationRecord[] {
  return db
    .prepare(`SELECT * FROM compilations ORDER BY id DESC LIMIT ?`)
    .all(limit) as unknown as CompilationRecord[];
}

export function getCompilationById(id: number): CompilationRecord | undefined {
  return db.prepare(`SELECT * FROM compilations WHERE id = ?`).get(id) as
    | CompilationRecord
    | undefined;
}

export interface Stats {
  total: number;
  successful: number;
  failed: number;
  successRate: number;
  averageCompileTimeMs: number;
  failuresByStage: { stage: string; count: number }[];
  recentCompileTimes: { id: number; timestamp: string; compile_time_ms: number }[];
  averageStageMs: {
    lexer: number | null;
    parser: number | null;
    semantic: number | null;
    dependency: number | null;
    llvm: number | null;
    execution: number | null;
  };
}

// Real SQL: COUNT(*), AVG(), and GROUP BY -- not computed in JS from a
// full table scan pulled into memory.
export function getStats(): Stats {
  const total = (db.prepare(`SELECT COUNT(*) AS c FROM compilations`).get() as { c: number }).c;
  const successful = (
    db.prepare(`SELECT COUNT(*) AS c FROM compilations WHERE success = 1`).get() as { c: number }
  ).c;
  const failed = total - successful;
  const avgRow = db
    .prepare(`SELECT AVG(compile_time_ms) AS avg FROM compilations WHERE success = 1`)
    .get() as { avg: number | null };
  const failuresByStage = db
    .prepare(
      `SELECT failed_stage AS stage, COUNT(*) AS count
       FROM compilations
       WHERE success = 0 AND failed_stage IS NOT NULL
       GROUP BY failed_stage
       ORDER BY count DESC`
    )
    .all() as unknown as { stage: string; count: number }[];

  // Last 20 compile times, oldest first -- real data for the History
  // page's compile-time sparkline. Not padded/interpolated: if there are
  // only 3 records, this returns exactly 3 points.
  const recentCompileTimes = (
    db
      .prepare(`SELECT id, timestamp, compile_time_ms FROM compilations ORDER BY id DESC LIMIT 20`)
      .all() as unknown as { id: number; timestamp: string; compile_time_ms: number }[]
  ).reverse();

  const avgStageRow = db
    .prepare(
      `SELECT AVG(lexer_ms) AS lexer, AVG(parser_ms) AS parser, AVG(semantic_ms) AS semantic,
              AVG(dependency_ms) AS dependency, AVG(llvm_ms) AS llvm, AVG(execution_ms) AS execution
       FROM compilations WHERE success = 1`
    )
    .get() as Record<string, number | null>;

  function round(v: number | null | undefined): number | null {
    return v === null || v === undefined ? null : Number(v.toFixed(2));
  }

  return {
    total,
    successful,
    failed,
    successRate: total > 0 ? Number(((successful / total) * 100).toFixed(1)) : 0,
    averageCompileTimeMs: avgRow.avg ? Number(avgRow.avg.toFixed(2)) : 0,
    failuresByStage,
    recentCompileTimes,
    averageStageMs: {
      lexer: round(avgStageRow.lexer),
      parser: round(avgStageRow.parser),
      semantic: round(avgStageRow.semantic),
      dependency: round(avgStageRow.dependency),
      llvm: round(avgStageRow.llvm),
      execution: round(avgStageRow.execution),
    },
  };
}

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

// Produces a clean, RFC-4180-ish CSV: escaped quotes/commas, CRLF-safe
// multiline fields, UTF-8, header row -- built specifically to be
// importable into Power BI Desktop without manual cleanup. Now includes
// the real per-stage timing columns for the Compiler Internals Power BI
// page.
export function exportCsv(): string {
  const rows = db.prepare(`SELECT * FROM compilations ORDER BY id ASC`).all() as unknown as CompilationRecord[];
  const headers = [
    "id", "timestamp", "success", "failed_stage", "compile_time_ms",
    "token_count", "runtime_exit_code", "runtime_output", "error_message",
    "lexer_ms", "parser_ms", "semantic_ms", "dependency_ms", "llvm_ms", "execution_ms",
  ];
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.id, r.timestamp, r.success, csvEscape(r.failed_stage), r.compile_time_ms,
        r.token_count ?? "", r.runtime_exit_code ?? "", csvEscape(r.runtime_output), csvEscape(r.error_message),
        r.lexer_ms ?? "", r.parser_ms ?? "", r.semantic_ms ?? "", r.dependency_ms ?? "", r.llvm_ms ?? "", r.execution_ms ?? "",
      ].join(",")
    );
  }
  return lines.join("\r\n");
}

export default db;
