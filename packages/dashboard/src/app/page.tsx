"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import AppShell from "@/components/app-shell";
import HeadOffice from "@/components/head-office";
import ProjectOffice from "@/components/project-office";
import PresetsPanel from "@/components/presets-panel";
import TaskGraph from "@/components/task-graph";
import {
  fetchProjects,
  streamAgent,
  killAgentProcess,
  sendAgentInput,
  startOrchestration,
  streamOrchestration,
  listOrchestrations,
  bootstrapProject,
  runCommand,
} from "@/lib/api";

// Fetch real agents from server
async function fetchServerAgents(): Promise<any[]> {
  try {
    const res = await fetch("/api/agent/list");
    if (!res.ok) return [];
    const data = await res.json();
    return data.agents || [];
  } catch {
    return [];
  }
}

export default function Home() {
  const [activeView, setActiveView] = useState("head-office");
  const [projects, setProjects] = useState<any[]>([]);
  const [serverAgents, setServerAgents] = useState<any[]>([]);
  const [orchestrations, setOrchestrations] = useState<any[]>([]);
  const [logs, setLogs] = useState<Record<string, { ts: string; msg: string }[]>>({});
  const [loaded, setLoaded] = useState(false);
  const eventSources = useRef<Record<string, EventSource>>({});
  const orchSources = useRef<Record<string, EventSource>>({});

  // -- Load projects from registry --
  useEffect(() => {
    fetchProjects()
      .then((data) => setProjects(data.projects || []))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  // -- Poll server agents every 2s --
  useEffect(() => {
    let mounted = true;
    const poll = async () => {
      const agents = await fetchServerAgents();
      if (mounted) setServerAgents(agents);
    };
    poll();
    const interval = setInterval(poll, 2000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  // -- Load orchestrations on mount --
  useEffect(() => {
    listOrchestrations()
      .then((data) => {
        if (data.orchestrations) setOrchestrations(data.orchestrations);
      })
      .catch(() => {});
  }, []);

  // -- SSE stream connection for agents --
  const connectStream = useCallback((agentId: string) => {
    if (eventSources.current[agentId]) {
      eventSources.current[agentId].close();
    }

    const ts = () =>
      new Date().toLocaleTimeString("en-US", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });

    const es = streamAgent(
      agentId,
      (data) => {
        const lines = data.split("\n").filter(Boolean);
        setLogs((prev) => {
          const arr = prev[agentId] || [];
          const newEntries = lines.map((line) => ({ ts: ts(), msg: line }));
          return { ...prev, [agentId]: [...arr.slice(-(50 - lines.length)), ...newEntries] };
        });
      },
      (data) => {
        const lines = data.split("\n").filter(Boolean);
        setLogs((prev) => {
          const arr = prev[agentId] || [];
          const newEntries = lines.map((line) => ({ ts: ts(), msg: `\u26A0 ${line}` }));
          return { ...prev, [agentId]: [...arr.slice(-(50 - lines.length)), ...newEntries] };
        });
      },
      (info) => {
        setLogs((prev) => {
          const arr = prev[agentId] || [];
          const statusMsg =
            info.status === "done"
              ? "Process exited (0) \u2713"
              : `Process exited (${info.code}) \u2717`;
          return { ...prev, [agentId]: [...arr, { ts: ts(), msg: statusMsg }] };
        });
        delete eventSources.current[agentId];
      },
    );

    eventSources.current[agentId] = es;
  }, []);

  // -- Auto-connect SSE for running agents --
  useEffect(() => {
    for (const sa of serverAgents) {
      if (sa.status === "running" && !eventSources.current[sa.id]) {
        connectStream(sa.id);
      }
    }
  }, [serverAgents, connectStream]);

  // -- Cleanup SSE on unmount --
  useEffect(() => {
    return () => {
      Object.values(eventSources.current).forEach((es) => es.close());
      Object.values(orchSources.current).forEach((es) => es.close());
    };
  }, []);

  // -- Handlers --
  const handleSendInput = useCallback(
    async (agentId: string, input: string) => {
      const ts = new Date().toLocaleTimeString("en-US", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      setLogs((prev) => {
        const arr = prev[agentId] || [];
        return { ...prev, [agentId]: [...arr.slice(-48), { ts, msg: `> ${input}` }] };
      });
      await sendAgentInput(agentId, input);
    },
    [],
  );

  const handleKillAgent = useCallback(async (agentId: string) => {
    await killAgentProcess(agentId);
    if (eventSources.current[agentId]) {
      eventSources.current[agentId].close();
      delete eventSources.current[agentId];
    }
  }, []);

  const handleNewOrchestration = useCallback(() => {
    setActiveView("orchestrations");
  }, []);

  const handleStartOrchestration = useCallback(
    async (task: string, projectId?: string) => {
      const result = await startOrchestration(task, projectId || "default");
      if (result.success && result.orchestration) {
        const orch = result.orchestration;
        setOrchestrations((prev) => [orch, ...prev]);
        // Connect orchestration SSE
        const es = streamOrchestration(orch.id, (event) => {
          if (event.type === "task_started" && event.data.agentProcessId) {
            setTimeout(() => connectStream(event.data.agentProcessId), 500);
          }
          setOrchestrations((prev) =>
            prev.map((o) => {
              if (o.id !== orch.id) return o;
              const updated = { ...o };
              if (
                event.type === "task_started" ||
                event.type === "task_done" ||
                event.type === "task_failed"
              ) {
                updated.subTasks = updated.subTasks?.map((st: any) =>
                  st.id === event.data.subTaskId
                    ? {
                        ...st,
                        status:
                          event.type === "task_started"
                            ? "running"
                            : event.type === "task_done"
                              ? "done"
                              : "failed",
                        agentProcessId:
                          event.data.agentProcessId || st.agentProcessId,
                      }
                    : st,
                );
              }
              if (event.type === "orchestration_done") {
                updated.status = event.data.status;
              }
              return updated;
            }),
          );
        });
        orchSources.current[orch.id] = es;
        return orch;
      }
      return null;
    },
    [connectStream],
  );

  const handleSpawnAgent = useCallback(() => {
    // Navigate to orchestrations where they can spawn
    setActiveView("orchestrations");
  }, []);

  const handleRunCommand = useCallback(async (command: string, cwd: string) => {
    return runCommand(command, cwd);
  }, []);

  const handleBootstrap = useCallback(async (projectPath: string) => {
    return bootstrapProject(projectPath);
  }, []);

  // -- Styles for orchestrations view --
  const orchStyles = {
    input: {
      width: "100%",
      padding: "9px 11px",
      borderRadius: 7,
      border: "1px solid #1a1a33",
      background: "#0d0d1a",
      color: "#e2e8f0",
      fontSize: 12,
      outline: "none",
      boxSizing: "border-box" as const,
    },
    btn: (c = "#6366f1") =>
      ({
        padding: "7px 14px",
        borderRadius: 7,
        border: "none",
        cursor: "pointer",
        fontSize: 12,
        fontWeight: 600,
        background: c,
        color: "#fff",
      }) as React.CSSProperties,
    btnSm: (c = "#6366f1") =>
      ({
        padding: "3px 9px",
        borderRadius: 5,
        border: "none",
        cursor: "pointer",
        fontSize: 10,
        fontWeight: 600,
        background: c + "30",
        color: c,
      }) as React.CSSProperties,
    projTab: (a: boolean) =>
      ({
        padding: "4px 12px",
        borderRadius: 6,
        border: a ? "1px solid #6366f1" : "1px solid #1a1a33",
        background: a ? "#6366f120" : "transparent",
        color: a ? "#a5b4fc" : "#64748b",
        cursor: "pointer",
        fontSize: 11,
        fontWeight: 500,
      }) as React.CSSProperties,
  };

  // -- Find selected project --
  const selectedProject = projects.find((p) => p.id === activeView);

  // -- Orchestrations view state --
  const [orchTask, setOrchTask] = useState("");
  const [activeOrch, setActiveOrch] = useState<string | null>(null);

  if (!loaded) {
    return (
      <div
        style={{
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          background: "#080810",
          color: "#475569",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        Loading...
      </div>
    );
  }

  return (
    <AppShell
      projects={projects}
      activeView={activeView}
      onNavigate={setActiveView}
      serverAgents={serverAgents}
    >
      {activeView === "head-office" && (
        <HeadOffice
          projects={projects}
          serverAgents={serverAgents}
          orchestrations={orchestrations}
          onSelectAgent={(id) => {
            // Find which project this agent belongs to, navigate there
            const agent = serverAgents.find((a) => a.id === id);
            if (agent?.projectId) {
              setActiveView(agent.projectId);
            }
          }}
          onSelectOrchestration={(id) => {
            setActiveOrch(id);
            setActiveView("orchestrations");
          }}
          onNewOrchestration={handleNewOrchestration}
          onSpawnAgent={handleSpawnAgent}
          onNavigate={setActiveView}
        />
      )}

      {activeView === "orchestrations" && (
        <div style={{ padding: "16px 20px" }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <input
              style={{ ...orchStyles.input, flex: 1 }}
              placeholder="Describe the task to orchestrate..."
              value={orchTask}
              onChange={(e) => setOrchTask(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && orchTask.trim()) {
                  handleStartOrchestration(orchTask);
                  setOrchTask("");
                }
              }}
            />
            <button
              style={orchStyles.btn()}
              onClick={() => {
                if (orchTask.trim()) {
                  handleStartOrchestration(orchTask);
                  setOrchTask("");
                }
              }}
            >
              Orchestrate
            </button>
          </div>
          {orchestrations.length > 0 && (
            <div style={{ display: "flex", gap: 4, marginBottom: 12, flexWrap: "wrap" }}>
              {orchestrations.map((o) => (
                <button
                  key={o.id}
                  style={orchStyles.projTab(activeOrch === o.id)}
                  onClick={() => setActiveOrch(o.id)}
                >
                  {o.taskDescription?.slice(0, 30)}
                  {o.taskDescription?.length > 30 ? "..." : ""}
                  <span
                    style={{
                      marginLeft: 4,
                      fontSize: 9,
                      color:
                        o.status === "done"
                          ? "#10b981"
                          : o.status === "failed"
                            ? "#ef4444"
                            : "#3b82f6",
                    }}
                  >
                    {o.status}
                  </span>
                </button>
              ))}
            </div>
          )}
          <TaskGraph plan={orchestrations.find((o) => o.id === activeOrch) || null} />
        </div>
      )}

      {activeView === "presets" && (
        <PresetsPanel
          onSpawn={async (preset: any) => {
            for (const agentDef of preset.agents) {
              const agentId = Math.random().toString(36).slice(2, 9);
              const body: any = {
                id: agentId,
                mode: agentDef.mode || "claude",
                role: agentDef.role,
                name: agentDef.name,
                skills: agentDef.skills,
                cwd: agentDef.cwd || ".",
              };
              if (agentDef.autoPrompt) body.prompt = agentDef.autoPrompt;
              if (agentDef.mode === "shell" && agentDef.autoPrompt)
                body.command = agentDef.autoPrompt;
              try {
                const res = await fetch("/api/agent/spawn", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(body),
                });
                const result = await res.json();
                if (result.success) connectStream(agentId);
              } catch {}
            }
          }}
          styles={{
            btn: orchStyles.btn,
            btnSm: orchStyles.btnSm,
            input: orchStyles.input,
          }}
        />
      )}

      {selectedProject && (
        <ProjectOffice
          project={selectedProject}
          serverAgents={serverAgents}
          logs={logs}
          onSpawnAgent={() => {
            // For now, navigate to orchestrations to spawn
            setActiveView("orchestrations");
          }}
          onSendInput={handleSendInput}
          onKillAgent={handleKillAgent}
          onRunCommand={handleRunCommand}
          onBootstrap={handleBootstrap}
        />
      )}
    </AppShell>
  );
}
