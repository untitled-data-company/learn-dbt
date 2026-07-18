import { describe, it, expect, beforeAll } from "vitest";
import { setupTestExecutor } from "./setup";
import { runSql } from "@/lib/runner";
import { gradeRows, gradeDbtExercise } from "@/lib/grader";
import { getChapterById } from "@/lib/chapters";
import { completeChapter, isChapterUnlocked, getChapterStatus } from "@/lib/progress";
import type { ProgressMap } from "@/lib/progress";
import {
  parseSourcesYaml,
  renameSourceTableInYaml,
  type ProjectManifest,
} from "@/lib/dbt-compiler";
import { dbtRun } from "@/lib/dbt-runner";

describe("chapter flow — chapter 0 SQL exercise", () => {
  beforeAll(async () => { await setupTestExecutor(); });
  it("chapter 0 has a SQL exercise with expected rows", () => {
    const ch = getChapterById(0);
    expect(ch!.exercise!.language).toBe("sql");
  });
  it("running the seed SQL produces rows with required columns", async () => {
    const ch = getChapterById(0);
    const result = await runSql(ch!.exercise!.initialSql!);
    expect(result.error).toBeUndefined();
    expect(result.rows.length).toBeGreaterThan(0);
    const cols = Object.keys(result.rows[0]);
    expect(cols).toContain("category");
    expect(cols).toContain("order_date");
    expect(cols).toContain("total_revenue");
  });
  it("grading the seed SQL passes column checks", async () => {
    const ch = getChapterById(0);
    const result = await runSql(ch!.exercise!.initialSql!);
    const grade = gradeRows({
      actual: result.rows,
      expected: ch!.exercise!.expectedRows ?? [],
      requiredColumns: ch!.exercise!.requiredColumns,
    });
    expect(grade.checks.find((c) => c.name === "columns")?.passed).toBe(true);
  });
});

describe("chapter flow — progress gating", () => {
  it("chapter 0 is unlocked with empty progress", () => {
    expect(isChapterUnlocked(0, {})).toBe(true);
  });
  it("chapter 1 is locked until chapter 0 is completed", () => {
    expect(isChapterUnlocked(1, {})).toBe(false);
    expect(isChapterUnlocked(1, completeChapter(0, {}))).toBe(true);
  });
  it("completing chapters sequentially unlocks the chain", () => {
    let p: ProgressMap = {};
    expect(getChapterStatus(0, p)).toBe("unlocked");
    expect(getChapterStatus(1, p)).toBe("locked");
    p = completeChapter(0, p);
    expect(getChapterStatus(0, p)).toBe("completed");
    expect(getChapterStatus(1, p)).toBe("unlocked");
    expect(getChapterStatus(2, p)).toBe("locked");
    p = completeChapter(1, p);
    expect(getChapterStatus(2, p)).toBe("unlocked");
  });
});

describe("chapter flow — YAML validation (chapter 2)", () => {
  it("chapter 2 exercise uses files array", () => {
    const ch = getChapterById(2);
    expect(ch!.exercise!.files).toBeDefined();
    expect(ch!.exercise!.files!.length).toBe(2);
  });
  it("valid sources.yml content has the required structure", () => {
    const yaml = getChapterById(2)!.exercise!.files![0].initialSql!;
    expect(/version:\s*2/.test(yaml)).toBe(true);
    expect(/sources:/.test(yaml)).toBe(true);
    expect(/name:\s*shop/.test(yaml)).toBe(true);
    expect(/raw_orders/.test(yaml)).toBe(true);
    expect(/raw_products/.test(yaml)).toBe(true);
    expect(/raw_customers/.test(yaml)).toBe(true);
  });
  it("daily_revenue.sql uses source() with shop", () => {
    const sql = getChapterById(2)!.exercise!.files![1].initialSql!;
    expect(sql).toContain("source('shop', 'raw_orders')");
    expect(sql).toContain("source('shop', 'raw_products')");
    expect(sql).not.toContain("raw_orders o");
  });
});

describe("chapter flow — chapter 2 dbt run + grading", () => {
  beforeAll(async () => { await setupTestExecutor(); });

  it("dbt run succeeds with chapter 2 sources.yml and daily_revenue.sql", async () => {
    const ch = getChapterById(2)!;
    const yamlContent = ch.exercise!.files![0].initialSql!;
    const sqlContent = ch.exercise!.files![1].initialSql!;

    const sources = parseSourcesYaml(yamlContent);
    const manifest: ProjectManifest = {
      sources,
      models: {
        daily_revenue: { name: "daily_revenue", sql: sqlContent },
      },
    };

    const results = await dbtRun(manifest);
    expect(results.error).toBeUndefined();
    expect(results.runs.every((r) => r.status === "success")).toBe(true);
  });

  it("gradeDbtExercise passes with chapter 2 initial content", async () => {
    const ch = getChapterById(2)!;
    const yamlContent = ch.exercise!.files![0].initialSql!;
    const sqlContent = ch.exercise!.files![1].initialSql!;

    const sources = parseSourcesYaml(yamlContent);
    const manifest: ProjectManifest = {
      sources,
      models: {
        daily_revenue: { name: "daily_revenue", sql: sqlContent },
      },
    };

    const results = await dbtRun(manifest);
    const allSuccess = results.runs.every((r) => r.status === "success");

    const grade = gradeDbtExercise({
      sourcesYaml: yamlContent,
      modelSql: sqlContent,
      dbtRunSuccess: allSuccess,
      expectedSourceName: "shop",
      expectedTables: ["raw_orders", "raw_products", "raw_customers"],
      expectedSourceRefs: ["raw_orders", "raw_products"],
    });

    expect(grade.passed).toBe(true);
    expect(grade.checks).toHaveLength(3);
    expect(grade.checks.every((c) => c.passed)).toBe(true);
  });

  it("gradeDbtExercise fails when source() is missing from SQL", async () => {
    const ch = getChapterById(2)!;
    const yamlContent = ch.exercise!.files![0].initialSql!;
    // SQL without source() — hardcoded table names
    const badSql = `SELECT * FROM raw_orders o
JOIN raw_products p ON o.product_id = p.product_id`;

    const sources = parseSourcesYaml(yamlContent);
    const manifest: ProjectManifest = {
      sources,
      models: {
        daily_revenue: { name: "daily_revenue", sql: badSql },
      },
    };

    const results = await dbtRun(manifest);
    const allSuccess = results.runs.every((r) => r.status === "success");

    const grade = gradeDbtExercise({
      sourcesYaml: yamlContent,
      modelSql: badSql,
      dbtRunSuccess: allSuccess,
      expectedSourceName: "shop",
      expectedTables: ["raw_orders", "raw_products", "raw_customers"],
      expectedSourceRefs: ["raw_orders", "raw_products"],
    });

    expect(grade.passed).toBe(false);
    expect(grade.details).toBe("sourceUsage");
  });
});

