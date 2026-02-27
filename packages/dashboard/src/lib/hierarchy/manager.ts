import { EventEmitter } from "events";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import {
  spawnClaudeAgent,
  spawnInteractiveClaude,
  sendInput,
  killAgent,
  getAgent,
  listAgents,
} from "../agent-executor";
import {
  saveHierarchyRegistry,
  loadHierarchyRegistry,
  loadAllHierarchyRegistries,
  saveHierarchyNode,
  loadAllHierarchyNodes,
} from "../persistence";
import {
  getOrCreateMemory,
  renderMemoryAsMarkdown,
  updateMemoryAfterTask,
  summarizeMemory,
  initializeMemory,
} from "./memory";
import { parseStructuredOutput } from "./output-parser";
import type { DispatchPlan } from "./output-parser";
import { findMcpConfig } from "../orchestrator/prompt-builder";
import type {
  AgentRole,
  HierarchyNode,
  HierarchyRegistry,
  AgentMemoryEntry,
} from "@orchestrator/shared";

// All non-orchestrator leader roles
const LEADER_ROLES: AgentRole[] = [
  "architect", "backend", "frontend", "tester", "reviewer",
  "fullstack", "devops", "security", "docs", "refactorer",
];

const ROLE_PROMPTS: Record<string, string> = {
  orchestrator: "ROLE: Orchestrator\nSKILLS: task-decomposition, coordination, dependency-resolution\nYou are the project orchestrator. You decompose tasks and coordinate team leaders.",
  architect: "ROLE: Architect Lead\nSKILLS: analyze-codebase, design-system, define-interfaces\nSCOPE: READ-ONLY → specs",
  backend: "ROLE: Backend Lead\nSKILLS: api-design, error-handling, database-ops\nSCOPE: src/ lib/ api/",
  frontend: "ROLE: Frontend Lead\nSKILLS: react-best-practices, css-patterns, accessibility\nSCOPE: components/ pages/ styles/",
  tester: "ROLE: Tester Lead\nSKILLS: unit-testing, integration-testing, mocking\nSCOPE: tests/ __tests__/",
  reviewer: "ROLE: Reviewer Lead\nSKILLS: code-review, security-audit, performance-check\nSCOPE: READ-ONLY",
  fullstack: "ROLE: Fullstack Lead\nSKILLS: full-stack development\nSCOPE: all src/",
  devops: "ROLE: DevOps Lead\nSKILLS: ci-cd-patterns, env-management\nSCOPE: .github/ docker/ config/",
  security: "ROLE: Security Lead\nSKILLS: security-audit, input-validation\nSCOPE: READ + advisory",
  docs: "ROLE: Docs Lead\nSKILLS: technical-writing, api-documentation\nSCOPE: docs/ *.md",
  refactorer: "ROLE: Refactorer Lead\nSKILLS: refactoring-patterns, code-quality\nSCOPE: all src/",
};

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function loadRepoContext(projectPath: string): string {
  const claudeMdPath = join(projectPath, "CLAUDE.md");
  let context = `Project at: ${projectPath}`;
  if (existsSync(claudeMdPath)) {
    try {
      const content = readFileSync(claudeMdPath, "utf-8");
      const repoCtxMatch = content.match(/```[\s\S]*?Structure:[\s\S]*?```/);
      context = repoCtxMatch ? repoCtxMatch[0] : content.slice(0, 1500);
    } catch { /* fallback */ }
  }
  return context;
}

interface PendingTask {
  taskId: string;
  description: string;
  resolve: (summary: string) => void;
  reject: (err: Error) => void;
}

export class HierarchyManager {
  readonly projectId: string;
  readonly projectPath: string;
  readonly projectName: string;
  readonly emitter = new EventEmitter();

  private registry: HierarchyRegistry;
  private nodes = new Map<string, HierarchyNode>();
  private orchestratorAgentId: string | null = null;
  private outputBuffer = "";
  private pendingTask: PendingTask | null = null;
  private activeLeaders = new Map<string, { role: AgentRole; taskId: string }>();

