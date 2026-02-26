import { spawn, ChildProcess } from "child_process";
import { EventEmitter } from "events";

export interface AgentProcess {
  id: string;
  pid: number | undefined;
  command: string;
  cwd: string;
  status: "running" | "done" | "failed" | "killed";
  exitCode: number | null;
  startedAt: number;
  endedAt: number | null;
  emitter: EventEmitter;
  process: ChildProcess;
}

// Survive Next.js dev hot reloads by attaching to globalThis
const globalStore = globalThis as typeof globalThis & { __agentProcesses?: Map<string, AgentProcess> };
if (!globalStore.__agentProcesses) {
  globalStore.__agentProcesses = new Map();
}
const agents = globalStore.__agentProcesses;

export function spawnAgent(opts: {
  id: string;
  command: string;
  cwd: string;
  shell?: boolean;
}): AgentProcess {
  const emitter = new EventEmitter();
  emitter.setMaxListeners(20);

  const child = spawn(opts.command, {
    cwd: opts.cwd,
    shell: opts.shell ?? true,
    stdio: ["ignore", "pipe", "pipe"],
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
  };

  child.stdout?.on("data", (chunk: Buffer) => {
    emitter.emit("stdout", chunk.toString());
  });

  child.stderr?.on("data", (chunk: Buffer) => {
    emitter.emit("stderr", chunk.toString());
  });

  child.on("close", (code) => {
    agent.exitCode = code;
    agent.status = code === 0 ? "done" : "failed";
    agent.endedAt = Date.now();
    emitter.emit("exit", { code, status: agent.status });
  });

  child.on("error", (err) => {
    agent.status = "failed";
    agent.endedAt = Date.now();
    emitter.emit("stderr", `Process error: ${err.message}\n`);
    emitter.emit("exit", { code: -1, status: "failed" });
  });

  agents.set(opts.id, agent);
  return agent;
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
  return agents.delete(id);
}
