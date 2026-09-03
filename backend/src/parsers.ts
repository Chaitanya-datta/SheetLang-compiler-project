// These functions ONLY reformat text that `sheetc` itself already
// produced (token dumps, the --ast tree, --deps output, semantic-error
// lines). None of them re-derive compiler results independently -- they
// are thin adapters over the compiler's real, existing text output, not
// a second implementation of any compiler stage.

export interface Token {
  lexeme: string;
  token: string;
  line: number;
  col: number;
}

export function parseTokens(stdout: string): Token[] {
  const tokens: Token[] = [];
  for (const line of stdout.split("\n")) {
    const m = line.match(/^(\S+)\s+(\S+)\s+line\s+(\d+)\s+col\s+(\d+)\s*$/);
    if (m) {
      tokens.push({ lexeme: m[1], token: m[2], line: Number(m[3]), col: Number(m[4]) });
    }
  }
  return tokens;
}

export function parseLexicalErrors(stderr: string): string[] {
  return stderr
    .split("\n")
    .filter((l) => l.startsWith("Lexical Error:"))
    .map((l) => l.replace(/^Lexical Error:\s*/, ""));
}

export interface AstNode {
  label: string;
  children: AstNode[];
}

// Generic indentation/box-drawing-character parser for the compiler's OWN
// existing --ast text output. Has no knowledge of SheetLang grammar --
// it only reads tree-drawing characters (├── / └──) and 4-space nesting.
export function parseAstTree(stdout: string): AstNode | null {
  const lines = stdout.split("\n").filter((l) => l.length > 0);
  if (lines.length === 0) return null;

  const root: AstNode = { label: lines[0].trim(), children: [] };
  const stack: { node: AstNode; depth: number }[] = [{ node: root, depth: -1 }];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const marker = line.match(/(├── |└── )/);
    if (!marker) continue;
    const markerIndex = line.indexOf(marker[1]);
    const depth = Math.floor(markerIndex / 4);
    const label = line.slice(markerIndex + 4).trim();
    const node: AstNode = { label, children: [] };

    while (stack.length && stack[stack.length - 1].depth >= depth) stack.pop();
    stack[stack.length - 1].node.children.push(node);
    stack.push({ node, depth });
  }

  return root;
}

export interface DerivedSymbol {
  name: string;
  kind: "LET" | "CELL";
}
export interface DerivedFunction {
  signature: string;
}

// Derives a "declared symbols" list from the real AST tree -- NOT a
// compiler symbol-table dump (sheetc has no such mode). Every
// "Assignment" node's first child is the target name (per AST.cpp's own
// label() for IdentifierNode/CellNode); a bare identifier target is
// reported as LET, an all-caps-plus-digits label (SheetLang's CELL
// syntax, e.g. "A1") is reported as CELL. No line numbers are included
// because the text AST printer does not emit them.
export function deriveSymbolsFromAst(astRoot: AstNode | null): {
  symbols: DerivedSymbol[];
  functions: DerivedFunction[];
} {
  const symbols: DerivedSymbol[] = [];
  const cellPattern = /^[A-Z]+[0-9]+$/;

  function walk(node: AstNode) {
    if (node.label === "Assignment" && node.children.length >= 1) {
      const name = node.children[0].label;
      symbols.push({ name, kind: cellPattern.test(name) ? "CELL" : "LET" });
    }
    for (const c of node.children) walk(c);
  }
  if (astRoot) walk(astRoot);

  const functions: DerivedFunction[] = [];
  function walkFn(node: AstNode) {
    if (node.label.startsWith("Function ")) {
      functions.push({ signature: node.label });
    }
    for (const c of node.children) walkFn(c);
  }
  if (astRoot) walkFn(astRoot);

  return { symbols, functions };
}

export interface SemanticError {
  message: string;
  line: number;
}

export function parseSemanticErrors(stderr: string): SemanticError[] {
  const out: SemanticError[] = [];
  for (const line of stderr.split("\n")) {
    const m = line.match(/^Semantic Error:\s*(.*?)\s+at line\s+(\d+)\s*$/);
    if (m) out.push({ message: m[1], line: Number(m[2]) });
  }
  return out;
}

export function parseDependencyErrors(stderr: string): string[] {
  return stderr
    .split("\n")
    .filter((l) => l.startsWith("Dependency Error:"))
    .map((l) => l.replace(/^Dependency Error:\s*/, ""));
}

export interface DependencyEdge {
  from: string;
  to: string[];
}

export function parseDependencies(stdout: string): { edges: DependencyEdge[]; order: string[] } {
  const lines = stdout.split("\n");
  const edges: DependencyEdge[] = [];
  const order: string[] = [];
  let section: "graph" | "order" | null = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (line === "Dependency Graph:") { section = "graph"; continue; }
    if (line === "Evaluation Order:") { section = "order"; continue; }
    if (line === "" || line === "(no dependencies)") continue;

    if (section === "graph") {
      const m = line.match(/^(\S+)\s*->\s*(.+)$/);
      if (m) edges.push({ from: m[1], to: m[2].split(",").map((s) => s.trim()) });
    } else if (section === "order") {
      order.push(line);
    }
  }

  return { edges, order };
}

// Reverse-dependency ("used by") view, derived purely from the same real
// edge list above -- no additional compiler invocation needed.
export function reverseDependencies(edges: DependencyEdge[]): Record<string, string[]> {
  const usedBy: Record<string, string[]> = {};
  for (const e of edges) {
    for (const target of e.to) {
      if (!usedBy[target]) usedBy[target] = [];
      usedBy[target].push(e.from);
    }
  }
  return usedBy;
}
