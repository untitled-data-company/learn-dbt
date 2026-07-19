import { describe, it, expect } from "vitest";
import { Type } from "apache-arrow";
import { classifyArrowFields, normalizeArrowRow } from "@/lib/duckdb";

/**
 * These target a regression where DuckDB-WASM query results, which flow
 * through Apache Arrow, were not converted to the plain JS values the
 * grader expects:
 *  - DATE/TIMESTAMP columns arrived as raw epoch-ms numbers instead of
 *    Date objects.
 *  - DECIMAL columns (e.g. SUM(quantity * price)) arrived as BigNum-like
 *    objects whose default JSON serialisation is the *unscaled* digit
 *    string (e.g. "4995" instead of 49.95).
 * A real DuckDB-WASM connection needs a Worker, unavailable in jsdom, so
 * these exercise the pure conversion functions with Arrow-shaped fixtures
 * instead.
 */

describe("classifyArrowFields", () => {
  it("identifies DATE and TIMESTAMP columns", () => {
    const fields = [
      { name: "order_date", type: { typeId: Type.Date } },
      { name: "created_at", type: { typeId: Type.Timestamp } },
      { name: "category", type: { typeId: Type.Utf8 } },
    ];
    const { dateColumns } = classifyArrowFields(fields as never);
    expect(dateColumns).toEqual(["order_date", "created_at"]);
  });

  it("identifies DECIMAL columns and captures their scale", () => {
    const fields = [
      { name: "total_revenue", type: { typeId: Type.Decimal, scale: 2 } },
      { name: "quantity", type: { typeId: Type.Int32 } },
    ];
    const { decimalColumns } = classifyArrowFields(fields as never);
    expect(decimalColumns.get("total_revenue")).toBe(2);
    expect(decimalColumns.has("quantity")).toBe(false);
  });
});

describe("normalizeArrowRow", () => {
  it("converts epoch-ms numbers in date columns to Date objects", () => {
    const row = { order_date: Date.UTC(2023, 3, 4), category: "gadgets" };
    const result = normalizeArrowRow(row, ["order_date"], new Map());
    expect(result.order_date).toBeInstanceOf(Date);
    expect((result.order_date as Date).toISOString().slice(0, 10)).toBe(
      "2023-04-04"
    );
  });

  it("leaves null date column values untouched", () => {
    const row = { order_date: null };
    const result = normalizeArrowRow(row, ["order_date"], new Map());
    expect(result.order_date).toBeNull();
  });

  it("converts BigNum decimal values to a scaled number via valueOf(scale)", () => {
    const bigNum = { valueOf: (scale?: number) => (scale === 2 ? 49.95 : NaN) };
    const row = { total_revenue: bigNum };
    const result = normalizeArrowRow(row, [], new Map([["total_revenue", 2]]));
    expect(result.total_revenue).toBe(49.95);
  });

  it("leaves null decimal values untouched", () => {
    const row = { total_revenue: null };
    const result = normalizeArrowRow(row, [], new Map([["total_revenue", 2]]));
    expect(result.total_revenue).toBeNull();
  });

  it("does not touch columns outside the given date/decimal sets", () => {
    const row = { category: "gadgets", quantity: 5 };
    const result = normalizeArrowRow(row, [], new Map());
    expect(result).toEqual({ category: "gadgets", quantity: 5 });
  });
});
