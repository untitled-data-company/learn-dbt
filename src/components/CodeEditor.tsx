"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Editor, { OnMount, BeforeMount } from "@monaco-editor/react";
import type { editor as MonacoEditor } from "monaco-editor";
import { sqlJinjaTokenizer } from "@/lib/jinja-tokenizer";

// ── Types ──

export type EditorLanguage = "sql" | "sql-jinja" | "python" | "yaml";

export interface EditorFile {
  /** Tab label, typically the filename (e.g. "stg_orders.sql"). */
  name: string;
  /** Language for syntax highlighting. `sql-jinja` enables dbt-Jinja. */
  language: EditorLanguage;
  /** Initial content shown when the tab is first activated. */
  defaultValue: string;
}

export interface CodeEditorProps {
  /**
   * List of file tabs. The editor renders one tab per file; switching
   * tabs swaps the editor content and language without losing
   * unsaved edits in other tabs (content is kept in component state).
   */
  files: EditorFile[];
  /**
   * Callback fired whenever the active tab content changes. Receives
   * the file name and the new content so the parent can track per-file
   * state.
   */
  onChange?: (fileName: string, content: string) => void;
  /** Active tab name (controlled). If omitted, the first file is active. */
  activeFile?: string;
  /** Called when the user switches tabs. */
  onTabChange?: (fileName: string) => void;
  /** Editor height (CSS). Defaults to 100% of container. */
  height?: string;
  /** Monaco theme. Defaults to "vs-dark". */
  theme?: string;
  /** Read-only mode. */
  readOnly?: boolean;
}

// ── Language mapping ──

/** Maps our language enum to Monaco's language IDs. */
const MONACO_LANGUAGE: Record<EditorLanguage, string> = {
  sql: "sql",
  "sql-jinja": "sql-jinja",
  python: "python",
  yaml: "yaml",
};

// ── dbt-Jinja registration ──

/**
 * Registers the custom `sql-jinja` language and Monarch tokenizer with
 * Monaco. Idempotent: uses an explicit check against Monaco's
 * registered languages instead of a module-level boolean so that
 * StrictMode double-invocation and hot-reload remounts are safe.
 */
function registerSqlJinja(monaco: typeof import("monaco-editor")) {
  if (monaco.languages.getLanguages().some((l) => l.id === "sql-jinja")) {
    return;
  }

  monaco.languages.register({ id: "sql-jinja" });

  // Set Monarch tokenizer — cast to Monaco's IMonarchLanguage since our
  // interface is structurally compatible but not the same type object.
  monaco.languages.setMonarchTokensProvider(
    "sql-jinja",
    sqlJinjaTokenizer as unknown as Parameters<
      typeof monaco.languages.setMonarchTokensProvider
    >[1],
  );

  // Configuration for matching brackets, autoclosing, etc.
  monaco.languages.setLanguageConfiguration("sql-jinja", {
    comments: {
      lineComment: "--",
      blockComment: ["/*", "*/"],
    },
    brackets: [
      ["{", "}"],
      ["[", "]"],
      ["(", ")"],
    ],
    autoClosingPairs: [
      { open: "{", close: "}" },
      { open: "[", close: "]" },
      { open: "(", close: ")" },
      { open: "'", close: "'", notIn: ["string", "comment"] },
      { open: '"', close: '"', notIn: ["string"] },
    ],
    surroundingPairs: [
      { open: "{", close: "}" },
      { open: "[", close: "]" },
      { open: "(", close: ")" },
      { open: "'", close: "'" },
      { open: '"', close: '"' },
    ],
  });
}

// ── Component ──

