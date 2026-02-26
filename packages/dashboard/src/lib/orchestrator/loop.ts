import { EventEmitter } from "events";
import type { OrchestrationPlan, SubTask } from "@orchestrator/shared";
import { spawnClaudeAgent, getAgent } from "../agent-executor";
import { buildPrompt, findMcpConfig } from "./prompt-builder";
import { saveOrchestration } from "../persistence";

const uid = () => Math.random().toString(36).slice(2, 9);

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
  private watchdogTimer: ReturnType<typeof setInterval> | null = null;

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
    this.startWatchdog();
    this.advance();
  }

  cancel(): void {
    this.stopWatchdog();
    this.plan.status = "cancelled";
    this.plan.completedAt = Date.now();
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

  // -- Watchdog: detects stalled/dead agents every 60s --
  private startWatchdog(): void {
    this.stopWatchdog();
    this.watchdogTimer = setInterval(() => {
      this.checkForStalledTasks();
    }, 60000);
  }

  private stopWatchdog(): void {
    if (this.watchdogTimer) {
      clearInterval(this.watchdogTimer);
      this.watchdogTimer = null;
    }
  }

  private checkForStalledTasks(): void {
    for (const st of this.plan.subTasks) {
      if (st.status !== "running" || !st.agentProcessId) continue;

      const agent = getAgent(st.agentProcessId);
      if (!agent || agent.status !== "running") {
        // Agent died without emitting exit — recover
        st.retryCount++;
        if (st.retryCount <= st.maxRetries) {
          st.status = "pending";
          st.error = "Agent process died unexpectedly";
          st.agentProcessId = undefined;
          this.persist();
          this.emitter.emit("task_failed", { subTaskId: st.id, error: "Process died, retrying..." });
        } else {
          st.status = "failed";
          st.error = "Agent process died after max retries";
          this.persist();
          this.emitter.emit("task_failed", { subTaskId: st.id, error: st.error });
        }
      }
    }
    this.advance();
  }

  private advance(): void {
    const allDone = this.plan.subTasks.every((t) => t.status === "done" || t.status === "failed");
    if (allDone) {
      this.stopWatchdog();
      const anyFailed = this.plan.subTasks.some((t) => t.status === "failed");
      this.plan.status = anyFailed ? "failed" : "done";
      this.plan.completedAt = Date.now();
      this.persist();
      this.emitter.emit("orchestration_done", { status: this.plan.status });
      this.emitter.emit("orchestration_summary", {
        total: this.plan.subTasks.length,
        done: this.plan.subTasks.filter((t) => t.status === "done").length,
        failed: this.plan.subTasks.filter((t) => t.status === "failed").length,
        duration: (this.plan.completedAt || Date.now()) - (this.plan.startedAt || Date.now()),
      });
      return;
    }

    for (const st of this.plan.subTasks) {
      if (st.status !== "pending" && st.status !== "ready") continue;

      const depsReady = st.deps.every((depId) => {
        const dep = this.plan.subTasks.find((t) => t.id === depId);
        return dep?.status === "done";
      });

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
    const mcpConfig = findMcpConfig(this.plan.projectPath);

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
      mcpConfig,
      maxTurns: 25,
    });

    agent.emitter.on("exit", (info: { code: number | null; status: string }) => {
      if (info.code === 0 || info.status === "done") {
        st.status = "done";
        st.output = agent.output;
        this.plan.cacheHits++;
        this.persist();
        this.emitter.emit("task_done", { subTaskId: st.id, output: agent.output.slice(-500) });
        this.advance();
      } else {
        st.retryCount++;
        if (st.retryCount <= st.maxRetries) {
          // Exponential backoff: 1s, 2s, 4s, 8s, 16s, max 30s
          const backoffMs = Math.min(1000 * Math.pow(2, st.retryCount - 1), 30000);
          st.error = agent.output.slice(-500);
          this.persist();
          this.emitter.emit("task_failed", {
            subTaskId: st.id,
            error: `Retry ${st.retryCount}/${st.maxRetries} in ${backoffMs / 1000}s...`,
          });
          setTimeout(() => {
            st.status = "pending";
            st.agentProcessId = undefined;
            this.persist();
            this.advance();
          }, backoffMs);
          return;
        }
        st.status = "failed";
        st.error = agent.output.slice(-500);
        this.persist();
        this.emitter.emit("task_failed", { subTaskId: st.id, error: st.error });
        this.advance();
      }
    });
  }

  private persist(): void {
    saveOrchestration(this.plan);
  }
}
