---
name: backend
description: Backend best practices for the Orchestrator TypeScript monorepo
---

# Backend Skills — Orchestrator

- ES modules throughout (`type: "module"` in package.json, `.js` extensions in imports)
- Zod for ALL external data validation — see `packages/shared/src/schemas.ts` for patterns
- Registry pattern: load JSON -> Zod parse -> operate -> save JSON (see `packages/cli/src/registry.ts`)
- Commander.js for CLI: each command in its own file under `commands/`, exported as a function returning `Command`
- Error handling: throw descriptive errors from Registry class, catch and chalk.red() in command handlers
- `findRegistryPath()` walks up directories to find `projects.json` — see `packages/cli/src/utils.ts`
- No classes except Registry — prefer pure functions for utilities
- Always `readonly` on constructor params that shouldn't change
- Filter patterns: `listProjects({ tag?, status? })` — optional filter object, applied incrementally
- Shell execution: `execSync` with `cwd`, `encoding: "utf-8"`, `timeout: 60000` — always catch errors
- Cross-project commands resolve aliases from `project.commands` before executing
- Keyword scoring for dispatch: lowercase split, match against name/type/tags/stack
- Build: `tsc` only, no bundler. Output to `dist/`. Consumed via `dist/index.js`
- Imports: always use `@orchestrator/shared` for types, never relative paths across packages
- Test with Vitest: test files in `src/__tests__/`, use temp dirs with `beforeEach`/`afterEach` cleanup
