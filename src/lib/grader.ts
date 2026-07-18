/**
 * Grader — compares learner query/model output against expected results.
 *
 * Pure logic: takes rows in, returns pass/fail + a message.  No DuckDB or
 * dbt imports — the caller (ExerciseRunner, dbt-runner, or a test) is
 * responsible for producing the actual rows.
 *
 * Checks are run in order and the first failure short-circuits, because a
 * learner who has the wrong columns cannot benefit from a row-level diff
 * until the shape is fixed.  Each failure message includes a specific,
 * actionable hint so the learner knows what to change.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ColumnType =
  | "number"
  | "string"
  | "boolean"
  | "date"
  | "bigint"
  | "null";

export interface AggregateCheck {
  /** Aggregate function to apply to the actual result */
  function: "sum" | "count" | "avg" | "min" | "max";
  /**
   * Column the function is applied to.
   * Omit (or leave undefined) for COUNT(*) which counts all rows.
   */
  column?: string;
  /** Expected aggregate value */
  expected: number;
  /** Floating-point tolerance (default 0 — use for avg/sum of decimals) */
  tolerance?: number;
}

export interface GraderInput {
  /** Rows produced by the learner's query or model */
  actual: Record<string, unknown>[];
  /** Expected rows (supplied by the chapter, never hardcoded here) */
  expected: Record<string, unknown>[];
  /** Column names the result must contain (order ignored) */
  requiredColumns?: string[];
  /** Exact column names and order required */
  orderedColumns?: string[];
  /** Expected JS type per column; missing entries are inferred from `expected` */
  expectedColumnTypes?: Record<string, ColumnType>;
  /** Whether row order matters (default false — most SQL is unordered) */
  orderMatters?: boolean;
  /** Column to use as a key for matching rows out of order */
  matchKey?: string;
  /** Aggregate checks applied independently of row-by-row comparison */
  aggregates?: AggregateCheck[];
}

export interface CheckResult {
  name: string;
  passed: boolean;
  message?: string;
}

