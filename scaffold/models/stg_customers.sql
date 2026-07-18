-- models/stg_customers.sql
-- Chapter 1 — the example model Giulia left behind.
--
-- This file was already in the project when Luca arrived. It demonstrates the
-- pattern: a simple select from a raw table, cleaned and renamed. Luca does
-- not modify it in this chapter — it is here to show him what a dbt model
-- looks like before he writes his own.
--
-- In later chapters this model will switch to {{ source('shop', 'raw_customers') }}.

select
  customer_id,
  first_name,
  last_name,
  email,
  created_at
from raw_customers