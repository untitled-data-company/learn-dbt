# Platform

This directory holds the technical design of the interactive exercise platform.

Responsibilities:
- In-browser SQL editor
- DuckDB-WASM integration
- dbt command runner (real or sandboxed)
- Exercise grader and progress tracking

## Stack

- Next.js + Tailwind CSS for the site.
- Monaco Editor embedded in a right-hand panel.
- DuckDB-WASM for SQL execution.
- A small dbt compiler in TypeScript for `source()` / `ref()` resolution and `dbt run` / `dbt test` simulation.

## Chapter layout

Every chapter uses a split-pane layout:
- **Left:** story, concept, instructions.
- **Right:** Monaco Editor with one or more file tabs, Run/Reset/Hint buttons, results table, verification panel.
