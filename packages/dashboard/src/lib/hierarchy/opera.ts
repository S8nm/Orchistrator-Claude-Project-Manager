import { EventEmitter } from "events";
import { saveOperaRegistry, loadOperaRegistry } from "@/lib/persistence";
import type { MessageLogEntry, OperaRegistry, AgentRole } from "@orchestrator/shared";

const MAX_LOG_ENTRIES = 200;

function makeLogId(): string {
  return `log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export class OperaManager {
  public registry: OperaRegistry;
  public emitter = new EventEmitter();

  private constructor(reg: OperaRegistry) {
    this.registry = reg;
    this.emitter.setMaxListeners(50);
  }

  static getInstance(): OperaManager {
    const store = globalThis as typeof globalThis & { __opera?: OperaManager };
    if (!store.__opera) {
      const saved = loadOperaRegistry();
      const reg: OperaRegistry = saved ?? {
        status: "active",
        projectIds: [],
        activatedAt: Date.now(),
        messageLog: [],
      };
      store.__opera = new OperaManager(reg);
    }
    return store.__opera;
  }

  // --- Project management ---

  registerProject(projectId: string): void {
    if (!this.registry.projectIds.includes(projectId)) {
      this.registry.projectIds.push(projectId);
      this.log({
        source: "opera",
        role: "opera",
        type: "info",
        content: `Registered project: ${projectId}`,
      });
      this.save();
    }
  }

  unregisterProject(projectId: string): void {
    this.registry.projectIds = this.registry.projectIds.filter((id) => id !== projectId);
    this.log({
      source: "opera",
      role: "opera",
      type: "info",
      content: `Unregistered project: ${projectId}`,
    });
    this.save();
  }

  getRegisteredProjects(): string[] {
    return this.registry.projectIds;
  }

  // --- Status ---

  getStatus(): OperaRegistry {
    return { ...this.registry };
  }

  // --- Message log ---

  log(entry: Omit<MessageLogEntry, "id" | "timestamp">): void {
    const full: MessageLogEntry = {
      ...entry,
      id: makeLogId(),
      timestamp: Date.now(),
    };
    this.registry.messageLog.push(full);
    if (this.registry.messageLog.length > MAX_LOG_ENTRIES) {
      this.registry.messageLog = this.registry.messageLog.slice(-MAX_LOG_ENTRIES);
    }
    this.emitter.emit("event", { type: "opera_log", data: full });
  }

  getLog(limit = 50): MessageLogEntry[] {
    return this.registry.messageLog.slice(-limit);
  }

  // --- Task routing (pass-through for now) ---

  routeTask(task: string, projectId?: string): { projectId: string; task: string } {
    if (projectId) {
      this.log({
        source: "opera",
        role: "opera",
        type: "task",
        content: `Routing task to project ${projectId}: ${task.slice(0, 100)}`,
      });
      return { projectId, task };
    }
    // Future: analyze task and pick the best project
    throw new Error("Task routing without projectId not yet supported");
  }

  // --- Persistence ---

  private save(): void {
    saveOperaRegistry(this.registry);
  }
}
