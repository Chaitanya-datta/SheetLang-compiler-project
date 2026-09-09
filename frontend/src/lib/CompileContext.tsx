import { createContext, useContext, useState, type ReactNode } from "react";
import type { CompileResult } from "./types";

// Holds the LAST real compile result so both the Playground and the
// Compiler Internals page show the same real data without re-compiling
// or duplicating state. Nothing here is fabricated -- if no compile has
// happened yet, `result` is null and every consumer shows a real "not
// available yet" state instead of inventing data.
interface CompileState {
  source: string;
  setSource: (s: string) => void;
  result: CompileResult | null;
  setResult: (r: CompileResult | null) => void;
}

const CompileContext = createContext<CompileState | null>(null);

export const DEFAULT_SOURCE = `SHEET Student

LET Maths = 90
LET Physics = 85
LET Chemistry = 80

LET Total = Maths + Physics + Chemistry
LET Average = Total / 3

IF Average >= 85
    PRINT "Distinction"
ELSE
    PRINT "First Class"
ENDIF

PRINT Total
PRINT Average

END
`;

export function CompileProvider({ children }: { children: ReactNode }) {
  const [source, setSource] = useState(DEFAULT_SOURCE);
  const [result, setResult] = useState<CompileResult | null>(null);
  return (
    <CompileContext.Provider value={{ source, setSource, result, setResult }}>
      {children}
    </CompileContext.Provider>
  );
}

export function useCompileState(): CompileState {
  const ctx = useContext(CompileContext);
  if (!ctx) throw new Error("useCompileState must be used within CompileProvider");
  return ctx;
}
