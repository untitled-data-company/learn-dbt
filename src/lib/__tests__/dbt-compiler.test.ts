import { describe, it, expect } from "vitest";
import {
  compileAllModels,
  compileModel,
  createModelResultTableSql,
  dropModelRelationSql,
  getDependencies,
  getMaterialization,
  parseSourcesYaml,
  renameSourceTableInYaml,
  topologicalSort,
  ProjectManifest,
} from "@/lib/dbt-compiler";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

function makeManifest(): ProjectManifest {
  return {
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
        sql: `SELECT customer_id, COUNT(*) AS total FROM {{ ref("stg_orders") }} GROUP BY customer_id`,
      },
    },
  };
}

// ---------------------------------------------------------------------------
// source() and ref() resolution
// ---------------------------------------------------------------------------

describe("dbt compiler — source() and ref()", () => {
  const manifest = makeManifest();

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

  it("throws for missing ref with model name in error", () => {
    const bad: ProjectManifest = {
      sources: {},
      models: {
        bad_model: { name: "bad_model", sql: `SELECT * FROM {{ ref("missing") }}` },
      },
    };
    expect(() => compileModel("bad_model", bad)).toThrow(
      'Model "bad_model": ref "missing" not found'
    );
  });

  it("throws for missing source with model name in error", () => {
    const bad: ProjectManifest = {
      sources: {},
      models: {
        bad_model: {
          name: "bad_model",
          sql: `SELECT * FROM {{ source("ghost", "table") }}`,
        },
      },
    };
    expect(() => compileModel("bad_model", bad)).toThrow(
      'Model "bad_model": source "ghost" not found'
    );
  });

  it("passes through table name when source/table mismatch (plot twist support)", () => {
    const bad: ProjectManifest = {
      sources: { ecommerce: { name: "ecommerce", tables: ["raw_orders"] } },
      models: {
        m: {
          name: "m",
          sql: `SELECT * FROM {{ source("ecommerce", "wrong_table") }}`,
        },
      },
    };
    const result = compileModel("m", bad);
    expect(result.compiledSql).toContain("wrong_table");
  });

  it("throws for unknown model", () => {
    expect(() => compileModel("nonexistent", manifest)).toThrow(
      'Model "nonexistent" not found in manifest'
    );
  });

  it("strips single-line SQL comments", () => {
    const m: ProjectManifest = {
      sources: {},
      models: {
        commented: {
          name: "commented",
          sql: `SELECT 1 -- this is a comment\nFROM dual`,
        },
      },
    };
    const compiled = compileModel("commented", m);
    expect(compiled.compiledSql).not.toContain("this is a comment");
  });

  it("supports single-quoted source and ref args", () => {
    const m: ProjectManifest = {
      sources: { s: { name: "s", tables: ["t"] } },
      models: {
        a: { name: "a", sql: `SELECT * FROM {{ source('s', 't') }}` },
        b: { name: "b", sql: `SELECT * FROM {{ ref('a') }}` },
      },
    };
    expect(compileModel("a", m).compiledSql).toContain("FROM t");
    expect(compileModel("b", m).compiledSql).toContain("__dbt__a");
  });
});

// ---------------------------------------------------------------------------
// compileAllModels
// ---------------------------------------------------------------------------

describe("dbt compiler — compileAllModels", () => {
  const manifest = makeManifest();

  it("compiles all models", () => {
    const all = compileAllModels(manifest);
    expect(all).toHaveLength(2);
    expect(all.map((m) => m.name)).toEqual(["stg_orders", "customer_orders"]);
  });

  it("returns models in dependency order (topological)", () => {
    // Reverse the declaration order to prove topo sort works
    const reversed: ProjectManifest = {
      sources: manifest.sources,
      models: {
        customer_orders: manifest.models.customer_orders,
        stg_orders: manifest.models.stg_orders,
      },
    };
    const all = compileAllModels(reversed);
    const names = all.map((m) => m.name);
    // stg_orders must come before customer_orders
    expect(names.indexOf("stg_orders")).toBeLessThan(
      names.indexOf("customer_orders")
    );
  });
});

