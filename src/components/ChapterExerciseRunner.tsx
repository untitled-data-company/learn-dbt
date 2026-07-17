"use client";

import { useEffect, useState } from "react";
import { CodeEditor } from "./CodeEditor";
import { ResultsTable } from "./ResultsTable";
import { runSql, SqlResult } from "@/lib/runner";
import { loadSeedData } from "@/lib/duckdb";
import type { ChapterExercise } from "@/lib/chapters";
import type { EditorLanguage } from "./CodeEditor";

/**
 * Map the exercise's language to the CodeEditor's supported languages.
 * `sql-jinja` (dbt-Jinja) is not yet supported by the base CodeEditor on
 * this branch, so it falls back to plain SQL highlighting.
 */
const EXERCISE_LANGUAGE_MAP: Record<ChapterExercise["language"], EditorLanguage> = {
  sql: "sql",
  "sql-jinja": "sql",
  python: "python",
  yaml: "yaml",
};

interface ChapterExerciseRunnerProps {
  exercise: ChapterExercise;
}

/**
 * ChapterExerciseRunner — the editor + results panel for a chapter.
 *
 * Pre-fills the SQL editor with a starter query, loads DuckDB seed data,
 * and provides a Run button to execute the query and render results in
 * a table.  A Hint button reveals progressive hints for users stuck on
 * join or aggregation logic.
 */
export function ChapterExerciseRunner({
  exercise,
}: ChapterExerciseRunnerProps) {
  const [sql, setSql] = useState(exercise.initialSql);
  const [result, setResult] = useState<SqlResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [dbReady, setDbReady] = useState(false);
  const [hintIndex, setHintIndex] = useState(0);
  const [shownHints, setShownHints] = useState<string[]>([]);

  useEffect(() => {
    let mounted = true;
    loadSeedData()
      .then(() => {
        if (mounted) setDbReady(true);
      })
      .catch((err) => console.error("Failed to seed DuckDB", err));
    return () => {
      mounted = false;
    };
  }, []);

  const handleRun = async () => {
    setLoading(true);
    const res = await runSql(sql);
    setResult(res);
    setLoading(false);
  };

  const handleHint = () => {
    if (hintIndex < exercise.hints.length) {
      setShownHints((prev) => [...prev, exercise.hints[hintIndex].text]);
      setHintIndex((prev) => prev + 1);
    }
  };

  const hasMoreHints = hintIndex < exercise.hints.length;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Prompt bar */}
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
        <h3 className="text-sm font-semibold text-gray-700 mb-1">Exercise</h3>
        <p className="text-sm text-gray-600">{exercise.prompt}</p>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-200 bg-white">
        <button
          onClick={handleRun}
          disabled={!dbReady || loading}
          className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
        >
          {loading ? "Running..." : "Run SQL"}
        </button>
        {hasMoreHints && (
          <button
            onClick={handleHint}
            className="px-3 py-2 bg-gray-100 text-gray-700 rounded text-sm font-medium hover:bg-gray-200 transition-colors"
          >
            {hintIndex === 0
              ? "Hint"
              : `Hint (${hintIndex}/${exercise.hints.length})`}
          </button>
        )}
        {!dbReady && (
          <span className="text-sm text-gray-500">Loading DuckDB...</span>
        )}
        <span className="text-xs text-gray-400 ml-auto hidden lg:inline">
          Seed: {exercise.seedTables.join(", ")}
        </span>
      </div>

      {/* Hints panel */}
      {shownHints.length > 0 && (
        <div className="px-4 py-2 border-b border-gray-200 bg-yellow-50 space-y-2">
          {shownHints.map((hint, i) => (
            <div
              key={i}
              className="text-sm text-gray-700 bg-yellow-100 border border-yellow-200 rounded p-2 whitespace-pre-wrap"
            >
              <span className="font-semibold text-yellow-800">
                Hint {i + 1}:
              </span>{" "}
              {hint}
            </div>
          ))}
        </div>
      )}

      {/* Editor + results split */}
      <div className="flex-1 min-h-0 flex flex-col">
        {/* Monaco editor */}
        <div className="flex-1 min-h-0">
          <CodeEditor
            value={sql}
            onChange={setSql}
            language={EXERCISE_LANGUAGE_MAP[exercise.language]}
            height="100%"
          />
        </div>

        {/* Results */}
        <div className="h-2/5 min-h-0 border-t border-gray-200 overflow-auto p-3 bg-gray-50">
          {result && (
            <>
              {result.error ? (
                <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3">
                  {result.error}
                </div>
              ) : (
                <ResultsTable
                  rows={result.rows}
                  caption={`${result.rows.length} row(s)`}
                />
              )}
            </>
          )}

          {!result && (
            <div className="text-sm text-gray-400 p-3 text-center">
              Click Run SQL to see results.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}