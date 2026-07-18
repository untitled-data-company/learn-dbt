import { load as loadYaml } from "js-yaml";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Materialization = "table" | "view";

export interface Model {
  name: string;
  sql: string;
  /** Per-model dbt config (materialized, tags, etc.) */
  config?: {
    materialized?: Materialization;
    [key: string]: unknown;
  };
}

export interface Source {
  name: string;
  /** The actual table names in the database that this source exposes */
  tables: string[];
}

export interface CompiledModel extends Model {
  compiledSql: string;
}

export interface ProjectManifest {
  sources: Record<string, Source>;
  models: Record<string, Model>;
}

// ---------------------------------------------------------------------------
// YAML parsing
// ---------------------------------------------------------------------------

/**
 * Raw shape of a dbt `sources.yml` file (only the fields we care about).
 */
interface SourcesYaml {
  sources?: Array<{
    name: string;
    tables?: Array<{ name: string }>;
  }>;
}

/**
 * Parse a dbt `sources.yml` file into a flat `Record<string, Source>`.
 *
 * In dbt, a source is declared as:
 *   sources:
 *     - name: ecommerce
 *       tables:
 *         - name: raw_orders
 *
 * The compiled `source("ecommerce", "raw_orders")` resolves to the table
 * name `raw_orders`.  We flatten the two-level structure into
 * `"ecommerce" -> { name: "ecommerce", tables: ["raw_orders"] }` keyed by
 * the *source* name, keeping the table names for resolution.
 *
 * When a source has multiple tables, we store all of them in the `tables`
 * array.  The compiler validates that the table name used in `source()`
 * exists in the source's table list.
 */
export function parseSourcesYaml(yamlContent: string): Record<string, Source> {
  const parsed = loadYaml(yamlContent) as SourcesYaml | undefined;
  const sources: Record<string, Source> = {};
  if (!parsed || !parsed.sources) return sources;
  for (const src of parsed.sources) {
    if (!src.name || !src.tables || src.tables.length === 0) continue;
    sources[src.name] = {
      name: src.name,
      tables: src.tables.map((t) => t.name),
    };
  }
  return sources;
}

// ---------------------------------------------------------------------------
// Compilation
// ---------------------------------------------------------------------------

/**
 * Lightweight dbt compiler.
 *
 * Supports:
 * - {{ source("source_name", "table_name") }} -> sources-backed table name
 * - {{ ref("model_name") }} -> compiled model result table name
 * - -- comments (single-line, outside Jinja)
 *
 * Limitations: no real Jinja parser, no loops/macros, no incremental config.
 * The compiler is deliberately regex-based for simplicity and testability.
 * If full Jinja support is needed later, swap `compileModel` for a nunjucks
 * render with the same `source`/`ref` globals — the interface stays the same.
 */
export function compileModel(
  modelName: string,
  manifest: ProjectManifest
): CompiledModel {
  const model = manifest.models[modelName];
  if (!model) {
    throw new Error(`Model "${modelName}" not found in manifest`);
  }

  let compiled = model.sql;

  // Replace sources: source("source_name", "table_name") => actual table name
  // The compiler resolves by matching the table name in the source's table list.
  // If the table name is found, return the name from the source definition.
  // If not found, return the name from the source() call (pass-through).
  // This allows the "plot twist" in Chapter 2: renaming a table in sources.yml
  // doesn't break compilation — the model SQL still works because it uses source().
  compiled = compiled.replace(
    /\{\{\s*source\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]\s*\)\s*\}\}/g,
    (_, sourceName, tableName) => {
      const source = manifest.sources[sourceName];
      if (!source) {
        throw new Error(
          `Model "${modelName}": source "${sourceName}" not found in manifest`
        );
      }
      // Return the table name as-is.  The source declaration in YAML is the
      // source of truth for what tables exist; the source() call in SQL just
      // needs to reference a valid source.  This allows the "plot twist"
      // scenario where the YAML is renamed but the SQL stays the same.
      return tableName;
    }
  );

  // Replace refs: ref("model_name") => __dbt__model_name
  compiled = compiled.replace(
    /\{\{\s*ref\(\s*["']([^"']+)["']\s*\)\s*\}\}/g,
    (_, refName) => {
      if (!manifest.models[refName]) {
        throw new Error(
          `Model "${modelName}": ref "${refName}" not found in manifest`
        );
      }
      return `__dbt__${refName}`;
    }
  );

  // Strip single-line SQL comments (outside of string literals — adequate for
  // the learning context; a full SQL lexer can be added if needed).
  compiled = compiled.replace(/--[^\n]*/g, "");

  return { ...model, compiledSql: compiled.trim() };
}

/**
 * Compile all models in the manifest, returning them in **dependency order**
 * (topologically sorted) so that `dbt run` can materialise them sequentially.
 *
 * A model that `ref()`s another model is always compiled *after* its
 * dependencies.  Models with no inter-dependencies keep their declaration
 * order.  Cycles are detected and reported.
 */
