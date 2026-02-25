---
name: testing
description: Testing best practices for the Orchestrator project using Vitest
---

# Testing Skills — Orchestrator

- Test runner: Vitest 2.x — config-free, uses workspace package.json scripts
- Test files: `src/__tests__/*.test.ts` — co-located with source
- Run all: `npm test` | Run specific: `npx vitest run packages/cli/src/__tests__/registry.test.ts`
- AAA pattern: Arrange (setup), Act (call), Assert (expect)
- Temp directory pattern for file-based tests (see `registry.test.ts`):
  - `beforeEach`: create tmpdir with `mkdirSync`, write seed JSON, instantiate class
  - `afterEach`: `rmSync(testDir, { recursive: true, force: true })`
- Import from source with `.js` extension (ES modules): `import { Registry } from "../registry.js"`
- Test happy path, error path, and edge cases:
  - Happy: `it("adds a project", ...)`
  - Error: `it("prevents duplicate project ids", ...)` — use `expect(() => ...).toThrow("message")`
  - Edge: empty state, missing fields, filter with no matches
- No mocking of internal modules — test through the public API
- Mock externals (fs, child_process) only when testing commands that shell out
- Assertions: `expect(x).toEqual()` for deep, `expect(x).toBe()` for primitives, `toHaveLength()` for arrays
- Test names: imperative verb, describe what happens — "loads an empty registry", "removes a project by id"
- Current coverage: Registry class (5 tests). Commands and dashboard need test expansion.
- Always run tests after writing and fix failures before reporting done
