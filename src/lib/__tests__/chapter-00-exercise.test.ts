import { describe, it, expect, beforeAll } from "vitest";
import { runSql } from "@/lib/runner";
import { setupTestExecutor } from "./setup";
import {
  CHAPTERS,
  getChapterBySlug,
  getChapterById,
  ChapterExercise,
} from "@/lib/chapters";

describe("chapters metadata", () => {
  it("has at least chapter 0 defined", () => {
    expect(CHAPTERS.length).toBeGreaterThanOrEqual(1);
  });

  it("chapter 0 is Luca's morning query", () => {
    const ch0 = getChapterById(0);
    expect(ch0).toBeDefined();
    expect(ch0!.title).toBe("Luca's morning query");
    expect(ch0!.keyConcept).toBe("Pure SQL exploration");
  });

  it("getChapterBySlug returns chapter 0", () => {
    const ch = getChapterBySlug("chapter-0");
    expect(ch).toBeDefined();
    expect(ch!.id).toBe(0);
  });

  it("getChapterBySlug returns undefined for unknown slug", () => {
    expect(getChapterBySlug("nonexistent")).toBeUndefined();
  });

  it("chapter 0 exercise has a starter SQL joining the three raw tables", () => {
    const exercise = getChapterById(0)!.exercise;
    expect(exercise.language).toBe("sql");
    // Starter query must reference all three seed tables
    expect(exercise.initialSql).toContain("raw_orders");
    expect(exercise.initialSql).toContain("raw_products");
    // raw_customers is available even if the starter query doesn't join it
    expect(exercise.seedTables).toContain("raw_customers");
  });

  it("chapter 0 has progressive hints for join and aggregation", () => {
    const exercise = getChapterById(0)!.exercise;
    expect(exercise.hints.length).toBeGreaterThanOrEqual(2);
    // First hint should mention JOIN
    expect(exercise.hints[0].text.toLowerCase()).toContain("join");
    // A later hint should mention GROUP BY or SUM (aggregation)
    const aggregationHint = exercise.hints.some((h) =>
      /group by|sum|aggregat/i.test(h.text)
    );
    expect(aggregationHint).toBe(true);
  });
});

describe("chapter 0 seed data and query execution", () => {
  beforeAll(async () => {
    await setupTestExecutor();
  });

  it("seed tables exist and have data", async () => {
    const ordersCount = await runSql("SELECT COUNT(*) AS cnt FROM raw_orders");
    expect(ordersCount.error).toBeUndefined();
    expect(ordersCount.rows[0].cnt).toBe(4);

    const productsCount = await runSql(
      "SELECT COUNT(*) AS cnt FROM raw_products"
    );
    expect(productsCount.rows[0].cnt).toBe(3);

    const customersCount = await runSql(
      "SELECT COUNT(*) AS cnt FROM raw_customers"
    );
    expect(customersCount.rows[0].cnt).toBe(3);
  });

  it("the starter query executes and returns category, order_date, total_revenue", async () => {
    const exercise: ChapterExercise = getChapterById(0)!.exercise;
    const result = await runSql(exercise.initialSql);
    expect(result.error).toBeUndefined();
    expect(result.rows.length).toBeGreaterThan(0);

    const columns = result.columnNames;
    expect(columns).toContain("category");
    expect(columns).toContain("order_date");
    expect(columns).toContain("total_revenue");
  });

  it("the starter query produces correct revenue for a known order", async () => {
    // Order 1: customer 1, product 1 (Widget A, $9.99), quantity 2 → 19.98
    // Order 2: customer 2, product 2 (Widget B, $19.99), quantity 1 → 19.99
    // Order 3: customer 1, product 3 (Thingamajig, $29.99), quantity 1 → 29.99
    // Order 4: customer 3, product 1 (Widget A, $9.99), quantity 5 → 49.95
    const exercise: ChapterExercise = getChapterById(0)!.exercise;
    const result = await runSql(exercise.initialSql);
    expect(result.error).toBeUndefined();

    // Find the row for gadgets on 2023-04-01 (order 1 only)
    // order_date may arrive as a Date object (native DuckDB) or an ISO string
    // (DuckDB-WASM), so normalise before comparing.
    const normaliseDate = (v: unknown): string =>
      v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10);

    const row = result.rows.find(
      (r) =>
        r.category === "gadgets" &&
        normaliseDate(r.order_date) === "2023-04-01"
    );
    expect(row).toBeDefined();
    expect(Number(row!.total_revenue)).toBeCloseTo(19.98, 2);
  });
});