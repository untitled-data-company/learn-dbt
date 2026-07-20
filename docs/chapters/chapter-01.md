# Chapter 1 — The manager says "use dbt"

## Story

Thursday. 10:00. The weekly analytics sync.

Luca dials in with his coffee. The manager, Giorgio, shares his screen — the
*Revenue by category* dashboard. The numbers are from Tuesday.

> "Yesterday's data was stale," he says. "I opened the dashboard before the
> board meeting and it showed Monday's numbers. Luca, you usually refresh it
> in the morning — what happened?"

Luca was on holiday on Wednesday. He says nothing. He does not need to. Giorgio
already knows the answer, and everyone on the call knows it too: the dashboard
only updates when Luca runs his query and pastes the results into the BI tool
by hand. No Luca, no refresh.

> "This cannot be the plan," Giorgio continues. "We have a dbt project sitting
> right there — the data engineering team set it up six months ago. It has
> profiles, it has sources, it has a models directory with one example model
> nobody has touched since. It is time to move your query into it."

She shares a link. Luca opens it: a repository called `analytics_dbt`.
Inside: a `dbt_project.yml`, a `profiles.yml`, a `models/` folder with a single
file — `stg_customers.sql` — left behind by Giulia as a template. The raw
tables (`raw_orders`, `raw_products`, `raw_customers`) are already declared as
sources. The plumbing is there. Nobody has used it.

> "Your morning query becomes a dbt model," Giorgio says. "Once it is in dbt, we
> schedule it. It runs every day at 6 a.m. whether you are here or not. The
> dashboard reads from the model, not from your clipboard. That is the end of
> the story — or at least the beginning of a better one."

Luca looks at the project. He looks at his query — the one from Chapter 0,
the `select` with the join and the `group by` that he runs every morning. All
he has to do is put it in a file called `models/daily_revenue.sql`, run
`dbt run`, and let dbt do the rest.

He can do that. Probably.

## What you will do in this chapter

You are now standing next to Luca inside the existing dbt project. The raw
tables are loaded. The sources are declared. The project is waiting for a
model that does something useful.

You will:

1. **Explore the dbt project scaffold** — `dbt_project.yml`, `profiles.yml`,
   the `models/` directory, the existing `sources.yml`.
2. **Create your first dbt model** — `models/daily_revenue.sql` — by moving
   the SQL query from Chapter 0 into a model file.
3. **Run `dbt run`** and watch dbt compile and materialise the model.
4. **Query the result** and verify it matches the numbers you got by hand.

This is the moment Luca stops being a manual refresh button and starts being
a dbt user. The query does not change. What changes is *where it lives* and
*who runs it*.

## Concept box — what is a dbt model?

A dbt model is a `.sql` file that lives inside the `models/` directory of a
dbt project. That is the entire definition from dbt's perspective: if the file
is in `models/` and it ends with a `select` statement, dbt treats it as a
model.

```sql
-- models/daily_revenue.sql
select
  p.category,
  o.order_date,
  sum(o.quantity * p.price) as total_revenue
from raw_orders o
join raw_products p on o.product_id = p.product_id
group by 1, 2
```

When you run `dbt run`, dbt does three things for each model:

1. **Compiles** — resolves any `{{ source() }}` or `{{ ref() }}` calls into
   real table names, producing a plain SQL statement.
2. **Materialises** — wraps that SQL in a `CREATE OR REPLACE TABLE` (or
   `VIEW`) and runs it against your database.
3. **Tracks** — records the model in the DAG so downstream models, tests, and
   docs know it exists.

### Why materialise?

You could run the query by hand every morning — Luca did, for months. So why
let dbt materialise it?

| | Run by hand | dbt model |
|---|---|---|
| **Who runs it** | Luca, at his desk, with coffee | The scheduler, at 6 a.m., without Luca |
| **Where the SQL lives** | Luca's head, a sticky note, a tab he forgets to save | A file in version control, reviewable, diffable |
| **What the dashboard reads** | A paste of whatever Luca ran | A stable table (or view) that dbt guarantees exists |
| **When it breaks** | Luca notices the numbers look wrong — maybe | dbt fails loudly at run time, before the dashboard loads |
| **Who can reproduce it** | Only Luca, if he is at his desk | Anyone with the repo, with one command |

The key word is **materialise**. dbt does not just run your query and show
you the rows. It creates a *physical object* in the database — a table or a
view — that persists after `dbt run` finishes. The dashboard can read that
object the same way it reads any other table. You do not need Luca. You do
not need a clipboard. You need `dbt run` and a schedule.

### Table or view?

dbt's default materialisation is **view** — it wraps your SQL in
`CREATE OR REPLACE VIEW`. Views cost nothing to store but re-run the
underlying query every time they are queried. For a small dataset like Luca's
that is fine.

**Table** materialisation runs the query once and stores the result. The
dashboard reads pre-computed rows — fast, but stale until the next `dbt run`.
For Chapter 1 we will use the dbt default (view). Chapter 4 will revisit this
choice when the dashboard is still slow.

