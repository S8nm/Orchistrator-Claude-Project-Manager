"use client";

export async function fetchProjects() {
  const res = await fetch("/api/projects");
  if (!res.ok) throw new Error("Failed to fetch projects");
  return res.json();
}

export async function runCommand(command: string, cwd: string) {
  const res = await fetch("/api/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ command, cwd }),
  });
  return res.json();
}

export async function bootstrapProject(projectPath: string) {
  const res = await fetch("/api/bootstrap", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectPath }),
  });
  return res.json();
}

export async function updateProject(action: string, data: any) {
  const res = await fetch("/api/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...data }),
  });
  return res.json();
}

export async function spawnAgent(id: string, command: string, cwd: string) {
  const res = await fetch("/api/agent/spawn", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, command, cwd }),
  });
  return res.json();
}

export async function killAgentProcess(id: string) {
  const res = await fetch("/api/agent/kill", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  });
  return res.json();
}

export function streamAgent(
  id: string,
  onStdout: (data: string) => void,
  onStderr: (data: string) => void,
  onExit: (info: { code: number | null; status: string }) => void,
): EventSource {
  const es = new EventSource(`/api/agent/stream?id=${encodeURIComponent(id)}`);

  es.addEventListener("stdout", (e) => {
    onStdout(JSON.parse(e.data));
  });

  es.addEventListener("stderr", (e) => {
    onStderr(JSON.parse(e.data));
  });

  es.addEventListener("exit", (e) => {
    const raw = JSON.parse(e.data);
    const info = typeof raw === "string" ? JSON.parse(raw) : raw;
    onExit(info);
    es.close();
  });

  es.onerror = () => {
    es.close();
  };

  return es;
}

export async function sendAgentInput(id: string, input: string) {
  const res = await fetch("/api/agent/input", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, input }),
  });
  return res.json();
}

export async function fetchPresets() {
  const res = await fetch("/api/presets");
  if (!res.ok) throw new Error("Failed to fetch presets");
  return res.json();
}

export async function savePresetApi(preset: any) {
  const res = await fetch("/api/presets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "save", preset }),
  });
  return res.json();
}

export async function deletePresetApi(id: string) {
  const res = await fetch("/api/presets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "delete", id }),
  });
  return res.json();
}

export async function startOrchestration(task: string, projectId: string) {
  const res = await fetch("/api/orchestrate/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ task, projectId }),
  });
  return res.json();
}

export async function getOrchestration(id: string) {
  const res = await fetch(`/api/orchestrate/${id}`);
  return res.json();
}

export async function cancelOrchestration(id: string) {
  const res = await fetch("/api/orchestrate/cancel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  });
  return res.json();
}

export async function listOrchestrations() {
  const res = await fetch("/api/orchestrate/list");
  return res.json();
}

export function streamOrchestration(
  id: string,
  onEvent: (event: { type: string; data: any }) => void,
  onError?: () => void,
): EventSource {
  const es = new EventSource(`/api/orchestrate/stream?id=${encodeURIComponent(id)}`);

  for (const eventType of ["task_started", "task_done", "task_failed", "plan_ready", "orchestration_done"]) {
    es.addEventListener(eventType, (e) => {
      onEvent({ type: eventType, data: JSON.parse(e.data) });
    });
  }

  es.onerror = () => {
    onError?.();
    es.close();
  };

  return es;
}

// --- Hierarchy API ---

export async function activateProject(projectId: string, projectPath: string, projectName: string) {
  const res = await fetch("/api/hierarchy/activate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId, projectPath, projectName }),
  });
  return res.json();
}

export async function deactivateProject(projectId: string) {
  const res = await fetch("/api/hierarchy/deactivate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId }),
  });
  return res.json();
}

export async function getHierarchyTree(projectId: string) {
  const res = await fetch(`/api/hierarchy/tree?projectId=${encodeURIComponent(projectId)}`);
  return res.json();
}

export async function sendHierarchyTask(projectId: string, task: string) {
  const res = await fetch("/api/hierarchy/send-task", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId, task }),
  });
  return res.json();
}

export async function getHierarchyStatus() {
  const res = await fetch("/api/hierarchy/status");
  return res.json();
}

export function streamHierarchy(
  projectId: string,
  onEvent: (event: { type: string; data: any }) => void,
  onError?: () => void,
): EventSource {
  const es = new EventSource(`/api/hierarchy/stream?projectId=${encodeURIComponent(projectId)}`);

  const eventTypes = [
    "orchestrator_spawned", "orchestrator_idle", "orchestrator_shutdown",
    "task_received", "plan_received",
    "leader_waking", "leader_active", "leader_done", "leader_failed",
    "employee_spawned", "employee_done",
    "task_complete", "memory_updated",
    "message_log",
  ];

  for (const eventType of eventTypes) {
    es.addEventListener(eventType, (e) => {
      onEvent({ type: eventType, data: JSON.parse(e.data) });
    });
  }

  // Also handle generic "status" event
  es.addEventListener("status", (e) => {
    onEvent({ type: "status", data: JSON.parse(e.data) });
  });

  es.onerror = () => {
    onError?.();
    es.close();
  };

  return es;
}

export async function getAgentMemory(projectId: string, role: string) {
  const res = await fetch(
    `/api/hierarchy/memory?projectId=${encodeURIComponent(projectId)}&role=${encodeURIComponent(role)}`,
  );
  return res.json();
}

export async function updateAgentMemory(projectId: string, role: string, memory: any) {
  const res = await fetch("/api/hierarchy/memory", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId, role, memory }),
  });
  return res.json();
}

// --- Opera API ---

export async function getOperaStatus() {
  const res = await fetch("/api/hierarchy/opera");
  return res.json();
}

export function streamOpera(
  onEvent: (event: { type: string; data: any }) => void,
  onError?: () => void,
): EventSource {
  const es = new EventSource("/api/hierarchy/opera/stream");

  es.addEventListener("opera_log", (e) => {
    onEvent({ type: "opera_log", data: JSON.parse(e.data) });
  });

  es.addEventListener("status", (e) => {
    onEvent({ type: "status", data: JSON.parse(e.data) });
  });

  es.onerror = () => {
    onError?.();
    es.close();
  };

  return es;
}

export async function getMessageLog(projectId: string, limit = 50) {
  const res = await fetch(
    `/api/hierarchy/log?projectId=${encodeURIComponent(projectId)}&limit=${limit}`,
  );
  return res.json();
}
