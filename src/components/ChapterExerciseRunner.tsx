"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CodeEditor, type EditorLanguage } from "@/components/CodeEditor";
import { ResultsTable } from "@/components/ResultsTable";
import { runSql } from "@/lib/runner";
import type { SqlResult } from "@/lib/runner";
import { gradeRows, type GradeResult } from "@/lib/grader";
import { loadSeedData } from "@/lib/duckdb";
import type { ChapterExercise, ExerciseFile } from "@/lib/chapters";
import { parseSourcesYaml, type ProjectManifest } from "@/lib/dbt-compiler";
import { dbtRun, type DbtRunResults } from "@/lib/dbt-runner";

interface ChapterExerciseRunnerProps {
  exercise: ChapterExercise;
  onComplete?: () => void;
}

/**
 * ChapterExerciseRunner — the editor + verification panel for a chapter.
 *
 * Supports two modes:
 *   1. SQL mode (default): single-file editor, runSql, gradeRows pipeline.
 *   2. dbt run mode (useDbtRun=true): multi-file editor (sources.yml + .sql),
 *      builds a ProjectManifest from the YAML and SQL, runs dbtRun, shows
 *      compilation results.
 *   3. YAML-only mode (language="yaml"): single-file YAML editor with
 *      structure validation (legacy).
 *
 * Calls onComplete when the grader reports a pass.
 */
