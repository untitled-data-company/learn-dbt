# Chapter 2 — Giulia rings the bell

## Story

Luca runs `dbt run` and watches the terminal light up green.

```
15:42:12  1 of 1 OK created sql view model analytics.daily_revenue ... [OK in 0.12s]
15:42:12  Finished running 1 view model ... [OK in 1.18s]
15:42:12  Completed successfully
```

"Done," he says, leaning back. One file, one model, the query from Chapter 0 now lives
inside the dbt project. The dashboard can call `daily_revenue` instead of re-running
his hand-written SQL every morning. He pushes his chair back and reaches for his coffee.

He does not get a sip.

Giulia rounds the corner before the cup reaches his lips. She pulls up a chair, glances
at his screen, and frowns — not at the results, but at the `from` clause.

> "Luca, stop. Look at line 4. You wrote `from raw_orders`. That table is being renamed to
> `orders_v2` next week — the ingestion team sent the notice on Monday. And `raw_orders`
> isn't a dbt model. It's loaded by Fivetran, not by dbt. You have no idea what it's
> called tomorrow, and dbt has no idea it exists."

Luca blinks. "But it works right now."
> "It works *today*. That's the problem. You hardcoded a name that you don't own and
> can't control. When ingestion renames the table, your model breaks at 3 a.m. and nobody
> knows why. There's a better way — declare it as a `source` and let dbt resolve the name."

She writes two words on a sticky note and slaps it on his monitor: **`source()`**.

> "Think of it as a contract. The ingestion team promises the data will be there. You
> promise to read it through `source()`. If the real table name changes, one line in
> `sources.yml` changes — and every model that depends on it keeps working. That's the
> whole point."

Luca looks at his `daily_revenue.sql`. Two hardcoded table names. One rename away from
a 3 a.m. page.

## Concept box — `source()` vs `ref()`

dbt models read from two kinds of things, and dbt gives you a function for each:

| | `source()` | `ref()` |
|---|---|---|
| **What it points to** | Data loaded **outside** dbt — by Fivetran, Airbyte, Stitch, a custom loader, a manual `COPY` | Data built **by dbt** — another model in your project |
| **Who owns the name** | The ingestion tool / data platform | You, inside the dbt project |
| **Where it's declared** | `sources.yml` (one entry per source table) | Implicit: every model in `models/` is automatically referenceable |
| **What changes if the name moves** | Update **one line** in `sources.yml`; every model keeps compiling | Nothing — dbt tracks model renames for you |
| **Lineage** | Source nodes appear in the DAG as inputs (grey squares) | Model nodes appear as regular nodes in the DAG |

```
source('shop', 'raw_orders')   →   a table that arrived from outside dbt
ref('stg_orders')              →   a model that dbt built itself
```

The rule is simple: **if dbt didn't build it, use `source()`. If dbt built it, use `ref()`.**

- `source()` is your handshake with the ingestion layer: "I acknowledge this table is
  external and its name is not mine to hardcode."
- `ref()` is your handshake with the rest of the project: "this model depends on that
  model, so build it first and wire it into the DAG."

Both resolve to real table names at compile time — but they give dbt the information it
needs to build a lineage graph, rewire names, and tell you exactly what breaks when
something upstream changes.

### Why hardcoding raw table names is dangerous

Writing `from raw_orders` directly in a model looks harmless — until it isn't.
Here's what you lose:

1. **Silent breakage.** When the ingestion team renames `raw_orders` to `orders_v2`,
   your model doesn't fail at compile time. It fails at run time, in production, the
   moment someone queries it — and the error message says "table not found," with no
   hint that a rename happened upstream.

2. **No lineage.** dbt can't see that `daily_revenue` depends on `raw_orders`. The DAG
   is missing an edge. Your docs, your freshness checks, and your impact analysis are
   all blind to the connection.

3. **Scattered, untracked name changes.** If `raw_orders` is hardcoded in five models,
   a rename means editing five files — and hoping you found them all. With `source()`,
   it's one line in `sources.yml`, and dbt tells you exactly which models are affected.

4. **You blur the boundary.** `source()` is the explicit line between "data dbt built"
   and "data someone else loaded." Hardcoding that line away makes the project harder
   to reason about for everyone who comes after you — including future you.

The fix is mechanical: declare the external table once in `sources.yml`, swap every
hardcoded `from raw_orders` for `{{ source('shop', 'raw_orders') }}`, and from that
point on the name is a configuration, not a guess.

## Exercise

1. Create `models/sources.yml` declaring a source called `shop` with three tables:
   `raw_orders`, `raw_products`, `raw_customers`.
2. Update `models/daily_revenue.sql` to replace the hardcoded table names with
   `{{ source('shop', 'raw_orders') }}` and `{{ source('shop', 'raw_products') }}`.
3. Run `dbt run`.

```yaml
# models/sources.yml
version: 2

sources:
  - name: shop
    tables:
      - raw_orders
      - raw_products
      - raw_customers
```

```sql
-- models/daily_revenue.sql
select
  p.category,
  o.order_date,
  sum(o.quantity * p.price) as total_revenue
from {{ source('shop', 'raw_orders') }} o
join {{ source('shop', 'raw_products') }} p
  on o.product_id = p.product_id
group by 1, 2
order by 2 desc, 3 desc
```

## Verification

- `dbt run` succeeds.
- Rename the `raw_orders` entry in `sources.yml` to `orders_v2` and run `dbt run` again
  — the model still compiles and executes correctly, because it reads through `source()`,
  not through a hardcoded name.
- `dbt source freshness` (or the runner equivalent) reports the source as declared.

## Plot hook

Giulia is satisfied — for now. But she taps the screen again, this time at the
`group by` and the `join`.

> "You have one model doing everything: cleaning, joining, aggregating. What happens
> when someone needs the cleaned orders without the revenue math? You'll copy-paste half
> this query into a second file, and now you have two copies of the same logic. We don't
> do that here."

Next chapter: split `daily_revenue` into layers with `ref()` and let dbt build the DAG.

## AI prompt to try

> I'm writing a dbt model that reads tables loaded by Fivetran. Should I use `source()`
> or write the table name directly? Why? Then show me what a `sources.yml` looks like for
> three tables named `raw_orders`, `raw_products`, and `raw_customers` under a source
> called `shop`.