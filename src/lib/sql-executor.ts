/**
 * SqlExecutor — the abstraction layer between dbt-runner / runner logic
 * and the underlying SQL engine.
 *
 * In the browser, the concrete implementation wraps DuckDB-WASM.
 * In Node tests, it wraps the native `duckdb` npm package.
 * Components obtain the active executor via getExecutor(); the correct
 * one is registered at startup by the environment (browser vs test).
 */

export interface QueryResult {
  rows: Record<string, unknown>[];
  /** Column names in result order (may be empty when no rows returned) */
  columnNames: string[];
}

export interface SqlExecutor {
  /** Run a query that returns rows (SELECT, SHOW, etc.) */
  query<T = Record<string, unknown>>(sql: string): Promise<T[]>;
  /** Run a statement that returns no rows (CREATE, INSERT, DROP) */
  exec(sql: string): Promise<void>;
}

// ---- Registry ----

let activeExecutor: SqlExecutor | null = null;

export function registerExecutor(executor: SqlExecutor): void {
  activeExecutor = executor;
}

export function getExecutor(): SqlExecutor {
  if (!activeExecutor) {
    throw new Error(
      "No SqlExecutor registered. Call registerExecutor() before running queries."
    );
  }
  return activeExecutor;
}

export function clearExecutor(): void {
  activeExecutor = null;
}