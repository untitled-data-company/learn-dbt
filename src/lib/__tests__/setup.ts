/**
 * Test setup — registers a native DuckDB executor and loads seed data
 * before each test suite runs.
 *
 * This mirrors the browser initDuckDB() path but uses the Node-native
 * duckdb package instead of DuckDB-WASM (which requires browser APIs).
 */
import { registerExecutor } from "@/lib/sql-executor";
import { NativeDuckDBExecutor } from "@/lib/native-duckdb";

const SEED_SQL = `
CREATE OR REPLACE TABLE raw_customers AS SELECT * FROM (VALUES
  (1, 'Giulia', 'Rossi', 'giulia@example.com', DATE '2023-01-15'),
  (2, 'Luca', 'Bianchi', 'luca@example.com', DATE '2023-02-20'),
  (3, 'Marco', 'Verdi', 'marco@example.com', DATE '2023-03-10')
) AS t(customer_id, first_name, last_name, email, created_at);

CREATE OR REPLACE TABLE raw_products AS SELECT * FROM (VALUES
  (1, 'Widget A', 9.99, 'gadgets'),
  (2, 'Widget B', 19.99, 'gadgets'),
  (3, 'Thingamajig', 29.99, 'widgets')
) AS t(product_id, name, price, category);

CREATE OR REPLACE TABLE raw_orders AS SELECT * FROM (VALUES
  (1, 1, 1, 2, DATE '2023-04-01', 'completed'),
  (2, 2, 2, 1, DATE '2023-04-02', 'completed'),
  (3, 1, 3, 1, DATE '2023-04-03', 'pending'),
  (4, 3, 1, 5, DATE '2023-04-04', 'completed')
) AS t(order_id, customer_id, product_id, quantity, order_date, status);
`;

let executorInstance: NativeDuckDBExecutor | null = null;

function getTestExecutor(): NativeDuckDBExecutor {
  if (!executorInstance) {
    executorInstance = new NativeDuckDBExecutor();
  }
  return executorInstance;
}

/**
 * Register the native executor and re-seed the in-memory DB.
 * Call from beforeAll() in test suites that need DuckDB.
 */
export async function setupTestExecutor(): Promise<void> {
  const executor = getTestExecutor();
  registerExecutor(executor);
  // Re-seed before each suite to ensure a clean state
  for (const stmt of SEED_SQL.split(";")) {
    const trimmed = stmt.trim();
    if (trimmed) {
      await executor.exec(trimmed);
    }
  }
}