import { z } from "zod";

export const ProjectSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  path: z.string().default(""),
  type: z.string().default("unknown"),
  stack: z.array(z.string()).default([]),
  remote: z.string().optional(),
  status: z.enum(["active", "archived", "paused"]).default("active"),
  tags: z.array(z.string()).default([]),
  commands: z.record(z.string()).default({}),
});

export const RegistrySchema = z.object({
  projects: z.array(ProjectSchema).default([]),
  locations: z.array(z.string()).default([]),
});

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
