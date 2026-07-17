/**
 * Chapter metadata — the single source of truth for chapter ordering,
 * titles, story beats, key concepts, and exercise definitions.
 *
 * Derived from docs/chapters/*.md and README module table.
 * The first chapter is always unlocked; subsequent chapters unlock
 * only when the previous chapter is completed (sequential gating).
 */

export interface ChapterExercise {
  /** Prompt shown in the exercise panel */
  prompt: string;
  /** Initial SQL seed for the editor */
  initialSql: string;
  /** Language for the Monaco editor */
  language: "sql" | "yaml";
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
  /** Tables available in this chapter */
  tables?: string[];
  /** AI prompt suggestion */
  aiPrompt?: string;
  /** Exercise definition */
  exercise?: ChapterExercise;
}

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
    tables: ["raw_orders", "raw_products", "raw_customers"],
    aiPrompt:
      "I have a slow dashboard backed by a manual SQL query. How should I explain it to a data engineer so they understand what to materialize in dbt?",
    exercise: {
      prompt:
        "Write a query that returns daily revenue by category. Join raw_orders with raw_products, multiply quantity by price, group by category and order_date.",
      initialSql: `-- Write your query here\nSELECT\n  p.category,\n  o.order_date,\n  SUM(o.quantity * p.price) AS total_revenue\nFROM raw_orders o\nJOIN raw_products p ON o.product_id = p.product_id\nGROUP BY 1, 2\nORDER BY 2 DESC, 3 DESC`,
      language: "sql",
      requiredColumns: ["category", "order_date", "total_revenue"],
      seedTables: ["raw_orders", "raw_products", "raw_customers"],
      expectedRows: [
        {
          category: "gadgets",
          order_date: "2023-04-01T00:00:00.000Z",
          total_revenue: 19.98,
        },
        {
          category: "gadgets",
          order_date: "2023-04-02T00:00:00.000Z",
          total_revenue: 19.99,
        },
        {
          category: "widgets",
          order_date: "2023-04-03T00:00:00.000Z",
          total_revenue: 29.99,
        },
        {
          category: "gadgets",
          order_date: "2023-04-04T00:00:00.000Z",
          total_revenue: 49.95,
        },
      ],
    },
  },
  {
    id: 1,
    slug: "chapter-1",
    title: 'The manager says "use dbt"',
    storyBeat: "Manager asks for dbt",
    keyConcept: "First dbt model",
    story:
      "In the weekly meeting the manager complains: the dashboard is slow and yesterday's data was stale because Luca forgot to refresh it. The company already has a dbt project. Luca must move his query there.",
    concept:
      'A dbt model is a `.sql` file inside `models/` that ends with a `select`. dbt materializes it as a view or table.',
    aiPrompt:
      "Turn this SQL query into a dbt model. Then tell me what is missing to make it production-ready.",
    exercise: {
      prompt:
        "Create a dbt model `daily_revenue` from the chapter 0 query. The model should select daily revenue by category. (Placeholder — dbt runner integration coming in the next chapter.)",
      initialSql: `-- models/daily_revenue.sql\nSELECT\n  p.category,\n  o.order_date,\n  SUM(o.quantity * p.price) AS total_revenue\nFROM {{ source('shop', 'raw_orders') }} o\nJOIN {{ source('shop', 'raw_products') }} p ON o.product_id = p.product_id\nGROUP BY 1, 2`,
      language: "sql",
      requiredColumns: ["category", "order_date", "total_revenue"],
      seedTables: ["raw_orders", "raw_products"],
      expectedRows: [
        {
          category: "gadgets",
          order_date: "2023-04-01T00:00:00.000Z",
          total_revenue: 19.98,
        },
        {
          category: "gadgets",
          order_date: "2023-04-02T00:00:00.000Z",
          total_revenue: 19.99,
        },
        {
          category: "widgets",
          order_date: "2023-04-03T00:00:00.000Z",
          total_revenue: 29.99,
        },
        {
          category: "gadgets",
          order_date: "2023-04-04T00:00:00.000Z",
          total_revenue: 49.95,
        },
      ],
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
    tables: ["raw_orders", "raw_products", "raw_customers"],
    aiPrompt:
      "I'm writing a dbt model that reads tables loaded by Fivetran. Should I use `source()` or write the table name directly? Why?",
    exercise: {
      prompt:
        "Write the sources.yml that declares sources raw_orders, raw_products, raw_customers under source 'shop'. (YAML format — placeholder for dbt runner integration.)",
      initialSql: `# models/sources.yml\nversion: 2\nsources:\n  - name: shop\n    tables:\n      - name: raw_orders\n      - name: raw_products\n      - name: raw_customers`,
      language: "yaml",
      seedTables: ["raw_orders", "raw_products", "raw_customers"],
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
  },
  {
    id: 4,
    slug: "chapter-4",
    title: "Dashboard still slow",
    storyBeat: "Dashboard still slow",
    keyConcept: "`view` vs `table`",
    story: "Coming soon.",
    concept: "Coming soon.",
  },
  {
    id: 5,
    slug: "chapter-5",
    title: "Numbers don't match",
    storyBeat: "Numbers don't match",
    keyConcept: "Tests",
    story: "Coming soon.",
    concept: "Coming soon.",
  },
  {
    id: 6,
    slug: "chapter-6",
    title: "New teammate uses the model",
    storyBeat: "New teammate uses the model",
    keyConcept: "Documentation",
    story: "Coming soon.",
    concept: "Coming soon.",
  },
  {
    id: 7,
    slug: "chapter-7",
    title: "Simulate the daily run",
    storyBeat: "Simulate the daily run",
    keyConcept: "Scheduling",
    story: "Coming soon.",
    concept: "Coming soon.",
  },
];

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
  const next = CHAPTERS.find((c) => c.id === id + 1);
  return next ?? null;
}

/** Get the previous chapter in sequence, or null if this is the first */
export function getPrevChapter(id: number): ChapterMeta | null {
  const prev = CHAPTERS.find((c) => c.id === id - 1);
  return prev ?? null;
}