---
name: devops
description: DevOps and infrastructure patterns for the Orchestrator project
---

# DevOps Skills — Orchestrator

- No CI/CD pipeline yet — `.github/workflows/` does not exist. Create when needed.
- Build chain: `npm run build` runs `tsc` across all workspaces (shared -> cli -> dashboard)
- Dashboard build: `next build` — produces static output, no server required for basic pages
- No Docker setup yet — consider multi-stage build: node:alpine for build, node:alpine-slim for run
- Environment: no `.env` files currently. Dashboard reads `projects.json` from filesystem.
- Git: master branch, remote `origin` at github.com/S8nm/Orchistrator-Claude-Project-Manager
- npm workspaces: 3 packages (`shared`, `cli`, `dashboard`). Shared must build first.
- Build order matters: shared -> cli (depends on shared types) -> dashboard (depends on shared types)
- No secrets in codebase. `projects.json` contains local file paths (personal use repo).
- `.gitignore`: node_modules, dist, .next, .env, .claude.local.md, *.tsbuildinfo
- Package linking: `@orchestrator/shared: "*"` in cli and dashboard package.json
- Next.js config: `transpilePackages: ["@orchestrator/shared"]` for workspace type resolution
- Potential CI pipeline: `npm ci -> npm run build -> npm test -> npx tsc --noEmit`
- Dashboard dev server: `npm run dev:dashboard` -> localhost:3000
- CLI invocation: `npm run cli -- <command>` or `node packages/cli/dist/index.js <command>`
