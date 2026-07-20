# Chapter 0 — Luca's morning query

## Story

Luca's manager stops by his desk. "Can you pull revenue by category for me? I need it before the 10am stand-up." Luca opens the SQL editor and writes a query against the raw tables he already knows.

## Concept

Just the data and the SQL you already know. Get comfortable with the editor, the tables, and the AI helper before anything else is layered on top.

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

> I'm new to this SQL editor. Can you help me write a query that joins two tables, sums a calculated column, and groups the results by category and date?