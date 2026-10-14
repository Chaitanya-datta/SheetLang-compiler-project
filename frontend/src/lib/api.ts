import type { CompileResult, ExampleMeta, HealthStatus, CompilationRecord, Stats } from "./types";

// This module is the frontend's ONLY interface to the backend/compiler.
// There is no compiler logic anywhere else in this codebase.
export async function compileSource(source: string, csvData?: string): Promise<CompileResult> {
  const res = await fetch("/api/compile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source, csvData }),
  });
  return res.json();
}

export async function fetchExamples(): Promise<ExampleMeta[]> {
  const res = await fetch("/api/examples");
  return res.json();
}

export async function fetchExampleSource(id: string): Promise<{ source: string; label: string }> {
  const res = await fetch(`/api/examples/${encodeURIComponent(id)}`);
  return res.json();
}

export async function fetchHealth(): Promise<HealthStatus> {
  const res = await fetch("/api/health");
  return res.json();
}

export async function fetchHistory(): Promise<CompilationRecord[]> {
  const res = await fetch("/api/history");
  return res.json();
}

export async function fetchStats(): Promise<Stats> {
  const res = await fetch("/api/stats");
  return res.json();
}
