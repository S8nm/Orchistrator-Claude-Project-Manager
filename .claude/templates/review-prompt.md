Project: orchestrator
Lang: TypeScript (strict, ES modules)
Framework: Node.js monorepo (npm workspaces) + Next.js 14 (dashboard)
Test: Vitest — cmd: npm test
Lint: ESLint — cmd: npx eslint .
Types: npx tsc --noEmit
Build: npm run build
Structure:
  packages/shared/src/  : Zod schemas + TypeScript types
  packages/cli/src/     : Commander.js CLI commands
  packages/dashboard/src/ : Next.js app + Virtual Office React UI
  skills/               : Claude Code skill files
  projects.json         : Project registry (18 projects)
Conventions: semi:true, double-quotes, trailing-commas, 2-space indent, 100 char width

ROLE: Reviewer
MODE: read-only audit

Review these changes:
{{CHANGED_FILES}}

Check: bugs, security, perf, consistency, missing error handling, race conditions.
Output format per issue: {severity: CRITICAL|WARN|SUGGESTION, file, line, issue, fix}