export function ChapterExerciseRunner({
  exercise,
  onComplete,
}: ChapterExerciseRunnerProps) {
  // ── Determine mode ──
  const isDbtRun = exercise.useDbtRun === true;
  const isYamlOnly = !isDbtRun && exercise.language === "yaml";
  const hasGrading =
    exercise.expectedRows !== undefined || exercise.minRows !== undefined;

  // ── Multi-file state ──
  // For multi-file exercises, track content per file name.
  const [fileContents, setFileContents] = useState<Record<string, string>>(
    () => {
      if (exercise.files) {
        const init: Record<string, string> = {};
        for (const f of exercise.files) init[f.fileName] = f.initialSql;
        return init;
      }
      return {};
    },
  );

  // ── Single-file state (legacy) ──
  const [content, setContent] = useState(exercise.initialSql ?? "");

  // ── Shared state ──
  const [result, setResult] = useState<SqlResult | null>(null);
  const [grade, setGrade] = useState<GradeResult | null>(null);
  const [dbtResults, setDbtResults] = useState<DbtRunResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [dbReady, setDbReady] = useState(false);
  const [dbLoaded, setDbLoaded] = useState(false);
  const [resetCounter, setResetCounter] = useState(0);

  // ── Seed DuckDB on mount ──
  useEffect(() => {
    if (dbLoaded) return;
    let mounted = true;
    loadSeedData()
      .then(() => {
        if (mounted) {
          setDbReady(true);
          setDbLoaded(true);
        }
      })
      .catch((err) => console.error("Failed to seed DuckDB", err));
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbLoaded]);

  // ── Build files array for CodeEditor ──
  const editorFiles: ExerciseFile[] = exercise.files ?? [
    {
      fileName: exercise.fileName ?? "query.sql",
      language: (exercise.language ?? "sql") as EditorLanguage,
      initialSql: content,
    },
  ];

  // ── Handle editor content changes ──
  const handleChange = useCallback(
    (fileName: string, value: string) => {
      if (exercise.files) {
        setFileContents((prev) => ({ ...prev, [fileName]: value }));
      } else {
        setContent(value);
      }
    },
    [exercise.files],
  );

  // ── Get the active SQL content (for single-file mode) ──
  const getActiveSql = useCallback((): string => {
    if (exercise.files) {
      // In multi-file mode, find the SQL file
      const sqlFile = exercise.files.find(
        (f) => f.language === "sql" || f.language === "sql-jinja",
      );
      if (sqlFile) return fileContents[sqlFile.fileName] ?? sqlFile.initialSql;
      return "";
    }
    return content;
  }, [exercise.files, fileContents, content]);

  // ── Run SQL (single-file mode) ──
  const handleRun = useCallback(async () => {
    setLoading(true);
    setGrade(null);
    setResult(null);
    const sql = getActiveSql();
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
    } else if (
      !res.error &&
      exercise.minRows &&
      res.rows.length >= exercise.minRows
    ) {
      const pass: GradeResult = {
        passed: true,
        message: `Query returned ${res.rows.length} rows (minimum ${exercise.minRows} required).`,
        checks: [],
      };
      setGrade(pass);
      if (onComplete) onComplete();
    }
    setLoading(false);
  }, [getActiveSql, exercise, onComplete]);

  // ── dbt run mode ──
  const handleDbtRun = useCallback(async () => {
    if (!exercise.files) return;
    setLoading(true);
    setGrade(null);
    setResult(null);
    setDbtResults(null);

    // Find the YAML file (sources.yml) and the SQL model file
    const yamlFile = exercise.files.find((f) => f.language === "yaml");
    const sqlFile = exercise.files.find(
      (f) => f.language === "sql" || f.language === "sql-jinja",
    );
    if (!yamlFile || !sqlFile) {
      setGrade({
        passed: false,
        message:
          "dbt run requires both a YAML sources file and a SQL model file.",
        checks: [],
      });
      setLoading(false);
      return;
    }

    const yamlContent = fileContents[yamlFile.fileName] ?? yamlFile.initialSql;
    const sqlContent = fileContents[sqlFile.fileName] ?? sqlFile.initialSql;

    // Parse YAML to get sources
    const sources = parseSourcesYaml(yamlContent);

    // Build the model name from the SQL filename (strip .sql extension)
    const modelName = sqlFile.fileName.replace(/\.sql$/, "").split("/").pop() ?? "daily_revenue";

    // Build the manifest
    const manifest: ProjectManifest = {
      sources,
      models: {
        [modelName]: {
          name: modelName,
          sql: sqlContent,
        },
      },
    };

    // Run dbt run
    const results = await dbtRun(manifest);
    setDbtResults(results);

    // Grade: all models must succeed
    const allSuccess = results.runs.every((r) => r.status === "success");
    if (allSuccess) {
      setGrade({
        passed: true,
        message: `dbt run completed successfully. ${results.runs.length} model(s) materialized.`,
        checks: results.runs.map((r) => ({
          name: r.modelName,
          passed: true,
          message: `Compiled: ${r.compiledSql?.slice(0, 80)}...`,
        })),
      });
      if (onComplete) onComplete();
    } else {
      const failed = results.runs.find((r) => r.status === "error");
      setGrade({
        passed: false,
        message: `dbt run failed: ${failed?.error ?? "Unknown error"}`,
        details: "dbtRunError",
        checks: results.runs.map((r) => ({
          name: r.modelName,
          passed: r.status === "success",
          message: r.error,
        })),
      });
    }
    setLoading(false);
  }, [exercise.files, fileContents, onComplete]);

  // ── YAML validation (legacy single-file mode) ──
  const handleValidateYaml = useCallback(() => {
    setLoading(true);
    const validation = validateYamlStructure(content);
    setGrade(validation);
    if (validation.passed && onComplete) {
      onComplete();
    }
    setLoading(false);
  }, [content, onComplete]);

  // ── Reset ──
  const handleReset = useCallback(() => {
    if (exercise.files) {
      const init: Record<string, string> = {};
      for (const f of exercise.files) init[f.fileName] = f.initialSql;
      setFileContents(init);
    } else {
      setContent(exercise.initialSql ?? "");
    }
    setResult(null);
    setGrade(null);
    setDbtResults(null);
    setResetCounter((c) => c + 1);
  }, [exercise]);

  // ── Determine button action ──
  const buttonLabel = loading
    ? "Running..."
    : isDbtRun
      ? "dbt run"
      : isYamlOnly
        ? "Validate"
        : "Run SQL";

  const handleAction = isDbtRun
    ? handleDbtRun
    : isYamlOnly
      ? handleValidateYaml
      : handleRun;

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
          onClick={handleAction}
          disabled={!dbReady || loading}
          className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
        >
          {buttonLabel}
        </button>
        <button
          onClick={handleReset}
          className="px-3 py-2 text-gray-600 rounded text-sm hover:bg-gray-100 transition-colors"
        >
          Reset
        </button>
        {!dbReady && !isYamlOnly && (
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
        <div className="flex-1 min-h-0" key={resetCounter}>
          <CodeEditor
            files={editorFiles.map((f) => ({
              name: f.fileName,
              language: f.language as EditorLanguage,
              defaultValue: f.initialSql,
            }))}
            onChange={handleChange}
          />
        </div>

        {/* Results + verification panel */}
        <div className="h-2/5 min-h-0 border-t border-gray-200 overflow-auto p-3 bg-gray-50">
          {/* SQL results (single-file mode) */}
          {!isDbtRun && !isYamlOnly && result && (
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

          {/* dbt run results */}
          {isDbtRun && dbtResults && (
            <div className="text-sm border border-gray-200 rounded p-3 bg-white mb-3">
              <h4 className="font-semibold mb-2">dbt run results</h4>
              {dbtResults.error && (
                <p className="text-red-600 mb-2">{dbtResults.error}</p>
              )}
              <ul className="space-y-1">
                {dbtResults.runs.map((r) => (
                  <li
                    key={r.modelName}
                    className={
                      r.status === "success"
                        ? "text-green-700"
                        : "text-red-700"
                    }
                  >
                    {r.modelName}: {r.status}
                    {r.error && ` — ${r.error}`}
                    {r.compiledSql && (
                      <pre className="text-xs text-gray-500 mt-1 bg-gray-100 p-2 rounded overflow-x-auto">
                        {r.compiledSql}
                      </pre>
                    )}
                  </li>
                ))}
              </ul>
            </div>
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
              <strong>{grade.passed ? "PASS" : "FAIL"}</strong> —{" "}
              {grade.message}
              {grade.details && (
                <span className="block text-xs text-gray-500 mt-1">
                  ({grade.details})
                </span>
              )}
              {grade.checks && grade.checks.length > 1 && (
                <ul className="mt-2 space-y-1 text-xs text-gray-600">
                  {grade.checks.map((check, i) => (
                    <li key={i}>
                      {check.passed ? "[OK]" : "[X]"} {check.name}
                      {check.message ? ` — ${check.message}` : ""}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* AI prompt box */}
          {exercise && (
            <AiPromptBox prompt={exercise.prompt} />
          )}

          {!result && !grade && !isYamlOnly && !isDbtRun && (
            <div className="text-sm text-gray-400 p-3 text-center">
              Click Run SQL to see results.
            </div>
          )}

          {!result && !grade && isDbtRun && (
            <div className="text-sm text-gray-400 p-3 text-center">
              Click "dbt run" to compile and materialize the model.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * AiPromptBox — a copy-to-clipboard prompt suggestion for the learner
 * to paste into their AI tool of choice. Shown in the verification panel
 * below the grading results.
 */
function AiPromptBox({ prompt }: { prompt: string }) {
  const [copied, setCopied] = useState(false);

  const fullPrompt = buildAiPrompt(prompt);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fullPrompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard may be unavailable (SSR, permissions)
    }
  };

  return (
    <div className="mt-3 border border-purple-200 rounded p-3 bg-purple-50">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-purple-600">
          AI prompt to try
        </span>
        <button
          onClick={handleCopy}
          className="text-xs text-purple-600 hover:text-purple-800 font-medium"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <p className="text-sm text-purple-800 italic">{fullPrompt}</p>
    </div>
  );
}

function buildAiPrompt(exercisePrompt: string): string {
  return `I'm working on a dbt learning exercise. ${exercisePrompt} Can you help me understand the approach and point out common pitfalls?`;
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
      checks: [],
    };
  }

  const hasSources = /sources:/.test(yaml);
  if (!hasSources) {
    return {
      passed: false,
      message: "Missing 'sources:' section.",
      details: "yamlMissingSources",
      checks: [],
    };
  }

  const hasSourceName = /name:\s*shop/.test(yaml);
  if (!hasSourceName) {
    return {
      passed: false,
      message:
        "Missing source named 'shop'. Add '- name: shop' under sources.",
      details: "yamlMissingSourceName",
      checks: [],
    };
  }

  const tables = yaml.match(/-\s+name:\s*(\w+)/g);
  if (!tables || tables.length < 3) {
    return {
      passed: false,
      message: `Expected at least 3 tables under the shop source, found ${tables?.length ?? 0}.`,
      details: "yamlMissingTables",
      checks: [],
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
      checks: [],
    };
  }

  return {
    passed: true,
    message:
      "sources.yml is valid: version 2, source 'shop' with all required tables.",
    checks: [],
  };
}
