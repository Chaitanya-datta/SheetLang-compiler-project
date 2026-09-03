import { execFile } from "node:child_process";
import { access, constants } from "node:fs/promises";
import { performance } from "node:perf_hooks";

// Path to the REAL sheetc binary. Never hardcoded -- read once at
// startup from the SHEETC_PATH environment variable. server.ts refuses
// to start (rather than silently falling back to a guessed path) if
// this is missing or not an executable file.
export const SHEETC_PATH = process.env.SHEETC_PATH || "";

export async function validateSheetcPath(): Promise<{ ok: boolean; reason?: string }> {
  if (!SHEETC_PATH) {
    return { ok: false, reason: "SHEETC_PATH environment variable is not set." };
  }
  try {
    await access(SHEETC_PATH, constants.X_OK);
    return { ok: true };
  } catch {
    return { ok: false, reason: `SHEETC_PATH ("${SHEETC_PATH}") does not exist or is not executable.` };
  }
}

export interface RunResult {
  exitCode: number;
  timedOut: boolean;
  stdout: string;
  stderr: string;
  durationMs: number;
}

const MAX_OUTPUT_BYTES = 1 * 1024 * 1024; // 1MB cap per spec section 30

// Runs `sheetc` with the given argv as a real ARGUMENT ARRAY -- never a
// shell string, so nothing in user-controlled source can ever reach a
// shell interpreter. Always resolves (never rejects) with a structured
// result.
export function runSheetc(args: string[], cwd: string, timeoutMs = 10_000): Promise<RunResult> {
  const start = performance.now();
  return new Promise((resolve) => {
    execFile(
      SHEETC_PATH,
      args,
      { cwd, timeout: timeoutMs, maxBuffer: MAX_OUTPUT_BYTES, windowsHide: true },
      (error, stdout, stderr) => {
        const durationMs = Number((performance.now() - start).toFixed(3));
        resolve({
          exitCode: error && typeof (error as any).code === "number" ? (error as any).code : error ? 1 : 0,
          timedOut: Boolean(error && (error as any).killed && (error as any).signal === "SIGTERM"),
          stdout: stdout || "",
          stderr: stderr || "",
          durationMs,
        });
      }
    );
  });
}

// Runs a just-produced executable the same safe way. Only ever called
// with a path this backend itself created inside the current request's
// own isolated temp directory -- never a user-supplied path (see
// server.ts's example-id sanitization and pipeline.ts's job isolation).
export function runExecutable(execPath: string, cwd: string, timeoutMs = 5_000): Promise<RunResult> {
  const start = performance.now();
  return new Promise((resolve) => {
    execFile(
      execPath,
      [],
      { cwd, timeout: timeoutMs, maxBuffer: MAX_OUTPUT_BYTES, windowsHide: true },
      (error, stdout, stderr) => {
        const durationMs = Number((performance.now() - start).toFixed(3));
        resolve({
          exitCode: error && typeof (error as any).code === "number" ? (error as any).code : error ? 1 : 0,
          timedOut: Boolean(error && (error as any).killed && (error as any).signal === "SIGTERM"),
          stdout: stdout || "",
          stderr: stderr || "",
          durationMs,
        });
      }
    );
  });
}