You control materialisation per-model with a config block at the top of the
file:

```sql
{{ config(materialized='table') }}

select ...
```

Or globally in `dbt_project.yml`. For now, the default is enough.

## The dbt project scaffold

The project Giorgio pointed Luca to has this structure:

```
analytics_dbt/
├── dbt_project.yml      # project-level config: name, materialisation defaults
├── profiles.yml         # connection profile (which database to target)
├── models/
│   ├── sources.yml      # declares raw_orders, raw_products, raw_customers
│   └── stg_customers.sql  # example model left by Giulia
└── seeds/               # (optional) CSV files dbt can load as tables
```

### `dbt_project.yml`

```yaml
# dbt_project.yml
name: analytics_dbt
version: "1.0.0"
config-version: 2

profile: analytics  # matches the profile name in profiles.yml

model-paths: ["models"]
seed-paths: ["seeds"]

models:
  analytics_dbt:
    +materialized: view  # default materialisation for all models
```

### `profiles.yml`

```yaml
# profiles.yml — tells dbt which database to connect to
analytics:
  target: dev
  outputs:
    dev:
      type: duckdb
      path: analytics.duckdb
```

### `models/sources.yml`

```yaml
# models/sources.yml — declares the raw tables loaded by the ingestion tool
version: 2

sources:
  - name: shop
    tables:
      - raw_orders
      - raw_products
      - raw_customers
```

The raw tables are already in the database — loaded by Fivetran, not by dbt.
`sources.yml` is dbt's way of saying "these tables exist, I did not create
them, but I know about them." Chapter 2 will explain why declaring them as
sources (and reading through `{{ source() }}` instead of hardcoding the
name) matters. For now, it is enough that the file exists and the tables are
listed.

> **In the browser runner:** you do not need a real `profiles.yml` or a
> running DuckDB instance. The in-browser DuckDB-WASM engine is already
> initialised with the raw tables as seed data. The scaffold files here are
> the *reference* — what the project looks like in a real deployment. The
> exercise below uses the same SQL against the same tables.

## Exercise

1. **Create `models/daily_revenue.sql`** by moving the Chapter 0 query into
   the dbt project.
2. **Run `dbt run`** (or the runner equivalent) to materialise the model.
3. **Query the model** and verify the output matches the hand-run query from
   Chapter 0.

```sql
-- models/daily_revenue.sql
select
  p.category,
  o.order_date,
  sum(o.quantity * p.price) as total_revenue
from raw_orders o
join raw_products p on o.product_id = p.product_id
group by 1, 2
order by 2 desc, 3 desc
```

Notice what did *not* change: the SQL is identical to Chapter 0. The only
difference is *where it lives* — inside `models/`, where dbt can find it,
compile it, materialise it, and schedule it. That is the whole point of this
chapter: the query is the same. The system around it is different.

## Verification

- `dbt run` succeeds and reports `1 of 1 OK` for `daily_revenue`.
- The model `daily_revenue` appears as a queryable table or view in the
  database.
- The results match the Chapter 0 query — same columns (`category`,
  `order_date`, `total_revenue`), same row count, same numbers.
- Bonus: query `select * from daily_revenue where category = 'gadgets'` and
  confirm the rows are a subset of the full result.

## Plot hook

Luca runs `dbt run`. Green across the board. He pushes back from his desk,
satisfied. The query is in the project. The dashboard can read the model.
Giorgio will be happy.

Then Giulia walks past his desk, glances at his screen, and stops.

> "Luca. Line 4. You wrote `from raw_orders`. That table is being renamed to
> `orders_v2` next week. And `raw_orders` is not a dbt model — it is loaded
> by Fivetran, not by dbt. You hardcoded a name you do not own. That is a
> 3 a.m. page waiting to happen."

Luca blinks. "But it works."

> "It works *today*. That is the problem."

Next chapter: Giulia explains `source()` and why hardcoding raw table names
is the first bad habit dbt is designed to break.

## AI prompt to try

> I have a SQL query that I run by hand every morning. I just moved it into a
> dbt model file and ran `dbt run` — it works. What are the first three things
> I should do to make this model production-ready before it runs on a
> schedule?

Run this through an AI assistant. Then **verify** what it tells you against
the scaffold above. If it suggests adding tests, check whether the project
has a tests directory yet (it does not — that comes later). If it suggests
`source()`, remember that Giulia is about to say the same thing in the next
chapter. The AI does not know your project structure — you do.

## Files in this chapter

| File | Purpose |
|---|---|
| `docs/chapters/chapter-01.md` | This narrative |
| `scaffold/dbt_project.yml` | Project-level dbt configuration |
| `scaffold/profiles.yml` | Connection profile (DuckDB) |
| `scaffold/models/sources.yml` | Declares the three raw tables as sources |
| `scaffold/models/daily_revenue.sql` | The first dbt model — Luca's query, materialised |
| `scaffold/models/stg_customers.sql` | Example model left by Giulia |