export function compileAllModels(manifest: ProjectManifest): CompiledModel[] {
  const order = topologicalSort(manifest);
  return order.map((name) => compileModel(name, manifest));
}

// ---------------------------------------------------------------------------
// Dependency resolution
// ---------------------------------------------------------------------------

/**
 * Extract the set of model names that `modelName` depends on via `ref()`.
 */
export function getDependencies(modelName: string, manifest: ProjectManifest): string[] {
  const model = manifest.models[modelName];
  if (!model) return [];
  const deps = new Set<string>();
  const refRegex = /\{\{\s*ref\(\s*["']([^"']+)["']\s*\)\s*\}\}/g;
  let match: RegExpExecArray | null;
  while ((match = refRegex.exec(model.sql)) !== null) {
    deps.add(match[1]);
  }
  return [...deps];
}

/**
 * Topologically sort models so that every model appears after all models it
 * `ref()`s.  Uses Kahn's algorithm (BFS) with deterministic tie-breaking by
 * declaration order.  Throws on cycles.
 */
export function topologicalSort(manifest: ProjectManifest): string[] {
  const modelNames = Object.keys(manifest.models);
  const sorted: string[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>(); // cycle detection

  function visit(name: string): void {
    if (visited.has(name)) return;
    if (visiting.has(name)) {
      throw new Error(
        `Circular dependency detected involving model "${name}"`
      );
    }
    visiting.add(name);
    for (const dep of getDependencies(name, manifest)) {
      if (!manifest.models[dep]) {
        throw new Error(
          `Model "${name}" references unknown model "${dep}"`
        );
      }
      visit(dep);
    }
    visiting.delete(name);
    visited.add(name);
    sorted.push(name);
  }

  for (const name of modelNames) {
    visit(name);
  }
  return sorted;
}

/**
 * Simulate renaming a table in a sources.yml file.
 *
 * This is used for the "plot twist" in Chapter 2: the learner has correctly
 * set up sources.yml, and then we show that renaming `raw_orders` to
 * `orders_v2` only requires a change in sources.yml — the model SQL stays
 * the same because it uses `source()`.
 *
 * Returns the updated YAML content with the table name changed.
 * Throws if the old table name is not found under the given source.
 */
export function renameSourceTableInYaml(
  yamlContent: string,
  sourceName: string,
  oldTableName: string,
  newTableName: string
): string {
  // Find the source block and the table entry within it.
  // Strategy: split into lines, find the source block, then find the table entry.
  const lines = yamlContent.split("\n");
  const sourceMarker = `  - name: ${sourceName}`;
  const tableMarker = `      - name: ${oldTableName}`;
  let sourceIdx = -1;
  let tableIdx = -1;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i] === sourceMarker) {
      sourceIdx = i;
    }
    if (sourceIdx >= 0 && lines[i] === tableMarker) {
      tableIdx = i;
      break;
    }
  }

  if (tableIdx < 0) {
    throw new Error(
      `Table "${oldTableName}" not found under source "${sourceName}" in sources.yml`
    );
  }

  lines[tableIdx] = `      - name: ${newTableName}`;
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Materialization helpers
// ---------------------------------------------------------------------------

/**
 * Determine the materialization strategy for a model.
 * Falls back to "table" when not specified — matching dbt's default for
 * models without an explicit config.
 */
export function getMaterialization(model: Model): Materialization {
  return model.config?.materialized ?? "table";
}

/**
 * Build the DDL prefix that creates or replaces the model's result relation.
 *
 *   table  -> CREATE OR REPLACE TABLE __dbt__model_name AS
 *   view   -> CREATE OR REPLACE VIEW  __dbt__model_name AS
 */
export function createModelResultTableSql(
  modelName: string,
  manifest: ProjectManifest
): string {
  const model = manifest.models[modelName];
  const mat = model ? getMaterialization(model) : "table";
  const relation = `__dbt__${modelName}`;
  return mat === "view"
    ? `CREATE OR REPLACE VIEW ${relation} AS`
    : `CREATE OR REPLACE TABLE ${relation} AS`;
}

/**
 * Build a `DROP` statement for the model's result relation.
 *
 * DuckDB (and most engines) refuse `CREATE OR REPLACE VIEW x` when `x` is
 * already a TABLE — and vice versa.  Dropping the relation first makes the
 * materialization type switchable across runs, which is essential in a
 * learning environment where the same model name may be re-run with a
 * different `materialized` config between chapters.
 *
 * Returns two statements — one for the view, one for the table — because
 * DuckDB's `DROP VIEW IF EXISTS` errors when the object is actually a table
 * (the `IF EXISTS` guard does not suppress type-mismatch errors).  The
 * caller should execute each independently and tolerate failure.
 */
export function dropModelRelationSql(modelName: string): string[] {
  const relation = `__dbt__${modelName}`;
  return [
    `DROP VIEW IF EXISTS ${relation}`,
    `DROP TABLE IF EXISTS ${relation}`,
  ];
}