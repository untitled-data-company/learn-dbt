export interface GraderInput {
  /** Rows produced by the student's query or model */
  actual: Record<string, unknown>[];
  /** Expected rows, in the same column order when order matters */
  expected: Record<string, unknown>[];
  /** Column names the result must contain (order ignored unless orderedColumns is set) */
  requiredColumns?: string[];
  /** Exact column names and order required */
  orderedColumns?: string[];
  /** Whether row order matters */
  orderMatters?: boolean;
  /** Column to use as a key for matching rows (allows out-of-order rows) */
  matchKey?: string;
}

export interface GradeResult {
  passed: boolean;
  message: string;
  details?: string;
}

export function gradeRows(input: GraderInput): GradeResult {
  const { actual, expected } = input;

  // Check column shape
  const actualCols = actual.length > 0 ? Object.keys(actual[0]) : [];

  if (input.orderedColumns) {
    const ordered = input.orderedColumns;
    if (JSON.stringify(actualCols) !== JSON.stringify(ordered)) {
      return {
        passed: false,
        message: `Expected columns ${ordered.join(", ")} in this order, but got ${actualCols.join(", ")}.`,
        details: `columnsMismatch`,
      };
    }
  }

  if (input.requiredColumns) {
    const missing = input.requiredColumns.filter((c) => !actualCols.includes(c));
    if (missing.length > 0) {
      return {
        passed: false,
        message: `Missing required column(s): ${missing.join(", ")}.`,
        details: `columnsMissing`,
      };
    }
  }

  if (actual.length !== expected.length) {
    return {
      passed: false,
      message: `Expected ${expected.length} row(s), but got ${actual.length}.`,
      details: `rowCountMismatch`,
    };
  }

  const compare = input.orderMatters
    ? compareOrderedRows
    : compareUnorderedRows.bind(null, input.matchKey);

  const mismatch = compare(actual, expected);
  if (mismatch) {
    return { passed: false, message: mismatch, details: `rowMismatch` };
  }

  return { passed: true, message: "Great job! Output matches the expected result." };
}

function compareOrderedRows(
  actual: Record<string, unknown>[],
  expected: Record<string, unknown>[]
): string | null {
  for (let i = 0; i < expected.length; i++) {
    const a = actual[i];
    const e = expected[i];
    const cols = Object.keys(e);
    for (const col of cols) {
      if (JSON.stringify(a[col]) !== JSON.stringify(e[col])) {
        return `Row ${i + 1}, column "${col}": expected ${JSON.stringify(
          e[col]
        )}, got ${JSON.stringify(a[col])}.`;
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
    const actualMap = new Map(actual.map((r) => [String(r[matchKey]), r]));
    for (const expectedRow of expected) {
      const key = String(expectedRow[matchKey]);
      const actualRow = actualMap.get(key);
      if (!actualRow) {
        return `Missing row with ${matchKey}=${key}.`;
      }
      const cols = Object.keys(expectedRow);
      for (const col of cols) {
        if (JSON.stringify(actualRow[col]) !== JSON.stringify(expectedRow[col])) {
          return `Row with ${matchKey}=${key}, column "${col}": expected ${JSON.stringify(
            expectedRow[col]
          )}, got ${JSON.stringify(actualRow[col])}.`;
        }
      }
    }
    return null;
  }

  // No key: compare as sorted JSON arrays
  const sortRows = (rows: Record<string, unknown>[]) =>
    rows
      .map((r) =>
        Object.keys(r)
          .sort()
          .map((k) => [k, r[k]])
      )
      .map((entries) => JSON.stringify(Object.fromEntries(entries)))
      .sort();

  const a = sortRows(actual);
  const e = sortRows(expected);
  for (let i = 0; i < e.length; i++) {
    if (a[i] !== e[i]) {
      return `At least one row does not match the expected output.`;
    }
  }
  return null;
}
