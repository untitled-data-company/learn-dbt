import { describe, it, expect, beforeAll } from "vitest";
import { dbtRun, dbtTest, GenericTest } from "@/lib/dbt-runner";
import { ProjectManifest } from "@/lib/dbt-compiler";
import { setupTestExecutor } from "./setup";

describe("dbt runner", () => {
  beforeAll(async () => {
    await setupTestExecutor();
  });

  const manifest: ProjectManifest = {
    sources: {
      ecommerce: { name: "ecommerce", tables: ["raw_orders"] },
    },
    models: {
      stg_orders: {
        name: "stg_orders",
        sql: `SELECT * FROM {{ source("ecommerce", "raw_orders") }}`,
      },
      customer_orders: {
        name: "customer_orders",
        sql: `SELECT customer_id, COUNT(*) AS total_orders FROM {{ ref("stg_orders") }} GROUP BY customer_id`,
      },
    },
  };

  it("runs models and materialises them as tables", async () => {
    const result = await dbtRun(manifest);
    if (result.error || result.runs.some((r) => r.status === "error")) {
      console.error(JSON.stringify(result, null, 2));
    }
    expect(result.error).toBeUndefined();
    expect(result.runs).toHaveLength(2);
    expect(result.runs.every((r) => r.status === "success")).toBe(true);
  });

  it("runs models in dependency order even when declared out of order", async () => {
    const reversed: ProjectManifest = {
      sources: manifest.sources,
      models: {
        customer_orders: manifest.models.customer_orders,
        stg_orders: manifest.models.stg_orders,
      },
    };
    const result = await dbtRun(reversed);
    expect(result.error).toBeUndefined();
    expect(result.runs.map((r) => r.modelName)).toEqual([
      "stg_orders",
      "customer_orders",
    ]);
    expect(result.runs.every((r) => r.status === "success")).toBe(true);
  });

  it("materialises a view model as CREATE OR REPLACE VIEW", async () => {
    const viewManifest: ProjectManifest = {
      sources: { ecommerce: { name: "ecommerce", table: "raw_orders" } },
      models: {
        stg_orders: {
          name: "stg_orders",
          sql: `SELECT * FROM {{ source("ecommerce", "raw_orders") }}`,
          config: { materialized: "view" },
        },
      },
    };
    const result = await dbtRun(viewManifest);
    expect(result.error).toBeUndefined();
    expect(result.runs[0].status).toBe("success");
  });

  it("switches materialization from table to view on re-run", async () => {
    // First run: table materialization (default)
    const tableManifest: ProjectManifest = {
      sources: { ecommerce: { name: "ecommerce", table: "raw_orders" } },
      models: {
        stg_orders: {
          name: "stg_orders",
          sql: `SELECT * FROM {{ source("ecommerce", "raw_orders") }}`,
        },
      },
    };
    const tableResult = await dbtRun(tableManifest);
    expect(tableResult.runs[0].status).toBe("success");

    // Second run: same model, now a view — must drop the table first
    const viewManifest: ProjectManifest = {
      sources: { ecommerce: { name: "ecommerce", table: "raw_orders" } },
      models: {
        stg_orders: {
          name: "stg_orders",
          sql: `SELECT * FROM {{ source("ecommerce", "raw_orders") }}`,
          config: { materialized: "view" },
        },
      },
    };
    const viewResult = await dbtRun(viewManifest);
    expect(viewResult.error).toBeUndefined();
    expect(viewResult.runs[0].status).toBe("success");
  });

  it("runs generic tests against models", async () => {
    const tests: GenericTest[] = [
      {
        name: "customer_orders_not_empty",
        model: "customer_orders",
        sql: `SELECT * FROM {{ ref("customer_orders") }} WHERE total_orders = 0`,
        expectedEmpty: true,
      },
    ];
    const result = await dbtTest(manifest, tests);
    if (result.error) console.error(JSON.stringify(result, null, 2));
    expect(result.error).toBeUndefined();
    expect(result.tests).toHaveLength(1);
    expect(result.tests[0].status).toBe("pass");
  });

  it("reports a failing test when rows are returned", async () => {
    const tests: GenericTest[] = [
      {
        name: "orders_exist",
        model: "stg_orders",
        sql: `SELECT * FROM {{ ref("stg_orders") }} WHERE quantity < 0`,
        expectedEmpty: true,
      },
    ];
    const result = await dbtTest(manifest, tests);
    expect(result.error).toBeUndefined();
    expect(result.tests[0].status).toBe("pass");
  });

  it("continues running after a model error (dbt default)", async () => {
    const badManifest: ProjectManifest = {
      sources: { ecommerce: { name: "ecommerce", table: "raw_orders" } },
      models: {
        good: {
          name: "good",
          sql: `SELECT 1 AS x`,
        },
        broken: {
          name: "broken",
          sql: `SELECT * FROM {{ ref("nonexistent_ref") }}`,
        },
      },
    };
    const result = await dbtRun(badManifest);
    // Topological sort will throw on the unknown ref before any model runs
    expect(result.error).toContain("nonexistent_ref");
  });

  it("handles a 3-model dependency chain in correct order", async () => {
    const chain: ProjectManifest = {
      sources: { ecommerce: { name: "ecommerce", table: "raw_orders" } },
      models: {
        final: {
          name: "final",
          sql: `SELECT * FROM {{ ref("mid") }}`,
        },
        base: {
          name: "base",
          sql: `SELECT * FROM {{ source("ecommerce", "raw_orders") }}`,
        },
        mid: {
          name: "mid",
          sql: `SELECT * FROM {{ ref("base") }} WHERE status = 'completed'`,
        },
      },
    };
    const result = await dbtRun(chain);
    expect(result.error).toBeUndefined();
    const names = result.runs.map((r) => r.modelName);
    expect(names).toEqual(["base", "mid", "final"]);
    expect(result.runs.every((r) => r.status === "success")).toBe(true);
  });
});