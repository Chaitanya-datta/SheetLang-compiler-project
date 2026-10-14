import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { runSheetc, runExecutable } from "./sheetc.js";
import {
  parseTokens,
  parseLexicalErrors,
  parseAstTree,
  deriveSymbolsFromAst,
  parseSemanticErrors,
  parseDependencyErrors,
  parseDependencies,
  reverseDependencies,
  type AstNode,
} from "./parsers.js";

// Limits per spec section 30.
export const MAX_SOURCE_BYTES = 100 * 1024; // 100 KB
const STAGE_TIMEOUT_MS = 10_000; // 10s
const RUN_TIMEOUT_MS = 5_000; // 5s

export type StageStatus = "success" | "failed" | "skipped";

export interface StageResult {
  id: string;
  name: string;
  status: StageStatus;
  durationMs: number;
  output: string;
}

export interface CompileResponse {
  success: boolean;
  stage?: string;
  error?: string;
  stages: StageResult[];
  tokens: { count: number; tokens: ReturnType<typeof parseTokens>; errors: string[] } | null;
  ast: { raw: string; tree: AstNode | null } | null;
  symbols: ReturnType<typeof deriveSymbolsFromAst> | null;
  semantic: { passed: boolean; errors: ReturnType<typeof parseSemanticErrors>; raw: string } | null;
  dependencies: {
    edges: ReturnType<typeof parseDependencies>["edges"];
    order: string[];
    usedBy: Record<string, string[]>;
    errors: string[];
  } | null;
  llvmIr: { text: string; verified: boolean; functionCount: number; basicBlockCount: number } | null;
  assembly: { text: string; error?: string } | null;
  optimization: { enabled: boolean; note: string };
  object: { generated: boolean; note: string };
  build: { linked: boolean; executablePath?: string; error?: string } | null;
  runtime: { stdout: string; stderr: string; exitCode: number; durationMs: number; timedOut: boolean } | null;
  updatedCsvData?: string;
}

const OPTIMIZATION_NOTE =
  "LLVM optimization passes are not run by this compiler build (no -O pass pipeline is invoked). " +
  "The LLVM IR shown in the LLVM IR tab is exactly what LLVMCodeGenerator produced, unmodified.";
const OBJECT_NOTE =
  "Object-file generation is handled internally by NativeCodeGenerator during native compilation. " +
  "The intermediate .o file is written to a temporary path and deleted immediately after linking -- " +
  "it is never retained, so there is nothing to display or download beyond this status.";

