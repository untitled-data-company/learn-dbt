# Product spec — Learn dbt

## Vision

A story-driven, interactive site where an analyst learns dbt by solving realistic exercises. Each chapter mixes narrative, SQL practice, dbt commands, and AI prompts that must be verified.

## Characters

- **Luca** — analyst, protagonist, makes mistakes, learns.
- **Manager** — asks for reliability and speed.
- **Giulia** — data engineer, keeps the dbt project healthy, teaches Luca the rules.

## Module 1 objective

Transform Luca's daily manual query into a reliable dbt model that can run every day without him.

## Success criteria

- A first-time user can complete chapter 0 with only SQL knowledge.
- Each chapter ends with an automated verification.
- The story and the exercise are inseparable.
- AI prompts are always followed by a human verification step.

## Stack decisions (draft)

- DuckDB-WASM for zero-cost, zero-install SQL and dbt exercises.
- Static site generator for content pages.
- Exercise runner that can execute SQL and dbt commands in the browser or a sandbox.

## Out of scope for module 1

- Incremental models
- Complex Jinja macros
- CI/CD pipelines
- Cloud warehouses
- Advanced data modeling (star schema, etc.)
