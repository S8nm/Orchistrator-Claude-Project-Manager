"use client";

import { useState, useEffect } from "react";
import { fetchProjects, runCommand, bootstrapProject } from "@/lib/api";

interface RegProject {
  id: string;
  name: string;
  path: string;
  type: string;
  stack: string[];
  remote?: string;
  status: string;
  tags: string[];
  commands: Record<string, string>;
}

const dark = "#080810", panel = "#0d0d1a", card = "#111122", border = "#1a1a33";

const STATUS_COLORS: Record<string, string> = {
  active: "#10b981",
  paused: "#eab308",
  archived: "#6b7280",
};

export default function ProjectManager() {
  const [projects, setProjects] = useState<RegProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [output, setOutput] = useState<Record<string, string>>({});
  const [running, setRunning] = useState<Record<string, boolean>>({});
  const [bootstrapping, setBootstrapping] = useState<Record<string, boolean>>({});
  const [bootstrapResults, setBootstrapResults] = useState<Record<string, any>>({});
  const [cmdInput, setCmdInput] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchProjects()
      .then((data) => setProjects(data.projects || []))
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, []);

  const execCmd = async (projectId: string, command: string, cwd: string) => {
    setRunning((r) => ({ ...r, [projectId]: true }));
    setOutput((o) => ({ ...o, [projectId]: `$ ${command}\n` }));
    try {
      const result = await runCommand(command, cwd);
      setOutput((o) => ({
        ...o,
        [projectId]: (o[projectId] || "") + (result.output || "") + (result.success ? "\n\u2713 Done" : "\n\u2717 Failed (exit " + result.exitCode + ")"),
      }));
    } catch (e: any) {
      setOutput((o) => ({ ...o, [projectId]: (o[projectId] || "") + "\n\u2717 Error: " + e.message }));
    }
    setRunning((r) => ({ ...r, [projectId]: false }));
  };

  const doBootstrap = async (project: RegProject) => {
    if (!project.path) return;
    setBootstrapping((b) => ({ ...b, [project.id]: true }));
    setOutput((o) => ({ ...o, [project.id]: "Bootstrapping " + project.name + "...\nScanning repo, detecting stack, creating CLAUDE.md + skills...\n" }));
    try {
      const result = await bootstrapProject(project.path);
      setBootstrapResults((r) => ({ ...r, [project.id]: result }));
      if (result.success) {
        const logStr = result.logs.join("\n");
        setOutput((o) => ({
          ...o,
          [project.id]: (o[project.id] || "") + logStr + "\n\n\u2713 Bootstrap complete!",
        }));
      } else {
        setOutput((o) => ({
          ...o,
          [project.id]: (o[project.id] || "") + "\n\u2717 " + (result.error || "Unknown error"),
        }));
      }
    } catch (e: any) {
      setOutput((o) => ({ ...o, [project.id]: (o[project.id] || "") + "\n\u2717 " + e.message }));
    }
    setBootstrapping((b) => ({ ...b, [project.id]: false }));
  };

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#475569" }}>Loading projects from registry...</div>
    );
  }

  return (
    <div style={{ padding: "16px 20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#94a3b8" }}>
          {"\u{1F4C2}"} Project Registry \u2014 {projects.length} projects
        </div>
        <button
          onClick={() => fetchProjects().then((d) => setProjects(d.projects || []))}
          style={{ padding: "5px 12px", borderRadius: 6, border: `1px solid ${border}`, background: "transparent", color: "#64748b", cursor: "pointer", fontSize: 11 }}
        >
          Refresh
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 12 }}>
        {projects.map((p) => {
          const isSelected = selected === p.id;
          const isRunningCmd = running[p.id];
          const isBootstrapping2 = bootstrapping[p.id];
          const sc = STATUS_COLORS[p.status] || "#6b7280";
          const hasPath = !!p.path;

          return (
            <div
              key={p.id}
              style={{
                background: card,
                border: isSelected ? `1px solid #6366f1` : `1px solid ${border}`,
                borderRadius: 12,
                overflow: "hidden",
                cursor: "pointer",
                transition: "border 0.2s",
              }}
              onClick={() => setSelected(isSelected ? null : p.id)}
            >
              {/* Header */}
              <div style={{ padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: sc, display: "inline-block", boxShadow: `0 0 6px ${sc}80` }} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{p.name}</div>
                    <div style={{ fontSize: 10, color: "#64748b" }}>{p.type} {p.stack.length > 0 && `\u2014 ${p.stack.join(", ")}`}</div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  {p.tags.map((tag) => (
                    <span key={tag} style={{ padding: "1px 6px", borderRadius: 4, fontSize: 9, background: `${border}`, color: "#94a3b8" }}>{tag}</span>
                  ))}
                </div>
              </div>

              {/* Path */}
              <div style={{ padding: "4px 14px 8px", fontSize: 10, color: "#475569", fontFamily: "'SF Mono',Monaco,monospace" }}>
                {hasPath ? p.path : p.remote || "No path set"}
              </div>

              {/* Expanded section */}
              {isSelected && (
                <div style={{ borderTop: `1px solid ${border}` }}>
                  {/* Action buttons */}
                  <div style={{ padding: "10px 14px", display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {hasPath && (
                      <>
                        <button
                          onClick={(e) => { e.stopPropagation(); doBootstrap(p); }}
                          disabled={isBootstrapping2}
                          style={{ padding: "5px 12px", borderRadius: 6, border: "none", cursor: isBootstrapping2 ? "wait" : "pointer", fontSize: 11, fontWeight: 600, background: "#a855f7", color: "#fff" }}
                        >
                          {isBootstrapping2 ? "Bootstrapping..." : "\u{1F3D7}\uFE0F Bootstrap"}
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); execCmd(p.id, "git status", p.path); }}
                          disabled={isRunningCmd}
                          style={{ padding: "5px 12px", borderRadius: 6, border: `1px solid ${border}`, background: "transparent", color: "#94a3b8", cursor: "pointer", fontSize: 11 }}
                        >
                          Git Status
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); execCmd(p.id, 'git log --oneline -10', p.path); }}
                          disabled={isRunningCmd}
                          style={{ padding: "5px 12px", borderRadius: 6, border: `1px solid ${border}`, background: "transparent", color: "#94a3b8", cursor: "pointer", fontSize: 11 }}
                        >
                          Git Log
                        </button>
                        {Object.entries(p.commands).map(([name, cmd]) => (
                          <button
                            key={name}
                            onClick={(e) => { e.stopPropagation(); execCmd(p.id, cmd, p.path); }}
                            disabled={isRunningCmd}
                            style={{ padding: "5px 12px", borderRadius: 6, border: `1px solid ${border}`, background: "transparent", color: "#94a3b8", cursor: "pointer", fontSize: 11 }}
                          >
                            {name}
                          </button>
                        ))}
                      </>
                    )}
                    {p.remote && (
                      <button
                        onClick={(e) => { e.stopPropagation(); window.open(p.remote, "_blank"); }}
                        style={{ padding: "5px 12px", borderRadius: 6, border: `1px solid ${border}`, background: "transparent", color: "#94a3b8", cursor: "pointer", fontSize: 11 }}
                      >
                        {"\u{1F517}"} GitHub
                      </button>
                    )}
                  </div>

                  {/* Custom command input */}
                  {hasPath && (
                    <div style={{ padding: "0 14px 10px", display: "flex", gap: 6 }}>
                      <input
                        onClick={(e) => e.stopPropagation()}
                        style={{ flex: 1, padding: "6px 10px", borderRadius: 6, border: `1px solid ${border}`, background: panel, color: "#e2e8f0", fontSize: 11, fontFamily: "'SF Mono',Monaco,monospace", outline: "none" }}
                        placeholder="Run custom command..."
                        value={cmdInput[p.id] || ""}
                        onChange={(e) => setCmdInput((c) => ({ ...c, [p.id]: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && cmdInput[p.id]?.trim()) {
                            execCmd(p.id, cmdInput[p.id], p.path);
                            setCmdInput((c) => ({ ...c, [p.id]: "" }));
                          }
                        }}
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (cmdInput[p.id]?.trim()) {
                            execCmd(p.id, cmdInput[p.id], p.path);
                            setCmdInput((c) => ({ ...c, [p.id]: "" }));
                          }
                        }}
                        style={{ padding: "5px 12px", borderRadius: 6, border: "none", background: "#3b82f6", color: "#fff", cursor: "pointer", fontSize: 11, fontWeight: 600 }}
                      >
                        Run
                      </button>
                    </div>
                  )}

                  {/* Bootstrap results */}
                  {bootstrapResults[p.id]?.detected && (
                    <div style={{ padding: "8px 14px", borderTop: `1px solid ${border}`, fontSize: 10, color: "#94a3b8" }}>
                      <div style={{ fontWeight: 600, marginBottom: 4, color: "#a855f7" }}>Detected Stack:</div>
                      <div>Lang: {bootstrapResults[p.id].detected.language} | Framework: {bootstrapResults[p.id].detected.framework}</div>
                      <div>Test: {bootstrapResults[p.id].detected.testRunner} | Lint: {bootstrapResults[p.id].detected.linter}</div>
                    </div>
                  )}

                  {/* Terminal output */}
                  {output[p.id] && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        padding: "10px 14px",
                        borderTop: `1px solid ${border}`,
                        background: "#08080f",
                        fontFamily: "'SF Mono',Monaco,'Fira Code',monospace",
                        fontSize: 10,
                        lineHeight: 1.7,
                        maxHeight: 250,
                        overflowY: "auto",
                        whiteSpace: "pre-wrap",
                        color: "#94a3b8",
                      }}
                    >
                      {output[p.id]}
                      {(isRunningCmd || isBootstrapping2) && <span style={{ animation: "blink 1s infinite", color: "#3b82f6" }}> {"\u2588"}</span>}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
