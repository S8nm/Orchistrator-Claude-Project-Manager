import { spawn, ChildProcess } from "child_process";
import { EventEmitter } from "events";
import { saveAgent, appendLog, loadAllAgents, deleteAgent as deletePersistedAgent } from "./persistence";
import type { AgentRole, AgentMode, AgentTier, PersistedAgent } from "@orchestrator/shared";

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
  role: AgentRole;
  name: string;
  mode: AgentMode;
  skills: string[];
  orchestrationId?: string;
  subTaskId?: string;
  projectId?: string;
  output: string;
  tier?: AgentTier;
  parentId?: string | null;
  hierarchyNodeId?: string | null;
}

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
  role?: AgentRole;
  name?: string;
  mode?: AgentMode;
  skills?: string[];
  orchestrationId?: string;
  subTaskId?: string;
  projectId?: string;
  mcpConfig?: string;
  maxTurns?: number;
  tier?: AgentTier;
  parentId?: string;
  hierarchyNodeId?: string;
}

// Tool restrictions per role
const ROLE_TOOLS: Record<string, string[]> = {
  architect: ["Read", "Grep", "Glob", "WebSearch"],
  reviewer: ["Read", "Grep", "Glob"],
  security: ["Read", "Grep", "Glob", "Bash"],
  docs: ["Read", "Write", "Edit", "Grep", "Glob"],
  backend: ["Read", "Write", "Edit", "Bash", "Grep", "Glob"],
  frontend: ["Read", "Write", "Edit", "Bash", "Grep", "Glob"],
  tester: ["Read", "Write", "Edit", "Bash", "Grep", "Glob"],
  fullstack: ["Read", "Write", "Edit", "Bash", "Grep", "Glob"],
  devops: ["Read", "Write", "Edit", "Bash", "Grep", "Glob"],
  refactorer: ["Read", "Write", "Edit", "Bash", "Grep", "Glob"],
  orchestrator: ["Read", "Write", "Edit", "Bash", "Grep", "Glob", "Task"],
};

function toPersisted(agent: AgentProcess): PersistedAgent {
  return {
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
    tier: agent.tier,
    parentId: agent.parentId ?? undefined,
    hierarchyNodeId: agent.hierarchyNodeId ?? undefined,
  };
}

function wireProcess(child: ChildProcess, agent: AgentProcess): void {
  child.stdout?.on("data", (chunk: Buffer) => {
    const text = chunk.toString();
    agent.output += text;
    appendLog(agent.id, text.trimEnd());
    agent.emitter.emit("stdout", text);
  });

  child.stderr?.on("data", (chunk: Buffer) => {
    const text = chunk.toString();
    appendLog(agent.id, `[stderr] ${text.trimEnd()}`);
    agent.emitter.emit("stderr", text);
  });

  child.on("close", (code) => {
    agent.exitCode = code;
    agent.status = code === 0 ? "done" : "failed";
    agent.endedAt = Date.now();
    saveAgent(toPersisted(agent));
    agent.emitter.emit("exit", { code, status: agent.status });
  });

  child.on("error", (err) => {
    agent.status = "failed";
    agent.endedAt = Date.now();
    saveAgent(toPersisted(agent));
    agent.emitter.emit("stderr", `Process error: ${err.message}\n`);
    agent.emitter.emit("exit", { code: -1, status: "failed" });
  });
}

