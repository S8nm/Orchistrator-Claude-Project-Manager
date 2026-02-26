# Orchestrator v2 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add interactive agent terminals, preset system, full disk persistence, orchestration engine, and upgraded Virtual Office UI.

**Architecture:** Hybrid agent runtime (child_process for shell + claude CLI for AI agents), bidirectional I/O via stdin pipe + SSE output, JSON-file persistence in `data/` directory, orchestration engine with DAG-based task decomposition and coordination loop.

**Tech Stack:** TypeScript, Next.js 14, Zod, Commander.js, Node child_process, SSE (EventSource), JSON file persistence.

---

## Task 1: Shared Types + Schemas

**Files:**
- Modify: `packages/shared/src/types.ts`
- Modify: `packages/shared/src/schemas.ts`
- Modify: `packages/shared/src/index.ts` (already re-exports, no change needed)

**Step 1: Add new types to types.ts**

Add after line 32 (after `ProjectStatus` interface):

```typescript
export type AgentRole =
  | "orchestrator" | "architect" | "backend" | "frontend"
  | "tester" | "reviewer" | "fullstack" | "devops"
  | "security" | "docs" | "refactorer";

export type AgentMode = "claude" | "shell";

export type SubTaskStatus = "pending" | "ready" | "running" | "done" | "failed";

export type OrchestrationStatus =
  | "decomposing" | "running" | "verifying"
  | "done" | "failed" | "cancelled";

export interface AgentPresetEntry {
  role: AgentRole;
  name: string;
  skills: string[];
  model?: string;
  cwd?: string;
  mode: AgentMode;
  autoPrompt?: string;
}

export interface AgentPreset {
  id: string;
  name: string;
  type: "role" | "team" | "custom";
  scope: "global" | string;
  agents: AgentPresetEntry[];
  tags: string[];
}

export interface PersistedAgent {
  id: string;
  pid: number | undefined;
  role: AgentRole;
  name: string;
  mode: AgentMode;
  command: string;
  cwd: string;
  skills: string[];
  status: "running" | "done" | "failed" | "killed" | "disconnected";
  exitCode: number | null;
  startedAt: number;
  endedAt: number | null;
  orchestrationId?: string;
  subTaskId?: string;
  projectId?: string;
}

export interface SubTask {
  id: string;
  role: AgentRole;
  title: string;
  prompt: string;
  scope: string[];
  skills: string[];
  deps: string[];
  retryCount: number;
  maxRetries: number;
  status: SubTaskStatus;
  agentProcessId?: string;
  output?: string;
  error?: string;
}

export interface OrchestrationPlan {
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

**Step 2: Add Zod schemas to schemas.ts**

Add after line 18 (after `RegistrySchema`):

```typescript
export const AgentRoleSchema = z.enum([
  "orchestrator", "architect", "backend", "frontend",
  "tester", "reviewer", "fullstack", "devops",
  "security", "docs", "refactorer",
]);

export const AgentModeSchema = z.enum(["claude", "shell"]);

export const AgentPresetEntrySchema = z.object({
  role: AgentRoleSchema,
  name: z.string().min(1),
  skills: z.array(z.string()).default([]),
  model: z.string().optional(),
  cwd: z.string().optional(),
  mode: AgentModeSchema.default("claude"),
  autoPrompt: z.string().optional(),
});

export const AgentPresetSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(["role", "team", "custom"]),
  scope: z.string().default("global"),
  agents: z.array(AgentPresetEntrySchema),
  tags: z.array(z.string()).default([]),
});

export const PersistedAgentSchema = z.object({
  id: z.string().min(1),
  pid: z.number().optional(),
  role: AgentRoleSchema,
  name: z.string().min(1),
  mode: AgentModeSchema,
  command: z.string(),
  cwd: z.string(),
  skills: z.array(z.string()).default([]),
  status: z.enum(["running", "done", "failed", "killed", "disconnected"]),
  exitCode: z.number().nullable(),
  startedAt: z.number(),
  endedAt: z.number().nullable(),
  orchestrationId: z.string().optional(),
  subTaskId: z.string().optional(),
  projectId: z.string().optional(),
});

export const SubTaskSchema = z.object({
  id: z.string().min(1),
  role: AgentRoleSchema,
  title: z.string().min(1),
  prompt: z.string(),
  scope: z.array(z.string()).default([]),
  skills: z.array(z.string()).default([]),
  deps: z.array(z.string()).default([]),
  retryCount: z.number().default(0),
  maxRetries: z.number().default(2),
  status: z.enum(["pending", "ready", "running", "done", "failed"]),
  agentProcessId: z.string().optional(),
  output: z.string().optional(),
  error: z.string().optional(),
});

export const OrchestrationPlanSchema = z.object({
  id: z.string().min(1),
  taskDescription: z.string().min(1),
  projectId: z.string(),
  projectPath: z.string(),
  status: z.enum(["decomposing", "running", "verifying", "done", "failed", "cancelled"]),
  subTasks: z.array(SubTaskSchema),
  createdAt: z.number(),
  startedAt: z.number().optional(),
  completedAt: z.number().optional(),
  tokenEstimate: z.number().default(0),
  cacheHits: z.number().default(0),
});
```

**Step 3: Verify types compile**

Run: `npx tsc --noEmit --project packages/shared/tsconfig.json`
Expected: no errors

**Step 4: Commit**

```bash
git add packages/shared/src/types.ts packages/shared/src/schemas.ts
git commit -m "feat: add shared types and schemas for agents, presets, orchestrations"
```

---

## Task 2: Persistence Layer

**Files:**
- Create: `packages/dashboard/src/lib/persistence.ts`

**Step 1: Create the persistence module**

```typescript
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, appendFileSync } from "fs";
import { join, resolve } from "path";
import type { PersistedAgent, AgentPreset, OrchestrationPlan } from "@orchestrator/shared";

const DATA_DIR = resolve(process.cwd(), "../../data");

const dirs = {
  agents: join(DATA_DIR, "agents"),
  orchestrations: join(DATA_DIR, "orchestrations"),
  logs: join(DATA_DIR, "logs"),
  presetsRoles: join(DATA_DIR, "presets", "roles"),
  presetsTeams: join(DATA_DIR, "presets", "teams"),
  presetsCustom: join(DATA_DIR, "presets", "custom"),
};

// Ensure all directories exist on first import
function ensureDirs() {
  for (const dir of Object.values(dirs)) {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }
}
ensureDirs();

// Debounce map for high-frequency writes
const writeTimers = new Map<string, NodeJS.Timeout>();

function debouncedWrite(filePath: string, data: string, delayMs = 1000) {
  const existing = writeTimers.get(filePath);
  if (existing) clearTimeout(existing);
  writeTimers.set(filePath, setTimeout(() => {
    writeFileSync(filePath, data, "utf-8");
    writeTimers.delete(filePath);
  }, delayMs));
}

function immediateWrite(filePath: string, data: string) {
  writeFileSync(filePath, data, "utf-8");
}

