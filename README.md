# Orchestrator — Claude Project Manager

Master control center for managing all your projects through Claude Code. CLI + Web Dashboard + Multi-Agent Orchestration.

![Version](https://img.shields.io/badge/version-0.1.0-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)
![Next.js](https://img.shields.io/badge/Next.js-14-black)

---

## What It Does

- **Project Registry** — Register all your projects (local, GitHub, remote) in one place
- **Virtual Office Dashboard** — Web UI where agents sit at desks with live terminal feeds
- **Bootstrap Any Project** — One click to scan a repo, detect its stack, and generate `CLAUDE.md` + skills + templates
- **Cross-Project Commands** — Run shell commands across filtered sets of projects
- **Task Dispatch** — Describe a task and it routes to the right project by keyword matching
- **Multi-Agent Protocol** — Token-optimized orchestrator that decomposes tasks and coordinates typed sub-agents
- **Prompt Caching Architecture** — Cached prefixes per agent type, <1400 tokens/agent target

---

## Quick Start

```bash
git clone https://github.com/S8nm/Orchistrator-Claude-Project-Manager.git
cd Orchistrator-Claude-Project-Manager
npm install
npm run build
```

### Launch Dashboard
```bash
npm run dev:dashboard
# Open http://localhost:3000
```

### Use CLI
```bash
npm run cli -- project list
npm run cli -- project add /path/to/your/project --name "My App" --type web-app --tags "frontend,react"
npm run cli -- status
npm run cli -- run "git status" --all
npm run cli -- dispatch "fix the login bug"
```

---

## Architecture

```
orchestrator/
├── CLAUDE.md                    # Multi-agent orchestrator protocol
├── projects.json                # Project registry (source of truth)
│
├── packages/
│   ├── shared/                  # Zod schemas + TypeScript types
│   ├── cli/                     # Commander.js CLI tool
│   │   └── src/commands/        # project, run, status, dispatch
│   └── dashboard/               # Next.js web dashboard
│       └── src/
│           ├── app/api/         # REST API (projects, run, bootstrap)
│           └── components/      # Virtual Office + Project Manager
│
├── .claude/
│   ├── skills/                  # Agent skill files (backend, frontend, testing, devops)
│   └── templates/               # Cached agent prompt templates
│
├── skills/                      # Claude Code orchestrator skills
├── config/                      # Shared ESLint + Prettier
├── templates/                   # CLAUDE.md template for new projects
└── docs/
    ├── plans/                   # Design & implementation docs
    └── references/              # Toolbox & resource references
```

---

## Dashboard

### Virtual Office
Every agent gets a workstation with a live terminal. Spawn agents (Backend, Frontend, Tester, Reviewer, etc.), assign tasks, and watch them work. Status cycling, token tracking, and prompt caching stats built in.

### Projects Tab
Connected to the real `projects.json` registry. Click any project to:
- **Bootstrap** — Auto-detect stack, generate CLAUDE.md + skills + templates
- **Git Status / Git Log** — Live git info
- **Run Commands** — Execute any shell command in the project directory
- **Quick Actions** — Pre-registered commands from the registry

### Commands
10 preset commands: Bootstrap, New Feature, Fix Bug, Refactor, Add Tests, Security Audit, Code Review, Token Optimize, Gen Docs, Deploy Prep. Each generates a ready-to-paste prompt.

---

## CLI Commands

| Command | Description |
|---------|-------------|
| `project add <path>` | Register a project |
| `project list [--tag X]` | List projects, optionally filtered |
| `project remove <id>` | Unregister a project |
| `project scan` | Auto-discover projects in registered locations |
| `run <cmd> [--all\|--tag\|--project]` | Run command across projects |
| `status [--all]` | Git health check all projects |
| `dispatch "<task>"` | Route task to matching project |

---

## API Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/projects` | List all registered projects |
| POST | `/api/projects` | Add, remove, or update projects |
| POST | `/api/run` | Execute a command in a project directory |
| POST | `/api/bootstrap` | Auto-detect stack and generate orchestrator files |

---

## Multi-Agent Protocol

The `CLAUDE.md` implements a token-optimized orchestrator:

```
┌─────────────────────────────────┐
│ REPO_CONTEXT (400 tok)          │  ← Cached, reused by ALL agents
├─────────────────────────────────┤
│ ROLE + SKILLS (300 tok)         │  ← Cached per agent type
├─────────────────────────────────┤
│ TASK + FILES (200-500 tok)      │  ← Only variable cost per spawn
└─────────────────────────────────┘
```

**Agent Types:** Architect, Backend, Frontend, Tester, Reviewer, Fullstack, DevOps, Security, Refactorer, Docs

**Execution Loop:** Assess → Batch → Collect → Verify → Report

---

## Bootstrap a Project

From the dashboard or API, bootstrap any project to auto-generate:

1. `CLAUDE.md` — Full orchestrator protocol with detected values
2. `.claude/skills/` — Backend, frontend, testing skill files
3. `.claude/templates/` — Agent prompt template with cached prefix

Supports: TypeScript, JavaScript, Python, Rust, Go, Java/Kotlin, and more.

---

## Tech Stack

- **TypeScript** (strict, ES modules)
- **npm workspaces** (monorepo)
- **Commander.js** (CLI)
- **Zod** (schema validation)
- **Next.js 14** (dashboard + API routes)
- **React 18** (Virtual Office UI)
- **Vitest** (testing)

---

## License

MIT