export interface GradeResult {
  passed: boolean;
  /** Human-readable summary — success greeting or the first failure message */
  message: string;
  /** Machine-readable failure code for UI routing (e.g. "columnsMismatch") */
  details?: string;
  /** Individual check results, in evaluation order */
  checks: CheckResult[];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Types for dbt exercise grading
// ---------------------------------------------------------------------------

export interface DbtGradeInput {
  /** The raw YAML content of sources.yml */
  sourcesYaml: string;
  /** The raw SQL content of the model */
  modelSql: string;
  /** The compiled SQL after source() resolution */
  compiledSql: string;
  /** Whether dbt run succeeded for all models */
  dbtRunSuccess: boolean;
  /** Expected source name */
  expectedSourceName: string;
  /** Expected table names under the source */
  expectedTables: string[];
  /** Table names that should be referenced via source() in the SQL */
  expectedSourceRefs: string[];
  /** Table names that should NOT appear literally in the compiled SQL */
  forbiddenLiteralTables: string[];
}

export function gradeDbtExercise(input: DbtGradeInput): GradeResult {
const checks: CheckResult[] = [];

// 1. dbt run success
const runCheck: CheckResult = {
  name: "dbtRunSuccess",
  passed: input.dbtRunSuccess,
  message: input.dbtRunSuccess
    ? "dbt run completed successfully."
    : "dbt run failed. Check the compilation errors above.",
};
checks.push(runCheck);
if (!runCheck.passed) {
  return fail(runCheck, checks);
}

// 2. sources.yml structure
const yamlCheck = checkSourcesYaml(input);
checks.push(yamlCheck);
if (!yamlCheck.passed) {
  return fail(yamlCheck, checks);
}

// 3. SQL uses source() for expected tables
const sourceUsageCheck = checkSourceUsage(input);
checks.push(sourceUsageCheck);
if (!sourceUsageCheck.passed) {
  return fail(sourceUsageCheck, checks);
}

// 4. Compiled SQL has no hardcoded raw table names (when provided)
if (input.forbiddenLiteralTables && input.forbiddenLiteralTables.length > 0) {
  const noHardcodeCheck = checkNoHardcodedTables(input);
  checks.push(noHardcodeCheck);
  if (!noHardcodeCheck.passed) {
    return fail(noHardcodeCheck, checks);
  }
}

return {
  passed: true,
  message:
    "Great job! sources.yml is correctly configured, the model uses source() for all raw tables, and the compiled SQL resolves through the source layer.",
  checks,
};
}

function checkSourcesYaml(input: DbtGradeInput): CheckResult {
  const yaml = input.sourcesYaml;

  if (!/version:\s*2/.test(yaml)) {
    return {
      name: "sourcesYmlStructure",
      passed: false,
      message:
        "Missing or incorrect 'version: 2' at the top of sources.yml.",
    };
  }

  if (!/sources:/.test(yaml)) {
    return {
      name: "sourcesYmlStructure",
      passed: false,
      message: "Missing 'sources:' section in sources.yml.",
    };
  }

  const sourceNameRegex = new RegExp(`name:\\s*${input.expectedSourceName}`);
  if (!sourceNameRegex.test(yaml)) {
    return {
      name: "sourcesYmlStructure",
      passed: false,
      message: `Missing source named '${input.expectedSourceName}'. Add '- name: ${input.expectedSourceName}' under sources.`,
    };
  }

  const tableNames = extractTableNamesFromYaml(yaml);
  const missing = input.expectedTables.filter(
    (t) => !tableNames.includes(t)
  );
  if (missing.length > 0) {
    return {
      name: "sourcesYmlStructure",
      passed: false,
      message: `Missing table(s) under source '${input.expectedSourceName}': ${missing.join(", ")}.`,
    };
  }

  return { name: "sourcesYmlStructure", passed: true };
}

function extractTableNamesFromYaml(yaml: string): string[] {
  const matches = yaml.match(/- \s*name:\s*(\w+)/g);
  if (!matches) return [];
  return matches
    .map((m) => m.match(/name:\s*(\w+)/)?.[1])
    .filter(Boolean) as string[];
}

function checkSourceUsage(input: DbtGradeInput): CheckResult {
  const sql = input.modelSql;
  const missing: string[] = [];

  for (const table of input.expectedSourceRefs) {
    const sourceRef = `source('${input.expectedSourceName}', '${table}')`;
    if (!sql.includes(sourceRef)) {
      missing.push(table);
    }
  }

  if (missing.length > 0) {
    const hint =
      missing.length === 1
        ? ` Replace the hardcoded table name with {{ source('${input.expectedSourceName}', '${missing[0]}') }}.`
        : ` Replace hardcoded table names with {{ source('${input.expectedSourceName}', '<table>') }}.`;
    return {
      name: "sourceUsage",
      passed: false,
      message: `Model does not use source() for: ${missing.join(", ")}.${hint}`,
    };
  }

  return { name: "sourceUsage", passed: true };
}

function checkNoHardcodedTables(input: DbtGradeInput): CheckResult {
  const compiled = input.compiledSql;
  const found: string[] = [];

  for (const table of input.forbiddenLiteralTables) {
    const regex = new RegExp(
      `\\b${escapeRegex(table)}\\b`,
      "i"
    );
    if (regex.test(compiled)) {
      found.push(table);
    }
  }

  if (found.length > 0) {
    return {
      name: "noHardcodedTables",
      passed: false,
      message: `Compiled SQL still references raw table name(s) directly: ${found.join(", ")}. All raw tables should be accessed through source().`,
    };
  }

  return { name: "noHardcodedTables", passed: true };
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function gradeRows(input: GraderInput): GradeResult {
  const checks: CheckResult[] = [];
  const { actual, expected } = input;

  // Determine whether row-level comparison applies.  A chapter that supplies
  // only aggregates (with empty expected rows) is using aggregate-only mode —
  // row count and cell match are skipped.
  const hasAggregates = !!input.aggregates && input.aggregates.length > 0;
  const rowMode = expected.length > 0 || !hasAggregates;

  // 1. Column shape
  const columnCheck = checkColumns(input);
  checks.push(columnCheck);
  if (!columnCheck.passed) {
    return fail(columnCheck, checks);
  }

  // 2. Column types
  const typeCheck = checkColumnTypes(input);
  checks.push(typeCheck);
  if (!typeCheck.passed) {
    return fail(typeCheck, checks);
  }

  // 3. Aggregates (run before row-level checks so aggregate-only mode works)
  if (hasAggregates) {
    const aggCheck = checkAggregates(input);
    checks.push(aggCheck);
    if (!aggCheck.passed) {
      return fail(aggCheck, checks);
    }
  }

  // 4–5. Row-level checks (skipped in aggregate-only mode)
  if (rowMode) {
    const countCheck = checkRowCount(actual, expected);
    checks.push(countCheck);
    if (!countCheck.passed) {
      return fail(countCheck, checks);
    }

    const matchCheck = checkRowMatch(input);
    checks.push(matchCheck);
    if (!matchCheck.passed) {
      return fail(matchCheck, checks);
    }
  }

  return {
    passed: true,
    message: "Great job! Your output matches the expected result.",
    checks,
  };
}

// ---------------------------------------------------------------------------
// Check 1 — Column shape
// ---------------------------------------------------------------------------

function checkColumns(input: GraderInput): CheckResult {
  const actualCols = input.actual.length > 0 ? Object.keys(input.actual[0]) : [];

  if (input.orderedColumns) {
    const ordered = input.orderedColumns;
    if (JSON.stringify(actualCols) !== JSON.stringify(ordered)) {
      return {
        name: "columns",
        passed: false,
        message:
          `Expected columns [${ordered.join(", ")}] in this order, ` +
          `but got [${actualCols.join(", ")}].`,
      };
    }
  }

  if (input.requiredColumns) {
    const missing = input.requiredColumns.filter((c) => !actualCols.includes(c));
    if (missing.length > 0) {
      const hint =
        missing.length === 1
          ? ` Did you forget to select "${missing[0]}"?`
          : ` Did you forget to select these columns?`;
      return {
        name: "columns",
        passed: false,
        message: `Missing required column(s): ${missing.join(", ")}.${hint}`,
      };
    }
  }

  return { name: "columns", passed: true };
}

// ---------------------------------------------------------------------------
// Check 2 — Column types
// ---------------------------------------------------------------------------

function checkColumnTypes(input: GraderInput): CheckResult {
  const { actual, expected } = input;
  if (actual.length === 0) return { name: "types", passed: true };

  const expectedCols = expected.length > 0 ? Object.keys(expected[0]) : [];
  if (expectedCols.length === 0) return { name: "types", passed: true };

  // Build expected type map: explicit overrides take precedence, then infer
  const typeMap: Record<string, ColumnType> = {};
  for (const col of expectedCols) {
    typeMap[col] =
      input.expectedColumnTypes?.[col] ?? inferColumnType(expected, col);
  }

  const actualCols = Object.keys(actual[0]);

  for (const col of Object.keys(typeMap)) {
    const expectedType = typeMap[col];
    if (expectedType === "null") continue; // can't check if all expected are null

    if (!actualCols.includes(col)) continue; // already caught by checkColumns

    for (let i = 0; i < actual.length; i++) {
      const value = actual[i][col];
      if (value === null || value === undefined) continue; // nulls are allowed

      const actualType = jsTypeOf(value);
      if (!typesCompatible(expectedType, actualType)) {
        const hint = typeHint(expectedType, col);
        return {
          name: "types",
          passed: false,
          message:
            `Row ${i + 1}, column "${col}": expected type ${expectedType}, ` +
            `but got ${actualType} (value: ${JSON.stringify(value)}).${hint}`,
        };
      }
    }
  }

  return { name: "types", passed: true };
}

// ---------------------------------------------------------------------------
// Check 3 — Row count
// ---------------------------------------------------------------------------

function checkRowCount(
  actual: Record<string, unknown>[],
  expected: Record<string, unknown>[]
): CheckResult {
  if (actual.length !== expected.length) {
    const diff = actual.length - expected.length;
    const hint =
      diff > 0
        ? ` You have ${diff} extra row(s) — check for a missing WHERE filter or an unintended CROSS JOIN.`
        : ` You are missing ${Math.abs(diff)} row(s) — check for an overly aggressive filter or a JOIN dropping rows.`;
    return {
      name: "rowCount",
      passed: false,
      message:
        `Expected ${expected.length} row(s), but got ${actual.length}.${hint}`,
    };
  }
  return { name: "rowCount", passed: true };
}

// ---------------------------------------------------------------------------
// Check 4 — Cell-level exact match
// ---------------------------------------------------------------------------

function checkRowMatch(input: GraderInput): CheckResult {
  const { actual, expected } = input;
  if (expected.length === 0) return { name: "rowMatch", passed: true };

  const compare = input.orderMatters
    ? compareOrderedRows
    : compareUnorderedRows.bind(null, input.matchKey);

  const mismatch = compare(actual, expected);
  if (mismatch) {
    return { name: "rowMatch", passed: false, message: mismatch };
  }
  return { name: "rowMatch", passed: true };
}

function compareOrderedRows(
  actual: Record<string, unknown>[],
  expected: Record<string, unknown>[]
): string | null {
  for (let i = 0; i < expected.length; i++) {
    const a = actual[i];
    const e = expected[i];
    for (const col of Object.keys(e)) {
      if (!deepEqual(a[col], e[col])) {
        return (
          `Row ${i + 1}, column "${col}": expected ${JSON.stringify(e[col])}, ` +
          `got ${JSON.stringify(a[col])}.`
        );
      }
    }
  }
  return null;
}

function compareUnorderedRows(
  matchKey: string | undefined,
  actual: Record<string, unknown>[],
  expected: Record<string, unknown>[]
): string | null {
  if (matchKey) {
    const actualMap = new Map(
      actual.map((r) => [String(r[matchKey]), r])
    );
    for (const expectedRow of expected) {
      const key = String(expectedRow[matchKey]);
      const actualRow = actualMap.get(key);
      if (!actualRow) {
        return `Missing row with ${matchKey}=${key}.`;
      }
      for (const col of Object.keys(expectedRow)) {
        if (!deepEqual(actualRow[col], expectedRow[col])) {
          return (
            `Row with ${matchKey}=${key}, column "${col}": ` +
            `expected ${JSON.stringify(expectedRow[col])}, ` +
            `got ${JSON.stringify(actualRow[col])}.`
          );
        }
      }
    }
    return null;
  }

  // No key: compare as sorted canonical-JSON arrays.
  // We use a custom serialiser so BigInt and Date values produce the same
  // string across the WASM and native DuckDB executors.
  const sortRows = (rows: Record<string, unknown>[]) =>
    rows
      .map((r) =>
        Object.keys(r)
          .sort()
          .map((k) => [k, canonicalValue(r[k])])
      )
      .map((entries) => JSON.stringify(Object.fromEntries(entries)))
      .sort();

  const a = sortRows(actual);
  const e = sortRows(expected);
  for (let i = 0; i < e.length; i++) {
    if (a[i] !== e[i]) {
      return `At least one row does not match the expected output. ` +
        `First difference at sorted position ${i + 1}: expected ${e[i]}, got ${a[i]}.`;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Check 5 — Aggregates
// ---------------------------------------------------------------------------

function checkAggregates(input: GraderInput): CheckResult {
  const { actual, aggregates } = input;
  if (!aggregates || aggregates.length === 0) {
    return { name: "aggregates", passed: true };
  }

  for (const agg of aggregates) {
    const result = computeAggregate(actual, agg);
    if (result.error) {
      return { name: "aggregates", passed: false, message: result.error };
    }
    const value = result.value as number;
    const tol = agg.tolerance ?? 0;
    const diff = Math.abs(value - agg.expected);
    if (diff > tol) {
      const fnLabel = agg.column
        ? `${agg.function}(${agg.column})`
        : `${agg.function}(*)`;
      return {
        name: "aggregates",
        passed: false,
        message:
          `Aggregate ${fnLabel}: expected ${agg.expected}, got ${value} ` +
          `(off by ${diff.toFixed(2)}).`,
      };
    }
  }

  return { name: "aggregates", passed: true };
}

function computeAggregate(
  rows: Record<string, unknown>[],
  agg: AggregateCheck
): { value: number; error?: never } | { value: null; error: string } {
  const { function: fn, column } = agg;

  if (fn === "count") {
    if (!column) return { value: rows.length };
    return {
      value: rows.filter((r) => r[column] !== null && r[column] !== undefined)
        .length,
    };
  }

  if (!column) {
    return { value: null, error: `${fn} requires a column name.` };
  }

  const values: number[] = [];
  for (const row of rows) {
    const v = row[column];
    if (v === null || v === undefined) continue;
    const n = Number(v);
    if (Number.isNaN(n)) {
      return {
        value: null,
        error: `${fn} of column "${column}": encountered non-numeric value ${JSON.stringify(v)}.`,
      };
    }
    values.push(n);
  }

  if (values.length === 0) {
    return { value: null, error: `${fn} of column "${column}": no non-null values to aggregate.` };
  }

  switch (fn) {
    case "sum":
      return { value: values.reduce((s, n) => s + n, 0) };
    case "avg":
      return { value: values.reduce((s, n) => s + n, 0) / values.length };
    case "min":
      return { value: Math.min(...values) };
    case "max":
      return { value: Math.max(...values) };
    default:
      return { value: null, error: `Unknown aggregate function: ${fn}` };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function inferColumnType(
  rows: Record<string, unknown>[],
  column: string
): ColumnType {
  for (const row of rows) {
    const v = row[column];
    if (v !== null && v !== undefined) {
      return jsTypeOf(v);
    }
  }
  return "null";
}

function jsTypeOf(value: unknown): ColumnType {
  if (value === null || value === undefined) return "null";
  if (typeof value === "number") return "number";
  if (typeof value === "string") return "string";
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "bigint") return "bigint";
  if (value instanceof Date) return "date";
  // DuckDB-WASM may return date-like strings; treat as string
  return "string";
}

function typesCompatible(expected: ColumnType, actual: ColumnType): boolean {
  if (expected === actual) return true;
  // number and bigint are interchangeable (native DuckDB returns BigInt,
  // WASM returns Number — both are valid)
  if (expected === "number" && actual === "bigint") return true;
  if (expected === "bigint" && actual === "number") return true;
  // dates may arrive as ISO strings from DuckDB serialization
  if (expected === "date" && actual === "string") return true;
  return false;
}

function typeHint(expectedType: ColumnType, column: string): string {
  switch (expectedType) {
    case "number":
      return ` Make sure "${column}" is a numeric expression, not wrapped in quotes.`;
    case "string":
      return ` Make sure "${column}" is a text value.`;
    case "boolean":
      return ` Make sure "${column}" is TRUE or FALSE.`;
    case "date":
      return ` Make sure "${column}" is a DATE or timestamp value.`;
    default:
      return "";
  }
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return a === b;
  // Coerce number/bigint for cross-engine compatibility
  if (typeof a === "number" && typeof b === "bigint") return a === Number(b);
  if (typeof a === "bigint" && typeof b === "number") return Number(a) === b;
  // Date vs ISO string
  if (a instanceof Date && typeof b === "string") return a.toISOString().slice(0, 10) === b;
  if (typeof a === "string" && b instanceof Date) return a === b.toISOString().slice(0, 10);
  return JSON.stringify(canonicalValue(a)) === JSON.stringify(canonicalValue(b));
}

/**
 * Normalise values for cross-engine comparison.
 * BigInt → number, Date → ISO date string.  Everything else passes through.
 */
function canonicalValue(value: unknown): unknown {
  if (typeof value === "bigint") return Number(value);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value;
}

function fail(check: CheckResult, checks: CheckResult[]): GradeResult {
  return {
    passed: false,
    message: check.message ?? "Check failed.",
    details: check.name,
    checks,
  };
}