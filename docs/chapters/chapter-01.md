# Chapter 1 — The manager says "use dbt"

## Story

In the weekly meeting the manager complains: the dashboard is slow and yesterday's data was stale because Luca forgot to refresh it. The company already has a dbt project. Luca must move his query there.

## Concept

A dbt model is a `.sql` file inside `models/` that ends with a `select`. dbt materializes it as a view or table.

## Exercise

1. Open the existing dbt project.
2. Create `models/daily_revenue.sql`.
3. Paste the query from chapter 0.
4. Run `dbt run`.

## Verification

- `dbt run` succeeds.
- The model `daily_revenue` appears in the project.

## Plot hook

The model still points to raw table names directly. Next chapter Giulia will explain why that is dangerous.

## AI prompt to try

> Turn this SQL query into a dbt model. Then tell me what is missing to make it production-ready.
