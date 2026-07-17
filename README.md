# Learn dbt

Interactive dbt learning platform with DuckDB-WASM. Learn dbt concepts through
in-browser SQL exercises — no local database required.

## Tech Stack

- **Next.js 15** (App Router) + React 19 + TypeScript
- **Tailwind CSS** for styling
- **DuckDB-WASM** for in-browser SQL execution
- **Monaco Editor** for code editing
- **Vitest** for unit tests
- **Playwright** for E2E tests
- **ESLint** for linting

## Getting Started

```bash
# Install dependencies (already done in bootstrap, but if needed)
npm install

# Start the dev server
npm run dev
# → http://localhost:3000
```

## Scripts

| Command             | Description                              |
|---------------------|------------------------------------------|
| `npm run dev`       | Start the development server             |
| `npm run build`     | Create a production build                |
| `npm run start`     | Start the production server              |
| `npm run lint`      | Run ESLint                               |
| `npm test`          | Run Vitest in watch mode                 |
| `npm run test:run`  | Run Vitest once (CI mode)                |
| `npm run test:e2e`  | Run Playwright E2E tests                 |

## Project Structure

```
learn-dbt/
├── src/
│   ├── app/              # Next.js App Router pages
│   │   ├── layout.tsx    # Root layout
│   │   ├── page.tsx      # Home page (placeholder)
│   │   └── globals.css   # Tailwind directives
│   └── test/             # Vitest setup + unit tests
├── e2e/                  # Playwright E2E tests
├── next.config.mjs       # Next.js configuration
├── tsconfig.json         # TypeScript configuration
├── tailwind.config.ts    # Tailwind CSS configuration
├── postcss.config.mjs    # PostCSS configuration
├── vitest.config.ts      # Vitest configuration
├── playwright.config.ts  # Playwright configuration
├── .eslintrc.json        # ESLint configuration
└── package.json          # Dependencies and scripts
```

## Development

This repo was bootstrapped as a shared skeleton so that feature tasks can branch
from `main` and reuse the installed environment without reinstalling dependencies
every run.

### Branching

Feature tasks should branch from `main`:

```bash
git checkout main
git checkout -b feat/your-feature
```