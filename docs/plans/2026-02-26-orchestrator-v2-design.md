# Orchestrator v2 — Interactive Agents, Presets, Persistence

**Date**: 2026-02-26
**Status**: Approved

## Overview

Upgrade the orchestrator from manual agent spawning to a full orchestration engine with:
- Interactive terminals per agent (bidirectional: see output + send input)
- Preset agent system (role-based, project-specific teams, custom user-defined)
- Full persistence (agent state, orchestrations, logs, presets survive restarts)
- Orchestration engine (auto task decomposition, dependency DAG, coordination loop)
- Virtual Office UI upgrade (orchestrate tab, presets tab, task graph viz)

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Web Dashboard                     │
│  ┌──────────┐ ┌──────────┐ ┌────────┐ ┌──────────┐ │
│  │  Office   │ │Orchestrate│ │Presets │ │ Registry │ │
│  │  (agents) │ │(task DAG) │ │(spawn) │ │(projects)│ │
│  └─────┬─────┘ └─────┬─────┘ └───┬────┘ └──────────┘ │
│        │              │           │                    │
│  ┌─────┴──────────────┴───────────┴──────────────┐   │
│  │          Interactive Terminal per Agent         │   │
│  │     SSE output ↓        ↑ POST /agent/input    │   │
│  └────────────────────────────────────────────────┘   │
└──────────────────────┬────────────────────────────────┘
                       │ API
