/**
 * Chapter metadata — the single source of truth for chapter ordering,
 * titles, story beats, key concepts, and exercise definitions.
 *
 * Derived from docs/chapters/*.md and README module table.
 * The first chapter is always unlocked; subsequent chapters unlock
 * only when the previous chapter is completed (sequential gating).
 */

import type { EditorLanguage } from "@/components/CodeEditor";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CharacterCard {
  name: string;
  role: string;
  description: string;
}

export interface ExerciseFile {
  /** Filename for the editor tab (e.g. "daily_revenue.sql") */
  fileName: string;
  /** Language for the Monaco editor */
  language: EditorLanguage;
  /** Initial content for the editor */
  initialSql: string;
}

export interface ChapterExercise {
  /** Prompt shown in the exercise panel */
  prompt: string;
  /** Files shown in the editor tabs. When present, overrides fileName/initialSql/language. */
  files?: ExerciseFile[];
  /** Initial content for the editor (legacy single-file mode) */
  initialSql?: string;
  /** Filename for the editor tab (legacy single-file mode) */
  fileName?: string;
  /** Language for the Monaco editor (legacy single-file mode) */
  language?: EditorLanguage;
  /** Expected rows for grading */
  expectedRows?: Record<string, unknown>[];
  /** Whether row order matters for grading */
  orderMatters?: boolean;
  /** Column to use as key for unordered comparison */
  matchKey?: string;
  /** Required column names */
  requiredColumns?: string[];
  /** Exact column order required */
  orderedColumns?: string[];
  /** Seed table names to display */
  seedTables?: string[];
  /** Minimum row count required (for queries that return arbitrary rows) */
  minRows?: number;
  /** When true, the exercise uses dbt run (compile + materialize) instead of raw SQL */
  useDbtRun?: boolean;
}

export interface ChapterMeta {
  id: number;
  slug: string;
  title: string;
  storyBeat: string;
  keyConcept: string;
  /** Story narrative shown in the left panel */
  story: string;
  /** Concept explanation shown in the left panel */
  concept: string;
  /** Character cards rendered in the story panel */
  characters: CharacterCard[];
  /** Tables available in this chapter */
  tables?: string[];
  /** AI prompt suggestion shown in the verification panel */
  aiPrompt?: string;
  /** Exercise definition */
  exercise?: ChapterExercise;
}

// ---------------------------------------------------------------------------
// Characters
// ---------------------------------------------------------------------------

const CHARACTERS = {
  luca: {
    name: "Luca",
    role: "Analyst, protagonist",
    description: "Makes mistakes, learns. You are helping him.",
  },
  manager: {
    name: "The Manager",
    role: "Sets the stakes",
    description: "Asks for reliability and speed. Not technical, but impatient.",
  },
  giulia: {
    name: "Giulia",
    role: "Data engineer",
    description:
      "Keeps the dbt project healthy. Teaches Luca the rules — and the reasons.",
  },
} satisfies Record<string, CharacterCard>;

// ---------------------------------------------------------------------------
// Chapter definitions
// ---------------------------------------------------------------------------

