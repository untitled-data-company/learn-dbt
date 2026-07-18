import * as duckdb from "@duckdb/duckdb-wasm";
import { registerExecutor, SqlExecutor } from "./sql-executor";

let db: duckdb.AsyncDuckDB | null = null;
let conn: duckdb.AsyncDuckDBConnection | null = null;

const DUCKDB_BUNDLE_URLS: duckdb.DuckDBBundles = {
  mvp: {
    mainModule: "/duckdb-wasm/duckdb-mvp.wasm",
    mainWorker: "/duckdb-wasm/duckdb-browser-mvp.worker.js",
  },
  eh: {
    mainModule: "/duckdb-wasm/duckdb-eh.wasm",
    mainWorker: "/duckdb-wasm/duckdb-browser-eh.worker.js",
  },
};

/** DuckDB-WASM-backed executor for browser environments */
class WasmExecutor implements SqlExecutor {
  async query<T = Record<string, unknown>>(sql: string): Promise<T[]> {
    const c = await getConnection();
    const arrowTable = await c.query(sql);
    return arrowTable.toArray().map((row) => row.toJSON() as T);
  }

  async exec(sql: string): Promise<void> {
    const c = await getConnection();
    await c.query(sql);
  }
}

async function getConnection(): Promise<duckdb.AsyncDuckDBConnection> {
  if (conn) return conn;

  const bundle = await duckdb.selectBundle(DUCKDB_BUNDLE_URLS);
  const worker = new Worker(bundle.mainWorker!);
  const logger = new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING);
  db = new duckdb.AsyncDuckDB(logger, worker);
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
  conn = await db.connect();
  return conn;
}

/**
 * Initialise DuckDB-WASM in the browser, load seed data, and register
 * the WasmExecutor as the active SqlExecutor.
 */
export async function initDuckDB(): Promise<void> {
  registerExecutor(new WasmExecutor());
  await loadSeedData();
}

export async function loadSeedData(): Promise<void> {
  const executor = new WasmExecutor();

  await executor.exec(`
    CREATE OR REPLACE TABLE raw_customers (
      customer_id INTEGER,
      first_name VARCHAR,
      last_name VARCHAR,
      email VARCHAR,
      created_at DATE
    );
  `);
  await executor.exec(`
    CREATE OR REPLACE TABLE raw_products (
      product_id INTEGER,
      name VARCHAR,
      price DECIMAL(10,2),
      category VARCHAR
    );
  `);
  await executor.exec(`
    CREATE OR REPLACE TABLE raw_orders (
      order_id INTEGER,
      customer_id INTEGER,
      product_id INTEGER,
      quantity INTEGER,
      order_date DATE,
      status VARCHAR
    );
  `);

  const customers = [
    { customer_id: 1, first_name: "Giulia", last_name: "Rossi", email: "giulia@example.com", created_at: "2023-01-15" },
    { customer_id: 2, first_name: "Luca", last_name: "Bianchi", email: "luca@example.com", created_at: "2023-02-20" },
    { customer_id: 3, first_name: "Marco", last_name: "Verdi", email: "marco@example.com", created_at: "2023-03-10" },
  ];
  const products = [
    { product_id: 1, name: "Widget A", price: 9.99, category: "gadgets" },
    { product_id: 2, name: "Widget B", price: 19.99, category: "gadgets" },
    { product_id: 3, name: "Thingamajig", price: 29.99, category: "widgets" },
  ];
  const orders = [
    { order_id: 1, customer_id: 1, product_id: 1, quantity: 2, order_date: "2023-04-01", status: "completed" },
    { order_id: 2, customer_id: 2, product_id: 2, quantity: 1, order_date: "2023-04-02", status: "completed" },
    { order_id: 3, customer_id: 1, product_id: 3, quantity: 1, order_date: "2023-04-03", status: "pending" },
    { order_id: 4, customer_id: 3, product_id: 1, quantity: 5, order_date: "2023-04-04", status: "completed" },
  ];

  await insertFromJSON(executor, "raw_customers", customers);
  await insertFromJSON(executor, "raw_products", products);
  await insertFromJSON(executor, "raw_orders", orders);

  // Register only after seed data is ready
  registerExecutor(executor);
}

async function insertFromJSON(
  executor: SqlExecutor,
  table: string,
  rows: Record<string, unknown>[]
): Promise<void> {
  if (rows.length === 0) return;
  const columns = Object.keys(rows[0]);
  const cols = columns.join(", ");
  const values = rows
    .map((row) => `(${columns.map((col) => escapeSqlLiteral(row[col])).join(", ")})`)
    .join(", ");
  await executor.exec(`INSERT INTO ${table} (${cols}) VALUES ${values}`);
}

function escapeSqlLiteral(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  return `'${String(value).replace(/'/g, "''")}'`;
}

export async function closeDuckDB(): Promise<void> {
  if (conn) {
    await conn.close();
    conn = null;
  }
  if (db) {
    await db.terminate();
    db = null;
  }
}