// ---------------------------------------------------------------------------
// Topological sort
// ---------------------------------------------------------------------------

describe("dbt compiler — topologicalSort", () => {
  it("sorts models so dependencies come first", () => {
    const manifest: ProjectManifest = {
      sources: {},
      models: {
        c: { name: "c", sql: `SELECT * FROM {{ ref("b") }}` },
        a: { name: "a", sql: `SELECT 1` },
        b: { name: "b", sql: `SELECT * FROM {{ ref("a") }}` },
      },
    };
    const sorted = topologicalSort(manifest);
    expect(sorted.indexOf("a")).toBeLessThan(sorted.indexOf("b"));
    expect(sorted.indexOf("b")).toBeLessThan(sorted.indexOf("c"));
  });

  it("preserves declaration order for independent models", () => {
    const manifest: ProjectManifest = {
      sources: {},
      models: {
        x: { name: "x", sql: `SELECT 1` },
        y: { name: "y", sql: `SELECT 2` },
      },
    };
    expect(topologicalSort(manifest)).toEqual(["x", "y"]);
  });

  it("detects circular dependencies", () => {
    const manifest: ProjectManifest = {
      sources: {},
      models: {
        a: { name: "a", sql: `SELECT * FROM {{ ref("b") }}` },
        b: { name: "b", sql: `SELECT * FROM {{ ref("a") }}` },
      },
    };
    expect(() => topologicalSort(manifest)).toThrow(/Circular dependency/);
  });

  it("throws on ref to unknown model", () => {
    const manifest: ProjectManifest = {
      sources: {},
      models: {
        a: { name: "a", sql: `SELECT * FROM {{ ref("ghost") }}` },
      },
    };
    expect(() => topologicalSort(manifest)).toThrow('unknown model "ghost"');
  });
});

// ---------------------------------------------------------------------------
// Dependency extraction
// ---------------------------------------------------------------------------

