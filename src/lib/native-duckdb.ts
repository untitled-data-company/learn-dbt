/**
 * Native DuckDB executor for Node/test environments.
 *
 * DuckDB-WASM requires browser Worker APIs unavailable in Node/jsdom,
 * so tests use the native `duckdb` npm package via this executor.
 * It implements the same SqlExecutor interface as the browser WasmExecutor.
 *
 * BigInt values from native DuckDB are converted to Numbers so that test
 * assertions match the browser path (DuckDB-WASM serialises via Arrow's
 * toJSON, which yields plain numbers for small integers).
 */
import { Database } from "duckdb";
import type { SqlExecutor } from "./sql-executor";

type DuckDBRow = Record<string, unknown>;

function convertBigInts(rows: DuckDBRow[]): DuckDBRow[] {
  return rows.map((row) => {
    const converted: DuckDBRow = {};
    for (const [key, value] of Object.entries(row)) {
      converted[key] =
        typeof value === "bigint" ? Number(value) : value;
    }
    return converted;
  });
}

class NativeDuckDBExecutor implements SqlExecutor {
  private db: Database;

  constructor(dbPath = ":memory:") {
    this.db = new Database(dbPath);
  }

  async query<T = Record<string, unknown>>(sql: string): Promise<T[]> {
    return new Promise((resolve, reject) => {
      this.db.all(sql, (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(convertBigInts((rows ?? []) as DuckDBRow[]) as T[]);
      });
    });
  }

  async exec(sql: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.exec(sql, (err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }
}

export { NativeDuckDBExecutor };