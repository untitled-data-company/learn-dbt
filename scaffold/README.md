# dbt project scaffold — Chapter 1

Reference files for the dbt project described in Chapter 1. These show what a
real `analytics_dbt` project looks like on disk. The in-browser runner uses
DuckDB-WASM directly and does not read these files at runtime — they exist so
learners can see the full project structure alongside the narrative.

## Structure

```
scaffold/
├── dbt_project.yml            # project config: name, profile, paths, defaults
├── profiles.yml               # connection profile (DuckDB)
└── models/
    ├── sources.yml            # declares raw_orders, raw_products, raw_customers
    ├── stg_customers.sql      # example model left by Giulia
    └── daily_revenue.sql      # Luca's first model (Chapter 0 query, materialised)
```

## Relationship to the runner

The browser runner (`src/lib/`) initialises DuckDB-WASM with seed data
matching the raw tables declared in `sources.yml`. When a learner runs
`dbt run` in the browser, the runner compiles models using the same
`source()` / `ref()` resolution logic described in the scaffold — but it
operates on the in-memory database, not on these files.

These files are the *reference deployment*: what you would see if you cloned
the repo and ran `dbt run` against a real DuckDB instance.