import * as duckdb from "@duckdb/duckdb-wasm";
import { registerExecutor, SqlExecutor } from "./sql-executor";
import { Type, Table as ArrowTable } from "@apache-arrow/es2015-esm";

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

// ── Arrow type conversion helpers ──────────────────────────────────────

/**
 * Convert a Decimal Arrow value to a plain JS number.
 *
 * DuckDB-WASM returns Decimal values as objects with a `toNumber(scale)`
 * method (from the Arrow Decimal vector). We try several strategies in
 * order of preference, then fall back to a manual division.
 */
export function convertDecimal(v: unknown, scale: number): number {
  if (v === null || v === undefined) return v as unknown as number;

  // Strategy 1: Arrow Decimal value with toNumber(scale)
  if (typeof (v as Record<string, unknown>).toNumber === "function") {
    return (v as { toNumber: (s: number) => number }).toNumber(scale);
  }

  // Strategy 2: valueOf(scale) — some Arrow builds expose this
  if (typeof (v as Record<string, unknown>).valueOf === "function") {
    const n = (v as { valueOf: () => unknown }).valueOf();
    if (typeof n === "number") return n;
    if (typeof n === "bigint") return Number(n) / 10 ** scale;
  }

  // Strategy 3: bigint value directly
  if (typeof v === "bigint") return Number(v) / 10 ** scale;

  // Strategy 4: already a number
  if (typeof v === "number") return v;

  // Strategy 5: string representation
  const s = String(v);
  const parsed = parseFloat(s);
  if (!isNaN(parsed)) return parsed;

  return Number(v);
}

/**
 * Convert a single row's values from Arrow JSON representation to
 * plain JS values, guided by the Arrow schema.
 *
 * - DATE / TIMESTAMP epoch-ms numbers → Date objects
 * - DECIMAL objects → JS number (scale applied)
 * - Null values are left untouched
 * - Double-normalisation guard: only convert number → Date when
 *   `typeof v === "number" && !(v instanceof Date)`
 */
export function convertArrowRow(
  row: Record<string, unknown>,
  schema: { name: string; typeId: number; scale?: number }[],
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const col of schema) {
    const v = row[col.name];

    if (v === null || v === undefined) {
      result[col.name] = v;
      continue;
    }

    switch (col.typeId) {
      case Type.Date:
      case Type.Timestamp:
        // DuckDB-WASM serialises DATE/TIMESTAMP as epoch-ms numbers
        result[col.name] =
          typeof v === "number" && !(v instanceof Date)
            ? new Date(v)
            : v;
        break;

      case Type.Decimal:
        result[col.name] = convertDecimal(v, col.scale ?? 0);
        break;

      default:
        result[col.name] = v;
        break;
    }
  }

  return result;
}

/**
 * Build a lightweight column-type map from an Arrow Table schema.
 * Returns an array of { name, typeId, scale? } for every column.
 */
function buildColumnSchema(
  arrowTable: ArrowTable,
): { name: string; typeId: number; scale?: number }[] {
  return arrowTable.schema.fields.map((f) => ({
    name: f.name,
    typeId: f.type.typeId,
    scale: f.type.typeId === Type.Decimal ? (f.type as { scale: number }).scale : undefined,
  }));
}

// ── WasmExecutor ───────────────────────────────────────────────────────
class WasmExecutor implements SqlExecutor {
  async query<T = Record<string, unknown>>(sql: string): Promise<T[]> {
    const c = await getConnection();
    const arrowTable = await c.query(sql);
    const colSchema = buildColumnSchema(arrowTable);
    return arrowTable.toArray().map((row) => convertArrowRow(row.toJSON() as Record<string, unknown>, colSchema) as T);
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