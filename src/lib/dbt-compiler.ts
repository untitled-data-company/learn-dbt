export interface Model {
  name: string;
  sql: string;
  config?: Record<string, unknown>;
}

export interface Source {
  name: string;
  table: string;
}

export interface CompiledModel extends Model {
  compiledSql: string;
}

export interface ProjectManifest {
  sources: Record<string, Source>;
  models: Record<string, Model>;
}

/**
 * Lightweight dbt compiler.
 *
 * Supports:
 * - {{ source("source_name", "table_name") }} -> sources.yml-backed table name
 * - {{ ref("model_name") }} -> compiled model result table name
 * - -- comments (single-line, outside Jinja)
 *
 * Limitations: no real Jinja parser, no loops/macros, no incremental config.
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
  compiled = compiled.replace(
    /\{\{\s*source\(\s*["']([^"']+)["']\s*,\s*["']([^"']+)["']\s*\)\s*\}\}/g,
    (_, sourceName, tableName) => {
      const source = manifest.sources[sourceName];
      if (!source) {
        throw new Error(`Source "${sourceName}" not found in manifest`);
      }
      if (source.table !== tableName) {
        throw new Error(
          `Source "${sourceName}" does not expose table "${tableName}"`
        );
      }
      return source.table;
    }
  );

  // Replace refs: ref("model_name") => __dbt__model_name
  compiled = compiled.replace(
    /\{\{\s*ref\(\s*["']([^"']+)["']\s*\)\s*\}\}/g,
    (_, refName) => {
      if (!manifest.models[refName]) {
        throw new Error(`Ref "${refName}" not found in manifest`);
      }
      return `__dbt__${refName}`;
    }
  );

  // Strip single-line SQL comments
  compiled = compiled.replace(/--[^\n]*/g, "");

  return { ...model, compiledSql: compiled.trim() };
}

export function compileAllModels(manifest: ProjectManifest): CompiledModel[] {
  const compiled: CompiledModel[] = [];
  for (const name of Object.keys(manifest.models)) {
    compiled.push(compileModel(name, manifest));
  }
  return compiled;
}

export function createModelResultTableSql(modelName: string): string {
  return `CREATE OR REPLACE TABLE __dbt__${modelName} AS`;
}
