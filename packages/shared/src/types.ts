export interface Project {
  id: string;
  name: string;
  path: string;
  type: string;
  stack: string[];
  remote?: string;
  status: "active" | "archived" | "paused";
  tags: string[];
  commands: Record<string, string>;
}

export interface ProjectRegistry {
  projects: Project[];
  locations: string[];
}

export interface TaskDispatch {
  task: string;
  projectId?: string;
  tags?: string[];
}

export interface ProjectStatus {
  id: string;
  name: string;
  gitBranch?: string;
  gitDirty?: boolean;
  lastCommit?: string;
  lastCommitDate?: string;
  exists: boolean;
}

export type AgentRole =
  | "opera" | "orchestrator" | "architect" | "backend" | "frontend"
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
  tier?: AgentTier;
  parentId?: string;
  hierarchyNodeId?: string;
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

// --- Hierarchy Types ---

export interface MessageLogEntry {
  id: string;
  timestamp: number;
  source: "system" | "orchestrator" | "leader" | "employee" | "opera" | "user";
  role: AgentRole;
  type: "info" | "task" | "plan" | "result" | "error" | "context";
  content: string;
  metadata?: Record<string, unknown>;
}

export interface OperaRegistry {
  status: "active" | "inactive";
  projectIds: string[];
  activatedAt: number | null;
  messageLog: MessageLogEntry[];
}

export type AgentTier = "opera" | "orchestrator" | "leader" | "employee";

export type HierarchyStatus =
  | "cold" | "placeholder" | "spawning" | "idle" | "active"
  | "dormant" | "done" | "failed" | "shutdown";

export interface HierarchyNode {
  id: string;
  projectId: string;
  tier: AgentTier;
  role: AgentRole;
  status: HierarchyStatus;
  parentId: string | null;
  childIds: string[];
  processId: string | null;
  memoryPath: string | null;
  lastActiveAt: number | null;
  currentTaskId: string | null;
  tasksCompleted: number;
  tasksFailed: number;
  createdAt: number;
  messageLog: MessageLogEntry[];
}

export interface HierarchyRegistry {
  projectId: string;
  projectPath: string;
  projectName: string;
  orchestratorNodeId: string;
  leaders: Record<string, string>;
  status: "active" | "inactive";
  activatedAt: number | null;
  deactivatedAt: number | null;
  messageLog: MessageLogEntry[];
}

export interface AgentMemoryEntry {
  timestamp: number;
  taskId: string;
  taskTitle: string;
  status: "done" | "failed";
  filesModified: string[];
  keyDecisions: string[];
  outcome: string;
  employeeCount: number;
}

export interface AgentMemory {
  role: AgentRole;
  projectId: string;
  lastUpdated: number;
  recentActivity: AgentMemoryEntry[];
  domainKnowledge: string[];
  activeConcerns: string[];
  workingAgreements: string[];
}
