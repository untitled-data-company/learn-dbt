"use client";

import { useState } from "react";
import Editor from "@monaco-editor/react";

export type EditorLanguage = "sql" | "python" | "yaml";

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language?: EditorLanguage;
  height?: string;
}

const languageMap: Record<EditorLanguage, string> = {
  sql: "sql",
  python: "python",
  yaml: "yaml",
};

export function CodeEditor({
  value,
  onChange,
  language = "sql",
  height = "100%",
}: CodeEditorProps) {
  const [isReady, setIsReady] = useState(false);

  return (
    <div className="h-full w-full flex flex-col border border-gray-700 rounded bg-[#1e1e1e]">
      <div className="px-3 py-1 text-xs text-gray-300 bg-gray-800 border-b border-gray-700 flex items-center gap-2">
        <span className="font-mono">{language.toUpperCase()}</span>
        {!isReady && <span className="text-gray-500">loading editor…</span>}
      </div>
      <div className="flex-1 min-h-0">
        <Editor
          height={height}
          language={languageMap[language]}
          value={value}
          theme="vs-dark"
          options={{
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            fontSize: 14,
            wordWrap: "on",
            lineNumbers: "on",
            folding: true,
          }}
          onChange={(v) => onChange(v ?? "")}
          onMount={() => setIsReady(true)}
        />
      </div>
    </div>
  );
}
