# Chapter 0 — Luca's morning query

## Story

Luca opens the BI tool. The dashboard *Revenue by category* spins for 40 seconds. While waiting, he runs his sanity-check SQL query against the raw tables.

## Concept

No dbt here. Just the data and the SQL that Luca already knows.

## Tables

- `raw_orders`: order_id, customer_id, product_id, quantity, order_date
- `raw_products`: product_id, name, category, price
- `raw_customers`: customer_id, name, country, registered_at

## Exercise

Write a query that returns daily revenue by category.

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

## Verification

- The query returns at least 10 rows.
- Columns are `category`, `order_date`, `total_revenue`.
- User answers: how much revenue did the category 'Electronics' make on a given date?

## AI prompt to try

> I have a slow dashboard backed by a manual SQL query. How should I explain it to a data engineer so they understand what to materialize in dbt?
