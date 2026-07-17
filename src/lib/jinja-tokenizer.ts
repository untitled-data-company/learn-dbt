/**
 * dbt-Jinja Monarch tokenizer for Monaco Editor.
 *
 * dbt SQL files contain Jinja `{{ }}` and `{% %}` blocks mixed with
 * standard SQL. Monaco's built-in `sql` language stops highlighting the
 * moment it hits `{{`, which makes dbt models look broken. This tokenizer
 * wraps the SQL grammar so Jinja constructs get their own tokens while
 * everything else is delegated to the standard SQL rules.
 *
 * Exported as a Monarch tokenizer definition object. Registered with
 * `monaco.languages.register({ id: "sql-jinja" }, <this>)`.
 *
 * The tokenizer is designed to be pure data — no runtime dependencies on
 * `monaco` itself. That makes it testable in Node without loading a
 * browser environment.
 */

export interface IMonarchToken {
  token: string;
  regex?: string | RegExp;
  next?: string;
  push?: string;
  goBack?: number;
  bracket?: string;
}

export interface IMonarchLanguage {
  defaultToken: string;
  tokenPostfix: string;
  ignoreCase: boolean;
  keywords: string[];
  operators: string[];
  symbols: string | RegExp;
  starts: IMonarchToken[];
  [key: string]: unknown;
}

/**
 * Jinja keywords that appear inside `{% ... %}` control blocks.
 */
export const JINJA_KEYWORDS = [
  "if", "elif", "else", "endif",
  "for", "endfor",
  "macro", "endmacro",
  "set", "do",
  "block", "endblock",
  "extends",
  "include",
  "import",
  "from",
  "as",
  "with",
  "without",
  "context",
  "filter",
  "endfilter",
  "raw",
  "endraw",
];

/**
 * Jinja builtin functions commonly seen in dbt models.
 * These are highlighted separately from the keywords to make `ref()`,
 * `source()`, `config()` etc. visually distinct.
 */
export const JINJA_BUILTINS = [
  "ref", "source", "config", "var", "log", "return",
  "is_defined", "env_var", "project", "run_query",
  "exceptions", "modules", "flags",
];

/**
 * Monarch tokenizer definition for the `sql-jinja` language.
 *
 * Strategy: two root-level rules at the top of `starts` intercept `{{` and
 * `{%`/`{#`, switching to dedicated Jinja sub-states. Everything else
 * falls through to the standard SQL rules copied from Monaco's built-in
 * SQL language (simplified but covering the common constructs).
 */
