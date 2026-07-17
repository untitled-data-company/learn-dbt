import { describe, it, expect, beforeAll } from "vitest";
import { runSql } from "@/lib/runner";
import { setupTestExecutor } from "./setup";

describe("SQL runner", () => {
  beforeAll(async () => {
    await setupTestExecutor();
  });

  it("executes a SELECT and returns rows", async () => {
    const result = await runSql("SELECT 1 AS x, 'hello' AS greeting");
    expect(result.error).toBeUndefined();
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].x).toBe(1);
    expect(result.rows[0].greeting).toBe("hello");
  });

  it("returns an error for invalid SQL", async () => {
    const result = await runSql("SELECT FROM nonexistent_table");
    expect(result.error).toBeTruthy();
    expect(result.rows).toHaveLength(0);
  });

  it("queries seed data from raw_orders", async () => {
    const result = await runSql("SELECT COUNT(*) AS cnt FROM raw_orders");
    expect(result.error).toBeUndefined();
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].cnt).toBe(4);
  });
});