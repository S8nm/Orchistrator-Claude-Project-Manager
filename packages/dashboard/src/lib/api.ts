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
