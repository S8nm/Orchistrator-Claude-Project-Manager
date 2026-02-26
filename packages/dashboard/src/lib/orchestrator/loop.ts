import { EventEmitter } from "events";
import type { OrchestrationPlan, SubTask } from "@orchestrator/shared";
import { spawnClaudeAgent, getAgent } from "../agent-executor";
import { buildPrompt } from "./prompt-builder";
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
    const allDone = this.plan.subTasks.every((t) => t.status === "done" || t.status === "failed");
    if (allDone) {
      const anyFailed = this.plan.subTasks.some((t) => t.status === "failed");
      this.plan.status = anyFailed ? "failed" : "done";
      this.plan.completedAt = Date.now();
      this.persist();
      this.emitter.emit("orchestration_done", { status: this.plan.status });
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
          st.error = agent.output.slice(-500);
          st.status = "pending";
          st.agentProcessId = undefined;
          this.persist();
          this.advance();
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
