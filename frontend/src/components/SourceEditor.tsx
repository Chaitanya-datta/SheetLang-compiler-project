import { useRef } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import type * as monacoTypes from "monaco-editor";
import { Code2, Zap } from "lucide-react";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onCompile: () => void;
  errorLine?: number | null;
  errorMessage?: string | null;
}

export default function SourceEditor({ value, onChange, onCompile, errorLine, errorMessage }: Props) {
  const monacoRef = useRef<typeof monacoTypes | null>(null);
  const editorRef = useRef<monacoTypes.editor.IStandaloneCodeEditor | null>(null);

  function applyMarkers() {
    const monaco = monacoRef.current;
    const editor = editorRef.current;
    if (!monaco || !editor) return;
    const model = editor.getModel();
    if (!model) return;

    if (errorLine && errorMessage) {
      monaco.editor.setModelMarkers(model, "sheetlang", [
        {
          startLineNumber: errorLine,
          startColumn: 1,
          endLineNumber: errorLine,
          endColumn: model.getLineMaxColumn(errorLine),
          message: errorMessage,
          severity: monaco.MarkerSeverity.Error,
        },
      ]);
    } else {
      monaco.editor.setModelMarkers(model, "sheetlang", []);
    }
  }

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => onCompile());
    applyMarkers();
  };

  applyMarkers();

  return (
    <div className="relative h-full flex flex-col overflow-hidden rounded-xl border border-white/10 bg-[#090d16] shadow-xl">
      <div className="flex items-center justify-between border-b border-white/5 bg-[#0d131f] px-4 py-2">
        <div className="flex items-center gap-2">
          <Code2 size={14} className="text-emerald-400" />
          <span className="text-[11px] font-mono font-bold tracking-wider text-slate-300 uppercase">
            SheetLang Source
          </span>
        </div>
        <div className="flex items-center gap-1.5 rounded-md border border-white/5 bg-slate-900/60 px-2 py-0.5 text-[10px] font-mono text-slate-400">
          <Zap size={10} className="text-amber-400" />
          <span>⌘/Ctrl+Enter</span>
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <Editor
          height="100%"
          defaultLanguage="plaintext"
          theme="vs-dark"
          value={value}
          onChange={(v) => onChange(v ?? "")}
          onMount={handleMount}
          options={{
            fontSize: 13,
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
            minimap: { enabled: false },
            lineNumbers: "on",
            renderLineHighlight: "all",
            scrollBeyondLastLine: false,
            folding: true,
            tabSize: 4,
            automaticLayout: true,
            padding: { top: 12, bottom: 12 },
            bracketPairColorization: { enabled: true },
          }}
        />
      </div>
    </div>
  );
}