export const CHAPTERS: ChapterMeta[] = [
  {
    id: 0,
    slug: "chapter-0",
    title: "Luca's morning query",
    storyBeat: "Luca's morning query",
    keyConcept: "Pure SQL exploration",
    story:
      "Luca opens the BI tool. The dashboard *Revenue by category* spins for 40 seconds. While waiting, he runs his sanity-check SQL query against the raw tables.",
    concept:
      "No dbt here. Just the data and the SQL that Luca already knows.",
    characters: [CHARACTERS.luca],
    tables: ["raw_orders", "raw_products", "raw_customers"],
    aiPrompt:
      "I have a slow dashboard backed by a manual SQL query. How should I explain it to a data engineer so they understand what to materialize in dbt?",
    exercise: {
      prompt:
        "Write a query that returns daily revenue by category. Join raw_orders with raw_products, multiply quantity by price, group by category and order_date.",
      fileName: "query.sql",
      initialSql: `-- Write your query here
SELECT
  p.category,
  o.order_date,
  SUM(o.quantity * p.price) AS total_revenue
FROM raw_orders o
JOIN raw_products p ON o.product_id = p.product_id
GROUP BY 1, 2
ORDER BY 2 DESC, 3 DESC`,
      language: "sql",
      requiredColumns: ["category", "order_date", "total_revenue"],
      seedTables: ["raw_orders", "raw_products", "raw_customers"],
      expectedRows: [
        { category: "gadgets", order_date: "2023-04-04", total_revenue: 49.95 },
        { category: "widgets", order_date: "2023-04-03", total_revenue: 29.99 },
        { category: "gadgets", order_date: "2023-04-02", total_revenue: 19.99 },
        { category: "gadgets", order_date: "2023-04-01", total_revenue: 19.98 },
      ],
      orderMatters: true,
    },
  },
  {
    id: 1,
    slug: "chapter-1",
    title: 'The manager says "use dbt"',
    storyBeat: "Manager asks for dbt",
    keyConcept: "First dbt model",
    story:
      'In the weekly meeting the manager complains: the dashboard is slow and yesterday\'s data was stale because Luca forgot to refresh it. The company already has a dbt project. Luca must move his query there.',
    concept:
      "A dbt model is a `.sql` file inside `models/` that ends with a `select`. dbt materializes it as a view or table.",
    characters: [CHARACTERS.luca, CHARACTERS.manager],
    aiPrompt:
      "Turn this SQL query into a dbt model. Then tell me what is missing to make it production-ready.",
    exercise: {
      prompt:
        "Create a dbt model `daily_revenue` from the chapter 0 query. The model should select daily revenue by category.",
      fileName: "daily_revenue.sql",
      initialSql: `-- models/daily_revenue.sql
SELECT
  p.category,
  o.order_date,
  SUM(o.quantity * p.price) AS total_revenue
FROM {{ source('shop', 'raw_orders') }} o
JOIN {{ source('shop', 'raw_products') }} p ON o.product_id = p.product_id
GROUP BY 1, 2`,
      language: "sql-jinja",
      requiredColumns: ["category", "order_date", "total_revenue"],
      seedTables: ["raw_orders", "raw_products"],
    },
  },
  {
    id: 2,
    slug: "chapter-2",
    title: "Giulia rings the bell",
    storyBeat: "Giulia warns about dependencies",
    keyConcept: "`source()` and `sources.yml`",
    story:
      'Luca runs `dbt run` and it works. "Done!" he thinks. Giulia walks by and looks at his screen.\n\n> "Luca, stop. `raw_orders` is being renamed to `orders_v2` next week. And `raw_orders` is loaded by the ingestion tool, not by dbt. Never hardcode raw table names. Use `source()`."',
    concept:
      "`source()` gives a stable name to data that arrives from outside the dbt project. `sources.yml` declares those tables. If the underlying name changes, only `sources.yml` changes.",
    characters: [CHARACTERS.luca, CHARACTERS.giulia],
    tables: ["raw_orders", "raw_products", "raw_customers"],
    aiPrompt:
      "I'm writing a dbt model that reads tables loaded by Fivetran. Should I use `source()` or write the table name directly? Why?",
    exercise: {
      prompt:
        "Create a sources.yml declaring the raw tables under source 'shop', then update daily_revenue.sql to use source() instead of hardcoded table names. Click 'dbt run' to compile and materialize.",
      files: [
        {
          fileName: "models/sources.yml",
          language: "yaml",
          initialSql: `# models/sources.yml
version: 2

sources:
  - name: shop
    tables:
      - name: raw_orders
      - name: raw_products
      - name: raw_customers`,
        },
        {
          fileName: "models/daily_revenue.sql",
          language: "sql-jinja",
          initialSql: `-- models/daily_revenue.sql
SELECT
  p.category,
  o.order_date,
  SUM(o.quantity * p.price) AS total_revenue
FROM {{ source('shop', 'raw_orders') }} o
JOIN {{ source('shop', 'raw_products') }} p ON o.product_id = p.product_id
GROUP BY 1, 2`,
        },
      ],
      seedTables: ["raw_orders", "raw_products", "raw_customers"],
      useDbtRun: true,
    },
  },
  {
    id: 3,
    slug: "chapter-3",
    title: "Split logic into layers",
    storyBeat: "Split logic into layers",
    keyConcept: "`ref()` and the DAG",
    story: "Coming soon.",
    concept: "Coming soon.",
    characters: [CHARACTERS.luca, CHARACTERS.giulia],
  },
  {
    id: 4,
    slug: "chapter-4",
    title: "Dashboard still slow",
    storyBeat: "Dashboard still slow",
    keyConcept: "`view` vs `table`",
    story: "Coming soon.",
    concept: "Coming soon.",
    characters: [CHARACTERS.luca, CHARACTERS.manager],
  },
  {
    id: 5,
    slug: "chapter-5",
    title: "Numbers don't match",
    storyBeat: "Numbers don't match",
    keyConcept: "Tests",
    story: "Coming soon.",
    concept: "Coming soon.",
    characters: [CHARACTERS.luca, CHARACTERS.giulia],
  },
  {
    id: 6,
    slug: "chapter-6",
    title: "New teammate uses the model",
    storyBeat: "New teammate uses the model",
    keyConcept: "Documentation",
    story: "Coming soon.",
    concept: "Coming soon.",
    characters: [CHARACTERS.luca],
  },
  {
    id: 7,
    slug: "chapter-7",
    title: "Simulate the daily run",
    storyBeat: "Simulate the daily run",
    keyConcept: "Scheduling",
    story: "Coming soon.",
    concept: "Coming soon.",
    characters: [CHARACTERS.luca, CHARACTERS.manager],
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Total number of chapters */
export const TOTAL_CHAPTERS = CHAPTERS.length;

/** Get a chapter by its numeric id */
export function getChapterById(id: number): ChapterMeta | undefined {
  return CHAPTERS.find((c) => c.id === id);
}

/** Get a chapter by its slug */
export function getChapterBySlug(slug: string): ChapterMeta | undefined {
  return CHAPTERS.find((c) => c.slug === slug);
}

/** Get the next chapter in sequence, or null if this is the last */
export function getNextChapter(id: number): ChapterMeta | null {
  return CHAPTERS.find((c) => c.id === id + 1) ?? null;
}

/** Get the previous chapter in sequence, or null if this is the first */
export function getPrevChapter(id: number): ChapterMeta | null {
  return CHAPTERS.find((c) => c.id === id - 1) ?? null;
}