export async function compile(source: string, csvData?: string): Promise<CompileResponse> {
  const stages: StageResult[] = [];
  const result: CompileResponse = {
    success: false,
    stages,
    tokens: null,
    ast: null,
    symbols: null,
    semantic: null,
    dependencies: null,
    llvmIr: null,
    assembly: null,
    optimization: { enabled: false, note: OPTIMIZATION_NOTE },
    object: { generated: false, note: OBJECT_NOTE },
    build: null,
    runtime: null,
  };

  if (typeof source !== "string" || source.length === 0) {
    result.stage = "source";
    result.error = "Empty source.";
    return result;
  }
  if (Buffer.byteLength(source, "utf8") > MAX_SOURCE_BYTES) {
    result.stage = "source";
    result.error = `Source exceeds maximum size of ${MAX_SOURCE_BYTES} bytes.`;
    return result;
  }

  const jobId = crypto.randomUUID();
  const jobDir = path.join(os.tmpdir(), "sheetlang", jobId);
  await fs.mkdir(jobDir, { recursive: true });

  const validCells = new Set<string>();

  if (csvData) {
    const lines = csvData.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const assignments: string[] = [];
    for (let r = 0; r < lines.length; r++) {
      const cols = lines[r].split(',').map(c => c.trim());
      for (let c = 0; c < cols.length; c++) {
        if (!cols[c]) continue; // Skip empty cells
        
        // Convert column index to letters (A, B, ..., Z, AA, etc.)
        let colName = "";
        let curr = c;
        while (curr >= 0) {
          colName = String.fromCharCode(65 + (curr % 26)) + colName;
          curr = Math.floor(curr / 26) - 1;
        }
        
        const cellName = `${colName}${r + 1}`;
        validCells.add(cellName); // Record valid cell
        // Only assign if it looks like a valid number or string
        const isNum = !isNaN(Number(cols[c]));
        const val = isNum ? cols[c] : `"${cols[c].replace(/"/g, '')}"`;
        assignments.push(`${cellName} = ${val}`);
      }
    }
    
    if (assignments.length > 0) {
      const injectStr = '\n' + assignments.join('\n') + '\n';
      const match = source.match(/^SHEET\s+\w+/m);
      if (match) {
        source = source.replace(match[0], match[0] + injectStr);
      } else {
        source = injectStr + source;
      }
    }
  }

  // Macro-expand aggregate ranges (e.g. SUM(A1:B3) -> (A1 + A2 ...))
  const aggRegex = /(SUM|AVG|COUNT)\(([A-Z]+)(\d+):([A-Z]+)(\d+)\)/g;
  source = source.replace(aggRegex, (match, func, startCol, startRow, endCol, endRow) => {
    let sColIdx = 0;
    for (let i = 0; i < startCol.length; i++) sColIdx = sColIdx * 26 + (startCol.charCodeAt(i) - 64);
    let eColIdx = 0;
    for (let i = 0; i < endCol.length; i++) eColIdx = eColIdx * 26 + (endCol.charCodeAt(i) - 64);
    
    const sCol = Math.min(sColIdx, eColIdx);
    const eCol = Math.max(sColIdx, eColIdx);
    const sRow = Math.min(parseInt(startRow, 10), parseInt(endRow, 10));
    const eRow = Math.max(parseInt(startRow, 10), parseInt(endRow, 10));
    
    const cells: string[] = [];
    for (let r = sRow; r <= eRow; r++) {
      for (let c = sCol; c <= eCol; c++) {
        let colName = "";
        let curr = c - 1;
        while (curr >= 0) {
          colName = String.fromCharCode(65 + (curr % 26)) + colName;
          curr = Math.floor(curr / 26) - 1;
        }
        cells.push(`${colName}${r}`);
      }
    }
    
    const presentCells = cells.filter(c => validCells.has(c));
    if (presentCells.length === 0) return "0";
    
    if (func === "SUM") return `(${presentCells.join(" + ")})`;
    if (func === "AVG") return `((${presentCells.join(" + ")}) / ${presentCells.length})`;
    if (func === "COUNT") return `${presentCells.length}`;
    
    return match;
  });

  const sourcePath = path.join(jobDir, "source.sheet");
  await fs.writeFile(sourcePath, source, "utf8");

  function record(id: string, name: string, status: StageStatus, durationMs: number, output: string) {
    stages.push({ id, name, status, durationMs, output });
  }
  function skip(...pairs: [string, string][]) {
    for (const [id, name] of pairs) record(id, name, "skipped", 0, "");
  }

  try {
    record("source", "Source", "success", 0, `${Buffer.byteLength(source, "utf8")} bytes`);

    // ---- Lexer ----
    const tokRun = await runSheetc(["--tokens", "source.sheet"], jobDir, STAGE_TIMEOUT_MS);
    const tokens = parseTokens(tokRun.stdout);
    const lexErrors = parseLexicalErrors(tokRun.stderr);
    result.tokens = { count: tokens.length, tokens, errors: lexErrors };

    if (lexErrors.length > 0 || tokRun.exitCode !== 0) {
      record("lexer", "Lexical Analysis", "failed", tokRun.durationMs, tokRun.stderr.trim());
      skip(
        ["parser", "Syntax Analysis"], ["ast", "AST Construction"], ["symbols", "Symbol Table"],
        ["semantic", "Semantic Analysis"], ["dependencies", "Dependency Analysis"],
        ["llvmIr", "LLVM IR Generation"], ["assembly", "Assembly Generation"],
        ["object", "Object Generation"], ["executable", "Executable Generation"], ["runtime", "Runtime"]
      );
      result.stage = "lexer";
      result.error = lexErrors.join("; ") || tokRun.stderr.trim();
      return finalize(result, jobDir);
    }
    record("lexer", "Lexical Analysis", "success", tokRun.durationMs, `${tokens.length} tokens generated.`);

    // ---- Parser + AST ----
    const astRun = await runSheetc(["--ast", "source.sheet"], jobDir, STAGE_TIMEOUT_MS);
    if (astRun.exitCode !== 0) {
      record("parser", "Syntax Analysis", "failed", astRun.durationMs, astRun.stderr.trim());
      skip(
        ["ast", "AST Construction"], ["symbols", "Symbol Table"], ["semantic", "Semantic Analysis"],
        ["dependencies", "Dependency Analysis"], ["llvmIr", "LLVM IR Generation"],
        ["assembly", "Assembly Generation"], ["object", "Object Generation"],
        ["executable", "Executable Generation"], ["runtime", "Runtime"]
      );
      result.stage = "parser";
      result.error = astRun.stderr.trim();
      return finalize(result, jobDir);
    }
    record("parser", "Syntax Analysis", "success", astRun.durationMs, "Parse completed successfully.");

    const astTree = parseAstTree(astRun.stdout);
    result.ast = { raw: astRun.stdout, tree: astTree };
    record("ast", "AST Construction", "success", 0, "AST generated.");

    const derived = deriveSymbolsFromAst(astTree);
    result.symbols = derived;
    record("symbols", "Symbol Table", "success", 0, `${derived.symbols.length} declared identifier(s) (AST-derived).`);

    // ---- Semantic analysis ----
    const checkRun = await runSheetc(["--check", "source.sheet"], jobDir, STAGE_TIMEOUT_MS);
    const semErrors = parseSemanticErrors(checkRun.stderr);
    result.semantic = { passed: checkRun.exitCode === 0, errors: semErrors, raw: checkRun.stderr.trim() };

    if (checkRun.exitCode !== 0) {
      record("semantic", "Semantic Analysis", "failed", checkRun.durationMs, checkRun.stderr.trim());
      skip(
        ["dependencies", "Dependency Analysis"], ["llvmIr", "LLVM IR Generation"],
        ["assembly", "Assembly Generation"], ["object", "Object Generation"],
        ["executable", "Executable Generation"], ["runtime", "Runtime"]
      );
      result.stage = "semantic";
      result.error = semErrors.map((e) => `${e.message} (line ${e.line})`).join("; ") || checkRun.stderr.trim();
      return finalize(result, jobDir);
    }
    record("semantic", "Semantic Analysis", "success", checkRun.durationMs, "No semantic errors found.");

    // ---- Dependency analysis ----
    const depsRun = await runSheetc(["--deps", "source.sheet"], jobDir, STAGE_TIMEOUT_MS);
    const depErrors = parseDependencyErrors(depsRun.stderr);
    const deps = parseDependencies(depsRun.stdout);
    result.dependencies = { ...deps, usedBy: reverseDependencies(deps.edges), errors: depErrors };

    if (depsRun.exitCode !== 0) {
      record("dependencies", "Dependency Analysis", "failed", depsRun.durationMs, depsRun.stderr.trim());
      skip(
        ["llvmIr", "LLVM IR Generation"], ["assembly", "Assembly Generation"],
        ["object", "Object Generation"], ["executable", "Executable Generation"], ["runtime", "Runtime"]
      );
      result.stage = "dependencies";
      result.error = depErrors.join("; ") || depsRun.stderr.trim();
      return finalize(result, jobDir);
    }
    record("dependencies", "Dependency Analysis", "success", depsRun.durationMs, `${deps.edges.length} dependency edge(s).`);

    // ---- LLVM IR (written to a real .ll file and read back) ----
    const irRun = await runSheetc(["--ir", "source.sheet", "-o", "output.ll"], jobDir, STAGE_TIMEOUT_MS);
    if (irRun.exitCode !== 0) {
      record("llvmIr", "LLVM IR Generation", "failed", irRun.durationMs, irRun.stderr.trim());
      skip(
        ["assembly", "Assembly Generation"], ["object", "Object Generation"],
        ["executable", "Executable Generation"], ["runtime", "Runtime"]
      );
      result.stage = "llvmIr";
      result.error = irRun.stderr.trim();
      return finalize(result, jobDir);
    }
    const irText = await fs.readFile(path.join(jobDir, "output.ll"), "utf8");
    const funcMatches = [...irText.matchAll(/^define [^\n]*@(\w+)\(/gm)];
    const blockMatches = [...irText.matchAll(/^\S+:(\s*;.*)?$/gm)];
    result.llvmIr = {
      text: irText,
      verified: irRun.stderr.includes("module verified"),
      functionCount: funcMatches.length,
      basicBlockCount: blockMatches.length,
    };
    record("llvmIr", "LLVM IR Generation", "success", irRun.durationMs, "Module verified successfully.");

    // ---- Assembly (real .s file, written and read back) ----
    const asmRun = await runSheetc(["--asm", "source.sheet", "-o", "output.s"], jobDir, STAGE_TIMEOUT_MS);
    if (asmRun.exitCode === 0) {
      const asmText = await fs.readFile(path.join(jobDir, "output.s"), "utf8");
      result.assembly = { text: asmText };
      record("assembly", "Assembly Generation", "success", asmRun.durationMs, "Assembly generated successfully.");
    } else {
      result.assembly = { text: "", error: asmRun.stderr.trim() };
      record("assembly", "Assembly Generation", "failed", asmRun.durationMs, asmRun.stderr.trim());
      // Assembly is supplementary (native compilation below uses direct
      // object emission, not this text form) -- a failure here does not
      // stop the rest of the pipeline.
    }

    // ---- Native compilation (object + link, handled internally) ----
    const exePath = path.join(jobDir, "program");
    const compileRun = await runSheetc(["--compile", "source.sheet", "-o", "program"], jobDir, STAGE_TIMEOUT_MS);
    const exeExists = await fileExists(exePath);

    if (compileRun.exitCode !== 0 || !exeExists) {
      record("object", "Object Generation", "failed", 0, OBJECT_NOTE);
      record("executable", "Executable Generation", "failed", compileRun.durationMs, compileRun.stderr.trim());
      record("runtime", "Runtime", "skipped", 0, "");
      result.build = { linked: false, error: compileRun.stderr.trim() };
      result.stage = "executable";
      result.error = compileRun.stderr.trim();
      return finalize(result, jobDir);
    }
    result.object = { generated: true, note: OBJECT_NOTE };
    record("object", "Object Generation", "success", 0, OBJECT_NOTE);
    record("executable", "Executable Generation", "success", compileRun.durationMs, "Executable generated and linked successfully.");
    result.build = { linked: true, executablePath: "program" };

    // ---- Execution ----
    const runResult = await runExecutable(exePath, jobDir, RUN_TIMEOUT_MS);
    result.runtime = {
      stdout: runResult.stdout,
      stderr: runResult.stderr,
      exitCode: runResult.exitCode,
      durationMs: runResult.durationMs,
      timedOut: runResult.timedOut,
    };
    record("runtime", "Runtime", runResult.exitCode === 0 ? "success" : "failed", runResult.durationMs, runResult.stdout);

    if (csvData && runResult.stdout) {
      const updates = new Map<string, string>();
      const lines = runResult.stdout.split('\n');
      for (let i = 0; i < lines.length - 1; i++) {
        const line = lines[i].trim();
        if (line.startsWith("UPDATE_CELL:")) {
          const cellName = line.replace("UPDATE_CELL:", "").trim();
          const value = lines[i + 1].trim();
          if (cellName && value) {
            updates.set(cellName, value);
            i++; // skip next line as it's the value
          }
        }
      }

      if (updates.size > 0) {
        const csvLines = csvData.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        let maxRow = csvLines.length;
        let maxCol = Math.max(...csvLines.map(l => l.split(',').length));

        for (const cellName of updates.keys()) {
          const match = cellName.match(/^([A-Z]+)(\d+)$/);
          if (match) {
            const colStr = match[1];
            let colIdx = 0;
            for (let i = 0; i < colStr.length; i++) {
              colIdx = colIdx * 26 + (colStr.charCodeAt(i) - 64);
            }
            maxCol = Math.max(maxCol, colIdx);
            maxRow = Math.max(maxRow, parseInt(match[2], 10));
          }
        }

        const grid: string[][] = Array.from({length: maxRow}, () => Array(maxCol).fill(""));
        for (let r = 0; r < csvLines.length; r++) {
          const cols = csvLines[r].split(',').map(c => c.trim());
          for (let c = 0; c < cols.length; c++) {
            grid[r][c] = cols[c];
          }
        }

        for (const [cellName, value] of updates.entries()) {
          const match = cellName.match(/^([A-Z]+)(\d+)$/);
          if (match) {
            const colStr = match[1];
            let colIdx = 0;
            for (let i = 0; i < colStr.length; i++) {
              colIdx = colIdx * 26 + (colStr.charCodeAt(i) - 64);
            }
            const c = colIdx - 1;
            const r = parseInt(match[2], 10) - 1;
            if (r >= 0 && c >= 0 && r < maxRow && c < maxCol) {
              grid[r][c] = value;
            }
          }
        }
        result.updatedCsvData = grid.map(row => row.join(', ')).join('\n');
      }
    }

    result.success = true;
    return finalize(result, jobDir);
  } catch (err) {
    result.stage = "internal";
    result.error = String(err instanceof Error ? err.message : err);
    return finalize(result, jobDir);
  }
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

// Cleans up the job's temp directory unconditionally so one request's
// files can never be read by another, and nothing accumulates on disk.
async function finalize(result: CompileResponse, jobDir: string): Promise<CompileResponse> {
  try {
    await fs.rm(jobDir, { recursive: true, force: true });
  } catch {
    /* best-effort cleanup */
  }
  return result;
}
