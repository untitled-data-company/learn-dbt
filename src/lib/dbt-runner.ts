import {
  compileAllModels,
  createModelResultTableSql,
  dropModelRelationSql,
  ProjectManifest,
} from "./dbt-compiler";
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

/**
 * Execute `dbt run` semantics: compile every model in dependency order and
 * materialise it as a table or view in DuckDB.
 *
 * Models are compiled in topological order (via `compileAllModels`) so that
 * a model's `ref()` dependencies are always materialised before it runs.
 * Each model is wrapped in its own try/catch so one failure doesn't abort
 * the entire run — matching dbt's default behaviour.
 */
export async function dbtRun(manifest: ProjectManifest): Promise<DbtRunResults> {
  const runs: RunResult[] = [];
  try {
    const models = compileAllModels(manifest);
    const executor = getExecutor();
    for (const model of models) {
      try {
        const ddl = createModelResultTableSql(model.name, manifest);
        // Drop any existing relation (view or table) before creating.
        // Each drop is run separately because DuckDB errors when dropping a
        // type that doesn't match the existing object, even with IF EXISTS.
        for (const drop of dropModelRelationSql(model.name)) {
          try {
            await executor.exec(drop);
          } catch {
            // Relation is the other type or doesn't exist — safe to ignore.
          }
        }
        await executor.exec(`${ddl} ${model.compiledSql}`);
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

/**
 * Execute `dbt test` semantics: run models first, then execute each test
 * query.  A test "passes" when it returns zero rows (the dbt convention for
 * generic tests — the query finds *failing* rows).
 *
 * The architecture is deliberately decoupled from the compiler: tests receive
 * the manifest so they can resolve `ref()` themselves, and the test query is
 * compiled with the same regex logic.  This allows test semantics to evolve
 * independently (e.g. singular tests, schema tests) without coupling to the
 * run path.
 */
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

/**
 * Compile a test query: resolve `ref()` to the materialised model table and
 * strip SQL comments.  Uses the same regex as the main compiler for consistency.
 */
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

/**
 * Query a materialised model's result rows.
 */
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