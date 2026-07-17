"use client";

import { useEffect, useState } from "react";
import { CodeEditor, EditorLanguage } from "@/components/CodeEditor";
import { ResultsTable } from "@/components/ResultsTable";
import { runSql } from "@/lib/runner";
import { SqlResult } from "@/lib/runner";
import { gradeRows, GradeResult } from "@/lib/grader";
import { loadSeedData } from "@/lib/duckdb";
import { ChapterExercise } from "@/lib/chapters";

interface ChapterExerciseRunnerProps {
  exercise: ChapterExercise;
  onComplete?: () => void;
}

/**
 * ChapterExerciseRunner — the editor + verification panel for a chapter.
 *
 * Wraps the existing CodeEditor, runSql, and gradeRows pipeline.
 * Calls onComplete when the grader reports a pass.
 *
 * For YAML exercises (e.g. sources.yml), the panel shows the editor and
 * a "Validate" check that verifies basic structure without SQL execution.
 */
export function ChapterExerciseRunner({
  exercise,
  onComplete,
}: ChapterExerciseRunnerProps) {
  const [sql, setSql] = useState(exercise.initialSql);
  const [result, setResult] = useState<SqlResult | null>(null);
  const [grade, setGrade] = useState<GradeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [dbReady, setDbReady] = useState(false);
  const [resetCounter, setResetCounter] = useState(0);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRun = async () => {
    setLoading(true);
    setGrade(null);
    const res = await runSql(sql);
    setResult(res);
    if (!res.error && exercise.expectedRows) {
      const gradeResult = gradeRows({
        actual: res.rows,
        expected: exercise.expectedRows,
        orderMatters: exercise.orderMatters,
        matchKey: exercise.matchKey,
        requiredColumns: exercise.requiredColumns,
        orderedColumns: exercise.orderedColumns,
      });
      setGrade(gradeResult);
      if (gradeResult.passed && onComplete) {
        onComplete();
      }
    } else if (!res.error && exercise.minRows && res.rows.length >= exercise.minRows) {
      // minRows-based pass (no expected rows)
      const pass: GradeResult = {
        passed: true,
        message: `Query returned ${res.rows.length} rows (minimum ${exercise.minRows} required).`,
      };
      setGrade(pass);
      if (onComplete) onComplete();
    }
    setLoading(false);
  };

  const handleReset = () => {
    setSql(exercise.initialSql);
    setResult(null);
    setGrade(null);
    setResetCounter((c) => c + 1);
  };

  // YAML validation (no SQL execution)
  const handleValidateYaml = () => {
    setLoading(true);
    const validation = validateYamlStructure(sql);
    setGrade(validation);
    if (validation.passed && onComplete) {
      onComplete();
    }
    setLoading(false);
  };

  const isYaml = exercise.language === "yaml";
  const hasGrading =
    exercise.expectedRows !== undefined || exercise.minRows !== undefined;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Prompt bar */}
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
        <h3 className="text-sm font-semibold text-gray-700 mb-1">
          Exercise
        </h3>
        <p className="text-sm text-gray-600">{exercise.prompt}</p>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-200 bg-white">
        <button
          onClick={isYaml ? handleValidateYaml : handleRun}
          disabled={!dbReady || loading}
          className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
        >
          {loading
            ? "Running..."
            : isYaml
              ? "Validate"
              : "Run SQL"}
        </button>
        <button
          onClick={handleReset}
          className="px-3 py-2 text-gray-600 rounded text-sm hover:bg-gray-100 transition-colors"
        >
          Reset
        </button>
        {!dbReady && (
          <span className="text-sm text-gray-500">Loading DuckDB...</span>
        )}
        {hasGrading && exercise.seedTables && (
          <span className="text-xs text-gray-400 ml-auto hidden lg:inline">
            Tables: {exercise.seedTables.join(", ")}
          </span>
        )}
      </div>

      {/* Editor + results split */}
      <div className="flex-1 min-h-0 flex flex-col">
        {/* Monaco editor */}
        <div className="flex-1 min-h-0">
          <CodeEditor
            key={resetCounter}
            value={sql}
            onChange={setSql}
            language={exercise.language as EditorLanguage}
          />
        </div>

        {/* Results */}
        <div className="h-2/5 min-h-0 border-t border-gray-200 overflow-auto p-3 bg-gray-50">
          {!isYaml && result && (
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

          {/* Verification panel */}
          {grade && (
            <div
              className={`mt-3 text-sm border rounded p-3 ${
                grade.passed
                  ? "text-green-700 bg-green-50 border-green-200"
                  : "text-red-700 bg-red-50 border-red-200"
              }`}
            >
              <strong>{grade.passed ? "PASS" : "FAIL"}</strong> — {grade.message}
              {grade.details && (
                <span className="block text-xs text-gray-500 mt-1">
                  ({grade.details})
                </span>
              )}
            </div>
          )}

          {!result && !grade && (
            <div className="text-sm text-gray-400 p-3 text-center">
              Click {isYaml ? "Validate" : "Run SQL"} to see results.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Basic YAML structure validator for sources.yml exercises.
 * Checks for version, source name, and table entries.
 */
function validateYamlStructure(yaml: string): GradeResult {
  const hasVersion = /version:\s*2/.test(yaml);
  if (!hasVersion) {
    return {
      passed: false,
      message: "Missing or incorrect 'version: 2' at the top of the file.",
      details: "yamlMissingVersion",
    };
  }

  const hasSources = /sources:/.test(yaml);
  if (!hasSources) {
    return {
      passed: false,
      message: "Missing 'sources:' section.",
      details: "yamlMissingSources",
    };
  }

  const hasSourceName = /name:\s*shop/.test(yaml);
  if (!hasSourceName) {
    return {
      passed: false,
      message: "Missing source named 'shop'. Add '- name: shop' under sources.",
      details: "yamlMissingSourceName",
    };
  }

  const tables = yaml.match(/-\s+name:\s*(\w+)/g);
  if (!tables || tables.length < 3) {
    return {
      passed: false,
      message: `Expected at least 3 tables under the shop source, found ${tables?.length ?? 0}.`,
      details: "yamlMissingTables",
    };
  }

  const tableNames = tables
    .map((t) => t.match(/name:\s*(\w+)/)?.[1])
    .filter(Boolean) as string[];

  const required = ["raw_orders", "raw_products", "raw_customers"];
  const missing = required.filter((r) => !tableNames.includes(r));
  if (missing.length > 0) {
    return {
      passed: false,
      message: `Missing table(s): ${missing.join(", ")}.`,
      details: "yamlMissingRequiredTables",
    };
  }

  return {
    passed: true,
    message: "sources.yml is valid: version 2, source 'shop' with all required tables.",
  };
}