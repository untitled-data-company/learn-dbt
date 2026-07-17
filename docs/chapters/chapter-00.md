# Chapter 0 — Luca's morning query

## Story

It is 8:15 on a Monday morning. Luca sits down with his coffee, opens the BI
tool, and clicks the *Revenue by category* dashboard. The loading spinner
appears. He waits. Thirty seconds. Forty seconds. The dashboard finally paints
itself, one tile at a time.

Luca does not trust the spinner. He never has. So he opens a SQL tab and runs
the same query he runs every single morning — by hand — against the raw tables.
It is his sanity check. If the numbers in the query match the numbers on the
dashboard, the day can start. If they do not, he has to figure out which one is
wrong before anyone notices.

This is Luca's life. He is an analyst at a small e-commerce company. He writes
good SQL. He does not trust dashboards he did not build, and he does not have a
system he can rely on — only a habit he repeats every morning, one query at a
time.

> The dashboard is slow. The query is manual. And Luca is the only thing
> standing between the team and stale numbers. That cannot scale.

## What you will do in this chapter

This chapter is pure SQL. There is no dbt yet — that comes later. Right now you
are standing next to Luca, looking at the same raw tables he looks at every
morning.

You will:

1. **Explore the raw tables** — `raw_orders`, `raw_products`, `raw_customers`.
2. **Write a query** that returns daily revenue by product category.
3. **Run it** against the in-browser DuckDB engine and see the results.
4. **Verify** your output against the expected columns and row count.

Think of this as the before picture. By the end of the module, Luca's morning
ritual will be a dbt model that runs itself. But you have to understand the raw
world first.

## Concept box — the e-commerce tables

The company sells products online. Three raw tables arrive every day from the
ingestion pipeline. Here is what they contain:

| Table | Grain | Key columns |
|---|---|---|
| `raw_orders` | one row per order line | `order_id`, `customer_id`, `product_id`, `quantity`, `order_date` |
| `raw_products` | one row per product | `product_id`, `name`, `category`, `price` |
| `raw_customers` | one row per customer | `customer_id`, `name`, `country`, `registered_at` |

A few things to notice:

- **`raw_orders` has no price.** To get revenue you must join to `raw_products`
  and multiply `quantity * price`. Nothing in the raw layer is pre-calculated.
- **`raw_customers` is not needed for revenue.** But it is there, and later
  chapters will use it. For now, focus on orders and products.
- **Everything is raw.** No transformations, no derived columns, no business
  logic. What the ingestion tool dumped is what you get.

## Exercise

Write a query that returns **daily revenue by category** — one row per
category per day, with the total revenue sorted from newest date to oldest.

```sql
select
  p.category,
  o.order_date,
  sum(o.quantity * p.price) as total_revenue
from raw_orders o
join raw_products p on o.product_id = p.product_id
group by 1, 2
order by 2 desc, 3 desc
```

Run it in the editor on the right. Tweak it. Break it. Understand it. This is
the query Luca runs every morning — and the same query that, by the end of
this module, will become a dbt model running on its own.

## Verification

- The query returns **at least 10 rows**.
- The columns are exactly `category`, `order_date`, `total_revenue`.
- Bonus question: how much revenue did the category `Electronics` make on the
  most recent date in the data?

## AI prompt to try

> I have a slow dashboard backed by a manual SQL query. How should I explain
> it to a data engineer so they understand what to materialize in dbt?

Run this through an AI assistant. Then **verify** what it tells you against the
tables above. The AI does not know your schema — you do. If it invents a
column that does not exist, catch it. That habit will matter more and more as
the chapters progress.

## Plot hook

Luca's query works. The numbers match the dashboard. But tomorrow morning he
will run it again, and the morning after that, and the morning after that. His
manager has started to ask a simple, uncomfortable question: *what happens on
the days Luca is on holiday?*

The answer, right now, is nothing. And that is the problem Chapter 1 begins to
solve.