  constructor(projectId: string, projectPath: string, projectName: string) {
    this.projectId = projectId;
    this.projectPath = projectPath;
    this.projectName = projectName;
    this.emitter.setMaxListeners(30);

    // Build registry
    const orchNodeId = `orch-${projectId}`;
    const leaders: Record<string, string> = {};
    for (const role of LEADER_ROLES) {
      leaders[role] = `leader-${role}-${projectId}`;
    }

    this.registry = {
      projectId,
      projectPath,
      projectName,
      orchestratorNodeId: orchNodeId,
      leaders,
      status: "inactive",
      activatedAt: null,
      deactivatedAt: null,
    };
  }

  // --- Activation ---

  async activate(): Promise<void> {
    // Create orchestrator node
    const orchNode = this.createNode(
      this.registry.orchestratorNodeId,
      "orchestrator",
      "orchestrator",
      null,
    );
    orchNode.status = "spawning";
    this.saveNode(orchNode);

    // Create dormant leader nodes
    for (const role of LEADER_ROLES) {
      const nodeId = this.registry.leaders[role];
      const node = this.createNode(nodeId, "leader", role as AgentRole, this.registry.orchestratorNodeId);
      node.status = "dormant";
      this.saveNode(node);
      initializeMemory(this.projectId, role as AgentRole);
    }

    // Initialize orchestrator memory
    initializeMemory(this.projectId, "orchestrator");

    // Spawn interactive orchestrator process
    const mcpConfig = findMcpConfig(this.projectPath);
    const agent = spawnInteractiveClaude({
      id: `orch-proc-${this.projectId}-${uid()}`,
      command: "",
      cwd: this.projectPath,
      role: "orchestrator",
      name: `Orchestrator [${this.projectName}]`,
      mode: "claude",
      skills: ["task-decomposition", "coordination"],
      projectId: this.projectId,
      tier: "orchestrator",
      hierarchyNodeId: this.registry.orchestratorNodeId,
      mcpConfig,
    });

    this.orchestratorAgentId = agent.id;
    orchNode.processId = agent.id;
    orchNode.status = "idle";
    this.saveNode(orchNode);

    // Listen to orchestrator output
    agent.emitter.on("stdout", (text: string) => {
      this.outputBuffer += text;
      this.processOrchestratorOutput();
    });

    agent.emitter.on("exit", () => {
      const node = this.nodes.get(this.registry.orchestratorNodeId);
      if (node) {
        node.status = "shutdown";
        node.processId = null;
        this.saveNode(node);
      }
      this.orchestratorAgentId = null;
      this.emitter.emit("event", {
        type: "orchestrator_shutdown",
        data: { projectId: this.projectId },
      });
    });

    // Send initial context
    const repoContext = loadRepoContext(this.projectPath);
    const memory = getOrCreateMemory(this.projectId, "orchestrator");
    const memoryMd = renderMemoryAsMarkdown(memory);

    const initMessage = [
      `You are the ORCHESTRATOR for project "${this.projectName}".`,
      "",
      "REPO_CONTEXT:",
      repoContext,
      "",
      ROLE_PROMPTS.orchestrator,
      "",
      "YOUR MEMORY:",
      memoryMd,
      "",
      "INSTRUCTIONS:",
      "When you receive a task, decompose it and output a dispatch_plan JSON block:",
      "```json",
      '{ "type": "dispatch_plan", "taskId": "<id>", "subtasks": [',
      '  { "role": "<leader_role>", "title": "<short title>", "prompt": "<detailed task>", "deps": ["<other_subtask_role>"], "priority": 1 }',
      "] }",
      "```",
      "",
      "When all leaders report back, output:",
      "```json",
      '{ "type": "task_complete", "taskId": "<id>", "summary": "<what was accomplished>" }',
      "```",
      "",
      "Available leader roles: " + LEADER_ROLES.join(", "),
      "",
      'Reply "READY" to confirm you are initialized.',
    ].join("\n");

    sendInput(agent.id, initMessage);

    // Update registry
    this.registry.status = "active";
    this.registry.activatedAt = Date.now();
    saveHierarchyRegistry(this.registry);

    this.emitter.emit("event", {
      type: "orchestrator_spawned",
      data: { projectId: this.projectId, agentId: agent.id },
    });
  }