describe("chapter flow — chapter 2 plot twist (rename simulation)", () => {
  beforeAll(async () => { await setupTestExecutor(); });

  it("renameSourceTableInYaml changes raw_orders to orders_v2", () => {
    const ch = getChapterById(2)!;
    const yamlContent = ch.exercise!.files![0].initialSql!;
    const result = renameSourceTableInYaml(yamlContent, "shop", "raw_orders", "orders_v2");
    expect(result).toContain("name: orders_v2");
    expect(result).not.toContain("name: raw_orders");
    expect(result).toContain("name: raw_products");
    expect(result).toContain("name: raw_customers");
  });

  it("dbt run still succeeds after rename (only YAML changed)", async () => {
    const ch = getChapterById(2)!;
    const yamlContent = ch.exercise!.files![0].initialSql!;
    const sqlContent = ch.exercise!.files![1].initialSql!;

    // Simulate the rename: raw_orders → orders_v2 in YAML
    const newYaml = renameSourceTableInYaml(yamlContent, "shop", "raw_orders", "orders_v2");

    // The SQL stays the same — it still uses source('shop', 'raw_orders').
    // The compiler passes through the name from the source() call since
    // 'raw_orders' is no longer in the source's table list.
    // The key insight: only the YAML changes, the SQL structure is untouched.
    const sources = parseSourcesYaml(newYaml);
    const manifest: ProjectManifest = {
      sources,
      models: {
        daily_revenue: { name: "daily_revenue", sql: sqlContent },
      },
    };

    const results = await dbtRun(manifest);
    expect(results.error).toBeUndefined();
    expect(results.runs.every((r) => r.status === "success")).toBe(true);
  });

  it("compiled SQL still uses source() table name after rename (SQL unchanged)", async () => {
    const ch = getChapterById(2)!;
    const yamlContent = ch.exercise!.files![0].initialSql!;
    const sqlContent = ch.exercise!.files![1].initialSql!;

    const newYaml = renameSourceTableInYaml(yamlContent, "shop", "raw_orders", "orders_v2");
    const sources = parseSourcesYaml(newYaml);
    const manifest: ProjectManifest = {
      sources,
      models: {
        daily_revenue: { name: "daily_revenue", sql: sqlContent },
      },
    };

    const results = await dbtRun(manifest);
    const compiledSql = results.runs[0]?.compiledSql ?? "";

    // The model SQL still uses source('shop', 'raw_orders') — the compiler
    // passes through the table name from the source() call since 'raw_orders'
    // is no longer in the source's table list (it was renamed to 'orders_v2').
    // The educational point: the model SQL doesn't need to change.
    expect(compiledSql).toContain("raw_orders");
  });

  it("gradeDbtExercise passes after rename with updated expectations", async () => {
    const ch = getChapterById(2)!;
    const yamlContent = ch.exercise!.files![0].initialSql!;
    const sqlContent = ch.exercise!.files![1].initialSql!;

    const newYaml = renameSourceTableInYaml(yamlContent, "shop", "raw_orders", "orders_v2");
    const sources = parseSourcesYaml(newYaml);
    const manifest: ProjectManifest = {
      sources,
      models: {
        daily_revenue: { name: "daily_revenue", sql: sqlContent },
      },
    };

    const results = await dbtRun(manifest);
    const allSuccess = results.runs.every((r) => r.status === "success");

    // After rename, the expected tables under shop are orders_v2, raw_products, raw_customers.
    // The model SQL still uses source('shop', 'raw_orders') — the grader checks
    // that the SQL uses source() for the tables it references, and the YAML
    // correctly declares the renamed table.
    const grade = gradeDbtExercise({
      sourcesYaml: newYaml,
      modelSql: sqlContent,
      dbtRunSuccess: allSuccess,
      expectedSourceName: "shop",
      expectedTables: ["orders_v2", "raw_products", "raw_customers"],
      expectedSourceRefs: ["raw_orders", "raw_products"],
    });

    expect(grade.passed).toBe(true);
  });
});
