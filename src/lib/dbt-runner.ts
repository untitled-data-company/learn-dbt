import { compileAllModels, ProjectManifest } from "./dbt-compiler";
import { getExecutor } from "./sql-executor";
import { SqlResult } from "./runner";

export interface RunResult {
  modelName: string;
  status: "success" | "error";
  compiledSql?: string;
  error?: string;
}

export interface TestResult {
  testName: string;
  status: "pass" | "fail" | "error";
  message?: string;
  failingRows?: Record<string, unknown>[];
}

export interface DbtRunResults {
  runs: RunResult[];
  error?: string;
}

export interface DbtTestResults {
  tests: TestResult[];
  error?: string;
}

export async function dbtRun(manifest: ProjectManifest): Promise<DbtRunResults> {
  const runs: RunResult[] = [];
  try {
    const models = compileAllModels(manifest);
    const executor = getExecutor();
    for (const model of models) {
      try {
        const sql = `CREATE OR REPLACE TABLE __dbt__${model.name} AS ${model.compiledSql}`;
        await executor.exec(sql);
        runs.push({
          modelName: model.name,
          status: "success",
          compiledSql: model.compiledSql,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        runs.push({
          modelName: model.name,
          status: "error",
          error: message,
        });
      }
    }
    return { runs };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { runs, error: message };
  }
}

export interface GenericTest {
  name: string;
  model: string;
  sql: string;
  expectedEmpty?: boolean;
}

export async function dbtTest(
  manifest: ProjectManifest,
  tests: GenericTest[] = []
): Promise<DbtTestResults> {
  const results: TestResult[] = [];
  try {
    // Ensure models are materialised so tests can reference them
    const runResults = await dbtRun(manifest);
    const failedRun = runResults.runs.find((r) => r.status === "error");
    if (failedRun) {
      return {
        tests: results,
        error: `dbt run failed before tests: ${failedRun.modelName} - ${failedRun.error}`,
      };
    }

    const executor = getExecutor();
    for (const test of tests) {
      try {
        const compiledTest = compileTestSql(test.sql, manifest);
        const rows = await executor.query<Record<string, unknown>>(compiledTest);
        const failed = test.expectedEmpty !== false && rows.length > 0;
        results.push({
          testName: test.name,
          status: failed ? "fail" : "pass",
          message: failed
            ? `Test returned ${rows.length} failing row(s)`
            : "Test passed",
          failingRows: failed ? rows : undefined,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        results.push({ testName: test.name, status: "error", message });
      }
    }
    return { tests: results };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { tests: results, error: message };
  }
}

function compileTestSql(sql: string, manifest: ProjectManifest): string {
  let compiled = sql;
  compiled = compiled.replace(
    /\{\{\s*ref\(\s*["']([^"']+)["']\s*\)\s*\}\}/g,
    (_, refName) => {
      if (!manifest.models[refName]) {
        throw new Error(`Ref "${refName}" not found in manifest`);
      }
      return `__dbt__${refName}`;
    }
  );
  compiled = compiled.replace(/--[^\n]*/g, "");
  return compiled.trim();
}

export async function queryModel(
  modelName: string,
  limit = 100
): Promise<SqlResult> {
  try {
    const executor = getExecutor();
    const rows = await executor.query<Record<string, unknown>>(
      `SELECT * FROM __dbt__${modelName} LIMIT ${limit}`
    );
    return {
      rows,
      columnNames: rows.length > 0 ? Object.keys(rows[0]) : [],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { rows: [], columnNames: [], error: message };
  }
}