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
    const info = JSON.parse(JSON.parse(e.data));
    onExit(info);
    es.close();
  });

  es.onerror = () => {
    es.close();
  };

  return es;
}
