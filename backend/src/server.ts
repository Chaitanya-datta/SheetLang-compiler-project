import "dotenv/config";
import express, { type Request, type Response } from "express";
import cors from "cors";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compile, MAX_SOURCE_BYTES } from "./pipeline.js";
import { SHEETC_PATH, validateSheetcPath } from "./sheetc.js";
import { recordCompilation, getHistory, getCompilationById, getStats, exportCsv } from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXAMPLES_DIR = path.join(__dirname, "..", "..", "compiler", "examples");

const app = express();
app.use(cors());
// Body limit set comfortably above MAX_SOURCE_BYTES (JSON escaping can
// inflate a 100KB source somewhat); compile() enforces the real 100KB
// ceiling on the decoded source itself.
app.use(express.json({ limit: "256kb" }));

// Curated, categorized example list -- every entry maps to a REAL file
// under compiler/examples/. The frontend never inlines example source;
// it always fetches the real file content via /api/examples/:id.
interface ExampleEntry {
  id: string;
  label: string;
  file: string;
  category: string;
}
const EXAMPLES: ExampleEntry[] = [
  { id: "student", label: "student.sheet", file: "student.sheet", category: "Basics" },
  { id: "arithmetic", label: "arithmetic.sheet", file: "arithmetic.sheet", category: "Basics" },
  { id: "native_arithmetic", label: "native_arithmetic.sheet", file: "native_arithmetic.sheet", category: "Native" },
  { id: "native_variables", label: "native_variables.sheet", file: "native_variables.sheet", category: "Native" },
  { id: "native_unary", label: "native_unary.sheet", file: "native_unary.sheet", category: "Native" },
  { id: "native_division", label: "native_division.sheet", file: "native_division.sheet", category: "Native" },
  { id: "native_print", label: "native_print.sheet", file: "native_print.sheet", category: "Native" },
  { id: "native_string_print", label: "native_string_print.sheet", file: "native_string_print.sheet", category: "Native" },
  { id: "phase8_function", label: "phase8_function.sheet", file: "phase8_function.sheet", category: "Functions" },
  { id: "phase8_function_args", label: "phase8_function_args.sheet", file: "phase8_function_args.sheet", category: "Functions" },
  { id: "phase8_function_call", label: "phase8_function_call.sheet", file: "phase8_function_call.sheet", category: "Functions" },
  { id: "phase8_if", label: "phase8_if.sheet", file: "phase8_if.sheet", category: "Control Flow" },
  { id: "phase8_if_else", label: "phase8_if_else.sheet", file: "phase8_if_else.sheet", category: "Control Flow" },
  { id: "phase8_comparison", label: "phase8_comparison.sheet", file: "phase8_comparison.sheet", category: "Control Flow" },
  { id: "phase8_combined", label: "phase8_combined.sheet", file: "phase8_combined.sheet", category: "Combined" },
  { id: "loop_basic", label: "loop_basic.sheet", file: "loop_basic.sheet", category: "Loops" },
  { id: "loop_sum", label: "loop_sum.sheet", file: "loop_sum.sheet", category: "Loops" },
  { id: "native_semantic_error", label: "native_semantic_error.sheet", file: "native_semantic_error.sheet", category: "Error Cases" },
  { id: "native_syntax_error", label: "native_syntax_error.sheet", file: "native_syntax_error.sheet", category: "Error Cases" },
  { id: "native_invalid_character", label: "native_invalid_character.sheet", file: "native_invalid_character.sheet", category: "Error Cases" },
  { id: "phase8_duplicate_function", label: "phase8_duplicate_function.sheet", file: "phase8_duplicate_function.sheet", category: "Error Cases" },
  { id: "phase8_invalid_function", label: "phase8_invalid_function.sheet", file: "phase8_invalid_function.sheet", category: "Error Cases" },
  { id: "phase8_wrong_args", label: "phase8_wrong_args.sheet", file: "phase8_wrong_args.sheet", category: "Error Cases" },
  { id: "phase8_return_outside_function", label: "phase8_return_outside_function.sheet", file: "phase8_return_outside_function.sheet", category: "Error Cases" },
  { id: "phase8_undefined_in_function", label: "phase8_undefined_in_function.sheet", file: "phase8_undefined_in_function.sheet", category: "Error Cases" },
  { id: "loop_undefined_condition", label: "loop_undefined_condition.sheet", file: "loop_undefined_condition.sheet", category: "Error Cases" },
  { id: "loop_missing_endwhile", label: "loop_missing_endwhile.sheet", file: "loop_missing_endwhile.sheet", category: "Error Cases" },
];
const EXAMPLE_ID_PATTERN = /^[a-z0-9_]+$/; // defense in depth against path traversal, on top of the whitelist lookup below

