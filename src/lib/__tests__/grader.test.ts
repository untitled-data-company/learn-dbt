import { describe, it, expect } from "vitest";
import { gradeRows, gradeDbtExercise, ColumnType } from "@/lib/grader";

describe("gradeRows — column shape", () => {
  it("passes for identical rows", () => {
    const result = gradeRows({
      actual: [{ id: 1, name: "A" }],
      expected: [{ id: 1, name: "A" }],
    });
    expect(result.passed).toBe(true);
    // columns + types + rowCount + rowMatch (no aggregates provided)
    expect(result.checks).toHaveLength(4);
  });

  it("fails on ordered column mismatch", () => {
    const result = gradeRows({
      actual: [{ name: "A", id: 1 }],
      expected: [{ id: 1, name: "A" }],
      orderedColumns: ["id", "name"],
    });
    expect(result.passed).toBe(false);
    expect(result.details).toBe("columns");
    expect(result.message).toContain("in this order");
  });

  it("fails on missing required column with hint", () => {
    const result = gradeRows({
      actual: [{ id: 1 }],
      expected: [{ id: 1, name: "A" }],
      requiredColumns: ["id", "name"],
    });
    expect(result.passed).toBe(false);
    expect(result.details).toBe("columns");
    expect(result.message).toContain("name");
    expect(result.message).toContain("forget");
  });
});

describe("gradeRows — row count", () => {
  it("fails on row count mismatch with extra-rows hint", () => {
    const result = gradeRows({
      actual: [{ id: 1 }, { id: 2 }],
      expected: [{ id: 1 }],
    });
    expect(result.passed).toBe(false);
    expect(result.details).toBe("rowCount");
    expect(result.message).toContain("extra row");
  });

  it("fails on row count mismatch with missing-rows hint", () => {
    const result = gradeRows({
      actual: [{ id: 1 }],
      expected: [{ id: 1 }, { id: 2 }],
    });
    expect(result.passed).toBe(false);
    expect(result.details).toBe("rowCount");
    expect(result.message).toContain("missing");
  });
});

describe("gradeRows — column types", () => {
  it("detects a number vs string type mismatch", () => {
    const result = gradeRows({
      actual: [{ id: "1", name: "A" }],
      expected: [{ id: 1, name: "A" }],
    });
    expect(result.passed).toBe(false);
    expect(result.details).toBe("types");
    expect(result.message).toContain("expected type number");
    expect(result.message).toContain("got string");
  });

  it("accepts bigint where number is expected (cross-engine)", () => {
    const result = gradeRows({
      actual: [{ id: BigInt(1), name: "A" }],
      expected: [{ id: 1, name: "A" }],
    });
    expect(result.passed).toBe(true);
  });

  it("accepts ISO string where date is expected", () => {
    const result = gradeRows({
      actual: [{ created_at: "2023-01-15" }],
      expected: [{ created_at: new Date("2023-01-15") }],
      expectedColumnTypes: { created_at: "date" as ColumnType },
    });
    expect(result.passed).toBe(true);
  });

  it("detects boolean vs number type mismatch with explicit override", () => {
    const result = gradeRows({
      actual: [{ value: true }],
      expected: [{ value: 1 }],
      expectedColumnTypes: { value: "number" as ColumnType },
    });
    expect(result.passed).toBe(false);
    expect(result.details).toBe("types");
    expect(result.message).toContain("expected type number");
  });

  it("skips type check for all-null expected column", () => {
    const result = gradeRows({
      actual: [{ id: 1, name: null }],
      expected: [{ id: 1, name: null }],
    });
    expect(result.passed).toBe(true);
  });
});

describe("gradeRows — cell-level match (ordered)", () => {
  it("passes when order matters and rows match", () => {
    const result = gradeRows({
      actual: [{ id: 1 }, { id: 2 }],
      expected: [{ id: 1 }, { id: 2 }],
      orderMatters: true,
    });
    expect(result.passed).toBe(true);
  });

  it("fails when order matters and rows differ", () => {
    const result = gradeRows({
      actual: [{ id: 2 }, { id: 1 }],
      expected: [{ id: 1 }, { id: 2 }],
      orderMatters: true,
    });
    expect(result.passed).toBe(false);
    expect(result.details).toBe("rowMatch");
    expect(result.message).toContain("Row 1");
  });
});