export function spawnAgent(opts: SpawnOpts): AgentProcess {
  const emitter = new EventEmitter();
  emitter.setMaxListeners(20);

  const child = spawn(opts.command, {
    cwd: opts.cwd,
    shell: opts.shell ?? true,
    stdio: ["pipe", "pipe", "pipe"],
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
    tier: opts.tier,
    parentId: opts.parentId ?? null,
    hierarchyNodeId: opts.hierarchyNodeId ?? null,
  };

  wireProcess(child, agent);
  agents.set(opts.id, agent);
  saveAgent(toPersisted(agent));
  return agent;
}

// One-shot Claude agent: sends prompt via -p flag, streams output, exits when done
export function spawnClaudeAgent(opts: SpawnOpts & { prompt: string; model?: string }): AgentProcess {
  const emitter = new EventEmitter();
  emitter.setMaxListeners(20);

  const model = opts.model ?? "sonnet";
  const role = opts.role ?? "fullstack";
  const tools = ROLE_TOOLS[role] ?? ROLE_TOOLS.fullstack;

  const args = [
    "-p", opts.prompt,
    "--output-format", "stream-json",
    "--verbose",
    "--model", model,
    "--tools", tools.join(","),
    "--dangerously-skip-permissions",
  ];
  if (opts.mcpConfig) args.push("--mcp-config", opts.mcpConfig);
  if (opts.maxTurns) args.push("--max-turns", String(opts.maxTurns));

  // CRITICAL: stdin="ignore" for -p mode to avoid deadlock
  const child = spawn("claude", args, {
    cwd: opts.cwd,
    shell: true,
    stdio: ["ignore", "pipe", "pipe"],
    env: (() => { const e = { ...process.env }; delete e.CLAUDECODE; return e; })(),
  });

  const command = `claude -p [${opts.prompt.slice(0, 50)}...] --model ${model}`;

  const agent: AgentProcess = {
    id: opts.id,
    pid: child.pid,
    command,
    cwd: opts.cwd,
    status: "running",
    exitCode: null,
    startedAt: Date.now(),
    endedAt: null,
    emitter,
    process: child,
    role,
    name: opts.name ?? role,
    mode: "claude",
    skills: opts.skills ?? [],
    orchestrationId: opts.orchestrationId,
    subTaskId: opts.subTaskId,
    projectId: opts.projectId,
    output: "",
    tier: opts.tier,
    parentId: opts.parentId ?? null,
    hierarchyNodeId: opts.hierarchyNodeId ?? null,
  };

  wireProcess(child, agent);
  agents.set(opts.id, agent);
  saveAgent(toPersisted(agent));
  return agent;
}

// Interactive Claude session: bidirectional via stream-json protocol
export function spawnInteractiveClaude(opts: SpawnOpts): AgentProcess {
  const emitter = new EventEmitter();
  emitter.setMaxListeners(20);

  const role = opts.role ?? "fullstack";
  const tools = ROLE_TOOLS[role] ?? ROLE_TOOLS.fullstack;

  const args = [
    "--input-format", "stream-json",
    "--output-format", "stream-json",
    "--verbose",
    "--tools", tools.join(","),
    "--dangerously-skip-permissions",
  ];
  if (opts.mcpConfig) args.push("--mcp-config", opts.mcpConfig);
  if (opts.maxTurns) args.push("--max-turns", String(opts.maxTurns));

  // Interactive mode: stdin MUST be "pipe" for bidirectional communication
  const child = spawn("claude", args, {
    cwd: opts.cwd,
    shell: true,
    stdio: ["pipe", "pipe", "pipe"],
    env: (() => { const e = { ...process.env }; delete e.CLAUDECODE; return e; })(),
  });

  const command = `claude --interactive --tools ${tools.join(",")}`;

  const agent: AgentProcess = {
    id: opts.id,
    pid: child.pid,
    command,
    cwd: opts.cwd,
    status: "running",
    exitCode: null,
    startedAt: Date.now(),
    endedAt: null,
    emitter,
    process: child,
    role,
    name: opts.name ?? role,
    mode: "claude",
    skills: opts.skills ?? [],
    orchestrationId: opts.orchestrationId,
    subTaskId: opts.subTaskId,
    projectId: opts.projectId,
    output: "",
    tier: opts.tier,
    parentId: opts.parentId ?? null,
    hierarchyNodeId: opts.hierarchyNodeId ?? null,
  };

  wireProcess(child, agent);
  agents.set(opts.id, agent);
  saveAgent(toPersisted(agent));
  return agent;
}

// Send input to a running agent's stdin
export function sendInput(id: string, input: string): boolean {
  const agent = agents.get(id);
  if (!agent || agent.status !== "running") return false;

  const stdin = agent.process.stdin;
  if (!stdin?.writable) return false;

  if (agent.mode === "claude") {
    // Stream-json protocol: send as JSON message
    const msg = JSON.stringify({
      type: "user",
      message: { role: "user", content: input },
    });
    stdin.write(msg + "\n");
  } else {
    // Shell mode: raw text
    stdin.write(input + "\n");
  }

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
  saveAgent(toPersisted(agent));
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

export function reconnectAgents(): { reconnected: number; disconnected: number } {
  const persisted = loadAllAgents();
  let reconnected = 0;
  let disconnected = 0;

  for (const pa of persisted) {
    if (pa.status !== "running") continue;
    if (agents.has(pa.id)) continue;

    let alive = false;
    if (pa.pid) {
      try {
        process.kill(pa.pid, 0);
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
    }
  }

  return { reconnected, disconnected };
}
