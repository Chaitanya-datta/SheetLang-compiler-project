import type { CompileResult, ExampleMeta, HealthStatus } from "./types";

// This module is the frontend's ONLY interface to the backend/compiler.
// There is no compiler logic anywhere else in this codebase.
export async function compileSource(source: string): Promise<CompileResult> {
  const res = await fetch("/api/compile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source }),
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
