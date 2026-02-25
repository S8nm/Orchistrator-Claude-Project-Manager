# Orchestrator

Master control center for all projects. Manages a registry of projects across local folders, GitHub repos, and remote servers.

## Quick Start

```bash
npm install            # Install all dependencies
npm run build          # Build all packages
npm run cli -- --help  # Show CLI help
npm run dev:dashboard  # Start web dashboard on localhost:3000
```

## Architecture

TypeScript monorepo with npm workspaces:
- `packages/shared` — Types and Zod schemas
- `packages/cli` — Commander-based CLI tool
- `packages/dashboard` — Next.js web dashboard with Virtual Office UI

## Key Files

- `projects.json` — Project registry (source of truth)
- `packages/cli/src/registry.ts` — Registry read/write logic
- `packages/cli/src/commands/` — CLI command implementations
- `packages/dashboard/src/app/page.tsx` — Virtual Office main component
- `skills/` — Claude Code skills for orchestration

## CLI Commands

```
npm run cli -- project add <path>       # Register project
npm run cli -- project list             # List projects
npm run cli -- project remove <id>      # Remove project
npm run cli -- project scan             # Auto-discover projects
npm run cli -- run <cmd> [--tag=X]      # Cross-project command
npm run cli -- status                   # Git status of all projects
npm run cli -- dispatch "<task>"        # Route task to project
```

## Testing

```bash
npm test                                        # All tests
npx vitest run packages/cli/src/__tests__/      # CLI tests only
```

## Code Style

- TypeScript strict mode
- ES modules (type: "module")
- Zod for all external data validation
- Vitest for testing

## Project Registry Schema

Projects in `projects.json` have: id, name, path, type, stack[], remote?, status, tags[], commands{}

## Skills

Skills in `skills/` directory:
- `manage-project` — Add/remove/list projects
- `cross-project-run` — Run commands across projects
- `dispatch-task` — Route tasks to the right project
- `project-status` — Health check all projects