┌──────────────────────┴────────────────────────────────┐
│                   Server (Next.js)                      │
│  ┌────────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │ Agent Executor  │  │ Orchestrator │  │ Persistence│ │
│  │ (spawn/stdin/  │  │ Engine       │  │ Layer      │ │
│  │  SSE stream)   │  │ (decompose,  │  │ (data/*.json│ │
│  │                │  │  DAG, loop)  │  │  + logs/)  │ │
│  └───────┬────────┘  └──────┬───────┘  └─────┬──────┘ │
│          │                  │                 │         │
│    child_process.spawn()    │           fs read/write   │
│    (claude / bash / cmd)    │          (debounced)      │
└──────────────────────────────────────────────────────────┘
```

## 1. Interactive Terminals

### Agent Executor Changes
- `stdio` changes from `["ignore", "pipe", "pipe"]` to `["pipe", "pipe", "pipe"]`
- New `sendInput(agentId, text)` function writes to `child.stdin`
- Store stdin handle on `AgentProcess` interface

### Two Spawn Modes
- **Claude mode**: `claude --dangerously-skip-permissions` (interactive, no `-p`)
  - User messages written to stdin, Claude responds via stdout
- **Shell mode**: `bash` or `cmd` with stdin piped
  - User types commands, sees output via SSE

### New API
- `POST /api/agent/input` — `{ id, input }` → writes to stdin + newline

### UI
- Each agent card: terminal pane (existing log view) + input field at bottom
- Type + Enter sends to agent via POST
- Expanded workstation view: prompt on left, live terminal on right

## 2. Preset Agent System

### Directory Structure
```
data/
├── presets/
│   ├── roles/           # 11 built-in (one per AGENT_TYPE)
│   │   ├── orchestrator.json
│   │   ├── architect.json
│   │   ├── backend.json
│   │   ├── frontend.json
│   │   ├── tester.json
│   │   ├── reviewer.json
│   │   ├── fullstack.json
│   │   ├── devops.json
│   │   ├── security.json
│   │   ├── docs.json
│   │   └── refactorer.json
│   ├── teams/           # Project-specific combos
│   │   └── jarvis-dev.json
│   └── custom/          # User-created via dashboard
├── agents/              # Active agent state
├── orchestrations/      # Orchestration history
└── logs/                # Per-agent log files
    └── {agentId}.log
```

### Preset Schema
```typescript
interface AgentPreset {
  id: string;
  name: string;
  type: "role" | "team" | "custom";
  scope: "global" | string;  // "global" or projectId
  agents: Array<{
    role: AgentRole;
    name: string;
    skills: string[];
    model?: string;
    cwd?: string;
    mode: "claude" | "shell";
    autoPrompt?: string;
  }>;
  tags: string[];
}
```

### Dashboard Presets Tab
- Three sections: Roles (11 built-in), Teams (project-scoped), Custom
- One-click "Spawn" on any preset → creates agents + connects terminals
- "Save as Preset" on any running agent configuration
- Edit/delete custom presets

## 3. Orchestration Engine

### Location: `packages/dashboard/src/lib/orchestrator/`

| File | Purpose |
|------|---------|
| `index.ts` | Re-exports |
| `task-templates.ts` | 10 preset DAG templates matching PRESET_COMMANDS |
| `plan-builder.ts` | `buildPlan(task, project)` → `OrchestrationPlan` |
| `prompt-builder.ts` | Cache-optimized prompt assembly |
| `loop.ts` | `OrchestratorLoop` class — coordination engine |

### Execution Loop
1. `buildPlan(task, project)` → sub-task DAG
2. Find tasks with no deps → spawn as first batch (parallel)
3. On exit success → mark done, store output, `advance()`
4. `advance()` → find tasks whose deps are all done → spawn next batch
5. On exit failure → retry up to 2x with error context
6. Downstream tasks get `CONTEXT FROM PREVIOUS AGENTS:` (last 2000 chars per dep)
7. All done → verification step (npm test + tsc)

### Prompt Caching
```
REPO_CONTEXT (cached, identical all agents)
→ ROLE+SKILLS (cached per type)
→ TASK+CONTEXT (variable)
Target: <1400 tok/agent
```

## 4. Full Persistence

### Storage
- Agent state → `data/agents/{id}.json` — on spawn, status change, exit
- Orchestrations → `data/orchestrations/{id}.json` — full plan + sub-tasks
- Logs → `data/logs/{agentId}.log` — append-only
- Presets → `data/presets/**/*.json` — on create/edit
- Debounced writes (1s) for high-frequency updates

### Reconnection on Restart
- Scan `data/agents/` for running agents
- Check PIDs alive via `process.kill(pid, 0)`
- Reconnect live ones (re-attach EventEmitter to stdout/stderr)
- Mark dead ones as "disconnected"

### Source of Truth
- Disk (data/) is source of truth
- localStorage is fast cache for instant dashboard load
- API reads from disk, writes to disk

## 5. New API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/agent/input` | POST | Send text to agent stdin |
| `/api/presets` | GET | List all presets |
| `/api/presets` | POST | Create/update/delete preset |
| `/api/orchestrate/start` | POST | Decompose + execute |
| `/api/orchestrate/[id]` | GET | Orchestration state |
| `/api/orchestrate/stream` | GET (SSE) | Stream events |
| `/api/orchestrate/cancel` | POST | Kill orchestration |
| `/api/orchestrate/list` | GET | List orchestrations |

## 6. UI Changes

### Office Tab (enhanced)
- Agent cards get interactive terminal input fields
- Click agent → expanded workstation: prompt left, terminal right

### Orchestrate Tab (new)
- Task input + preset command picker → "Run" button
- DAG visualization: sub-tasks as boxes, SVG lines for deps
- Colored by status, real-time updates via SSE

### Presets Tab (new)
- Browse/spawn/create/edit presets
- Role cards, team cards, custom cards

### Existing tabs (Registry, Cmd) — unchanged

## 7. Shared Types

```typescript
type AgentRole = "orchestrator" | "architect" | "backend" | "frontend"
  | "tester" | "reviewer" | "fullstack" | "devops" | "security" | "docs" | "refactorer";

type AgentMode = "claude" | "shell";

type SubTaskStatus = "pending" | "ready" | "running" | "done" | "failed";

type OrchestrationStatus = "decomposing" | "running" | "verifying"
  | "done" | "failed" | "cancelled";

interface SubTask {
  id: string;
  role: AgentRole;
  title: string;
  prompt: string;
  scope: string[];
  skills: string[];
  deps: string[];       // sub-task IDs
  retryCount: number;
  maxRetries: number;
  status: SubTaskStatus;
  agentProcessId?: string;
  output?: string;
  error?: string;
}

interface OrchestrationPlan {
  id: string;
  taskDescription: string;
  projectId: string;
  projectPath: string;
  status: OrchestrationStatus;
  subTasks: SubTask[];
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  tokenEstimate: number;
  cacheHits: number;
}
```

## File Impact

### New files (~19):
- `data/presets/roles/*.json` (11 preset files)
- `packages/dashboard/src/lib/orchestrator/` (5 files)
- `packages/dashboard/src/app/api/orchestrate/` (5 route files)
- `packages/dashboard/src/app/api/agent/input/route.ts`
- `packages/dashboard/src/app/api/presets/route.ts`
- `packages/dashboard/src/lib/persistence.ts`
- `packages/dashboard/src/components/task-graph.tsx`
- `packages/dashboard/src/components/agent-workstation.tsx`
- `packages/dashboard/src/components/orchestration-bar.tsx`
- `packages/dashboard/src/components/orchestration-progress.tsx`
- `packages/dashboard/src/components/presets-panel.tsx`

### Modified files (~7):
- `packages/shared/src/types.ts` — new types
- `packages/shared/src/schemas.ts` — new Zod schemas
- `packages/shared/src/index.ts` — re-exports
- `packages/dashboard/src/lib/agent-executor.ts` — stdin support, claude mode
- `packages/dashboard/src/lib/api.ts` — new client functions
- `packages/dashboard/src/components/virtual-office.tsx` — new tabs, terminal input
- `packages/cli/src/commands/dispatch.ts` — --execute flag