function readJson<T>(filePath: string): T | null {
  try {
    if (!existsSync(filePath)) return null;
    return JSON.parse(readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}

function listJsonFiles<T>(dir: string): T[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => readJson<T>(join(dir, f)))
    .filter((v): v is T => v !== null);
}

// --- Agents ---

export function saveAgent(agent: PersistedAgent): void {
  immediateWrite(join(dirs.agents, `${agent.id}.json`), JSON.stringify(agent, null, 2));
}

export function loadAgent(id: string): PersistedAgent | null {
  return readJson<PersistedAgent>(join(dirs.agents, `${id}.json`));
}

export function loadAllAgents(): PersistedAgent[] {
  return listJsonFiles<PersistedAgent>(dirs.agents);
}

export function deleteAgent(id: string): void {
  const p = join(dirs.agents, `${id}.json`);
  if (existsSync(p)) {
    const { unlinkSync } = require("fs");
    unlinkSync(p);
  }
}

// --- Logs ---

export function appendLog(agentId: string, line: string): void {
  const logPath = join(dirs.logs, `${agentId}.log`);
  appendFileSync(logPath, line + "\n", "utf-8");
}

export function readLog(agentId: string, tailLines = 100): string[] {
  const logPath = join(dirs.logs, `${agentId}.log`);
  if (!existsSync(logPath)) return [];
  const content = readFileSync(logPath, "utf-8");
  const lines = content.split("\n").filter(Boolean);
  return lines.slice(-tailLines);
}

// --- Presets ---

export function loadPresets(): AgentPreset[] {
  return [
    ...listJsonFiles<AgentPreset>(dirs.presetsRoles),
    ...listJsonFiles<AgentPreset>(dirs.presetsTeams),
    ...listJsonFiles<AgentPreset>(dirs.presetsCustom),
  ];
}

export function savePreset(preset: AgentPreset): void {
  const subDir = preset.type === "role" ? dirs.presetsRoles
    : preset.type === "team" ? dirs.presetsTeams
    : dirs.presetsCustom;
  immediateWrite(join(subDir, `${preset.id}.json`), JSON.stringify(preset, null, 2));
}

export function deletePreset(id: string): boolean {
  for (const dir of [dirs.presetsRoles, dirs.presetsTeams, dirs.presetsCustom]) {
    const p = join(dir, `${id}.json`);
    if (existsSync(p)) {
      const { unlinkSync } = require("fs");
      unlinkSync(p);
      return true;
    }
  }
  return false;
}

// --- Orchestrations ---

export function saveOrchestration(orch: OrchestrationPlan): void {
  debouncedWrite(
    join(dirs.orchestrations, `${orch.id}.json`),
    JSON.stringify(orch, null, 2),
  );
}

export function loadOrchestration(id: string): OrchestrationPlan | null {
  return readJson<OrchestrationPlan>(join(dirs.orchestrations, `${id}.json`));
}

export function loadAllOrchestrations(): OrchestrationPlan[] {
  return listJsonFiles<OrchestrationPlan>(dirs.orchestrations);
}
```

**Step 2: Verify it compiles**

Run: `npx tsc --noEmit --project packages/dashboard/tsconfig.json`
Expected: no errors

**Step 3: Commit**

```bash
git add packages/dashboard/src/lib/persistence.ts
git commit -m "feat: add JSON file persistence layer for agents, presets, orchestrations"
```

---

## Task 3: Extended Agent Executor (stdin + claude mode + persistence)

**Files:**
- Modify: `packages/dashboard/src/lib/agent-executor.ts`

**Step 1: Add stdin support and claude mode**

Replace the entire file content with:

```typescript
import { spawn, ChildProcess } from "child_process";
import { EventEmitter } from "events";
import { saveAgent, appendLog, loadAllAgents, deleteAgent as deletePersistedAgent } from "./persistence";
import type { AgentRole, AgentMode, PersistedAgent } from "@orchestrator/shared";

export interface AgentProcess {
  id: string;
  pid: number | undefined;
  command: string;
  cwd: string;
  status: "running" | "done" | "failed" | "killed" | "disconnected";
  exitCode: number | null;
  startedAt: number;
  endedAt: number | null;
  emitter: EventEmitter;
  process: ChildProcess;
  // New fields
  role: AgentRole;
  name: string;
  mode: AgentMode;
  skills: string[];
  orchestrationId?: string;
  subTaskId?: string;
  projectId?: string;
  output: string;
}

// Survive Next.js dev hot reloads by attaching to globalThis
const globalStore = globalThis as typeof globalThis & { __agentProcesses?: Map<string, AgentProcess> };
if (!globalStore.__agentProcesses) {
  globalStore.__agentProcesses = new Map();
}
const agents = globalStore.__agentProcesses;

export interface SpawnOpts {
  id: string;
  command: string;
  cwd: string;
  shell?: boolean;
  // New optional fields
  role?: AgentRole;
  name?: string;
  mode?: AgentMode;
  skills?: string[];
  orchestrationId?: string;
  subTaskId?: string;
  projectId?: string;
}

function persistAgent(agent: AgentProcess): void {
  const persisted: PersistedAgent = {
    id: agent.id,
    pid: agent.pid,
    role: agent.role,
    name: agent.name,
    mode: agent.mode,
    command: agent.command,
    cwd: agent.cwd,
    skills: agent.skills,
    status: agent.status,
    exitCode: agent.exitCode,
    startedAt: agent.startedAt,
    endedAt: agent.endedAt,
    orchestrationId: agent.orchestrationId,
    subTaskId: agent.subTaskId,
    projectId: agent.projectId,
  };
  saveAgent(persisted);
}

export function spawnAgent(opts: SpawnOpts): AgentProcess {
  const emitter = new EventEmitter();
  emitter.setMaxListeners(20);

  const child = spawn(opts.command, {
    cwd: opts.cwd,
    shell: opts.shell ?? true,
    stdio: ["pipe", "pipe", "pipe"],  // stdin writable
  });

  const agent: AgentProcess = {
    id: opts.id,
    pid: child.pid,
    command: opts.command,
    cwd: opts.cwd,
    status: "running",
    exitCode: null,
    startedAt: Date.now(),
    endedAt: null,
    emitter,
    process: child,
    role: opts.role ?? "fullstack",
    name: opts.name ?? opts.role ?? "Agent",
    mode: opts.mode ?? "shell",
    skills: opts.skills ?? [],
    orchestrationId: opts.orchestrationId,
    subTaskId: opts.subTaskId,
    projectId: opts.projectId,
    output: "",
  };

  child.stdout?.on("data", (chunk: Buffer) => {
    const text = chunk.toString();
    agent.output += text;
    appendLog(agent.id, text.trimEnd());
    emitter.emit("stdout", text);
  });

  child.stderr?.on("data", (chunk: Buffer) => {
    const text = chunk.toString();
    appendLog(agent.id, `[stderr] ${text.trimEnd()}`);
    emitter.emit("stderr", text);
  });

  child.on("close", (code) => {
    agent.exitCode = code;
    agent.status = code === 0 ? "done" : "failed";
    agent.endedAt = Date.now();
    persistAgent(agent);
    emitter.emit("exit", { code, status: agent.status });
  });

  child.on("error", (err) => {
    agent.status = "failed";
    agent.endedAt = Date.now();
    persistAgent(agent);
    emitter.emit("stderr", `Process error: ${err.message}\n`);
    emitter.emit("exit", { code: -1, status: "failed" });
  });

  agents.set(opts.id, agent);
  persistAgent(agent);
  return agent;
}

export function spawnClaudeAgent(opts: SpawnOpts & { prompt: string; model?: string }): AgentProcess {
  const model = opts.model ?? "sonnet";
  const command = `claude -p --dangerously-skip-permissions --output-format stream-json --model ${model}`;

  const agent = spawnAgent({
    ...opts,
    command,
    mode: "claude",
  });

  // Write prompt to stdin, then close it
  if (agent.process.stdin) {
    agent.process.stdin.write(opts.prompt);
    agent.process.stdin.end();
  }

  return agent;
}

export function spawnInteractiveClaude(opts: SpawnOpts): AgentProcess {
  const command = "claude --dangerously-skip-permissions";
  return spawnAgent({
    ...opts,
    command,
    mode: "claude",
  });
}

export function sendInput(id: string, input: string): boolean {
  const agent = agents.get(id);
  if (!agent || agent.status !== "running" || !agent.process.stdin?.writable) return false;
  agent.process.stdin.write(input + "\n");
  appendLog(agent.id, `[input] ${input}`);
  return true;
}

export function getAgent(id: string): AgentProcess | undefined {
  return agents.get(id);
}

export function killAgent(id: string): boolean {
  const agent = agents.get(id);
  if (!agent || agent.status !== "running") return false;
  agent.process.kill("SIGTERM");
  agent.status = "killed";
  agent.endedAt = Date.now();
  persistAgent(agent);
  agent.emitter.emit("exit", { code: null, status: "killed" });
  return true;
}

export function listAgents(): Omit<AgentProcess, "emitter" | "process">[] {
  return Array.from(agents.values()).map(({ emitter, process, ...rest }) => rest);
}

export function removeAgent(id: string): boolean {
  const agent = agents.get(id);
  if (agent && agent.status === "running") {
    agent.process.kill("SIGTERM");
  }
  deletePersistedAgent(id);
  return agents.delete(id);
}

// Reconnect to persisted agents on startup
export function reconnectAgents(): { reconnected: number; disconnected: number } {
  const persisted = loadAllAgents();
  let reconnected = 0;
  let disconnected = 0;

  for (const pa of persisted) {
    if (pa.status !== "running") continue;
    if (agents.has(pa.id)) continue; // Already tracked in memory

    // Check if PID is still alive
    let alive = false;
    if (pa.pid) {
      try {
        process.kill(pa.pid, 0); // Signal 0 = check existence
        alive = true;
      } catch {
        alive = false;
      }
    }

    if (!alive) {
      pa.status = "disconnected";
      pa.endedAt = Date.now();
      saveAgent(pa);
      disconnected++;
    } else {
      reconnected++;
      // Can't re-attach to the process stdout/stderr, mark as running but no stream
    }
  }

  return { reconnected, disconnected };
}
```

**Step 2: Verify it compiles**

Run: `npx tsc --noEmit --project packages/dashboard/tsconfig.json`
Expected: no errors

**Step 3: Commit**

```bash
git add packages/dashboard/src/lib/agent-executor.ts
git commit -m "feat: add stdin support, claude spawn modes, persistence to agent executor"
```

---

## Task 4: Agent Input API Route

**Files:**
- Create: `packages/dashboard/src/app/api/agent/input/route.ts`

**Step 1: Create the input endpoint**

```typescript
import { NextResponse } from "next/server";
import { sendInput } from "@/lib/agent-executor";

export async function POST(req: Request) {
  try {
    const { id, input } = await req.json();

    if (!id || typeof input !== "string") {
      return NextResponse.json({ error: "id and input required" }, { status: 400 });
    }

    const sent = sendInput(id, input);
    if (!sent) {
      return NextResponse.json({ error: "Agent not found or not running" }, { status: 404 });
    }

    return NextResponse.json({ success: true, id });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
```

**Step 2: Update spawn route to accept new fields**

Replace `packages/dashboard/src/app/api/agent/spawn/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { existsSync } from "fs";
import { spawnAgent, spawnClaudeAgent, spawnInteractiveClaude } from "@/lib/agent-executor";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { id, command, cwd, mode, role, name, skills, prompt, model, orchestrationId, subTaskId, projectId } = body;

    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    const workDir = cwd || process.cwd();
    if (cwd && !existsSync(cwd)) {
      return NextResponse.json({ error: `Path not found: ${cwd}` }, { status: 400 });
    }

    const baseOpts = { id, cwd: workDir, role, name, skills, orchestrationId, subTaskId, projectId };
    let agent;

    if (mode === "claude" && prompt) {
      // One-shot Claude agent with a prompt
      agent = spawnClaudeAgent({ ...baseOpts, command: "", prompt, model });
    } else if (mode === "claude") {
      // Interactive Claude session
      agent = spawnInteractiveClaude({ ...baseOpts, command: "" });
    } else {
      // Shell command
      if (!command) {
        return NextResponse.json({ error: "command required for shell mode" }, { status: 400 });
      }
      agent = spawnAgent({ ...baseOpts, command });
    }

    return NextResponse.json({
      success: true,
      id: agent.id,
      pid: agent.pid,
      status: agent.status,
      mode: agent.mode,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
```

**Step 3: Verify it compiles**

Run: `npx tsc --noEmit --project packages/dashboard/tsconfig.json`
Expected: no errors

**Step 4: Commit**

```bash
git add packages/dashboard/src/app/api/agent/input/route.ts packages/dashboard/src/app/api/agent/spawn/route.ts
git commit -m "feat: add agent input endpoint and multi-mode spawn (claude/shell)"
```

---

## Task 5: Presets API + Seed Data

**Files:**
- Create: `packages/dashboard/src/app/api/presets/route.ts`
- Create: `data/presets/roles/` (11 JSON files)
- Create: `data/presets/teams/jarvis-dev.json`

**Step 1: Create presets API route**

```typescript
import { NextResponse } from "next/server";
import { loadPresets, savePreset, deletePreset } from "@/lib/persistence";
import { AgentPresetSchema } from "@orchestrator/shared";

export const dynamic = "force-dynamic";

export async function GET() {
  const presets = loadPresets();
  return NextResponse.json({ presets });
}

export async function POST(req: Request) {
  try {
    const { action, preset, id } = await req.json();

    if (action === "delete") {
      if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
      const deleted = deletePreset(id);
      return NextResponse.json({ success: deleted });
    }

    if (action === "save") {
      const parsed = AgentPresetSchema.safeParse(preset);
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.message }, { status: 400 });
      }
      savePreset(parsed.data);
      return NextResponse.json({ success: true, preset: parsed.data });
    }

    return NextResponse.json({ error: "Unknown action. Use 'save' or 'delete'" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
```

**Step 2: Create seed script for role presets**

Create `packages/dashboard/src/lib/seed-presets.ts`:

```typescript
import { existsSync } from "fs";
import { join, resolve } from "path";
import { savePreset } from "./persistence";
import type { AgentPreset } from "@orchestrator/shared";

const ROLE_PRESETS: AgentPreset[] = [
  { id: "role-orchestrator", name: "Orchestrator", type: "role", scope: "global", tags: ["core"], agents: [
    { role: "orchestrator", name: "Orchestrator", skills: ["task-decomposition", "batching", "prompt-caching"], mode: "claude" },
  ]},
  { id: "role-architect", name: "Architect", type: "role", scope: "global", tags: ["design"], agents: [
    { role: "architect", name: "Architect", skills: ["analyze-codebase", "design-system", "define-interfaces"], mode: "claude" },
  ]},
  { id: "role-backend", name: "Backend Dev", type: "role", scope: "global", tags: ["backend"], agents: [
    { role: "backend", name: "Backend Dev", skills: ["api-design", "database-ops", "error-handling", "auth-patterns"], mode: "claude" },
  ]},
  { id: "role-frontend", name: "Frontend Dev", type: "role", scope: "global", tags: ["frontend"], agents: [
    { role: "frontend", name: "Frontend Dev", skills: ["react-best-practices", "css-patterns", "accessibility"], mode: "claude" },
  ]},
  { id: "role-tester", name: "Tester", type: "role", scope: "global", tags: ["quality"], agents: [
    { role: "tester", name: "Tester", skills: ["unit-testing", "integration-testing", "mocking"], mode: "claude" },
  ]},
  { id: "role-reviewer", name: "Reviewer", type: "role", scope: "global", tags: ["quality"], agents: [
    { role: "reviewer", name: "Reviewer", skills: ["code-review", "security-audit", "performance-check"], mode: "claude" },
  ]},
  { id: "role-fullstack", name: "Fullstack Dev", type: "role", scope: "global", tags: ["fullstack"], agents: [
    { role: "fullstack", name: "Fullstack Dev", skills: ["react-best-practices", "api-design", "error-handling"], mode: "claude" },
  ]},
  { id: "role-devops", name: "DevOps", type: "role", scope: "global", tags: ["infra"], agents: [
    { role: "devops", name: "DevOps", skills: ["ci-cd-patterns", "docker-best-practices", "env-management"], mode: "claude" },
  ]},
  { id: "role-security", name: "Security", type: "role", scope: "global", tags: ["security"], agents: [
    { role: "security", name: "Security Analyst", skills: ["security-audit", "input-validation", "dependency-check"], mode: "claude" },
  ]},
  { id: "role-docs", name: "Docs Writer", type: "role", scope: "global", tags: ["docs"], agents: [
    { role: "docs", name: "Docs Writer", skills: ["technical-writing", "api-documentation"], mode: "claude" },
  ]},
  { id: "role-refactorer", name: "Refactorer", type: "role", scope: "global", tags: ["refactor"], agents: [
    { role: "refactorer", name: "Refactorer", skills: ["refactoring-patterns", "code-quality"], mode: "claude" },
  ]},
];

const TEAM_PRESETS: AgentPreset[] = [
  { id: "team-jarvis-dev", name: "J.A.R.V.I.S. Dev Team", type: "team", scope: "jarvis", tags: ["jarvis", "fullstack"], agents: [
    { role: "backend", name: "JARVIS Backend", skills: ["api-design", "database-ops", "error-handling"], mode: "claude", cwd: "C:/Users/PC/!projects/JArvis" },
    { role: "frontend", name: "JARVIS Frontend", skills: ["react-best-practices", "css-patterns", "accessibility"], mode: "claude", cwd: "C:/Users/PC/!projects/JArvis" },
    { role: "tester", name: "JARVIS QA", skills: ["unit-testing", "integration-testing", "mocking"], mode: "claude", cwd: "C:/Users/PC/!projects/JArvis" },
  ]},
];

export function seedPresets(): void {
  for (const preset of [...ROLE_PRESETS, ...TEAM_PRESETS]) {
    const DATA_DIR = resolve(process.cwd(), "../../data");
    const subDir = preset.type === "role" ? "roles" : "teams";
    const filePath = join(DATA_DIR, "presets", subDir, `${preset.id}.json`);
    if (!existsSync(filePath)) {
      savePreset(preset);
    }
  }
}
```

**Step 3: Verify it compiles**

Run: `npx tsc --noEmit --project packages/dashboard/tsconfig.json`
Expected: no errors

**Step 4: Commit**

```bash
git add packages/dashboard/src/app/api/presets/route.ts packages/dashboard/src/lib/seed-presets.ts
git commit -m "feat: add presets API and seed data for 11 roles + JARVIS team"
```

---

## Task 6: Client API Functions

**Files:**
- Modify: `packages/dashboard/src/lib/api.ts`

**Step 1: Add new client functions**

Append after the existing `streamAgent` function (after line 81):

```typescript
export async function sendAgentInput(id: string, input: string) {
  const res = await fetch("/api/agent/input", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, input }),
  });
  return res.json();
}

export async function fetchPresets() {
  const res = await fetch("/api/presets");
  if (!res.ok) throw new Error("Failed to fetch presets");
  return res.json();
}

export async function savePresetApi(preset: any) {
  const res = await fetch("/api/presets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "save", preset }),
  });
  return res.json();
}

export async function deletePresetApi(id: string) {
  const res = await fetch("/api/presets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "delete", id }),
  });
  return res.json();
}

export async function startOrchestration(task: string, projectId: string) {
  const res = await fetch("/api/orchestrate/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ task, projectId }),
  });
  return res.json();
}

