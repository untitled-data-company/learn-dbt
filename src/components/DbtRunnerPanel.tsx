"use client";

import { useEffect, useState } from "react";
import { CodeEditor } from "./CodeEditor";
import { ResultsTable } from "./ResultsTable";
import {
  dbtRun,
  dbtTest,
  DbtRunResults,
  DbtTestResults,
  queryModel,
  GenericTest,
} from "@/lib/dbt-runner";
import { ProjectManifest } from "@/lib/dbt-compiler";
import { loadSeedData } from "@/lib/duckdb";

const DEFAULT_MANIFEST: ProjectManifest = {
  sources: {
    ecommerce: { name: "ecommerce", tables: ["raw_orders"] },
  },
  models: {
    stg_orders: {
      name: "stg_orders",
      sql: `SELECT * FROM {{ source("ecommerce", "raw_orders") }}`,
    },
    customer_orders: {
      name: "customer_orders",
      sql: `
        SELECT
          c.customer_id,
          c.first_name,
          c.last_name,
          COUNT(o.order_id) AS total_orders
        FROM {{ ref("stg_orders") }} o
        JOIN raw_customers c ON o.customer_id = c.customer_id
        GROUP BY c.customer_id, c.first_name, c.last_name
      `,
    },
  },
};

const DEFAULT_TESTS: GenericTest[] = [
  {
    name: "customer_orders_not_empty",
    model: "customer_orders",
    sql: `SELECT * FROM {{ ref("customer_orders") }} WHERE total_orders = 0`,
    expectedEmpty: true,
  },
];

export function DbtRunnerPanel() {
  const [manifest, setManifest] = useState(
    JSON.stringify(DEFAULT_MANIFEST, null, 2)
  );
  const [dbtResults, setDbtResults] = useState<DbtRunResults | null>(null);
  const [testResults, setTestResults] = useState<DbtTestResults | null>(null);
  const [modelPreview, setModelPreview] = useState<{
    rows: Record<string, unknown>[];
    columnNames: string[];
    name: string;
    error?: string;
  } | null>(null);
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    loadSeedData()
      .then(() => setDbReady(true))
      .catch((err) => console.error("Failed to seed DuckDB", err));
  }, []);

  const parsedManifest = (): ProjectManifest | null => {
    try {
      return JSON.parse(manifest) as ProjectManifest;
    } catch {
      return null;
    }
  };

  const handleRun = async () => {
    const m = parsedManifest();
    if (!m) return;
    setDbtResults(await dbtRun(m));
    setTestResults(null);
  };

  const handleTest = async () => {
    const m = parsedManifest();
    if (!m) return;
    setTestResults(await dbtTest(m, DEFAULT_TESTS));
  };

  const previewModel = async (name: string) => {
    const m = parsedManifest();
    if (!m) return;
    await dbtRun(m);
    const res = await queryModel(name);
    setModelPreview({ name, ...res });
  };

  return (
    <div className="flex h-full gap-4">
      {/* Left panel: controls + results */}
      <div className="flex flex-col gap-3 w-1/2 min-w-0">
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={handleRun}
            disabled={!dbReady}
            className="px-4 py-2 bg-green-600 text-white rounded text-sm font-medium hover:bg-green-700 disabled:bg-gray-400"
          >
            dbt run
          </button>
          <button
            onClick={handleTest}
            disabled={!dbReady}
            className="px-4 py-2 bg-purple-600 text-white rounded text-sm font-medium hover:bg-purple-700 disabled:bg-gray-400"
          >
            dbt test
          </button>
          <button
            onClick={() => previewModel("customer_orders")}
            disabled={!dbReady}
            className="px-4 py-2 bg-gray-700 text-white rounded text-sm font-medium hover:bg-gray-800 disabled:bg-gray-400"
          >
            Preview customer_orders
          </button>
          {!dbReady && (
            <span className="text-sm text-gray-500">Loading DuckDB…</span>
          )}
        </div>

        <div className="flex-1 overflow-auto flex flex-col gap-3">
          {dbtResults && (
            <div className="text-sm border border-gray-200 rounded p-3 bg-white">
              <h4 className="font-semibold mb-2">Run results</h4>
              {dbtResults.error && (
                <p className="text-red-600">{dbtResults.error}</p>
              )}
              <ul className="space-y-1">
                {dbtResults.runs.map((r) => (
                  <li
                    key={r.modelName}
                    className={
                      r.status === "success" ? "text-green-700" : "text-red-700"
                    }
                  >
                    {r.modelName}: {r.status} {r.error && `- ${r.error}`}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {testResults && (
            <div className="text-sm border border-gray-200 rounded p-3 bg-white">
              <h4 className="font-semibold mb-2">Test results</h4>
              {testResults.error && (
                <p className="text-red-600">{testResults.error}</p>
              )}
              <ul className="space-y-1">
                {testResults.tests.map((t) => (
                  <li
                    key={t.testName}
                    className={
                      t.status === "pass"
                        ? "text-green-700"
                        : t.status === "fail"
                          ? "text-orange-700"
                          : "text-red-700"
                    }
                  >
                    {t.testName}: {t.status} {t.message && `- ${t.message}`}
                  </li>
                ))}
              </ul>
              {testResults.tests.some((t) => t.failingRows) && (
                <div className="mt-2">
                  <ResultsTable
                    rows={
                      testResults.tests.find((t) => t.failingRows)
                        ?.failingRows ?? []
                    }
                    caption="Failing rows"
                  />
                </div>
              )}
            </div>
          )}

          {modelPreview && (
            <div className="flex flex-col gap-2">
              <h4 className="text-sm font-semibold">
                Preview: {modelPreview.name}
              </h4>
              {modelPreview.error ? (
                <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3">
                  {modelPreview.error}
                </div>
              ) : (
                <ResultsTable
                  rows={modelPreview.rows}
                  caption={`${modelPreview.rows.length} row(s)`}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right panel: manifest editor */}
      <div className="flex-1 min-h-0 min-w-0">
        <CodeEditor
          files={[
            {
              name: "manifest.yaml",
              language: "yaml",
              defaultValue: manifest,
            },
          ]}
          onChange={(_name, value) => setManifest(value)}
        />
      </div>
    </div>
  );
}