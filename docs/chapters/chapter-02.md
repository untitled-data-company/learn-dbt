# Chapter 2 — Giulia rings the bell

## Story

Luca runs `dbt run` and it works. "Done!" he thinks. Giulia walks by and looks at his screen.

> "Luca, stop. `raw_orders` is being renamed to `orders_v2` next week. And `raw_orders` is loaded by the ingestion tool, not by dbt. Never hardcode raw table names. Use `source()`."

## Concept

`source()` gives a stable name to data that arrives from outside the dbt project. `sources.yml` declares those tables. If the underlying name changes, only `sources.yml` changes.

## Exercise

1. Create `models/sources.yml` with sources `raw_orders`, `raw_products`, `raw_customers` under source `shop`.
2. Update `daily_revenue.sql` to use `{{ source('shop', 'raw_orders') }}` and `{{ source('shop', 'raw_products') }}`.
3. Run `dbt run`.

## Verification

- `dbt run` succeeds.
- Renaming the source table in `sources.yml` to `orders_v2` still lets the model compile.

## AI prompt to try

> I'm writing a dbt model that reads tables loaded by Fivetran. Should I use `source()` or write the table name directly? Why?