describe("dbt compiler — getDependencies", () => {
  it("extracts ref dependencies", () => {
    const manifest: ProjectManifest = {
      sources: {},
      models: {
        m: { name: "m", sql: `SELECT * FROM {{ ref("a") }} JOIN {{ ref("b") }}` },
      },
    };
    expect(getDependencies("m", manifest).sort()).toEqual(["a", "b"]);
  });

  it("returns empty array for model with no refs", () => {
    const manifest: ProjectManifest = {
      sources: {},
      models: { m: { name: "m", sql: `SELECT 1` } },
    };
    expect(getDependencies("m", manifest)).toEqual([]);
  });

  it("returns empty array for unknown model", () => {
    expect(getDependencies("ghost", makeManifest())).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Materialization
// ---------------------------------------------------------------------------

describe("dbt compiler — materialization", () => {
  it("defaults to table when no config", () => {
    expect(getMaterialization({ name: "m", sql: "SELECT 1" })).toBe("table");
  });

  it("reads materialized from config", () => {
    expect(
      getMaterialization({ name: "m", sql: "SELECT 1", config: { materialized: "view" } })
    ).toBe("view");
  });

  it("generates CREATE OR REPLACE TABLE for table materialization", () => {
    const manifest: ProjectManifest = {
      sources: {},
      models: { m: { name: "m", sql: "SELECT 1", config: { materialized: "table" } } },
    };
    expect(createModelResultTableSql("m", manifest)).toBe(
      "CREATE OR REPLACE TABLE __dbt__m AS"
    );
  });

  it("generates CREATE OR REPLACE VIEW for view materialization", () => {
    const manifest: ProjectManifest = {
      sources: {},
      models: { m: { name: "m", sql: "SELECT 1", config: { materialized: "view" } } },
    };
    expect(createModelResultTableSql("m", manifest)).toBe(
      "CREATE OR REPLACE VIEW __dbt__m AS"
    );
  });

  it("defaults to TABLE when model not in manifest", () => {
    const manifest: ProjectManifest = { sources: {}, models: {} };
    expect(createModelResultTableSql("unknown", manifest)).toBe(
      "CREATE OR REPLACE TABLE __dbt__unknown AS"
    );
  });

  it("dropModelRelationSql drops both view and table for the model", () => {
    expect(dropModelRelationSql("m")).toEqual([
      "DROP VIEW IF EXISTS __dbt__m",
      "DROP TABLE IF EXISTS __dbt__m",
    ]);
  });
});

// ---------------------------------------------------------------------------
// YAML parsing
// ---------------------------------------------------------------------------

describe("dbt compiler — parseSourcesYaml", () => {
  it("parses a standard sources.yml", () => {
    const yaml = `
version: 2
sources:
  - name: ecommerce
    tables:
      - name: raw_orders
  - name: crm
    tables:
      - name: raw_customers
`;
    const sources = parseSourcesYaml(yaml);
    expect(sources.ecommerce).toEqual({ name: "ecommerce", tables: ["raw_orders"] });
    expect(sources.crm).toEqual({ name: "crm", tables: ["raw_customers"] });
  });

  it("returns empty object for empty yaml", () => {
    expect(parseSourcesYaml("")).toEqual({});
  });

  it("returns empty object for yaml with no sources key", () => {
    expect(parseSourcesYaml("version: 2\n")).toEqual({});
  });

  it("skips sources without tables", () => {
    const yaml = `
sources:
  - name: empty_source
  - name: good
    tables:
      - name: t
`;
    const sources = parseSourcesYaml(yaml);
    expect(sources.empty_source).toBeUndefined();
    expect(sources.good).toEqual({ name: "good", tables: ["t"] });
  });
});

describe("dbt compiler — renameSourceTableInYaml", () => {
  const yaml = `version: 2
sources:
  - name: shop
    tables:
      - name: raw_orders
      - name: raw_products
      - name: raw_customers`;

  it("renames a table under the correct source", () => {
    const result = renameSourceTableInYaml(yaml, "shop", "raw_orders", "orders_v2");
    expect(result).toContain("name: orders_v2");
    expect(result).not.toContain("name: raw_orders");
    // Other tables should be unchanged
    expect(result).toContain("name: raw_products");
    expect(result).toContain("name: raw_customers");
  });

  it("throws when table not found under source", () => {
    expect(() =>
      renameSourceTableInYaml(yaml, "shop", "nonexistent", "new_name")
    ).toThrow("nonexistent");
  });

  it("throws when source not found", () => {
    expect(() =>
      renameSourceTableInYaml(yaml, "ghost", "raw_orders", "orders_v2")
    ).toThrow("raw_orders");
  });

  it("only renames the first matching table", () => {
    const multiYaml = `version: 2
sources:
  - name: shop
    tables:
      - name: raw_orders
      - name: raw_orders
      - name: raw_customers`;
    const result = renameSourceTableInYaml(multiYaml, "shop", "raw_orders", "orders_v2");
    // The regex uses replace() which only replaces the first match
    expect(result).toContain("name: orders_v2");
    expect(result).toContain("name: raw_orders"); // second occurrence remains
  });

  it("works with the chapter 2 sources.yml content", () => {
    const ch2Yaml = `# models/sources.yml
version: 2

sources:
  - name: shop
    tables:
      - name: raw_orders
      - name: raw_products
      - name: raw_customers`;
    const result = renameSourceTableInYaml(ch2Yaml, "shop", "raw_orders", "orders_v2");
    expect(result).toContain("name: orders_v2");
    expect(result).not.toContain("name: raw_orders");
    expect(result).toContain("name: raw_products");
    expect(result).toContain("name: raw_customers");
  });
});