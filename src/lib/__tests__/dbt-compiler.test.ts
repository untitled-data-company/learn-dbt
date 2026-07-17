import { describe, it, expect } from "vitest";
import { compileAllModels, compileModel, ProjectManifest } from "@/lib/dbt-compiler";

describe("dbt compiler", () => {
  const manifest: ProjectManifest = {
    sources: {
      ecommerce: { name: "ecommerce", table: "raw_orders" },
    },
    models: {
      stg_orders: {
        name: "stg_orders",
        sql: `SELECT * FROM {{ source("ecommerce", "raw_orders") }}`,
      },
      customer_orders: {
        name: "customer_orders",
        sql: `SELECT customer_id, COUNT(*) AS total FROM {{ ref("stg_orders") }} GROUP BY customer_id`,
      },
    },
  };

  it("resolves source() to table name", () => {
    const compiled = compileModel("stg_orders", manifest);
    expect(compiled.compiledSql).toContain("FROM raw_orders");
    expect(compiled.compiledSql).not.toContain("{{");
  });

  it("resolves ref() to model result table", () => {
    const compiled = compileModel("customer_orders", manifest);
    expect(compiled.compiledSql).toContain("__dbt__stg_orders");
    expect(compiled.compiledSql).not.toContain("{{");
  });

  it("compiles all models", () => {
    const all = compileAllModels(manifest);
    expect(all).toHaveLength(2);
    expect(all.map((m) => m.name)).toEqual(["stg_orders", "customer_orders"]);
  });

  it("throws for missing ref", () => {
    const bad: ProjectManifest = {
      sources: {},
      models: {
        bad_model: { name: "bad_model", sql: `SELECT * FROM {{ ref("missing") }}` },
      },
    };
    expect(() => compileModel("bad_model", bad)).toThrow('Ref "missing" not found');
  });
});
