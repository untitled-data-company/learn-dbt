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
      ecommerce: { name: "ecommerce", table: "raw_orders" },
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
});