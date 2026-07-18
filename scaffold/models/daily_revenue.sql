-- models/daily_revenue.sql
-- Chapter 1 — Luca's first dbt model.
--
-- This is the exact SQL from Chapter 0, moved into the dbt project.
-- The query does not change. What changes is where it lives and who runs it.
--
-- In Chapter 2 Giulia will replace the hardcoded `raw_orders` / `raw_products`
-- table names with {{ source('shop', 'raw_orders') }} calls. For now, the
-- raw names are written directly — the project works, but the contract is
-- not yet explicit.

select
  p.category,
  o.order_date,
  sum(o.quantity * p.price) as total_revenue
from raw_orders o
join raw_products p on o.product_id = p.product_id
group by 1, 2
order by 2 desc, 3 desc