export const sqlJinjaTokenizer: IMonarchLanguage = {
  defaultToken: "",
  tokenPostfix: ".sql",
  ignoreCase: true,
  keywords: [
    // SQL keywords
    "SELECT", "FROM", "WHERE", "GROUP BY", "ORDER BY", "HAVING",
    "JOIN", "LEFT JOIN", "RIGHT JOIN", "INNER JOIN", "OUTER JOIN",
    "FULL JOIN", "CROSS JOIN", "ON", "USING",
    "AS", "AND", "OR", "NOT", "NULL", "IS", "IN", "BETWEEN", "LIKE",
    "CASE", "WHEN", "THEN", "ELSE", "END",
    "DISTINCT", "UNION", "ALL", "LIMIT", "OFFSET",
    "CREATE", "TABLE", "VIEW", "DROP", "ALTER", "INSERT", "UPDATE",
    "DELETE", "INTO", "VALUES", "WITH", "RECURSIVE",
    "PRIMARY", "KEY", "FOREIGN", "REFERENCES", "DEFAULT",
    "INTEGER", "TEXT", "VARCHAR", "REAL", "BOOLEAN", "DATE", "TIMESTAMP",
    "TRUE", "FALSE", "CAST", "COUNT", "SUM", "AVG", "MIN", "MAX",
    "COALESCE", "NULLIF", "CONCAT", "UPPER", "LOWER", "LENGTH",
  ],
  operators: [
    "=", ">", "<", "!", "<=", ">=", "<>", "+", "-", "*", "/", "%",
  ],
  symbols: /[=><!~&|+\-*/%]+/,
  starts: [
    // ── Jinja expression: {{ ... }} ──
    {
      token: "delimiter.jinja",
      regex: "{{",
      push: "jinja-expression",
    },
    // ── Jinja statement/control: {% ... %} ──
    {
      token: "delimiter.jinja",
      regex: "{%",
      push: "jinja-statement",
    },
    // ── Jinja comment: {# ... #} ──
    {
      token: "comment.jinja",
      regex: "{#",
      push: "jinja-comment",
    },
    // ── Standard SQL rules (fallthrough) ──
    {
      token: "whitespace",
      regex: /\s+/,
    },
    {
      token: "comment",
      regex: /--.*$/,
    },
    {
      token: "comment",
      regex: /\/\*/,
      push: "sql-comment",
    },
    {
      token: "string",
      regex: /'/,
      push: "sql-string-single",
    },
    {
      token: "string",
      regex: /"/,
      push: "sql-string-double",
    },
    {
      token: "number",
      regex: /\d+(\.\d+)?/,
    },
    {
      token: "keyword.sql",
      regex: /[A-Za-z_][A-Za-z0-9_]*/,
    },
    {
      token: "delimiter",
      regex: /[();,.]/,
    },
    {
      token: "operator.sql",
      regex: /@symbols/,
    },
  ],
  // ── Jinja expression sub-state ──
  "jinja-expression": [
    {
      token: "delimiter.jinja",
      regex: "}}",
      next: "@pop",
    },
    {
      token: "string.jinja",
      regex: /'[^']*'/,
    },
    {
      token: "string.jinja",
      regex: /"[^"]*"/,
    },
    {
      token: "number.jinja",
      regex: /\d+(\.\d+)?/,
    },
    {
      token: "keyword.builtin.jinja",
      regex: new RegExp(
        `\\b(${JINJA_BUILTINS.join("|")})\\b`,
      ),
    },
    {
      token: "identifier.jinja",
      regex: /[A-Za-z_][A-Za-z0-9_]*/,
    },
    {
      token: "delimiter.jinja",
      regex: /[(){}[\],.:]/,
    },
    {
      token: "operator.jinja",
      regex: /[=+\-*/%<>!|~]+/,
    },
    {
      token: "whitespace",
      regex: /\s+/,
    },
  ],
  // ── Jinja statement sub-state ──
  "jinja-statement": [
    {
      token: "delimiter.jinja",
      regex: "%}",
      next: "@pop",
    },
    {
      token: "keyword.control.jinja",
      regex: new RegExp(`\\b(${JINJA_KEYWORDS.join("|")})\\b`),
    },
    {
      token: "keyword.builtin.jinja",
      regex: new RegExp(
        `\\b(${JINJA_BUILTINS.join("|")})\\b`,
      ),
    },
    {
      token: "string.jinja",
      regex: /'[^']*'/,
    },
    {
      token: "string.jinja",
      regex: /"[^"]*"/,
    },
    {
      token: "number.jinja",
      regex: /\d+(\.\d+)?/,
    },
    {
      token: "identifier.jinja",
      regex: /[A-Za-z_][A-Za-z0-9_]*/,
    },
    {
      token: "delimiter.jinja",
      regex: /[(){}[\],.:]/,
    },
    {
      token: "operator.jinja",
      regex: /[=+\-*/%<>!|~]+/,
    },
    {
      token: "whitespace",
      regex: /\s+/,
    },
  ],
  // ── Jinja comment sub-state ──
  "jinja-comment": [
    {
      token: "comment.jinja",
      regex: "#}",
      next: "@pop",
    },
    {
      token: "comment.jinja",
      regex: /[^#]+/,
    },
    {
      token: "comment.jinja",
      regex: /#(?!\})/,
    },
  ],
  // ── SQL block comment ──
  "sql-comment": [
    {
      token: "comment",
      regex: /\*\//,
      next: "@pop",
    },
    {
      token: "comment",
      regex: /[^*]+/,
    },
    {
      token: "comment",
      regex: /\*(?!\*\/)/,
    },
  ],
  // ── SQL single-quoted string ──
  "sql-string-single": [
    {
      token: "string",
      regex: /'/,
      next: "@pop",
    },
    {
      token: "string.escape",
      regex: /\\./,
    },
    {
      token: "string",
      regex: /[^'\\]+/,
    },
  ],
  // ── SQL double-quoted string ──
  "sql-string-double": [
    {
      token: "string",
      regex: /"/,
      next: "@pop",
    },
    {
      token: "string.escape",
      regex: /\\./,
    },
    {
      token: "string",
      regex: /[^"\\]+/,
    },
  ],
};