  // --- Deactivation ---

  deactivate(): void {
    // Kill orchestrator
    if (this.orchestratorAgentId) {
      killAgent(this.orchestratorAgentId);
      this.orchestratorAgentId = null;
    }

    // Kill any running leaders/employees
    for (const [, node] of this.nodes) {
      if (node.processId && (node.status === "active" || node.status === "spawning")) {
        killAgent(node.processId);
        node.status = node.tier === "leader" ? "dormant" : "done";
        node.processId = null;
        this.saveNode(node);
      }
    }

    // Update orchestrator node
    const orchNode = this.nodes.get(this.registry.orchestratorNodeId);
    if (orchNode) {
      orchNode.status = "cold";
      orchNode.processId = null;
      this.saveNode(orchNode);
    }

    this.registry.status = "inactive";
    this.registry.deactivatedAt = Date.now();
    saveHierarchyRegistry(this.registry);

    this.emitter.emit("event", {
      type: "orchestrator_shutdown",
      data: { projectId: this.projectId },
    });
  }

  // --- Task Dispatch ---

  async sendTask(task: string): Promise<string> {
    if (!this.orchestratorAgentId) {
      throw new Error("Orchestrator not active for project " + this.projectId);
    }

    const taskId = `task-${uid()}`;

    // Update orchestrator to active
    const orchNode = this.nodes.get(this.registry.orchestratorNodeId);
    if (orchNode) {
      orchNode.status = "active";
      orchNode.currentTaskId = taskId;
      this.saveNode(orchNode);
    }

    this.emitter.emit("event", {
      type: "task_received",
      data: { projectId: this.projectId, taskId, description: task },
    });

    // Clear output buffer for fresh parsing
    this.outputBuffer = "";

    // Send task to orchestrator
    const taskMessage = [
      `NEW TASK (id: ${taskId}):`,
      task,
      "",
      "Decompose this into subtasks for the appropriate team leaders.",
      "Output a dispatch_plan JSON block.",
    ].join("\n");

    sendInput(this.orchestratorAgentId, taskMessage);

    // Return promise that resolves when orchestration completes
    return new Promise((resolve, reject) => {
      this.pendingTask = { taskId, description: task, resolve, reject };
      // Timeout after 10 minutes
      setTimeout(() => {
        if (this.pendingTask?.taskId === taskId) {
          this.pendingTask = null;
          reject(new Error("Orchestration timed out after 10 minutes"));
        }
      }, 10 * 60 * 1000);
    });
  }

  // --- Process Orchestrator Output ---

  private processOrchestratorOutput(): void {
    const messages = parseStructuredOutput(this.outputBuffer);
    for (const msg of messages) {
      switch (msg.type) {
        case "dispatch_plan":
          this.handleDispatchPlan(msg);
          break;
        case "task_complete":
          this.handleTaskComplete(msg.taskId, msg.summary);
          break;
        case "spawn_employee":
          // Future: leaders can request employee spawns
          break;
      }
    }
  }

