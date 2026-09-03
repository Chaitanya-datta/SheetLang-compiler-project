// These types mirror exactly what backend/src/pipeline.ts actually
// returns. The frontend never invents fields the backend doesn't send.

export type StageStatus = "pending" | "success" | "failed" | "skipped";

export interface StageResult {
  id: string;
  name: string;
  status: StageStatus;
  durationMs: number;
  output: string;
}

export interface Token {
  lexeme: string;
  token: string;
  line: number;
  col: number;
}

export interface AstNode {
  label: string;
  children: AstNode[];
}

export interface DerivedSymbol {
  name: string;
  kind: "LET" | "CELL";
}
export interface DerivedFunction {
  signature: string;
}

export interface SemanticError {
  message: string;
  line: number;
}

export interface DependencyEdge {
  from: string;
  to: string[];
}

export interface CompileResult {
  success: boolean;
  stage?: string;
  error?: string;
  stages: StageResult[];
  tokens: { count: number; tokens: Token[]; errors: string[] } | null;
  ast: { raw: string; tree: AstNode | null } | null;
  symbols: { symbols: DerivedSymbol[]; functions: DerivedFunction[] } | null;
  semantic: { passed: boolean; errors: SemanticError[]; raw: string } | null;
  dependencies: {
    edges: DependencyEdge[];
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
}

export interface ExampleMeta {
  id: string;
  label: string;
  file: string;
  category: string;
}

export interface HealthStatus {
  status: string;
  compiler: "available" | "unavailable";
  sheetcPath: string | null;
  reason?: string;
}