describe("gradeRows — cell-level match (unordered)", () => {
  it("passes unordered rows with matchKey", () => {
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

  it("fails unordered rows with clear row-level message", () => {
    const result = gradeRows({
      actual: [{ id: 1, name: "A" }],
      expected: [{ id: 1, name: "B" }],
      matchKey: "id",
    });
    expect(result.passed).toBe(false);
    expect(result.message).toContain('column "name"');
  });

  it("reports missing row by key when row counts match", () => {
    const result = gradeRows({
      actual: [
        { id: 1, name: "A" },
        { id: 3, name: "C" },
      ],
      expected: [
        { id: 1, name: "A" },
        { id: 2, name: "B" },
      ],
      matchKey: "id",
    });
    expect(result.passed).toBe(false);
    expect(result.message).toContain("Missing row with id=2");
  });

  it("passes unordered rows without matchKey (sorted JSON)", () => {
    const result = gradeRows({
      actual: [{ b: 2, a: 1 }],
      expected: [{ a: 1, b: 2 }],
    });
    expect(result.passed).toBe(true);
  });

  it("fails unordered rows without matchKey with first-diff message", () => {
    const result = gradeRows({
      actual: [{ a: 1, b: 3 }],
      expected: [{ a: 1, b: 2 }],
    });
    expect(result.passed).toBe(false);
    expect(result.message).toContain("First difference");
  });
});

describe("gradeRows — aggregates", () => {
  it("passes when sum matches (aggregate-only mode)", () => {
    const result = gradeRows({
      actual: [
        { amount: 10 },
        { amount: 20 },
        { amount: 30 },
      ],
      expected: [],
      aggregates: [{ function: "sum", column: "amount", expected: 60 }],
    });
    expect(result.passed).toBe(true);
  });

  it("fails when sum is wrong", () => {
    const result = gradeRows({
      actual: [
        { amount: 10 },
        { amount: 20 },
      ],
      expected: [],
      aggregates: [{ function: "sum", column: "amount", expected: 60 }],
    });
    expect(result.passed).toBe(false);
    expect(result.details).toBe("aggregates");
    expect(result.message).toContain("sum(amount)");
    expect(result.message).toContain("off by");
  });

  it("passes count(*) without a column", () => {
    const result = gradeRows({
      actual: [{ x: 1 }, { x: 2 }, { x: 3 }],
      expected: [],
      aggregates: [{ function: "count", expected: 3 }],
    });
    expect(result.passed).toBe(true);
  });

  it("passes count(column) skipping nulls", () => {
    const result = gradeRows({
      actual: [{ x: 1 }, { x: null }, { x: 3 }],
      expected: [],
      aggregates: [{ function: "count", column: "x", expected: 2 }],
    });
    expect(result.passed).toBe(true);
  });

  it("passes avg with tolerance", () => {
    const result = gradeRows({
      actual: [{ v: 1 }, { v: 2 }, { v: 3 }],
      expected: [],
      aggregates: [
        { function: "avg", column: "v", expected: 2.0, tolerance: 0.001 },
      ],
    });
    expect(result.passed).toBe(true);
  });

  it("fails avg outside tolerance", () => {
    const result = gradeRows({
      actual: [{ v: 1 }, { v: 2 }],
      expected: [],
      aggregates: [
        { function: "avg", column: "v", expected: 10, tolerance: 0.5 },
      ],
    });
    expect(result.passed).toBe(false);
    expect(result.details).toBe("aggregates");
  });

  it("handles min and max", () => {
    const result = gradeRows({
      actual: [{ v: 3 }, { v: 1 }, { v: 2 }],
      expected: [],
      aggregates: [
        { function: "min", column: "v", expected: 1 },
        { function: "max", column: "v", expected: 3 },
      ],
    });
    expect(result.passed).toBe(true);
  });

  it("errors on non-numeric values in sum", () => {
    const result = gradeRows({
      actual: [{ v: "hello" }],
      expected: [],
      aggregates: [{ function: "sum", column: "v", expected: 0 }],
    });
    expect(result.passed).toBe(false);
    expect(result.message).toContain("non-numeric");
  });
});

describe("gradeRows — short-circuit ordering", () => {
  it("stops at columns before checking rows", () => {
    const result = gradeRows({
      actual: [{ wrong_col: 1 }],
      expected: [{ id: 1, name: "A" }],
      requiredColumns: ["id", "name"],
    });
    expect(result.passed).toBe(false);
    expect(result.details).toBe("columns");
    expect(result.checks.filter((c) => c.name === "rowCount")).toHaveLength(0);
  });

  it("stops at row count before checking row match", () => {
    const result = gradeRows({
      actual: [{ id: 1 }],
      expected: [{ id: 1 }, { id: 2 }],
    });
    expect(result.passed).toBe(false);
    expect(result.details).toBe("rowCount");
    expect(result.checks.find((c) => c.name === "rowMatch")).toBeUndefined();
  });
});

describe("gradeRows — reusability", () => {
  it("works with an empty expected result set", () => {
    const result = gradeRows({
      actual: [],
      expected: [],
    });
    expect(result.passed).toBe(true);
  });

  it("fails when actual is empty but expected is not", () => {
    const result = gradeRows({
      actual: [],
      expected: [{ id: 1 }],
    });
    expect(result.passed).toBe(false);
    expect(result.details).toBe("rowCount");
  });
});

describe("gradeDbtExercise — dbt run success", () => {
  it("passes when dbt run succeeds", () => {
    const result = gradeDbtExercise({
      sourcesYaml: "version: 2\nsources:\n  - name: shop\n    tables:\n      - name: raw_orders\n      - name: raw_products\n      - name: raw_customers",
      modelSql: "SELECT * FROM {{ source('shop', 'raw_orders') }}",
      compiledSql: "SELECT * FROM raw_orders",
      dbtRunSuccess: true,
      expectedSourceName: "shop",
      expectedTables: ["raw_orders", "raw_products", "raw_customers"],
      expectedSourceRefs: ["raw_orders"],
      forbiddenLiteralTables: ["raw_orders"],
    });
    expect(result.passed).toBe(true);
  });

  it("fails when dbt run fails", () => {
    const result = gradeDbtExercise({
      sourcesYaml: "version: 2\nsources:\n  - name: shop\n    tables:\n      - name: raw_orders",
      modelSql: "SELECT * FROM {{ source('shop', 'raw_orders') }}",
      compiledSql: "",
      dbtRunSuccess: false,
      expectedSourceName: "shop",
      expectedTables: ["raw_orders"],
      expectedSourceRefs: ["raw_orders"],
      forbiddenLiteralTables: ["raw_orders"],
    });
    expect(result.passed).toBe(false);
    expect(result.details).toBe("dbtRunSuccess");
  });
});

describe("gradeDbtExercise — sources.yml structure", () => {
  const passBase = {
    modelSql: "SELECT * FROM {{ source('shop', 'raw_orders') }}",
    compiledSql: "SELECT * FROM raw_orders",
    dbtRunSuccess: true,
    expectedSourceName: "shop",
    expectedTables: ["raw_orders", "raw_products", "raw_customers"],
    expectedSourceRefs: ["raw_orders"],
    forbiddenLiteralTables: ["raw_orders"],
  };

  it("fails on missing version", () => {
    const result = gradeDbtExercise({
      ...passBase,
      sourcesYaml: "sources:\n  - name: shop\n    tables:\n      - name: raw_orders",
    });
    expect(result.passed).toBe(false);
    expect(result.details).toBe("sourcesYmlStructure");
    expect(result.message).toContain("version");
  });

  it("fails on missing sources section", () => {
    const result = gradeDbtExercise({
      ...passBase,
      sourcesYaml: "version: 2\nother: true",
    });
    expect(result.passed).toBe(false);
    expect(result.details).toBe("sourcesYmlStructure");
    expect(result.message).toContain("sources");
  });

  it("fails on wrong source name", () => {
    const result = gradeDbtExercise({
      ...passBase,
      sourcesYaml: "version: 2\nsources:\n  - name: wrong\n    tables:\n      - name: raw_orders",
    });
    expect(result.passed).toBe(false);
    expect(result.details).toBe("sourcesYmlStructure");
    expect(result.message).toContain("shop");
  });

  it("fails on missing tables", () => {
    const result = gradeDbtExercise({
      ...passBase,
      sourcesYaml: "version: 2\nsources:\n  - name: shop\n    tables:\n      - name: raw_orders",
    });
    expect(result.passed).toBe(false);
    expect(result.details).toBe("sourcesYmlStructure");
    expect(result.message).toContain("raw_products");
  });
});

describe("gradeDbtExercise — source() usage", () => {
  const passBase = {
    sourcesYaml: "version: 2\nsources:\n  - name: shop\n    tables:\n      - name: raw_orders\n      - name: raw_products",
    compiledSql: "SELECT * FROM raw_orders",
    dbtRunSuccess: true,
    expectedSourceName: "shop",
    expectedTables: ["raw_orders", "raw_products"],
    expectedSourceRefs: ["raw_orders"],
    forbiddenLiteralTables: ["raw_orders"],
  };

  it("fails when model does not use source() for expected table", () => {
    const result = gradeDbtExercise({
      ...passBase,
      modelSql: "SELECT * FROM raw_orders",
    });
    expect(result.passed).toBe(false);
    expect(result.details).toBe("sourceUsage");
    expect(result.message).toContain("source()");
  });

  it("passes when model uses source() correctly", () => {
    const result = gradeDbtExercise({
      ...passBase,
      modelSql: "SELECT * FROM {{ source('shop', 'raw_orders') }}",
    });
    expect(result.passed).toBe(true);
  });
});

describe("gradeDbtExercise — no hardcoded tables in compiled SQL", () => {
  it("fails when compiled SQL still has raw table name", () => {
    const result = gradeDbtExercise({
      sourcesYaml: "version: 2\nsources:\n  - name: shop\n    tables:\n      - name: raw_orders",
      modelSql: "SELECT * FROM {{ source('shop', 'raw_orders') }}",
      compiledSql: "SELECT * FROM raw_orders",
      dbtRunSuccess: true,
      expectedSourceName: "shop",
      expectedTables: ["raw_orders"],
      expectedSourceRefs: ["raw_orders"],
      forbiddenLiteralTables: ["raw_orders"],
    });
    expect(result.passed).toBe(false);
    expect(result.details).toBe("noHardcodedTables");
    expect(result.message).toContain("raw_orders");
  });

  it("passes when compiled SQL uses source-resolved name that differs from raw", () => {
    const result = gradeDbtExercise({
      sourcesYaml: "version: 2\nsources:\n  - name: shop\n    tables:\n      - name: orders_v2",
      modelSql: "SELECT * FROM {{ source('shop', 'orders_v2') }}",
      compiledSql: "SELECT * FROM orders_v2",
      dbtRunSuccess: true,
      expectedSourceName: "shop",
      expectedTables: ["orders_v2"],
      expectedSourceRefs: ["orders_v2"],
      forbiddenLiteralTables: ["raw_orders"],
    });
    expect(result.passed).toBe(true);
  });
});

describe("gradeDbtExercise — short-circuit ordering", () => {
  it("stops at dbtRunSuccess before checking YAML", () => {
    const result = gradeDbtExercise({
      sourcesYaml: "invalid",
      modelSql: "",
      compiledSql: "",
      dbtRunSuccess: false,
      expectedSourceName: "shop",
      expectedTables: ["raw_orders"],
      expectedSourceRefs: ["raw_orders"],
      forbiddenLiteralTables: ["raw_orders"],
    });
    expect(result.passed).toBe(false);
    expect(result.details).toBe("dbtRunSuccess");
    expect(result.checks).toHaveLength(1);
  });

  it("stops at YAML before checking source usage", () => {
    const result = gradeDbtExercise({
      sourcesYaml: "version: 2\nother: true",
      modelSql: "SELECT * FROM {{ source('shop', 'raw_orders') }}",
      compiledSql: "SELECT * FROM raw_orders",
      dbtRunSuccess: true,
      expectedSourceName: "shop",
      expectedTables: ["raw_orders"],
      expectedSourceRefs: ["raw_orders"],
      forbiddenLiteralTables: ["raw_orders"],
    });
    expect(result.passed).toBe(false);
    expect(result.details).toBe("sourcesYmlStructure");
    expect(result.checks).toHaveLength(2); // dbtRunSuccess + sourcesYmlStructure
  });
});