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
