/**
 * Static display metadata for the raw seed tables — column names/types and
 * a few sample rows, used by the "Tables" explorer cards on the chapter
 * story panel. Mirrors the seed data DuckDB is actually loaded with in
 * loadSeedData() (src/lib/duckdb.ts) so the cards show real values; keep
 * the two in sync if the seed data changes.
 */

export interface ColumnDef {
  name: string;
  type: string;
}

export interface TableMetadata {
  columns: ColumnDef[];
  sampleRows: Record<string, unknown>[];
}

export const TABLE_METADATA: Record<string, TableMetadata> = {
  raw_customers: {
    columns: [
      { name: "customer_id", type: "INTEGER" },
      { name: "first_name", type: "VARCHAR" },
      { name: "last_name", type: "VARCHAR" },
      { name: "email", type: "VARCHAR" },
      { name: "created_at", type: "DATE" },
    ],
    sampleRows: [
      { customer_id: 1, first_name: "Giulia", last_name: "Rossi", email: "giulia@example.com", created_at: "2023-01-15" },
      { customer_id: 2, first_name: "Luca", last_name: "Bianchi", email: "luca@example.com", created_at: "2023-02-20" },
      { customer_id: 3, first_name: "Marco", last_name: "Verdi", email: "marco@example.com", created_at: "2023-03-10" },
    ],
  },
  raw_products: {
    columns: [
      { name: "product_id", type: "INTEGER" },
      { name: "name", type: "VARCHAR" },
      { name: "price", type: "DECIMAL(10,2)" },
      { name: "category", type: "VARCHAR" },
    ],
    sampleRows: [
      { product_id: 1, name: "Widget A", price: 9.99, category: "gadgets" },
      { product_id: 2, name: "Widget B", price: 19.99, category: "gadgets" },
      { product_id: 3, name: "Thingamajig", price: 29.99, category: "widgets" },
    ],
  },
  raw_orders: {
    columns: [
      { name: "order_id", type: "INTEGER" },
      { name: "customer_id", type: "INTEGER" },
      { name: "product_id", type: "INTEGER" },
      { name: "quantity", type: "INTEGER" },
      { name: "order_date", type: "DATE" },
      { name: "status", type: "VARCHAR" },
    ],
    sampleRows: [
      { order_id: 1, customer_id: 1, product_id: 1, quantity: 2, order_date: "2023-04-01", status: "completed" },
      { order_id: 2, customer_id: 2, product_id: 2, quantity: 1, order_date: "2023-04-02", status: "completed" },
      { order_id: 3, customer_id: 1, product_id: 3, quantity: 1, order_date: "2023-04-03", status: "pending" },
      { order_id: 4, customer_id: 3, product_id: 1, quantity: 5, order_date: "2023-04-04", status: "completed" },
    ],
  },
};

export function getTableMetadata(tableName: string): TableMetadata | undefined {
  return TABLE_METADATA[tableName];
}
