import { useRef } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import type * as monacoTypes from "monaco-editor";

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
    <div className="relative h-full overflow-hidden rounded-lg border border-[#26313c]">
      <div className="absolute right-2 top-2 z-10 rounded bg-black/40 px-2 py-0.5 text-[10px] font-medium text-slate-400">
        SheetLang &nbsp;·&nbsp; ⌘/Ctrl+Enter to compile
      </div>
      <Editor
        height="100%"
        defaultLanguage="plaintext"
        theme="vs-dark"
        value={value}
        onChange={(v) => onChange(v ?? "")}
        onMount={handleMount}
        options={{
          fontSize: 13,
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          minimap: { enabled: true, scale: 1 },
          lineNumbers: "on",
          renderLineHighlight: "all",
          scrollBeyondLastLine: false,
          folding: true,
          tabSize: 4,
          automaticLayout: true,
          padding: { top: 12 },
          bracketPairColorization: { enabled: true },
        }}
      />
    </div>
  );
}
