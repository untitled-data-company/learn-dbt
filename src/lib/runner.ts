import { getExecutor } from "./sql-executor";

export interface SqlResult {
  rows: Record<string, unknown>[];
  columnNames: string[];
  error?: string;
}

export async function runSql(sql: string): Promise<SqlResult> {
  try {
    const executor = getExecutor();
    const rows = await executor.query(sql);
    const columnNames = rows.length > 0 ? Object.keys(rows[0]) : [];
    return { rows, columnNames };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { rows: [], columnNames: [], error: message };
  }
}

export async function runSqlNoResult(sql: string): Promise<{ error?: string }> {
  try {
    const executor = getExecutor();
    await executor.exec(sql);
    return {};
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { error: message };
  }
}