export function CodeEditor({
  files,
  onChange,
  activeFile: controlledActive,
  onTabChange,
  height = "100%",
  theme = "vs-dark",
  readOnly = false,
}: CodeEditorProps) {
  // ── Active tab ──
  const [internalActive, setInternalActive] = useState(
    () => controlledActive ?? files[0]?.name ?? "",
  );
  const active = controlledActive ?? internalActive;

  // ── Per-tab content state (survives tab switches) ──
  const [contents, setContents] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const f of files) init[f.name] = f.defaultValue;
    return init;
  });

  // ── Editor instance ref (for programmatic model swap) ──
  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof import("monaco-editor") | null>(null);

  // ── Per-tab Monaco models (one model per file tab) ──
  // Keyed by file name; each model holds its own undo stack and cursor
  // position, so switching tabs via setModel preserves editing state.
  const modelsRef = useRef<Map<string, MonacoEditor.ITextModel>>(new Map());

  const handleBeforeMount: BeforeMount = useCallback((monaco) => {
    monacoRef.current = monaco;
    registerSqlJinja(monaco);
  }, []);

  const handleMount: OnMount = useCallback((editor) => {
    editorRef.current = editor;
  }, []);

  // ── Create / update Monaco models when files or contents change ──
  useEffect(() => {
    const monaco = monacoRef.current;
    if (!monaco) return;

    const models = modelsRef.current;

    for (const f of files) {
      const lang = MONACO_LANGUAGE[f.language];
      const content = contents[f.name] ?? f.defaultValue;
      let model = models.get(f.name);

      if (!model) {
        // Create a new model for this tab (disposed on unmount cleanup)
        model = monaco.editor.createModel(content, lang);
        models.set(f.name, model);
      } else {
        // Model exists — sync language in case the file's language changed
        if (model.getLanguageId() !== lang) {
          monaco.editor.setModelLanguage(model, lang);
        }
        // Sync content only if the model's value differs from our state
        // (avoids resetting cursor/undo on every render)
        if (model.getValue() !== content) {
          model.setValue(content);
        }
      }
    }
  }, [files, contents]);

  // ── Swap the active model when the active tab changes ──
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const models = modelsRef.current;
    const model = models.get(active);

    if (model) {
      const currentModel = editor.getModel();
      // Only call setModel if it's actually different — calling setModel
      // with the same model resets cursor position.
      if (currentModel !== model) {
        editor.setModel(model);
      }
    }
  }, [active]);

  // ── Tab switching ──
  const handleTabClick = (name: string) => {
    if (controlledActive === undefined) {
      setInternalActive(name);
    }
    onTabChange?.(name);
  };

  // ── Content change handler ──
  // We update React state from the editor's onChange. We do NOT push
  // the value back into the Monaco model here — the model IS the source
  // of truth; the useEffect above only syncs external state into models
  // when it differs (e.g. defaultValue on first creation).
  const handleContentChange = (value: string | undefined) => {
    const newContent = value ?? "";
    setContents((prev) => ({ ...prev, [active]: newContent }));
    onChange?.(active, newContent);
  };

  // If files prop changes identity, re-seed contents for any new files
  useEffect(() => {
    setContents((prev) => {
      const updated = { ...prev };
      for (const f of files) {
        if (!(f.name in updated)) {
          updated[f.name] = f.defaultValue;
        }
      }
      return updated;
    });
  }, [files]);

  // ── Dispose all models on unmount ──
  useEffect(() => {
    const models = modelsRef.current;
    return () => {
      models.forEach((m) => m.dispose());
      models.clear();
    };
  }, []);

  if (files.length === 0) {
    return (
      <div className="h-full w-full flex items-center justify-center border border-gray-700 rounded bg-[#1e1e1e] text-gray-500 text-sm">
        No files to display.
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col border border-gray-700 rounded bg-[#1e1e1e] overflow-hidden">
      {/* ── File tabs ── */}
      <div className="flex items-center bg-gray-800 border-b border-gray-700 overflow-x-auto">
        {files.map((file) => {
          const isActive = file.name === active;
          return (
            <button
              key={file.name}
              onClick={() => handleTabClick(file.name)}
              className={`px-3 py-1.5 text-xs font-mono whitespace-nowrap border-r border-gray-700 transition-colors ${
                isActive
                  ? "bg-[#1e1e1e] text-white border-t-2 border-t-blue-500"
                  : "text-gray-400 hover:text-gray-200 hover:bg-gray-750"
              }`}
            >
              {file.name}
            </button>
          );
        })}
      </div>

      {/* ── Editor area ── */}
      <div className="flex-1 min-h-0">
        <Editor
          height={height}
          theme={theme}
          beforeMount={handleBeforeMount}
          onMount={handleMount}
          onChange={handleContentChange}
          options={{
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            fontSize: 14,
            wordWrap: "on",
            lineNumbers: "on",
            folding: true,
            tabSize: 2,
            readOnly,
            renderWhitespace: "selection",
            fontLigatures: true,
          }}
        />
      </div>
    </div>
  );
}