  private async handleDispatchPlan(plan: DispatchPlan): Promise<void> {
    this.emitter.emit("event", {
      type: "plan_received",
      data: { projectId: this.projectId, taskId: plan.taskId, subtasks: plan.subtasks.length },
    });

    // Sort by priority (lower = higher priority)
    const sorted = [...plan.subtasks].sort((a, b) => a.priority - b.priority);

    // Build dependency-aware execution batches
    const completed = new Set<string>();
    const roleToSubtask = new Map(sorted.map((s) => [s.role, s]));

    const executeBatch = async () => {
      const ready = sorted.filter(
        (s) => !completed.has(s.role) && s.deps.every((d) => completed.has(d)),
      );
      if (ready.length === 0) return;

      const promises = ready.map((subtask) => this.wakeLeader(
        subtask.role as AgentRole,
        plan.taskId,
        subtask.prompt,
        subtask.deps.map((d) => {
          const dep = roleToSubtask.get(d);
          return dep ? `[${dep.role}] ${dep.title}` : d;
        }),
      ));

      const results = await Promise.allSettled(promises);
      for (let i = 0; i < ready.length; i++) {
        completed.add(ready[i].role);
        if (results[i].status === "rejected") {
          console.error(`Leader ${ready[i].role} failed:`, (results[i] as PromiseRejectedResult).reason);
        }
      }

      // Continue with next batch if more subtasks remain
      if (completed.size < sorted.length) {
        await executeBatch();
      }
    };

    await executeBatch();

    // Notify orchestrator that all leaders completed
    if (this.orchestratorAgentId) {
      const reportLines = ["ALL LEADERS HAVE COMPLETED:"];
      for (const subtask of sorted) {
        const leaderNodeId = this.registry.leaders[subtask.role];
        const node = this.nodes.get(leaderNodeId);
        reportLines.push(`- ${subtask.role}: ${node?.status === "failed" ? "FAILED" : "DONE"}`);
      }
      reportLines.push("", "Output a task_complete JSON block with a summary.");
      sendInput(this.orchestratorAgentId, reportLines.join("\n"));
    }
  }

  private handleTaskComplete(taskId: string, summary: string): void {
    // Update orchestrator to idle
    const orchNode = this.nodes.get(this.registry.orchestratorNodeId);
    if (orchNode) {
      orchNode.status = "idle";
      orchNode.currentTaskId = null;
      orchNode.tasksCompleted++;
      this.saveNode(orchNode);
    }

    // Update orchestrator memory
    if (this.pendingTask) {
      updateMemoryAfterTask(this.projectId, "orchestrator", {
        timestamp: Date.now(),
        taskId,
        taskTitle: this.pendingTask.description.slice(0, 100),
        status: "done",
        filesModified: [],
        keyDecisions: [],
        outcome: summary,
        employeeCount: 0,
      });
    }

    this.emitter.emit("event", {
      type: "task_complete",
      data: { projectId: this.projectId, taskId, summary },
    });

    // Resolve pending promise
    if (this.pendingTask?.taskId === taskId) {
      this.pendingTask.resolve(summary);
      this.pendingTask = null;
    }
  }

  // --- Leader Management ---

