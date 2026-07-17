# Learn dbt

Interactive dbt learning journey for analysts becoming analytical engineers.

## Premise

Luca is an analyst at a small e-commerce company. Every morning he runs the same SQL query by hand to power a slow dashboard. His manager asks him to make it reliable, fast, and independent of his clicking finger.

The company already uses dbt. Luca must learn how to use it.

## Target audience

- Analysts writing SQL for reports and dashboards
- People moving toward an analytical engineer role
- Anyone who wants to use AI to accelerate dbt work without trusting it blindly

## Module 1: from ad-hoc query to daily model

| Chapter | Story beat | Key concept |
|---|---|---|
| 0 | Luca's morning query | Pure SQL exploration |
| 1 | Manager asks for dbt | First dbt model |
| 2 | Giulia (data engineer) warns about dependencies | `source()` and `sources.yml` |
| 3 | Split logic into layers | `ref()` and the DAG |
| 4 | Dashboard still slow | `view` vs `table` |
| 5 | Numbers don't match | Tests |
| 6 | New teammate uses the model | Documentation |
| 7 | Simulate the daily run | Scheduling |

## Proposed tech stack

- Frontend: Astro or Next.js
- In-browser SQL/dbt execution: DuckDB-WASM
- dbt adapter: dbt-duckdb
- Exercise grading: expected-row comparison + dbt test results

## Repository layout

```
learn-dbt/
├── README.md
├── docs/
│   ├── product-spec.md
│   └── chapters/
│       ├── chapter-00.md
│       ├── chapter-01.md
│       └── chapter-02.md
├── platform/
│   └── README.md
├── src/
│   └── README.md
└── tests/
    └── README.md
```

## Contributing

1. Open or pick an issue.
2. Write or review chapter content in `docs/chapters/` before coding.
3. Platform changes live in `platform/` and `src/`.
4. Every exercise must have an automated check in `tests/`.
