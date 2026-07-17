/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { runSql } from "@/lib/runner";
import { gradeRows } from "@/lib/grader";
import { completeChapter, getChapterStatus, loadProgress } from "@/lib/progress";
import { setupTestExecutor } from "./setup";
import { getChapterById } from "@/lib/chapters";

/**
 * End-to-end exercise completion test for Chapter 0.
 *
 * Simulates the full user flow:
 * 1. User writes the correct SQL query
 * 2. Runs it via the runner
 * 3. The grader verifies the output
 * 4. On pass, the chapter is marked complete
 * 5. The next chapter becomes unlocked
 *
 * Also simulates a common mistake (wrong column or missing join) and
 * verifies the grader reports the correct failure reason, and the
 * chapter is NOT marked complete.
 */
describe("chapter 0 exercise flow (e2e)", () => {
  beforeAll(async () => {
    await setupTestExecutor();
  });

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  const chapter = getChapterById(0)!;
  const exercise = chapter.exercise!;

  it("completes successfully when the user writes the correct query", async () => {
    // The correct query: daily revenue by category
    const userSql = `
      SELECT
        p.category,
        o.order_date,
        SUM(o.quantity * p.price) AS total_revenue
      FROM raw_orders o
      JOIN raw_products p ON o.product_id = p.product_id
      GROUP BY 1, 2
      ORDER BY 2 DESC, 3 DESC
    `;

    // Step 1: run the SQL
    const result = await runSql(userSql);
    expect(result.error).toBeUndefined();
    expect(result.rows.length).toBeGreaterThan(0);

    // Step 2: grade the result
    const grade = gradeRows({
      actual: result.rows,
      expected: exercise.expectedRows!,
      matchKey: exercise.matchKey,
      requiredColumns: exercise.requiredColumns,
    });

    // Step 3: grader should pass
    expect(grade.passed).toBe(true);

    // Step 4: mark chapter complete (what the UI does on pass)
    let progress = loadProgress();
    progress = completeChapter(chapter.id, progress);

    // Step 5: chapter 0 is completed, chapter 1 is unlocked
    expect(getChapterStatus(0, progress)).toBe("completed");
    expect(getChapterStatus(1, progress)).toBe("unlocked");
  });

  it("fails with the correct reason when the user forgets the join", async () => {
    // Common mistake: CROSS JOIN instead of INNER JOIN produces wrong row counts
    const brokenSql = `
      SELECT
        p.category,
        o.order_date,
        SUM(o.quantity * p.price) AS total_revenue
      FROM raw_orders o
      CROSS JOIN raw_products p
      GROUP BY 1, 2
      ORDER BY 2 DESC, 3 DESC
    `;

    const result = await runSql(brokenSql);
    expect(result.error).toBeUndefined();

    const grade = gradeRows({
      actual: result.rows,
      expected: exercise.expectedRows!,
      matchKey: exercise.matchKey,
      requiredColumns: exercise.requiredColumns,
    });

    // Grader should fail
    expect(grade.passed).toBe(false);

    // The failure reason should be about row mismatch (wrong count from cross join)
    expect(grade.details).toBe("rowCountMismatch");
    expect(grade.message).toContain("row");

    // Chapter should NOT be marked complete
    const progress = loadProgress();
    // Simulate UI: only complete on pass — on fail, do nothing
    expect(getChapterStatus(0, progress)).not.toBe("completed");
    expect(getChapterStatus(1, progress)).toBe("locked");
  });

  it("fails with the correct reason when columns are missing", async () => {
    // Common mistake: alias the revenue column incorrectly
    const wrongColumnsSql = `
      SELECT
        p.category,
        o.order_date,
        SUM(o.quantity * p.price) AS revenue
      FROM raw_orders o
      JOIN raw_products p ON o.product_id = p.product_id
      GROUP BY 1, 2
      ORDER BY 2 DESC, 3 DESC
    `;

    const result = await runSql(wrongColumnsSql);
    expect(result.error).toBeUndefined();

    const grade = gradeRows({
      actual: result.rows,
      expected: exercise.expectedRows!,
      matchKey: exercise.matchKey,
      requiredColumns: exercise.requiredColumns,
    });

    // Grader should fail because 'total_revenue' column is missing
    expect(grade.passed).toBe(false);
    expect(grade.details).toBe("columnsMissing");
    expect(grade.message).toContain("total_revenue");
  });
});