  private wakeLeader(
    role: AgentRole,
    taskId: string,
    task: string,
    depsContext: string[],
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const nodeId = this.registry.leaders[role];
      const node = this.nodes.get(nodeId);
      if (!node) return reject(new Error(`No leader node for role ${role}`));

      node.status = "active";
      node.currentTaskId = taskId;
      this.saveNode(node);

      this.emitter.emit("event", {
        type: "leader_waking",
        data: { projectId: this.projectId, role, taskId },
      });

      // Build prompt with memory
      const memory = getOrCreateMemory(this.projectId, role);
      const memoryMd = renderMemoryAsMarkdown(
        summarizeMemory(memory, 1500),
      );
      const repoContext = loadRepoContext(this.projectPath);

      const prompt = [
        `REPO_CONTEXT:\n${repoContext}`,
        "",
        ROLE_PROMPTS[role] || ROLE_PROMPTS.fullstack,
        "",
        `YOUR MEMORY (from previous work on this project):\n${memoryMd}`,
        "",
        `TASK (id: ${taskId}):\n${task}`,
        ...(depsContext.length > 0
          ? ["", `COMPLETED DEPENDENCIES:\n${depsContext.join("\n")}`]
          : []),
      ].join("\n");

      const mcpConfig = findMcpConfig(this.projectPath);
      const agent = spawnClaudeAgent({
        id: `leader-${role}-${uid()}`,
        command: "",
        cwd: this.projectPath,
        role,
        name: `${role} Leader`,
        skills: [],
        projectId: this.projectId,
        tier: "leader",
        parentId: this.registry.orchestratorNodeId,
        hierarchyNodeId: nodeId,
        mcpConfig,
        maxTurns: 30,
        prompt,
        model: "sonnet",
      });

      node.processId = agent.id;
      this.saveNode(node);
      this.activeLeaders.set(agent.id, { role, taskId });

      this.emitter.emit("event", {
        type: "leader_active",
        data: { projectId: this.projectId, role, agentId: agent.id },
      });

      agent.emitter.on("exit", ({ code }: { code: number | null }) => {
        const output = agent.output;
        const succeeded = code === 0;

        // Update node
        node.status = "dormant";
        node.processId = null;
        node.currentTaskId = null;
        if (succeeded) node.tasksCompleted++;
        else node.tasksFailed++;
        node.lastActiveAt = Date.now();
        this.saveNode(node);

        // Update leader memory
        updateMemoryAfterTask(this.projectId, role, {
          timestamp: Date.now(),
          taskId,
          taskTitle: task.slice(0, 100),
          status: succeeded ? "done" : "failed",
          filesModified: extractFilePaths(output),
          keyDecisions: [],
          outcome: succeeded
            ? output.slice(-500)
            : `Failed with exit code ${code}`,
          employeeCount: 0,
        });

        this.activeLeaders.delete(agent.id);

        const eventType = succeeded ? "leader_done" : "leader_failed";
        this.emitter.emit("event", {
          type: eventType,
          data: {
            projectId: this.projectId,
            role,
            agentId: agent.id,
            summary: output.slice(-300),
          },
        });

        if (succeeded) {
          resolve(output.slice(-500));
        } else {
          reject(new Error(`Leader ${role} failed with code ${code}`));
        }
      });
    });
  }

  // --- Employee Management ---

  spawnEmployee(
    parentLeaderRole: AgentRole,
    task: string,
    employeeRole?: AgentRole,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const empId = `emp-${uid()}`;
      const role = employeeRole || parentLeaderRole;
      const parentNodeId = this.registry.leaders[parentLeaderRole];

      const node = this.createNode(empId, "employee", role, parentNodeId);
      node.status = "active";
      this.saveNode(node);

      // Add employee to parent's childIds
      const parentNode = this.nodes.get(parentNodeId);
      if (parentNode) {
        parentNode.childIds.push(empId);
        this.saveNode(parentNode);
      }

      const mcpConfig = findMcpConfig(this.projectPath);
      const repoContext = loadRepoContext(this.projectPath);

      const prompt = [
        `REPO_CONTEXT:\n${repoContext}`,
        "",
        `ROLE: ${role} Employee`,
        `TASK: ${task}`,
      ].join("\n");

      const agent = spawnClaudeAgent({
        id: `emp-proc-${uid()}`,
        command: "",
        cwd: this.projectPath,
        role,
        name: `${role} Employee`,
        skills: [],
        projectId: this.projectId,
        tier: "employee",
        parentId: parentNodeId,
        hierarchyNodeId: empId,
        mcpConfig,
        maxTurns: 15,
        prompt,
        model: "sonnet",
      });

      node.processId = agent.id;
      this.saveNode(node);

      this.emitter.emit("event", {
        type: "employee_spawned",
        data: { projectId: this.projectId, parentRole: parentLeaderRole, agentId: agent.id, task },
      });

      agent.emitter.on("exit", ({ code }: { code: number | null }) => {
        node.status = code === 0 ? "done" : "failed";
        node.processId = null;
        this.saveNode(node);

        this.emitter.emit("event", {
          type: "employee_done",
          data: { agentId: agent.id, summary: agent.output.slice(-300), status: node.status },
        });

        if (code === 0) resolve(agent.output.slice(-500));
        else reject(new Error(`Employee failed with code ${code}`));
      });
    });
  }

  // --- Queries ---

  getTree(): {
    registry: HierarchyRegistry;
    nodes: HierarchyNode[];
  } {
    return {
      registry: this.registry,
      nodes: Array.from(this.nodes.values()),
    };
  }

  getStatus(): {
    projectId: string;
    projectName: string;
    active: boolean;
    orchestratorStatus: string;
    activeLeaderCount: number;
    totalTasksCompleted: number;
  } {
    const orchNode = this.nodes.get(this.registry.orchestratorNodeId);
    let totalCompleted = 0;
    let activeLeaders = 0;
    for (const [, node] of this.nodes) {
      totalCompleted += node.tasksCompleted;
      if (node.tier === "leader" && node.status === "active") activeLeaders++;
    }
    return {
      projectId: this.projectId,
      projectName: this.projectName,
      active: this.registry.status === "active",
      orchestratorStatus: orchNode?.status || "cold",
      activeLeaderCount: activeLeaders,
      totalTasksCompleted: totalCompleted,
    };
  }

  // --- Helpers ---

  private createNode(
    id: string,
    tier: "orchestrator" | "leader" | "employee",
    role: AgentRole,
    parentId: string | null,
  ): HierarchyNode {
    const node: HierarchyNode = {
      id,
      projectId: this.projectId,
      tier,
      role,
      status: "cold",
      parentId,
      childIds: [],
      processId: null,
      memoryPath: `data/memory/${this.projectId}/${role}.json`,
      lastActiveAt: null,
      currentTaskId: null,
      tasksCompleted: 0,
      tasksFailed: 0,
      createdAt: Date.now(),
    };
    this.nodes.set(id, node);
    return node;
  }

  private saveNode(node: HierarchyNode): void {
    this.nodes.set(node.id, node);
    saveHierarchyNode(this.projectId, node);
  }
}

