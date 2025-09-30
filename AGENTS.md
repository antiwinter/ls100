# Repository Guidelines

## Project Structure & Module Organization
- Monorepo using Yarn workspaces.
- client/ – React + Vite app (source in client/src, tests in client/src/**/*.{test,spec}.js).
- server/ – Node/Express API (entry server/server.js; DB adapters in server/utils/dbc/; tests in server/tests/*.js).
- docs/ – Architecture and module docs.
- infra/ – Local dev proxy and deployment scripts.
- prompt/manage.js – Small CLI for prompt/conversation utilities.

## Build, Test, and Development Commands
- Install: yarn
- Run dev (client + server + dev proxy): yarn dev
- Production: yarn start
- Lint: yarn lint (or per package: yarn workspace client lint, yarn workspace server lint)
- Client build: yarn workspace client build
- Client tests (Vitest): yarn workspace client test
- Server tests (node scripts):
  - node server/tests/run-compatibility-tests.js [auth|abstraction]
  - Example (SQLite): DATABASE=tmp/test.sqlite node server/tests/run-compatibility-tests.js

## Coding Style & Naming Conventions
- Language: JS (ESM). Prefer JS over TS here.
- ESLint enforced (client/eslint.config.js, server/eslint.config.js):
  - 2-space indent; single quotes; no semicolons; no console; trailing commas: never.
- React components: PascalCase (e.g., ComponentName.jsx); utilities: camelCase (e.g., utils/dateFormat.js); tests: sameName.test.js.
- Logging:
  - Server: import { log } from '../utils/logger.js'
  - Client: import { log } from '../utils/logger'
- See coding-rules.md for additional preferences (short names, reuse helpers, keep code clean).

## Testing Guidelines
- Frontend: Vitest; place *.test.js near code or under src/**/test/.
- Backend: Node scripts in server/tests; set DATABASE (file path or postgresql://…) and optionally USE_POSTGRES=true.
- Aim to cover non-trivial logic; keep tests explicit per test-rules.md (do not hide failures).

## Commit & Pull Request Guidelines
- Commits: short, imperative, focused (no strict type prefixes required).
  - Examples: “fix rating interval display”, “refactor reader view”, “add invite code API”
- PRs: clear description, scope, linked issues, test steps, and screenshots/GIFs for UI changes. Ensure yarn lint and client tests pass. Update docs when needed.

## Security & Configuration Tips
- Use .env for local secrets; never commit secrets.
- Key env vars: DATABASE, USE_POSTGRES, PORT, NODE_ENV.
- Use Yarn (not npm).
