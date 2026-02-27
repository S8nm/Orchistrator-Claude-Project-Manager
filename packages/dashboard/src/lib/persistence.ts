import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  readdirSync,
  appendFileSync,
  unlinkSync,
} from "fs";
import { join, resolve } from "path";
import type {
  PersistedAgent,
  AgentPreset,
  OrchestrationPlan,
  AgentMemory,
  HierarchyRegistry,
  HierarchyNode,
  OperaRegistry,
} from "@orchestrator/shared";

// data/ dir lives at project root, dashboard runs from packages/dashboard/
const DATA_DIR = resolve(process.cwd(), "../../data");

const dirs = {
  agents: join(DATA_DIR, "agents"),
  orchestrations: join(DATA_DIR, "orchestrations"),
  logs: join(DATA_DIR, "logs"),
  presetsRoles: join(DATA_DIR, "presets", "roles"),
  presetsTeams: join(DATA_DIR, "presets", "teams"),
  presetsCustom: join(DATA_DIR, "presets", "custom"),
  memory: join(DATA_DIR, "memory"),
  hierarchy: join(DATA_DIR, "hierarchy"),
};

function ensureDirs() {
  for (const dir of Object.values(dirs)) {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }
}
ensureDirs();

const writeTimers = new Map<string, NodeJS.Timeout>();

function debouncedWrite(filePath: string, data: string, delayMs = 1000) {
  const existing = writeTimers.get(filePath);
  if (existing) clearTimeout(existing);
  writeTimers.set(
    filePath,
    setTimeout(() => {
      writeFileSync(filePath, data, "utf-8");
      writeTimers.delete(filePath);
    }, delayMs),
  );
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
  writeFileSync(
    join(dirs.agents, `${agent.id}.json`),
    JSON.stringify(agent, null, 2),
    "utf-8",
  );
}

export function loadAgent(id: string): PersistedAgent | null {
  return readJson<PersistedAgent>(join(dirs.agents, `${id}.json`));
}

export function loadAllAgents(): PersistedAgent[] {
  return listJsonFiles<PersistedAgent>(dirs.agents);
}

export function deleteAgent(id: string): void {
  const p = join(dirs.agents, `${id}.json`);
  if (existsSync(p)) unlinkSync(p);
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
  const subDir =
    preset.type === "role"
      ? dirs.presetsRoles
      : preset.type === "team"
        ? dirs.presetsTeams
        : dirs.presetsCustom;
  writeFileSync(
    join(subDir, `${preset.id}.json`),
    JSON.stringify(preset, null, 2),
    "utf-8",
  );
}

export function deletePreset(id: string): boolean {
  for (const dir of [dirs.presetsRoles, dirs.presetsTeams, dirs.presetsCustom]) {
    const p = join(dir, `${id}.json`);
    if (existsSync(p)) {
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

// --- Agent Memory ---

function ensureMemoryDir(projectId: string): string {
  const dir = join(dirs.memory, projectId);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

export function saveMemory(projectId: string, role: string, memory: AgentMemory): void {
  const dir = ensureMemoryDir(projectId);
  writeFileSync(join(dir, `${role}.json`), JSON.stringify(memory, null, 2), "utf-8");
}

export function loadMemory(projectId: string, role: string): AgentMemory | null {
  return readJson<AgentMemory>(join(dirs.memory, projectId, `${role}.json`));
}

export function loadAllMemory(projectId: string): AgentMemory[] {
  const dir = join(dirs.memory, projectId);
  return listJsonFiles<AgentMemory>(dir);
}

// --- Hierarchy ---

function ensureHierarchyDir(projectId: string): string {
  const dir = join(dirs.hierarchy, projectId);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

export function saveHierarchyRegistry(reg: HierarchyRegistry): void {
  const dir = ensureHierarchyDir(reg.projectId);
  writeFileSync(join(dir, "registry.json"), JSON.stringify(reg, null, 2), "utf-8");
}

export function loadHierarchyRegistry(projectId: string): HierarchyRegistry | null {
  return readJson<HierarchyRegistry>(join(dirs.hierarchy, projectId, "registry.json"));
}

export function loadAllHierarchyRegistries(): HierarchyRegistry[] {
  if (!existsSync(dirs.hierarchy)) return [];
  return readdirSync(dirs.hierarchy)
    .map((d) => readJson<HierarchyRegistry>(join(dirs.hierarchy, d, "registry.json")))
    .filter((v): v is HierarchyRegistry => v !== null);
}

export function saveHierarchyNode(projectId: string, node: HierarchyNode): void {
  const dir = ensureHierarchyDir(projectId);
  writeFileSync(join(dir, `${node.id}.json`), JSON.stringify(node, null, 2), "utf-8");
}

export function loadHierarchyNode(projectId: string, nodeId: string): HierarchyNode | null {
  return readJson<HierarchyNode>(join(dirs.hierarchy, projectId, `${nodeId}.json`));
}

export function loadAllHierarchyNodes(projectId: string): HierarchyNode[] {
  const dir = join(dirs.hierarchy, projectId);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json") && f !== "registry.json")
    .map((f) => readJson<HierarchyNode>(join(dir, f)))
    .filter((v): v is HierarchyNode => v !== null);
}

// --- Opera ---

export function saveOperaRegistry(reg: OperaRegistry): void {
  writeFileSync(join(dirs.hierarchy, "opera.json"), JSON.stringify(reg, null, 2), "utf-8");
}

export function loadOperaRegistry(): OperaRegistry | null {
  return readJson<OperaRegistry>(join(dirs.hierarchy, "opera.json"));
}