// --- Global Store ---

const globalStore = globalThis as typeof globalThis & {
  __hierarchies?: Map<string, HierarchyManager>;
};
if (!globalStore.__hierarchies) {
  globalStore.__hierarchies = new Map();
}
const hierarchies = globalStore.__hierarchies;

export function getOrCreateHierarchyManager(
  projectId: string,
  projectPath: string,
  projectName: string,
): HierarchyManager {
  let mgr = hierarchies.get(projectId);
  if (!mgr) {
    mgr = new HierarchyManager(projectId, projectPath, projectName);
    hierarchies.set(projectId, mgr);
  }
  return mgr;
}

export function getHierarchyManager(projectId: string): HierarchyManager | undefined {
  return hierarchies.get(projectId);
}

export function getAllHierarchyManagers(): HierarchyManager[] {
  return Array.from(hierarchies.values());
}

export function removeHierarchyManager(projectId: string): void {
  hierarchies.delete(projectId);
}

/** Reconnect hierarchies for active projects after server restart */
export async function reconnectHierarchies(): Promise<void> {
  const registries = loadAllHierarchyRegistries();
  for (const reg of registries) {
    if (reg.status === "active") {
      console.log(`[hierarchy] Reconnecting orchestrator for ${reg.projectName}...`);
      const mgr = getOrCreateHierarchyManager(reg.projectId, reg.projectPath, reg.projectName);
      try {
        await mgr.activate();
      } catch (err) {
        console.error(`[hierarchy] Failed to reconnect ${reg.projectId}:`, err);
      }
    }
  }
}

// --- Utilities ---

function extractFilePaths(output: string): string[] {
  const paths: string[] = [];
  const pattern = /(?:created?|modified?|updated?|wrote|edited)\s+[`"]?([a-zA-Z0-9_\-./\\]+\.[a-zA-Z]+)[`"]?/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(output)) !== null) {
    if (match[1] && !paths.includes(match[1])) {
      paths.push(match[1]);
    }
  }
  return paths.slice(0, 20); // Cap at 20
}
