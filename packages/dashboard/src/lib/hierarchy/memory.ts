import { saveMemory, loadMemory } from "../persistence";
import type { AgentMemory, AgentMemoryEntry, AgentRole } from "@orchestrator/shared";

const MAX_RECENT_ACTIVITY = 10;

export function initializeMemory(projectId: string, role: AgentRole): AgentMemory {
  const memory: AgentMemory = {
    role,
    projectId,
    lastUpdated: Date.now(),
    recentActivity: [],
    domainKnowledge: [],
    activeConcerns: [],
    workingAgreements: [],
  };
  saveMemory(projectId, role, memory);
  return memory;
}

export function getOrCreateMemory(projectId: string, role: AgentRole): AgentMemory {
  const existing = loadMemory(projectId, role);
  if (existing) return existing;
  return initializeMemory(projectId, role);
}

export function renderMemoryAsMarkdown(memory: AgentMemory): string {
  const lines: string[] = [];
  const roleName = memory.role.charAt(0).toUpperCase() + memory.role.slice(1);

  lines.push(`# ${roleName} Leader Memory — ${memory.projectId}`);
  lines.push(`Last updated: ${new Date(memory.lastUpdated).toISOString()}`);
  lines.push("");

  // Recent Activity
  if (memory.recentActivity.length > 0) {
    lines.push(`## Recent Activity (${memory.recentActivity.length} tasks)`);
    for (const entry of memory.recentActivity) {
      const date = new Date(entry.timestamp).toISOString().slice(0, 16);
      lines.push(`### [${date}] ${entry.taskTitle}`);
      lines.push(`- Status: ${entry.status}`);
      if (entry.filesModified.length > 0) {
        lines.push(`- Files: ${entry.filesModified.join(", ")}`);
      }
      if (entry.keyDecisions.length > 0) {
        for (const d of entry.keyDecisions) {
          lines.push(`- Decision: ${d}`);
        }
      }
      lines.push(`- Outcome: ${entry.outcome}`);
      if (entry.employeeCount > 0) {
        lines.push(`- Employees used: ${entry.employeeCount}`);
      }
      lines.push("");
    }
  } else {
    lines.push("## Recent Activity");
    lines.push("No tasks completed yet.");
    lines.push("");
  }

  // Domain Knowledge
  if (memory.domainKnowledge.length > 0) {
    lines.push("## Domain Knowledge");
    for (const item of memory.domainKnowledge) {
      lines.push(`- ${item}`);
    }
    lines.push("");
  }

  // Active Concerns
  if (memory.activeConcerns.length > 0) {
    lines.push("## Active Concerns");
    for (const item of memory.activeConcerns) {
      lines.push(`- ${item}`);
    }
    lines.push("");
  }

  // Working Agreements
  if (memory.workingAgreements.length > 0) {
    lines.push("## Working Agreements");
    for (const item of memory.workingAgreements) {
      lines.push(`- ${item}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

export function updateMemoryAfterTask(
  projectId: string,
  role: AgentRole,
  entry: AgentMemoryEntry,
): AgentMemory {
  const memory = getOrCreateMemory(projectId, role);
  memory.recentActivity.unshift(entry);
  if (memory.recentActivity.length > MAX_RECENT_ACTIVITY) {
    memory.recentActivity = memory.recentActivity.slice(0, MAX_RECENT_ACTIVITY);
  }
  memory.lastUpdated = Date.now();
  saveMemory(projectId, role, memory);
  return memory;
}

export function updateDomainKnowledge(
  projectId: string,
  role: AgentRole,
  items: string[],
): AgentMemory {
  const memory = getOrCreateMemory(projectId, role);
  for (const item of items) {
    if (!memory.domainKnowledge.includes(item)) {
      memory.domainKnowledge.push(item);
    }
  }
  // Cap at 20 items
  if (memory.domainKnowledge.length > 20) {
    memory.domainKnowledge = memory.domainKnowledge.slice(-20);
  }
  memory.lastUpdated = Date.now();
  saveMemory(projectId, role, memory);
  return memory;
}

export function getMemoryTokenEstimate(memory: AgentMemory): number {
  const md = renderMemoryAsMarkdown(memory);
  // Rough estimate: ~4 chars per token
  return Math.ceil(md.length / 4);
}

export function summarizeMemory(memory: AgentMemory, maxTokens: number): AgentMemory {
  const copy = { ...memory, recentActivity: [...memory.recentActivity] };
  // Keep trimming oldest entries until under budget
  while (copy.recentActivity.length > 1 && getMemoryTokenEstimate(copy) > maxTokens) {
    copy.recentActivity.pop();
  }
  return copy;
}
