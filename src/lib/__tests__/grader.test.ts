import { describe, it, expect } from "vitest";
import { gradeRows } from "@/lib/grader";

describe("gradeRows", () => {
  it("passes for identical rows", () => {
    const result = gradeRows({
      actual: [{ id: 1, name: "A" }],
      expected: [{ id: 1, name: "A" }],
    });
    expect(result.passed).toBe(true);
  });

  it("fails on row count mismatch", () => {
    const result = gradeRows({
      actual: [{ id: 1 }],
      expected: [{ id: 1 }, { id: 2 }],
    });
    expect(result.passed).toBe(false);
    expect(result.details).toBe("rowCountMismatch");
  });

  it("fails on ordered column mismatch", () => {
    const result = gradeRows({
      actual: [{ name: "A", id: 1 }],
      expected: [{ id: 1, name: "A" }],
      orderedColumns: ["id", "name"],
    });
    expect(result.passed).toBe(false);
    expect(result.details).toBe("columnsMismatch");
  });

  it("passes unordered rows when key is provided", () => {
    const result = gradeRows({
      actual: [
        { id: 2, name: "B" },
        { id: 1, name: "A" },
      ],
      expected: [
        { id: 1, name: "A" },
        { id: 2, name: "B" },
      ],
      matchKey: "id",
    });
    expect(result.passed).toBe(true);
  });

  it("fails unordered rows with a clear row-level message", () => {
    const result = gradeRows({
      actual: [{ id: 1, name: "A" }],
      expected: [{ id: 1, name: "B" }],
      matchKey: "id",
    });
    expect(result.passed).toBe(false);
    expect(result.message).toContain('column "name"');
  });
});
