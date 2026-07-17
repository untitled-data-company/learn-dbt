"use client";

import { useEffect, useState } from "react";
import { CodeEditor, EditorLanguage } from "./CodeEditor";
import { ResultsTable } from "./ResultsTable";
import { runSql } from "@/lib/runner";
import { SqlResult } from "@/lib/runner";
import { gradeRows, GradeResult } from "@/lib/grader";
import { loadSeedData } from "@/lib/duckdb";

const DEFAULT_SQL = `SELECT
  o.order_id,
  c.first_name,
  p.name AS product_name,
  o.quantity,
  o.order_date
FROM raw_orders o
JOIN raw_customers c ON o.customer_id = c.customer_id
JOIN raw_products p ON o.product_id = p.product_id
LIMIT 10;`;

interface ExerciseRunnerProps {
  /** Initial SQL for the editor */
  initialSql?: string;
  /** Language for the Monaco editor */
  language?: EditorLanguage;
  /** Optional exercise prompt shown in the left panel */
  prompt?: string;
  /** Optional expected rows for grading */
  expectedRows?: Record<string, unknown>[];
  /** Whether row order matters for grading */
  orderMatters?: boolean;
  /** Column to use as key for unordered comparison */
  matchKey?: string;
  /** Required column names */
  requiredColumns?: string[];
  /** Exact column order required */
  orderedColumns?: string[];
  /** Seed table names to display */
  seedTables?: string[];
}

export function ExerciseRunner({
  initialSql = DEFAULT_SQL,
  language = "sql",
  prompt,
  expectedRows,
  orderMatters,
  matchKey,
  requiredColumns,
  orderedColumns,
  seedTables = ["raw_orders", "raw_products", "raw_customers"],
}: ExerciseRunnerProps) {
  const [sql, setSql] = useState(initialSql);
  const [result, setResult] = useState<SqlResult | null>(null);
  const [grade, setGrade] = useState<GradeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    loadSeedData()
      .then(() => setDbReady(true))
      .catch((err) => console.error("Failed to seed DuckDB", err));
  }, []);

  const handleRun = async () => {
    setLoading(true);
    setGrade(null);
    const res = await runSql(sql);
    setResult(res);
    if (!res.error && expectedRows) {
      setGrade(
        gradeRows({
          actual: res.rows,
          expected: expectedRows,
          orderMatters,
          matchKey,
          requiredColumns,
          orderedColumns,
        })
      );
    }
    setLoading(false);
  };

  return (
    <div className="flex h-full gap-4">
      {/* Left panel: controls, results, grading */}
      <div className="flex flex-col gap-3 w-1/2 min-w-0">
        {prompt && (
          <div className="text-sm text-gray-700 bg-gray-100 border border-gray-200 rounded p-3">
            {prompt}
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={handleRun}
              disabled={!dbReady || loading}
              className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:bg-gray-400"
            >
              {loading ? "Running…" : "Run SQL"}
            </button>
            {!dbReady && (
              <span className="text-sm text-gray-500">Loading DuckDB…</span>
            )}
          </div>
          <span className="text-xs text-gray-500">
            Seed tables: {seedTables.join(", ")}
          </span>
        </div>

        <div className="flex-1 overflow-auto">
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
        </div>

        {grade && (
          <div
            className={`text-sm border rounded p-3 ${
              grade.passed
                ? "text-green-700 bg-green-50 border-green-200"
                : "text-red-700 bg-red-50 border-red-200"
            }`}
          >
            <strong>{grade.passed ? "PASS" : "FAIL"}</strong> — {grade.message}
          </div>
        )}
      </div>

      {/* Right panel: Monaco editor */}
      <div className="flex-1 min-h-0 min-w-0">
        <CodeEditor value={sql} onChange={setSql} language={language} />
      </div>
    </div>
  );
}