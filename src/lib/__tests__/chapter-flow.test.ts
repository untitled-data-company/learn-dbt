import { describe, it, expect, beforeAll } from "vitest";
import { setupTestExecutor } from "./setup";
import { runSql } from "@/lib/runner";
import { gradeRows } from "@/lib/grader";
import { getChapterById } from "@/lib/chapters";
import { completeChapter, isChapterUnlocked, getChapterStatus } from "@/lib/progress";
import type { ProgressMap } from "@/lib/progress";

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