app.get("/api/health", async (_req: Request, res: Response) => {
  const check = await validateSheetcPath();
  res.json({
    status: "ok",
    compiler: check.ok ? "available" : "unavailable",
    sheetcPath: SHEETC_PATH || null,
    reason: check.ok ? undefined : check.reason,
  });
});

app.get("/api/examples", (_req: Request, res: Response) => {
  res.json(EXAMPLES.map(({ id, label, file, category }) => ({ id, label, file, category })));
});

app.get("/api/examples/:id", async (req: Request, res: Response) => {
  const id = req.params.id;
  if (!EXAMPLE_ID_PATTERN.test(id)) {
    return res.status(400).json({ error: "Invalid example id." });
  }
  const entry = EXAMPLES.find((e) => e.id === id);
  if (!entry) return res.status(404).json({ error: "Unknown example id." });

  // Resolve against the fixed EXAMPLES_DIR and verify the result is
  // still inside it -- defense in depth against path traversal even
  // though `entry.file` only ever comes from the fixed whitelist above,
  // never from user input.
  const filePath = path.join(EXAMPLES_DIR, entry.file);
  if (!filePath.startsWith(EXAMPLES_DIR)) {
    return res.status(400).json({ error: "Invalid example path." });
  }

  try {
    const source = await fs.readFile(filePath, "utf8");
    res.json({ id: entry.id, label: entry.label, category: entry.category, source });
  } catch (err) {
    res.status(500).json({ error: "Could not read example file: " + (err instanceof Error ? err.message : String(err)) });
  }
});

app.post("/api/compile", async (req: Request, res: Response) => {
  const source = req.body && typeof req.body.source === "string" ? req.body.source : null;
  if (source === null) {
    return res.status(400).json({ success: false, error: "Request body must contain a string 'source' field." });
  }
  if (Buffer.byteLength(source, "utf8") > MAX_SOURCE_BYTES) {
    return res.status(413).json({ success: false, error: `Source exceeds maximum size of ${MAX_SOURCE_BYTES} bytes.` });
  }
  const result = await compile(source);
  // Log every real compilation (success or failure) to SQLite -- this is
  // the only place compilation history is written from; nothing is
  // backfilled or synthesized elsewhere.
  try {
    recordCompilation(source, result);
  } catch (err) {
    console.error("Failed to record compilation to database:", err);
    // A logging failure must never break the actual compile response.
  }
  res.json(result);
});

app.get("/api/history", (req: Request, res: Response) => {
  const limit = Math.min(Number(req.query.limit) || 50, 500);
  res.json(getHistory(limit));
});

app.get("/api/history/:id", (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "Invalid history id." });
  }
  const record = getCompilationById(id);
  if (!record) return res.status(404).json({ error: "No compilation with that id." });
  res.json(record);
});

app.get("/api/stats", (_req: Request, res: Response) => {
  res.json(getStats());
});

app.get("/api/export/csv", (_req: Request, res: Response) => {
  const csv = exportCsv();
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", "attachment; filename=sheetlang_compilations.csv");
  res.send(csv);
});

const PORT = Number(process.env.PORT) || 3001;

validateSheetcPath().then((check) => {
  if (!check.ok) {
    console.error(`WARNING: ${check.reason}`);
    console.error("The server will still start, but /api/compile will fail until SHEETC_PATH points at a valid, built sheetc binary.");
  } else {
    console.log(`Using real sheetc binary at: ${SHEETC_PATH}`);
  }
  app.listen(PORT, () => {
    console.log(`SheetLang backend listening on http://localhost:${PORT}`);
  });
});
