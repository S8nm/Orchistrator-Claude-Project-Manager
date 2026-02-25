# Orchestrator Design

**Date:** 2026-02-25
**Status:** Approved

## Purpose

A master control center for all projects across local folders, GitHub repos, cloud services, and servers. It provides a central hub for launching, shared config/skills, and cross-project task routing.

## Tech Stack

- **Language:** TypeScript
- **CLI:** Node.js with Commander/Yargs
- **Dashboard:** Next.js (local web UI)
- **Monorepo:** npm workspaces
- **Platform:** Windows 11

## Architecture

```
C:\Users\PC\Desktop\Claude\
├── CLAUDE.md                         # Master brain
├── .claude.local.md                  # Local overrides (gitignored)
├── package.json                      # Root monorepo config
├── tsconfig.json                     # Shared TS config
├── projects.json                     # Project registry
│
├── packages/
│   ├── cli/                          # CLI tool
│   │   ├── src/
│   │   │   ├── index.ts              # Entry point
│   │   │   ├── commands/
│   │   │   │   ├── project.ts        # add/remove/list projects
│   │   │   │   ├── run.ts            # cross-project commands
│   │   │   │   ├── status.ts         # project statuses
│   │   │   │   └── dispatch.ts       # task routing
│   │   │   ├── registry.ts           # Registry manager
│   │   │   └── utils.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── dashboard/                    # Next.js web dashboard
│   │   ├── src/
│   │   │   ├── app/                  # App router pages
│   │   │   ├── components/           # UI components
│   │   │   └── lib/                  # Utilities
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── shared/                       # Shared types & utilities
│       ├── src/
│       │   ├── types.ts              # Project, Task, Config types
│       │   └── schemas.ts            # Validation schemas
│       ├── package.json
│       └── tsconfig.json
│
├── skills/                           # Claude Code skills
│   ├── manage-project.md
│   ├── cross-project-run.md
│   ├── dispatch-task.md
│   └── project-status.md
│
├── templates/                        # Project scaffolds
│   ├── CLAUDE.md.template
│   ├── node-project/
│   └── python-project/
│
├── config/
│   ├── eslint.config.js
│   └── prettier.config.js
│
└── docs/
    └── plans/
```

## Project Registry (projects.json)

```json
{
  "projects": [
    {
      "id": "example-app",
      "name": "Example App",
      "path": "C:/Users/PC/Projects/example-app",
      "type": "web-app",
      "stack": ["typescript", "react"],
      "remote": "https://github.com/user/example-app",
      "status": "active",
      "tags": ["frontend", "production"],
      "commands": {
        "dev": "npm run dev",
        "build": "npm run build",
        "test": "npm test"
      }
    }
  ],
  "locations": [
    "C:/Users/PC/Desktop",
    "C:/Users/PC/Projects"
  ]
}
```

- **locations**: directories the orchestrator scans to auto-discover projects
- Each project defines its own commands, tags, and metadata

## CLI Commands

```
orchestrator project add <path>       # Register a project
orchestrator project list             # List all projects
orchestrator project remove <id>      # Unregister a project
orchestrator project scan             # Auto-discover in locations

orchestrator run <cmd> [--all | --tag=<tag> | --project=<id>]
orchestrator status [--all]           # Git/health checks
orchestrator dispatch "<task>"        # Route task to right project
```

## Skills

1. **manage-project** — Register/update/remove projects in the registry
2. **cross-project-run** — Execute commands across matching projects
3. **dispatch-task** — Route a task description to the correct project
4. **project-status** — Check git status, last commit, build health across all projects

## Dashboard

Next.js app on localhost:3000:
- Project list with status indicators
- Quick actions (run commands, open editor, view git log)
- Simple kanban task board for cross-project tasks

## Interaction Model

- **Primary:** Claude Code CLI in this directory using skills and commands
- **Secondary:** Web dashboard for visualization and quick actions
- **Registry:** projects.json as single source of truth for all project metadata

## Success Criteria

1. Can register any project regardless of location (local, GitHub, server)
2. Can run commands across filtered sets of projects
3. Shared skills work from this central location
4. Dashboard shows real-time project overview
5. CLAUDE.md provides full context so Claude Code is effective immediately
