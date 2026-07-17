/**
 * chapters.ts — Chapter metadata and exercise definitions.
 *
 * Each chapter has narrative content (story, concept, table list) and an
 * exercise definition (initial SQL, seed tables, progressive hints).  The
 * ChapterExerciseRunner component consumes the exercise; the chapter page
 * renders the narrative alongside it.
 *
 * This module is pure data — no DuckDB or dbt imports — so it can be
 * consumed by both server and client components.
 */

// ── Types ──

export interface ExerciseHint {
  /** Progressive hint text revealed one at a time by the Hint button. */
  text: string;
}

export interface ChapterExercise {
  /** Prompt shown above the editor describing what the learner must do. */
  prompt: string;
  /** Starter SQL pre-filled in the editor. */
  initialSql: string;
  /** Seed tables that must be loaded before the query runs. */
  seedTables: string[];
  /** Language for syntax highlighting in the editor. */
  language: "sql" | "sql-jinja" | "python" | "yaml";
  /** Progressive hints for users stuck on join or aggregation logic. */
  hints: ExerciseHint[];
}

export interface Chapter {
  /** Zero-based chapter number. */
  id: number;
  /** URL slug (e.g. "chapter-0"). */
  slug: string;
  /** Display title. */
  title: string;
  /** Short concept label shown under the title. */
  keyConcept: string;
  /** Narrative story text. */
  story: string;
  /** Concept explanation. */
  concept: string;
  /** Raw table names available in this chapter. */
  tables: string[];
  /** Exercise definition for the runner. */
  exercise: ChapterExercise;
}

// ── Chapter 0 — Luca's morning query ──

const CHAPTER_0: Chapter = {
  id: 0,
  slug: "chapter-0",
  title: "Luca's morning query",
  keyConcept: "Pure SQL exploration",
  story: `Luca opens the BI tool. The dashboard "Revenue by category" spins for 40 seconds.

While waiting, he runs his sanity-check SQL query against the raw tables — the same query he runs every morning, by hand, to make sure the numbers look right.

Today the query feels slower than yesterday. He wonders: is there a better way?`,
  concept: `No dbt here. Just the data and the SQL that Luca already knows.

You'll start where every analytics engineer starts: with raw tables and a question. The goal is a query that returns daily revenue by category — a foundation you'll rebuild with dbt in later chapters.`,
  tables: ["raw_orders", "raw_products", "raw_customers"],
  exercise: {
    prompt:
      "Write a query that returns daily revenue by category. The starter query is already in the editor — press Run SQL to execute it, then refine it.",
    language: "sql",
    seedTables: ["raw_orders", "raw_products", "raw_customers"],
    initialSql: `-- Luca's morning sanity check: daily revenue by category
SELECT
  p.category,
  o.order_date,
  SUM(o.quantity * p.price) AS total_revenue
FROM raw_orders o
JOIN raw_products p ON o.product_id = p.product_id
GROUP BY p.category, o.order_date
ORDER BY o.order_date DESC, total_revenue DESC;`,
    hints: [
      {
        text: `JOIN raw_orders with raw_products on product_id so you can multiply quantity by price.

  FROM raw_orders o
  JOIN raw_products p ON o.product_id = p.product_id`,
      },
      {
        text: `To get revenue per category per day, use GROUP BY and SUM:

  GROUP BY p.category, o.order_date
  SUM(o.quantity * p.price) AS total_revenue`,
      },
      {
        text: `Don't forget to ORDER BY so the most recent and highest-revenue rows appear first:

  ORDER BY o.order_date DESC, total_revenue DESC`,
      },
    ],
  },
};

// ── Registry ──

export const CHAPTERS: Chapter[] = [CHAPTER_0];

// ── Lookup helpers ──

export function getChapterById(id: number): Chapter | undefined {
  return CHAPTERS.find((ch) => ch.id === id);
}

export function getChapterBySlug(slug: string): Chapter | undefined {
  return CHAPTERS.find((ch) => ch.slug === slug);
}