export async function getOrchestration(id: string) {
  const res = await fetch(`/api/orchestrate/${id}`);
  return res.json();
}

export async function cancelOrchestration(id: string) {
  const res = await fetch("/api/orchestrate/cancel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  });
  return res.json();
}

export async function listOrchestrations() {
  const res = await fetch("/api/orchestrate/list");
  return res.json();
}

export function streamOrchestration(
  id: string,
  onEvent: (event: { type: string; data: any }) => void,
  onError?: () => void,
): EventSource {
  const es = new EventSource(`/api/orchestrate/stream?id=${encodeURIComponent(id)}`);

  for (const eventType of ["task_started", "task_done", "task_failed", "plan_ready", "orchestration_done"]) {
    es.addEventListener(eventType, (e) => {
      onEvent({ type: eventType, data: JSON.parse(e.data) });
    });
  }

  es.onerror = () => {
    onError?.();
    es.close();
  };

  return es;
}
```

**Step 2: Fix double-JSON-parse bug at line 71**

Change the exit handler in `streamAgent` from:
```typescript
    const info = JSON.parse(JSON.parse(e.data));
```
to:
```typescript
    const raw = JSON.parse(e.data);
    const info = typeof raw === "string" ? JSON.parse(raw) : raw;
```

**Step 3: Verify**

Run: `npx tsc --noEmit --project packages/dashboard/tsconfig.json`
Expected: no errors

**Step 4: Commit**

```bash
git add packages/dashboard/src/lib/api.ts
git commit -m "feat: add client API functions for presets, orchestration, agent input"
```

---

## Task 7: Orchestration Engine

**Files:**
- Create: `packages/dashboard/src/lib/orchestrator/index.ts`
- Create: `packages/dashboard/src/lib/orchestrator/task-templates.ts`
- Create: `packages/dashboard/src/lib/orchestrator/plan-builder.ts`
- Create: `packages/dashboard/src/lib/orchestrator/prompt-builder.ts`
- Create: `packages/dashboard/src/lib/orchestrator/loop.ts`

**Step 1: Create task-templates.ts**

```typescript
import type { AgentRole, SubTask } from "@orchestrator/shared";

const uid = () => Math.random().toString(36).slice(2, 9);

interface TaskTemplate {
  id: string;
  match: string[];  // keywords to match
  subTasks: Array<{
    role: AgentRole;
    title: string;
    promptTemplate: string;
    scope: string[];
    skills: string[];
    deps: string[];  // references by index: "0", "1", etc.
  }>;
}

export const TASK_TEMPLATES: TaskTemplate[] = [
  {
    id: "feature",
    match: ["feature", "add", "implement", "create", "build", "new"],
    subTasks: [
      { role: "architect", title: "Design feature architecture", promptTemplate: "Analyze the codebase and design the architecture for: {{TASK}}. Output: file plan, interfaces, data flow. Do NOT write implementation code.", scope: ["src/"], skills: ["analyze-codebase", "design-system"], deps: [] },
      { role: "backend", title: "Implement backend", promptTemplate: "Implement the backend for: {{TASK}}.\n\nARCHITECT OUTPUT:\n{{DEP:0}}", scope: ["src/", "lib/", "api/"], skills: ["api-design", "error-handling"], deps: ["0"] },
      { role: "frontend", title: "Implement frontend", promptTemplate: "Implement the frontend for: {{TASK}}.\n\nARCHITECT OUTPUT:\n{{DEP:0}}", scope: ["components/", "pages/"], skills: ["react-best-practices"], deps: ["0"] },
      { role: "tester", title: "Write tests", promptTemplate: "Write tests for: {{TASK}}.\n\nBACKEND:\n{{DEP:1}}\n\nFRONTEND:\n{{DEP:2}}", scope: ["tests/", "__tests__/"], skills: ["unit-testing", "integration-testing"], deps: ["1", "2"] },
      { role: "reviewer", title: "Review implementation", promptTemplate: "Review all changes for: {{TASK}}. Check for bugs, security issues, missing error handling. Output: {severity, file, line, issue, fix}.", scope: ["src/"], skills: ["code-review", "security-audit"], deps: ["1", "2", "3"] },
    ],
  },
  {
    id: "bug",
    match: ["bug", "fix", "broken", "error", "crash", "issue", "debug"],
    subTasks: [
      { role: "architect", title: "Diagnose bug", promptTemplate: "Diagnose this bug: {{TASK}}. Find the root cause. Output: affected files, root cause, proposed fix.", scope: ["src/"], skills: ["analyze-codebase"], deps: [] },
      { role: "backend", title: "Fix bug", promptTemplate: "Fix this bug: {{TASK}}.\n\nDIAGNOSIS:\n{{DEP:0}}", scope: ["src/"], skills: ["error-handling"], deps: ["0"] },
      { role: "tester", title: "Add regression test", promptTemplate: "Write a regression test for: {{TASK}}.\n\nFIX:\n{{DEP:1}}", scope: ["tests/"], skills: ["unit-testing"], deps: ["1"] },
    ],
  },
  {
    id: "refactor",
    match: ["refactor", "clean", "restructure", "simplify", "optimize"],
    subTasks: [
      { role: "architect", title: "Analyze refactor targets", promptTemplate: "Analyze code for refactoring: {{TASK}}. Identify duplication, poor naming, complex control flow. Output: plan with before/after.", scope: ["src/"], skills: ["analyze-codebase"], deps: [] },
      { role: "refactorer", title: "Execute refactor", promptTemplate: "Refactor: {{TASK}}.\n\nPLAN:\n{{DEP:0}}\n\nAll existing tests MUST still pass.", scope: ["src/"], skills: ["refactoring-patterns", "code-quality"], deps: ["0"] },
      { role: "tester", title: "Verify tests pass", promptTemplate: "Run all tests and verify nothing broke from refactoring: {{TASK}}.", scope: ["tests/"], skills: ["unit-testing"], deps: ["1"] },
    ],
  },
  {
    id: "tests",
    match: ["test", "tests", "coverage", "spec"],
    subTasks: [
      { role: "architect", title: "Analyze test coverage", promptTemplate: "Analyze test coverage for: {{TASK}}. Identify untested paths, edge cases, error paths.", scope: ["src/", "tests/"], skills: ["analyze-codebase"], deps: [] },
      { role: "tester", title: "Write tests", promptTemplate: "Write comprehensive tests for: {{TASK}}.\n\nCOVERAGE ANALYSIS:\n{{DEP:0}}\n\nCover: happy path, edge cases, error cases. Use AAA pattern.", scope: ["tests/"], skills: ["unit-testing", "integration-testing", "mocking"], deps: ["0"] },
    ],
  },
  {
    id: "security",
    match: ["security", "audit", "vulnerability", "secure"],
    subTasks: [
      { role: "security", title: "Security audit", promptTemplate: "Full security audit: {{TASK}}. Check: injection, auth bypass, CSRF/XSS, insecure deps, secrets in code. Output: {severity, file, line, issue, fix}.", scope: ["src/"], skills: ["security-audit", "input-validation", "dependency-check"], deps: [] },
    ],
  },
  {
    id: "review",
    match: ["review", "check", "inspect"],
    subTasks: [
      { role: "reviewer", title: "Code review", promptTemplate: "Review recent changes: {{TASK}}. Output: {severity: CRITICAL|WARN|SUGGESTION, file, line, issue, fix}.", scope: ["src/"], skills: ["code-review", "security-audit", "performance-check"], deps: [] },
    ],
  },
  {
    id: "docs",
    match: ["docs", "documentation", "readme", "jsdoc", "docstring"],
    subTasks: [
      { role: "docs", title: "Generate documentation", promptTemplate: "Generate documentation for: {{TASK}}. Scan exports, add JSDoc/docstrings to public APIs, update README.", scope: ["docs/", "src/"], skills: ["technical-writing", "api-documentation"], deps: [] },
    ],
  },
  {
    id: "deploy",
    match: ["deploy", "build", "release", "ship", "ci"],
    subTasks: [
      { role: "devops", title: "Lint", promptTemplate: "Run linter and fix all issues. Command: npx eslint . --fix", scope: ["src/"], skills: ["ci-cd-patterns"], deps: [] },
      { role: "devops", title: "Type check", promptTemplate: "Run TypeScript type checker: npx tsc --noEmit. Fix all type errors.", scope: ["src/"], skills: ["ci-cd-patterns"], deps: ["0"] },
      { role: "tester", title: "Run tests", promptTemplate: "Run full test suite. Fix any failures.", scope: ["tests/"], skills: ["unit-testing"], deps: ["1"] },
      { role: "devops", title: "Build", promptTemplate: "Run production build. Fix any build errors.", scope: ["src/"], skills: ["ci-cd-patterns"], deps: ["2"] },
    ],
  },
];

export function matchTemplate(task: string): TaskTemplate | null {
  const words = task.toLowerCase().split(/\s+/);
  let bestMatch: TaskTemplate | null = null;
  let bestScore = 0;

  for (const template of TASK_TEMPLATES) {
    let score = 0;
    for (const keyword of template.match) {
      if (words.some((w) => w.includes(keyword))) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = template;
    }
  }

  return bestScore > 0 ? bestMatch : null;
}
```

**Step 2: Create plan-builder.ts**

```typescript
import type { OrchestrationPlan, SubTask } from "@orchestrator/shared";
import { matchTemplate } from "./task-templates";

const uid = () => Math.random().toString(36).slice(2, 9);

export function buildPlan(task: string, projectId: string, projectPath: string): OrchestrationPlan {
  const template = matchTemplate(task);
  const planId = `orch-${uid()}`;

  let subTasks: SubTask[];

  if (template) {
    // Map template sub-tasks to real sub-tasks with IDs
    const idMap = new Map<string, string>();
    subTasks = template.subTasks.map((t, idx) => {
      const taskId = `st-${uid()}`;
      idMap.set(String(idx), taskId);
      return {
        id: taskId,
        role: t.role,
        title: t.title,
        prompt: t.promptTemplate.replace("{{TASK}}", task),
        scope: t.scope,
        skills: t.skills,
        deps: [], // Will be resolved below
        retryCount: 0,
        maxRetries: 2,
        status: "pending" as const,
      };
    });

    // Resolve dependency references (index → real ID)
    template.subTasks.forEach((t, idx) => {
      subTasks[idx].deps = t.deps.map((depIdx) => idMap.get(depIdx) || depIdx);
    });

    // Mark tasks with no deps as "ready"
    for (const st of subTasks) {
      if (st.deps.length === 0) {
        st.status = "ready";
      }
    }
  } else {
    // Fallback: single fullstack agent
    subTasks = [{
      id: `st-${uid()}`,
      role: "fullstack",
      title: task,
      prompt: task,
      scope: ["src/"],
      skills: ["react-best-practices", "api-design", "error-handling"],
      deps: [],
      retryCount: 0,
      maxRetries: 2,
      status: "ready",
    }];
  }

  const tokenEstimate = subTasks.reduce((sum, t) => sum + Math.round(t.prompt.length * 0.35) + 700, 0);

  return {
    id: planId,
    taskDescription: task,
    projectId,
    projectPath,
    status: "decomposing",
    subTasks,
    createdAt: Date.now(),
    tokenEstimate,
    cacheHits: 0,
  };
}
```

**Step 3: Create prompt-builder.ts**

```typescript
import type { SubTask, OrchestrationPlan } from "@orchestrator/shared";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const ROLE_PROMPTS: Record<string, string> = {
  orchestrator: "ROLE: Orchestrator\nSKILLS: task-decomposition, batching, prompt-caching\nSCOPE: Coordinates all agents\nBAR: production-ready, efficient",
  architect: "ROLE: Architect\nSKILLS: analyze-codebase, design-system, define-interfaces\nSCOPE: READ-ONLY -> specs\nFORBIDDEN: writing implementation code\nBAR: clear interfaces, data flow diagrams",
  backend: "ROLE: Backend Dev\nSKILLS: api-design, error-handling, database-ops, auth-patterns\nSCOPE: src/ lib/ api/ db/\nBAR: production-ready, error-handled, match existing style",
  frontend: "ROLE: Frontend Dev\nSKILLS: react-best-practices, css-patterns, accessibility\nSCOPE: components/ pages/ styles/\nBAR: FC+hooks, useCallback for handlers, memo for lists",
  tester: "ROLE: Tester\nSKILLS: unit-testing, integration-testing, mocking\nSCOPE: tests/ __tests__/\nBAR: AAA pattern, mock externals, cover happy+error+edge",
  reviewer: "ROLE: Reviewer\nSKILLS: code-review, security-audit, performance-check\nSCOPE: READ-ONLY\nBAR: output {severity: CRITICAL|WARN|SUGGESTION, file, line, issue, fix}",
  fullstack: "ROLE: Fullstack Dev\nSKILLS: react-best-practices, api-design, error-handling\nSCOPE: all src/\nBAR: production-ready, consistent patterns",
  devops: "ROLE: DevOps\nSKILLS: ci-cd-patterns, env-management\nSCOPE: .github/ docker/ config/\nBAR: fail fast, test->lint->typecheck->build",
  security: "ROLE: Security Analyst\nSKILLS: security-audit, input-validation, dependency-check\nSCOPE: READ + advisory\nBAR: check injection, auth bypass, CSRF/XSS, insecure deps, secrets",
  docs: "ROLE: Docs Writer\nSKILLS: technical-writing, api-documentation\nSCOPE: docs/ *.md\nBAR: concise, accurate, public API coverage",
  refactorer: "ROLE: Refactorer\nSKILLS: refactoring-patterns, code-quality\nSCOPE: all src/ (no behavior change)\nBAR: all existing tests must pass",
};

function loadRepoContext(projectPath: string): string {
  const claudeMdPath = join(projectPath, "CLAUDE.md");
  if (existsSync(claudeMdPath)) {
    try {
      const content = readFileSync(claudeMdPath, "utf-8");
      // Extract REPO_CONTEXT section or use first 600 chars
      const repoCtxMatch = content.match(/```[\s\S]*?Structure:[\s\S]*?```/);
      if (repoCtxMatch) return repoCtxMatch[0];
      return content.slice(0, 600);
    } catch {
      return `Project at: ${projectPath}`;
    }
  }
  return `Project at: ${projectPath}`;
}

export function buildPrompt(subTask: SubTask, plan: OrchestrationPlan): string {
  const sections: string[] = [];

  // 1. REPO_CONTEXT (cached prefix — identical for all agents in this plan)
  sections.push(`REPO_CONTEXT:\n${loadRepoContext(plan.projectPath)}`);

  // 2. ROLE + SKILLS (cached per role type)
  sections.push(ROLE_PROMPTS[subTask.role] || ROLE_PROMPTS.fullstack);

  // 3. TASK (variable)
  sections.push(`TASK: ${subTask.prompt}`);

  // 4. Context from completed dependencies
  const depOutputs: string[] = [];
  for (const depId of subTask.deps) {
    const dep = plan.subTasks.find((t) => t.id === depId);
    if (dep?.output) {
      const truncated = dep.output.slice(-2000);
      depOutputs.push(`--- ${dep.title} (${dep.role}) ---\n${truncated}`);
    }
  }
  if (depOutputs.length > 0) {
    sections.push(`CONTEXT FROM PREVIOUS AGENTS:\n${depOutputs.join("\n\n")}`);
  }

  // 5. Retry context
  if (subTask.retryCount > 0 && subTask.error) {
    sections.push(`PREVIOUS ATTEMPT FAILED:\n${subTask.error.slice(-500)}\nFix the issue and try again.`);
  }

  return sections.join("\n\n");
}
```

**Step 4: Create loop.ts**

```typescript
import { EventEmitter } from "events";
import type { OrchestrationPlan, SubTask } from "@orchestrator/shared";
import { spawnClaudeAgent, getAgent } from "../agent-executor";
import { buildPrompt } from "./prompt-builder";
import { saveOrchestration } from "../persistence";

const uid = () => Math.random().toString(36).slice(2, 9);

// Global orchestration store (survives hot reload)
const globalStore = globalThis as typeof globalThis & { __orchestrations?: Map<string, OrchestratorLoop> };
if (!globalStore.__orchestrations) {
  globalStore.__orchestrations = new Map();
}

export function getOrchestratorLoop(id: string): OrchestratorLoop | undefined {
  return globalStore.__orchestrations!.get(id);
}

export function listOrchestratorLoops(): OrchestratorLoop[] {
  return Array.from(globalStore.__orchestrations!.values());
}

export class OrchestratorLoop {
  public plan: OrchestrationPlan;
  public emitter: EventEmitter;

  constructor(plan: OrchestrationPlan) {
    this.plan = plan;
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(20);
    globalStore.__orchestrations!.set(plan.id, this);
  }

  start(): void {
    this.plan.status = "running";
    this.plan.startedAt = Date.now();
    this.emitter.emit("plan_ready", { plan: this.plan });
    this.persist();
    this.advance();
  }

  cancel(): void {
    this.plan.status = "cancelled";
    this.plan.completedAt = Date.now();
    // Kill all running agents
    for (const st of this.plan.subTasks) {
      if (st.status === "running" && st.agentProcessId) {
        const agent = getAgent(st.agentProcessId);
        if (agent && agent.status === "running") {
          agent.process.kill("SIGTERM");
        }
        st.status = "failed";
        st.error = "Cancelled";
      }
    }
    this.persist();
    this.emitter.emit("orchestration_done", { status: "cancelled" });
  }

  private advance(): void {
    // Check if all tasks are done or failed
    const allDone = this.plan.subTasks.every((t) => t.status === "done" || t.status === "failed");
    if (allDone) {
      const anyFailed = this.plan.subTasks.some((t) => t.status === "failed");
      this.plan.status = anyFailed ? "failed" : "done";
      this.plan.completedAt = Date.now();
      this.persist();
      this.emitter.emit("orchestration_done", { status: this.plan.status });
      return;
    }

    // Find tasks that are ready (deps all done) and pending
    for (const st of this.plan.subTasks) {
      if (st.status !== "pending" && st.status !== "ready") continue;

      const depsReady = st.deps.every((depId) => {
        const dep = this.plan.subTasks.find((t) => t.id === depId);
        return dep?.status === "done";
      });

      // If a dep failed, this task fails too
      const depFailed = st.deps.some((depId) => {
        const dep = this.plan.subTasks.find((t) => t.id === depId);
        return dep?.status === "failed";
      });

      if (depFailed) {
        st.status = "failed";
        st.error = "Dependency failed";
        this.persist();
        this.emitter.emit("task_failed", { subTaskId: st.id, error: "Dependency failed" });
        continue;
      }

      if (depsReady) {
        this.spawnSubTask(st);
      }
    }
  }

  private spawnSubTask(st: SubTask): void {
    const prompt = buildPrompt(st, this.plan);
    const agentId = `agent-${uid()}`;

    st.status = "running";
    st.agentProcessId = agentId;
    this.persist();
    this.emitter.emit("task_started", { subTaskId: st.id, agentProcessId: agentId });

    const agent = spawnClaudeAgent({
      id: agentId,
      command: "",
      cwd: this.plan.projectPath,
      prompt,
      role: st.role,
      name: st.title,
      skills: st.skills,
      orchestrationId: this.plan.id,
      subTaskId: st.id,
    });

    agent.emitter.on("exit", (info: { code: number | null; status: string }) => {
      if (info.code === 0 || info.status === "done") {
        st.status = "done";
        st.output = agent.output;
        this.plan.cacheHits++;
        this.persist();
        this.emitter.emit("task_done", { subTaskId: st.id, output: agent.output.slice(-500) });
      } else {
        st.retryCount++;
        if (st.retryCount <= st.maxRetries) {
          // Retry with error context
          st.error = agent.output.slice(-500);
          st.status = "pending";
          st.agentProcessId = undefined;
          this.persist();
          this.advance(); // Try again
          return;
        }
        st.status = "failed";
        st.error = agent.output.slice(-500);
        this.persist();
        this.emitter.emit("task_failed", { subTaskId: st.id, error: st.error });
      }
      this.advance();
    });
  }

  private persist(): void {
    saveOrchestration(this.plan);
  }
}
```

**Step 5: Create index.ts**

```typescript
export { buildPlan } from "./plan-builder";
export { buildPrompt } from "./prompt-builder";
export { OrchestratorLoop, getOrchestratorLoop, listOrchestratorLoops } from "./loop";
export { matchTemplate, TASK_TEMPLATES } from "./task-templates";
```

**Step 6: Verify**

Run: `npx tsc --noEmit --project packages/dashboard/tsconfig.json`
Expected: no errors

**Step 7: Commit**

```bash
git add packages/dashboard/src/lib/orchestrator/
git commit -m "feat: add orchestration engine with task templates, plan builder, prompt builder, coordination loop"
```

---

## Task 8: Orchestration API Routes

**Files:**
- Create: `packages/dashboard/src/app/api/orchestrate/start/route.ts`
- Create: `packages/dashboard/src/app/api/orchestrate/list/route.ts`
- Create: `packages/dashboard/src/app/api/orchestrate/stream/route.ts`
- Create: `packages/dashboard/src/app/api/orchestrate/cancel/route.ts`
- Create: `packages/dashboard/src/app/api/orchestrate/[id]/route.ts`

**Step 1: Create start/route.ts**

```typescript
import { NextResponse } from "next/server";
import { buildPlan } from "@/lib/orchestrator";
import { OrchestratorLoop } from "@/lib/orchestrator";
import { readFileSync } from "fs";
import { resolve } from "path";

export async function POST(req: Request) {
  try {
    const { task, projectId } = await req.json();

    if (!task) {
      return NextResponse.json({ error: "task required" }, { status: 400 });
    }

    // Find project path from registry
    let projectPath = process.cwd();
    if (projectId) {
      try {
        const registryPath = resolve(process.cwd(), "../../projects.json");
        const registry = JSON.parse(readFileSync(registryPath, "utf-8"));
        const project = registry.projects?.find((p: any) => p.id === projectId);
        if (project?.path) projectPath = project.path;
      } catch {}
    }

    const plan = buildPlan(task, projectId || "default", projectPath);
    const loop = new OrchestratorLoop(plan);
    loop.start();

    return NextResponse.json({
      success: true,
      orchestration: plan,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
```

**Step 2: Create [id]/route.ts**

```typescript
import { NextResponse } from "next/server";
import { getOrchestratorLoop } from "@/lib/orchestrator";
import { loadOrchestration } from "@/lib/persistence";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const loop = getOrchestratorLoop(params.id);
  if (loop) {
    return NextResponse.json({ orchestration: loop.plan });
  }

  // Fallback to disk
  const orch = loadOrchestration(params.id);
  if (orch) {
    return NextResponse.json({ orchestration: orch });
  }

  return NextResponse.json({ error: "Orchestration not found" }, { status: 404 });
}
```

**Step 3: Create stream/route.ts**

```typescript
import { getOrchestratorLoop } from "@/lib/orchestrator";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");

  if (!id) {
    return new Response("Missing id parameter", { status: 400 });
  }

  const loop = getOrchestratorLoop(id);
  if (!loop) {
    return new Response("Orchestration not found", { status: 404 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: any) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      // Send current state
      send("plan_ready", { plan: loop.plan });

      const onTaskStarted = (data: any) => send("task_started", data);
      const onTaskDone = (data: any) => send("task_done", data);
      const onTaskFailed = (data: any) => send("task_failed", data);
      const onDone = (data: any) => {
        send("orchestration_done", data);
        cleanup();
        controller.close();
      };

      loop.emitter.on("task_started", onTaskStarted);
      loop.emitter.on("task_done", onTaskDone);
      loop.emitter.on("task_failed", onTaskFailed);
      loop.emitter.on("orchestration_done", onDone);

      const cleanup = () => {
        loop.emitter.off("task_started", onTaskStarted);
        loop.emitter.off("task_done", onTaskDone);
        loop.emitter.off("task_failed", onTaskFailed);
        loop.emitter.off("orchestration_done", onDone);
      };

      req.signal.addEventListener("abort", () => {
        cleanup();
        try { controller.close(); } catch {}
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
```

**Step 4: Create cancel/route.ts**

```typescript
import { NextResponse } from "next/server";
import { getOrchestratorLoop } from "@/lib/orchestrator";

export async function POST(req: Request) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const loop = getOrchestratorLoop(id);
    if (!loop) return NextResponse.json({ error: "Orchestration not found" }, { status: 404 });

    loop.cancel();
    return NextResponse.json({ success: true, status: "cancelled" });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
```

**Step 5: Create list/route.ts**

```typescript
import { NextResponse } from "next/server";
import { listOrchestratorLoops } from "@/lib/orchestrator";
import { loadAllOrchestrations } from "@/lib/persistence";

export const dynamic = "force-dynamic";

export async function GET() {
  // Combine in-memory active and disk-persisted
  const active = listOrchestratorLoops().map((l) => l.plan);
  const persisted = loadAllOrchestrations();

  // Merge: active wins over persisted for same ID
  const activeIds = new Set(active.map((a) => a.id));
  const merged = [...active, ...persisted.filter((p) => !activeIds.has(p.id))];

  return NextResponse.json({ orchestrations: merged });
}
```

**Step 6: Verify**

Run: `npx tsc --noEmit --project packages/dashboard/tsconfig.json`
Expected: no errors

**Step 7: Commit**

```bash
git add packages/dashboard/src/app/api/orchestrate/
git commit -m "feat: add orchestration API routes (start, get, stream, cancel, list)"
```

---

## Task 9: Presets Panel Component

**Files:**
- Create: `packages/dashboard/src/components/presets-panel.tsx`

**Step 1: Create the presets panel**

```typescript
"use client";

import { useState, useEffect, useCallback } from "react";
import { fetchPresets, savePresetApi, deletePresetApi } from "@/lib/api";

const uid = () => Math.random().toString(36).slice(2, 9);

const ROLE_ICONS: Record<string, string> = {
  orchestrator: "\u{1F9E0}", architect: "\u{1F3D7}\uFE0F", backend: "\u2699\uFE0F",
  frontend: "\u{1F3A8}", tester: "\u{1F9EA}", reviewer: "\u{1F50D}",
  fullstack: "\u{1F527}", devops: "\u{1F680}", security: "\u{1F6E1}\uFE0F",
  docs: "\u{1F4DD}", refactorer: "\u267B\uFE0F",
};

const ROLE_COLORS: Record<string, string> = {
  orchestrator: "#a855f7", architect: "#8b5cf6", backend: "#3b82f6",
  frontend: "#ec4899", tester: "#10b981", reviewer: "#f59e0b",
  fullstack: "#6366f1", devops: "#14b8a6", security: "#ef4444",
  docs: "#8b5cf6", refactorer: "#06b6d4",
};

interface PresetsProps {
  onSpawn: (preset: any) => void;
  styles: Record<string, any>;
}

export default function PresetsPanel({ onSpawn, styles }: PresetsProps) {
  const [presets, setPresets] = useState<any[]>([]);
  const [filter, setFilter] = useState<"all" | "role" | "team" | "custom">("all");
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", type: "custom" as const, scope: "global", agents: [] as any[], tags: "" });

  const S = styles;
  const dark = "#080810", panel = "#0d0d1a", card = "#111122", border = "#1a1a33";

  useEffect(() => {
    fetchPresets().then((r) => setPresets(r.presets || [])).catch(() => {});
  }, []);

  const filtered = filter === "all" ? presets : presets.filter((p) => p.type === filter);

  const handleDelete = async (id: string) => {
    await deletePresetApi(id);
    setPresets((p) => p.filter((pr) => pr.id !== id));
  };

  const handleCreate = async () => {
    const preset = {
      id: `custom-${uid()}`,
      name: form.name,
      type: form.type,
      scope: form.scope,
      agents: form.agents,
      tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
    };
    const result = await savePresetApi(preset);
    if (result.success) {
      setPresets((p) => [...p, result.preset || preset]);
      setCreating(false);
      setForm({ name: "", type: "custom", scope: "global", agents: [], tags: "" });
    }
  };

  return (
    <div style={{ padding: "16px 20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#94a3b8" }}>{"\u{1F3AD}"} Agent Presets</div>
        <button style={{ padding: "7px 14px", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, background: "#6366f1", color: "#fff" }} onClick={() => setCreating(true)}>+ New Preset</button>
      </div>

      <div style={{ display: "flex", gap: 4, marginBottom: 14, flexWrap: "wrap" }}>
        {(["all", "role", "team", "custom"] as const).map((f) => (
          <button key={f} style={{ padding: "4px 12px", borderRadius: 6, border: filter === f ? "1px solid #6366f1" : `1px solid ${border}`, background: filter === f ? "#6366f120" : "transparent", color: filter === f ? "#a5b4fc" : "#64748b", cursor: "pointer", fontSize: 11, fontWeight: 500 }} onClick={() => setFilter(f)}>
            {f === "all" ? "All" : f[0].toUpperCase() + f.slice(1)}s ({f === "all" ? presets.length : presets.filter((p) => p.type === f).length})
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, padding: 24, textAlign: "center", color: "#374151", fontSize: 12 }}>
          No presets found. {filter !== "all" && "Try a different filter or "}Create a new one!
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 10 }}>
          {filtered.map((preset) => (
            <div key={preset.id} style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, overflow: "hidden" }}>
              <div style={{ padding: "12px 14px", borderBottom: `1px solid ${border}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: "#e2e8f0" }}>{preset.name}</div>
                    <div style={{ fontSize: 10, color: "#475569", marginTop: 2 }}>
                      {preset.type} {preset.scope !== "global" && `\u2022 ${preset.scope}`} \u2022 {preset.agents.length} agent{preset.agents.length !== 1 ? "s" : ""}
                    </div>
                  </div>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 12, fontSize: 10, fontWeight: 600, background: preset.type === "role" ? "#6366f118" : preset.type === "team" ? "#10b98118" : "#f59e0b18", color: preset.type === "role" ? "#6366f1" : preset.type === "team" ? "#10b981" : "#f59e0b" }}>
                    {preset.type}
                  </div>
                </div>
              </div>

              <div style={{ padding: "10px 14px" }}>
                {preset.agents.map((a: any, i: number) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
                    <span style={{ fontSize: 16 }}>{ROLE_ICONS[a.role] || "\u{1F527}"}</span>
                    <span style={{ fontSize: 12, color: ROLE_COLORS[a.role] || "#6366f1", fontWeight: 600 }}>{a.name}</span>
                    <span style={{ fontSize: 9, color: "#475569" }}>{a.mode}</span>
                  </div>
                ))}
              </div>

              {preset.tags.length > 0 && (
                <div style={{ padding: "0 14px 8px", display: "flex", gap: 3, flexWrap: "wrap" }}>
                  {preset.tags.map((tag: string) => (
                    <span key={tag} style={{ padding: "1px 6px", borderRadius: 4, fontSize: 9, background: `${border}`, color: "#64748b" }}>{tag}</span>
                  ))}
                </div>
              )}

              <div style={{ padding: "8px 14px", borderTop: `1px solid ${border}`, display: "flex", gap: 6 }}>
                <button style={{ padding: "5px 12px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 600, background: "#6366f1", color: "#fff", flex: 1 }} onClick={() => onSpawn(preset)}>Spawn</button>
                {preset.type === "custom" && (
                  <button style={{ padding: "5px 12px", borderRadius: 6, border: `1px solid ${border}`, background: "transparent", color: "#ef4444", cursor: "pointer", fontSize: 11 }} onClick={() => handleDelete(preset.id)}>Delete</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {creating && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }} onClick={(e) => e.target === e.currentTarget && setCreating(false)}>
          <div style={{ background: card, border: `1px solid #252545`, borderRadius: 14, padding: 20, maxWidth: 520, width: "100%" }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>New Preset</div>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: "#64748b", marginBottom: 3 }}>Name</div>
              <input style={{ width: "100%", padding: "9px 11px", borderRadius: 7, border: `1px solid ${border}`, background: panel, color: "#e2e8f0", fontSize: 12, outline: "none", boxSizing: "border-box" }} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. My Custom Team" />
            </div>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: "#64748b", marginBottom: 3 }}>Tags (comma separated)</div>
              <input style={{ width: "100%", padding: "9px 11px", borderRadius: 7, border: `1px solid ${border}`, background: panel, color: "#e2e8f0", fontSize: 12, outline: "none", boxSizing: "border-box" }} value={form.tags} onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))} placeholder="e.g. fullstack, python" />
            </div>
            <div style={{ fontSize: 10, color: "#475569", marginBottom: 14 }}>Agents can be added after creation by saving running agents as presets.</div>
            <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
              <button style={{ padding: "3px 8px", borderRadius: 5, border: `1px solid ${border}`, background: "transparent", color: "#64748b", cursor: "pointer", fontSize: 11 }} onClick={() => setCreating(false)}>Cancel</button>
              <button style={{ padding: "7px 14px", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, background: "#6366f1", color: "#fff" }} onClick={handleCreate} disabled={!form.name.trim()}>Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Verify**

Run: `npx tsc --noEmit --project packages/dashboard/tsconfig.json`
Expected: no errors

**Step 3: Commit**

```bash
git add packages/dashboard/src/components/presets-panel.tsx
git commit -m "feat: add presets panel component with browse, spawn, create, delete"
```

---

## Task 10: Task Graph Component

**Files:**
- Create: `packages/dashboard/src/components/task-graph.tsx`

**Step 1: Create the DAG visualization**

```typescript
"use client";

import { useMemo } from "react";
import type { OrchestrationPlan, SubTask } from "@orchestrator/shared";

const ROLE_COLORS: Record<string, string> = {
  orchestrator: "#a855f7", architect: "#8b5cf6", backend: "#3b82f6",
  frontend: "#ec4899", tester: "#10b981", reviewer: "#f59e0b",
  fullstack: "#6366f1", devops: "#14b8a6", security: "#ef4444",
  docs: "#8b5cf6", refactorer: "#06b6d4",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "#374151", ready: "#6b7280", running: "#3b82f6",
  done: "#10b981", failed: "#ef4444",
};

const ROLE_ICONS: Record<string, string> = {
  orchestrator: "\u{1F9E0}", architect: "\u{1F3D7}\uFE0F", backend: "\u2699\uFE0F",
  frontend: "\u{1F3A8}", tester: "\u{1F9EA}", reviewer: "\u{1F50D}",
  fullstack: "\u{1F527}", devops: "\u{1F680}", security: "\u{1F6E1}\uFE0F",
  docs: "\u{1F4DD}", refactorer: "\u267B\uFE0F",
};

interface TaskGraphProps {
  plan: OrchestrationPlan | null;
}

export default function TaskGraph({ plan }: TaskGraphProps) {
  const border = "#1a1a33";
  const card = "#111122";

  // Compute layers (topological sort by dependency depth)
  const layers = useMemo(() => {
    if (!plan) return [];

    const taskMap = new Map(plan.subTasks.map((t) => [t.id, t]));
    const layerMap = new Map<string, number>();

    function getLayer(task: SubTask): number {
      if (layerMap.has(task.id)) return layerMap.get(task.id)!;
      if (task.deps.length === 0) {
        layerMap.set(task.id, 0);
        return 0;
      }
      const maxDep = Math.max(...task.deps.map((depId) => {
        const dep = taskMap.get(depId);
        return dep ? getLayer(dep) : 0;
      }));
      const layer = maxDep + 1;
      layerMap.set(task.id, layer);
      return layer;
    }

    plan.subTasks.forEach((t) => getLayer(t));

    const numLayers = Math.max(0, ...Array.from(layerMap.values())) + 1;
    const result: SubTask[][] = Array.from({ length: numLayers }, () => []);
    plan.subTasks.forEach((t) => {
      result[layerMap.get(t.id) || 0].push(t);
    });

    return result;
  }, [plan]);

  if (!plan) {
    return (
      <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, padding: 40, textAlign: "center", color: "#374151", fontSize: 12 }}>
        No active orchestration. Start one from the bar above.
      </div>
    );
  }

  const NODE_W = 180;
  const NODE_H = 70;
  const GAP_X = 40;
  const GAP_Y = 24;
  const PADDING = 20;

  const maxPerLayer = Math.max(...layers.map((l) => l.length), 1);
  const svgW = layers.length * (NODE_W + GAP_X) + PADDING * 2;
  const svgH = maxPerLayer * (NODE_H + GAP_Y) + PADDING * 2;

  // Compute positions
  const positions = new Map<string, { x: number; y: number }>();
  layers.forEach((layer, col) => {
    const offsetY = (maxPerLayer - layer.length) * (NODE_H + GAP_Y) / 2;
    layer.forEach((task, row) => {
      positions.set(task.id, {
        x: PADDING + col * (NODE_W + GAP_X),
        y: PADDING + offsetY + row * (NODE_H + GAP_Y),
      });
    });
  });

  return (
    <div style={{ overflowX: "auto", padding: "0 20px" }}>
      {/* Status bar */}
      <div style={{ display: "flex", gap: 12, marginBottom: 12, alignItems: "center" }}>
        <span style={{ fontSize: 11, color: "#64748b" }}>Status:</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: STATUS_COLORS[plan.status] || "#6b7280" }}>{plan.status}</span>
        <span style={{ fontSize: 11, color: "#374151" }}>|</span>
        <span style={{ fontSize: 11, color: "#64748b" }}>{plan.subTasks.filter((t) => t.status === "done").length}/{plan.subTasks.length} tasks done</span>
        <span style={{ fontSize: 11, color: "#374151" }}>|</span>
        <span style={{ fontSize: 11, color: "#64748b" }}>~{plan.tokenEstimate} tokens</span>
      </div>

      <svg width={svgW} height={svgH} style={{ background: "#08080f", borderRadius: 10, border: `1px solid ${border}` }}>
        {/* Draw dependency lines */}
        {plan.subTasks.map((task) =>
          task.deps.map((depId) => {
            const from = positions.get(depId);
            const to = positions.get(task.id);
            if (!from || !to) return null;
            const x1 = from.x + NODE_W;
            const y1 = from.y + NODE_H / 2;
            const x2 = to.x;
            const y2 = to.y + NODE_H / 2;
            const mx = (x1 + x2) / 2;
            const depTask = plan.subTasks.find((t) => t.id === depId);
            const color = depTask?.status === "done" ? "#10b98140" : "#1a1a33";
            return (
              <path
                key={`${depId}-${task.id}`}
                d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`}
                stroke={color}
                strokeWidth={2}
                fill="none"
              />
            );
          })
        )}

        {/* Draw task nodes */}
        {plan.subTasks.map((task) => {
          const pos = positions.get(task.id);
          if (!pos) return null;
          const roleColor = ROLE_COLORS[task.role] || "#6366f1";
          const statusColor = STATUS_COLORS[task.status] || "#374151";
          const isRunning = task.status === "running";

          return (
            <g key={task.id}>
              <rect
                x={pos.x}
                y={pos.y}
                width={NODE_W}
                height={NODE_H}
                rx={8}
                fill={card}
                stroke={isRunning ? roleColor : statusColor}
                strokeWidth={isRunning ? 2 : 1}
              />
              {/* Role icon + title */}
              <text x={pos.x + 10} y={pos.y + 20} fontSize={14} fill="#e2e8f0">
                {ROLE_ICONS[task.role] || "\u{1F527}"}
              </text>
              <text x={pos.x + 30} y={pos.y + 20} fontSize={11} fontWeight={600} fill="#e2e8f0">
                {task.title.slice(0, 18)}{task.title.length > 18 ? "..." : ""}
              </text>
              {/* Role label */}
              <text x={pos.x + 10} y={pos.y + 38} fontSize={9} fill={roleColor}>
                {task.role}
              </text>
              {/* Status */}
              <circle cx={pos.x + NODE_W - 16} cy={pos.y + 16} r={4} fill={statusColor}>
                {isRunning && <animate attributeName="opacity" values="1;0.3;1" dur="1.5s" repeatCount="indefinite" />}
              </circle>
              <text x={pos.x + 10} y={pos.y + 56} fontSize={9} fill="#475569">
                {task.status}{task.retryCount > 0 ? ` (retry ${task.retryCount})` : ""}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
```

**Step 2: Verify**

Run: `npx tsc --noEmit --project packages/dashboard/tsconfig.json`
Expected: no errors

**Step 3: Commit**

```bash
git add packages/dashboard/src/components/task-graph.tsx
git commit -m "feat: add task graph DAG visualization component"
```

---

## Task 11: Virtual Office Integration

**Files:**
- Modify: `packages/dashboard/src/components/virtual-office.tsx`

This is the biggest change — adding interactive terminal input, presets tab, orchestrate tab, and wiring everything together. The key modifications:

**Step 1: Add imports and new state**

At the top of the file (after existing imports, line 4), add:

```typescript
import PresetsPanel from "./presets-panel";
import TaskGraph from "./task-graph";
import { sendAgentInput, startOrchestration, streamOrchestration, listOrchestrations } from "@/lib/api";
```

After `const [loaded, setLoaded]` (line 119), add:

```typescript
const [inputValues, setInputValues] = useState<Record<string, string>>({});
const [orchestrations, setOrchestrations] = useState<any[]>([]);
const [activeOrch, setActiveOrch] = useState<string | null>(null);
const [orchTask, setOrchTask] = useState("");
const orchSources = useRef<Record<string, EventSource>>({});
```

**Step 2: Add terminal input handler**

After the `connectStream` function (around line 213), add:

```typescript
const handleSendInput = useCallback(async (agentId: string) => {
  const input = inputValues[agentId];
  if (!input?.trim()) return;
  const ts = new Date().toLocaleTimeString("en-US",{hour12:false,hour:"2-digit",minute:"2-digit",second:"2-digit"});
  setLogs(prev => {
    const arr = prev[agentId] || [];
    return {...prev, [agentId]: [...arr.slice(-48), {ts, msg: `> ${input}`}]};
  });
  setInputValues(prev => ({...prev, [agentId]: ""}));
  await sendAgentInput(agentId, input);
}, [inputValues]);

const handleSpawnPreset = useCallback(async (preset: any) => {
  for (const agentDef of preset.agents) {
    const agentId = uid();
    const a = {
      id: agentId,
      type: agentDef.role,
      name: agentDef.name,
      skills: agentDef.skills || [],
      status: agentDef.autoPrompt ? "running" : "idle",
      task: agentDef.autoPrompt || "",
      logs: [],
    };
    updateProj(p => { p.agents.push(a); return p; });
    if (agentDef.autoPrompt || agentDef.mode === "claude") {
      try {
        const body: any = {
          id: agentId,
          mode: agentDef.mode || "claude",
          role: agentDef.role,
          name: agentDef.name,
          skills: agentDef.skills,
          cwd: agentDef.cwd || ".",
        };
        if (agentDef.autoPrompt) body.prompt = agentDef.autoPrompt;
        if (agentDef.mode === "shell" && agentDef.autoPrompt) body.command = agentDef.autoPrompt;
        const res = await fetch("/api/agent/spawn", {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify(body),
        });
        const result = await res.json();
        if (result.success) connectStream(agentId);
      } catch {}
    }
  }
}, [updateProj, connectStream]);

const handleStartOrchestration = useCallback(async () => {
  if (!orchTask.trim()) return;
  const result = await startOrchestration(orchTask, proj.id);
  if (result.success && result.orchestration) {
    const orch = result.orchestration;
    setOrchestrations(prev => [orch, ...prev]);
    setActiveOrch(orch.id);
    setOrchTask("");
    // Connect SSE
    const es = streamOrchestration(orch.id, (event) => {
      setOrchestrations(prev => prev.map(o => {
        if (o.id !== orch.id) return o;
        const updated = {...o};
        if (event.type === "task_started" || event.type === "task_done" || event.type === "task_failed") {
          updated.subTasks = updated.subTasks.map((st: any) =>
            st.id === event.data.subTaskId ? {...st, status: event.type === "task_started" ? "running" : event.type === "task_done" ? "done" : "failed"} : st
          );
        }
        if (event.type === "orchestration_done") {
          updated.status = event.data.status;
        }
        return updated;
      }));
    });
    orchSources.current[orch.id] = es;
  }
}, [orchTask, proj.id]);
```

**Step 3: Add terminal input field to agent cards**

In the `renderOffice` function, inside the agent card (after the skills footer div at line ~457), add the input field. Replace the skills footer section (the last `<div>` before the closing `</div>` of each agent card):

Find this block (around line 457-459):
```tsx
<div style={{ padding:"8px 10px", borderTop:`1px solid ${border}`, display:"flex", flexWrap:"wrap", gap:3 }}>
  {a.skills.map(sk => <span key={sk} style={S.skill(true)}>{sk}</span>)}
</div>
```

Replace with:
```tsx
<div style={{ padding:"8px 10px", borderTop:`1px solid ${border}`, display:"flex", flexWrap:"wrap", gap:3 }}>
  {a.skills.map(sk => <span key={sk} style={S.skill(true)}>{sk}</span>)}
</div>
{a.status === "running" && (
  <div style={{ padding:"6px 10px", borderTop:`1px solid ${border}`, display:"flex", gap:4 }}>
    <input
      style={{...S.input, fontSize:11, padding:"5px 8px", fontFamily:"'SF Mono',Monaco,monospace"}}
      placeholder="Type a message or command..."
      value={inputValues[a.id] || ""}
      onChange={e => setInputValues(prev => ({...prev, [a.id]: e.target.value}))}
      onKeyDown={e => { if (e.key === "Enter") handleSendInput(a.id); }}
    />
    <button style={S.btnSm(t.color)} onClick={() => handleSendInput(a.id)}>{"\u21B5"}</button>
  </div>
)}
```

**Step 4: Add new tabs (Orchestrate + Presets)**

In the tabs array (around line 584), change:
```tsx
{[{id:"office",l:"\u{1F3E2} Office"},{id:"projects",l:"\u{1F4C2} Projects"},{id:"commands",l:"\u26A1 Commands"},{id:"skills",l:"\u{1F3AF} Skills"},{id:"export",l:"\u{1F4E6} Export"}].map(t=>(
```

To:
```tsx
{[{id:"office",l:"\u{1F3E2} Office"},{id:"orchestrate",l:"\u{1F504} Orchestrate"},{id:"presets",l:"\u{1F3AD} Presets"},{id:"projects",l:"\u{1F4C2} Projects"},{id:"commands",l:"\u26A1 Commands"},{id:"skills",l:"\u{1F3AF} Skills"},{id:"export",l:"\u{1F4E6} Export"}].map(t=>(
```

**Step 5: Add view renderers**

After line 594 (`{view==="export" && renderExport()}`), add:
```tsx
{view==="orchestrate" && (
  <div style={{ padding:"16px 20px" }}>
    <div style={{ display:"flex", gap:8, marginBottom:16 }}>
      <input style={{...S.input, flex:1}} placeholder="Describe the task to orchestrate..." value={orchTask} onChange={e=>setOrchTask(e.target.value)} onKeyDown={e=>{ if(e.key==="Enter") handleStartOrchestration(); }} />
      <button style={S.btn()} onClick={handleStartOrchestration}>Orchestrate</button>
    </div>
    <div style={{ display:"flex", gap:8, marginBottom:12, flexWrap:"wrap" }}>
      {PRESET_COMMANDS.slice(0,6).map(cmd=>(
        <button key={cmd.id} style={S.btnSm("#6366f1")} onClick={()=>setOrchTask(cmd.prompt)}>{cmd.label}</button>
      ))}
    </div>
    {orchestrations.length > 0 && (
      <div style={{ display:"flex", gap:4, marginBottom:12, flexWrap:"wrap" }}>
        {orchestrations.map(o=>(
          <button key={o.id} style={S.projTab(activeOrch===o.id)} onClick={()=>setActiveOrch(o.id)}>
            {o.taskDescription.slice(0,30)}{o.taskDescription.length>30?"...":""}
            <span style={{ marginLeft:4, fontSize:9, color: o.status==="done"?"#10b981":o.status==="failed"?"#ef4444":"#3b82f6" }}>{o.status}</span>
          </button>
        ))}
      </div>
    )}
    <TaskGraph plan={orchestrations.find(o=>o.id===activeOrch) || null} />
  </div>
)}
{view==="presets" && <PresetsPanel onSpawn={handleSpawnPreset} styles={S} />}
```

**Step 6: Verify**

Run: `npx tsc --noEmit --project packages/dashboard/tsconfig.json`
Expected: no errors

**Step 7: Commit**

```bash
git add packages/dashboard/src/components/virtual-office.tsx
git commit -m "feat: add interactive terminals, orchestrate tab, presets tab to Virtual Office"
```

---

## Task 12: Create data/ directory and .gitignore

**Files:**
- Create: `data/.gitignore`

**Step 1: Create data directory with gitignore**

```
# Persist presets (version controlled)
!presets/

# Ignore runtime data
agents/
orchestrations/
logs/
```

**Step 2: Commit**

```bash
git add data/.gitignore
git commit -m "feat: add data/ directory structure for persistence"
```

---

## Task 13: CLI Dispatch --execute Flag

**Files:**
- Modify: `packages/cli/src/commands/dispatch.ts`

**Step 1: Add --execute flag**

Replace the entire file:

```typescript
import { Command } from "commander";
import { Registry } from "../registry.js";
import { findRegistryPath } from "../utils.js";
import chalk from "chalk";

export function dispatchCommand(): Command {
  return new Command("dispatch")
    .description("Route a task to the right project")
    .argument("<task>", "Task description")
    .option("-x, --execute", "Execute via orchestration engine (requires dashboard running)")
    .action(async (task, opts) => {
      const registry = new Registry(findRegistryPath());
      const projects = registry.listProjects({ status: "active" });

      if (projects.length === 0) {
        console.log(chalk.yellow("No projects to dispatch to."));
        return;
      }

      const words = task.toLowerCase().split(/\s+/);
      const scored = projects.map((p) => {
        let score = 0;
        const searchable = [p.name, p.type, ...p.tags, ...p.stack].map((s) => s.toLowerCase());
        for (const word of words) {
          for (const term of searchable) {
            if (term.includes(word)) score++;
          }
        }
        return { project: p, score };
      });

      scored.sort((a, b) => b.score - a.score);
      const best = scored[0];

      if (best.score === 0) {
        console.log(chalk.yellow("No matching project found for this task."));
        console.log(chalk.gray("Registered projects:"));
        for (const p of projects) {
          console.log(chalk.gray(`  - ${p.name} (${p.tags.join(", ")})`));
        }
        return;
      }

      console.log(chalk.bold(`\nRouting: "${task}"`));
      console.log(chalk.green(`\u2192 ${best.project.name} (${best.project.id})`));
      console.log(chalk.gray(`  Path: ${best.project.path}`));
      console.log(chalk.gray(`  Score: ${best.score} keyword matches`));

      if (scored.length > 1 && scored[1].score > 0) {
        console.log(chalk.gray(`\n  Also possible:`));
        for (const s of scored.slice(1, 3).filter((s) => s.score > 0)) {
          console.log(chalk.gray(`  - ${s.project.name} (score: ${s.score})`));
        }
      }

      if (opts.execute) {
        console.log(chalk.blue(`\n\u26A1 Executing via orchestration engine...`));
        try {
          const res = await fetch("http://localhost:3000/api/orchestrate/start", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ task, projectId: best.project.id }),
          });
          const result = await res.json();
          if (result.success) {
            console.log(chalk.green(`\u2713 Orchestration started: ${result.orchestration.id}`));
            console.log(chalk.gray(`  Sub-tasks: ${result.orchestration.subTasks.length}`));
            console.log(chalk.gray(`  Est. tokens: ${result.orchestration.tokenEstimate}`));
            console.log(chalk.gray(`\n  View at: http://localhost:3000 (Orchestrate tab)`));
          } else {
            console.log(chalk.red(`\u2717 Failed: ${result.error}`));
          }
        } catch {
          console.log(chalk.red(`\u2717 Dashboard not running. Start it with: npm run dev:dashboard`));
        }
      }
    });
}
```

**Step 2: Verify**

Run: `npx tsc --noEmit --project packages/cli/tsconfig.json`
Expected: no errors

**Step 3: Commit**

```bash
git add packages/cli/src/commands/dispatch.ts
git commit -m "feat: add --execute flag to dispatch command for orchestration engine"
```

---

## Task 14: Build + Test Verification

**Step 1: Run type checker across all packages**

Run: `npm run build`
Expected: all packages build successfully

**Step 2: Run tests**

Run: `npm test`
Expected: existing tests still pass

**Step 3: Seed presets**

Run the dev server briefly to trigger preset seeding, or create a small script.

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: orchestrator v2 — interactive terminals, presets, persistence, orchestration engine"
```
