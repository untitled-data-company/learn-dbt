import { describe, it, expect } from "vitest";
import { convertDecimal, convertArrowRow } from "@/lib/duckdb";
import { Type } from "@apache-arrow/es2015-esm";

describe("convertDecimal", () => {
  it("converts an Arrow Decimal with toNumber(scale)", () => {
    const decimalValue = { toNumber: (_s: number) => 9.99 };
    expect(convertDecimal(decimalValue, 2)).toBe(9.99);
  });

  it("converts an Arrow Decimal with valueOf returning a number", () => {
    const decimalValue = { valueOf: () => 19.99 };
    expect(convertDecimal(decimalValue, 2)).toBe(19.99);
  });

  it("converts an Arrow Decimal with valueOf returning a bigint", () => {
    const decimalValue = { valueOf: () => BigInt(2999) };
    expect(convertDecimal(decimalValue, 2)).toBe(29.99);
  });

  it("converts a raw bigint value", () => {
    expect(convertDecimal(BigInt(12345), 3)).toBe(12.345);
  });

  it("passes through an already-plain number", () => {
    expect(convertDecimal(42.5, 2)).toBe(42.5);
  });

  it("parses a string representation", () => {
    expect(convertDecimal("99.99", 2)).toBe(99.99);
  });

  it("returns null as-is", () => {
    expect(convertDecimal(null, 2)).toBeNull();
  });

  it("returns undefined as-is", () => {
    expect(convertDecimal(undefined, 2)).toBeUndefined();
  });
});

describe("convertArrowRow", () => {
  const schema = [
    { name: "id", typeId: Type.Int },
    { name: "name", typeId: Type.Utf8 },
    { name: "created_at", typeId: Type.Date },
    { name: "updated_at", typeId: Type.Timestamp },
    { name: "price", typeId: Type.Decimal, scale: 2 },
    { name: "nullable_date", typeId: Type.Date },
    { name: "nullable_decimal", typeId: Type.Decimal, scale: 2 },
  ];

  it("converts DATE epoch-ms to Date object", () => {
    const row = { id: 1, name: "test", created_at: 1673740800000, updated_at: null, price: null, nullable_date: null, nullable_decimal: null };
    const result = convertArrowRow(row, schema);
    expect(result.created_at).toBeInstanceOf(Date);
    expect((result.created_at as Date).toISOString()).toBe("2023-01-15T00:00:00.000Z");
  });

  it("converts TIMESTAMP epoch-ms to Date object", () => {
    const row = { id: 1, name: "test", created_at: null, updated_at: 1680307200000, price: null, nullable_date: null, nullable_decimal: null };
    const result = convertArrowRow(row, schema);
    expect(result.updated_at).toBeInstanceOf(Date);
    expect((result.updated_at as Date).toISOString()).toBe("2023-04-01T00:00:00.000Z");
  });

  it("converts DECIMAL to number", () => {
    const row = { id: 1, name: "test", created_at: null, updated_at: null, price: { toNumber: (_s: number) => 9.99 }, nullable_date: null, nullable_decimal: null };
    const result = convertArrowRow(row, schema);
    expect(result.price).toBe(9.99);
  });

  it("leaves null values untouched", () => {
    const row = { id: 1, name: "test", created_at: null, updated_at: null, price: null, nullable_date: null, nullable_decimal: null };
    const result = convertArrowRow(row, schema);
    expect(result.created_at).toBeNull();
    expect(result.price).toBeNull();
    expect(result.nullable_date).toBeNull();
    expect(result.nullable_decimal).toBeNull();
  });

  it("guards against double-normalisation (Date already a Date)", () => {
    const alreadyDate = new Date(1673740800000);
    const row = { id: 1, name: "test", created_at: alreadyDate, updated_at: null, price: null, nullable_date: null, nullable_decimal: null };
    const result = convertArrowRow(row, schema);
    expect(result.created_at).toBe(alreadyDate);
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it("does not mutate the original row object", () => {
    const row = { id: 1, name: "test", created_at: 1673740800000, updated_at: null, price: { toNumber: (_s: number) => 9.99 }, nullable_date: null, nullable_decimal: null };
    const result = convertArrowRow(row, schema);
    expect(result).not.toBe(row);
    expect(row.created_at).toBe(1673740800000); // original unchanged
    expect(row.price).toEqual({ toNumber: expect.any(Function) }); // original unchanged
  });

  it("passes through non-DATE/TIMESTAMP/DECIMAL columns unchanged", () => {
    const row = { id: 42, name: "hello", created_at: null, updated_at: null, price: null, nullable_date: null, nullable_decimal: null };
    const result = convertArrowRow(row, schema);
    expect(result.id).toBe(42);
    expect(result.name).toBe("hello");
  });
});
