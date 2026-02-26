"use client";

import { useState, useEffect, useCallback, useMemo, memo } from "react";

// -- Theme constants ----------------------------------------------------------

const COLORS = {
  bg: "#080810",
  panel: "#0d0d1a",
  card: "#111122",
  border: "#1a1a33",
  borderLight: "#252545",
  primary: "#6366f1",
  primaryMuted: "rgba(99, 102, 241, 0.12)",
  primaryGlow: "rgba(99, 102, 241, 0.25)",
  success: "#10b981",
  warning: "#f59e0b",
  error: "#ef4444",
  textPrimary: "#e2e8f0",
  textSecondary: "#94a3b8",
  textMuted: "#64748b",
} as const;

const FONT_STACK = "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const MONO_STACK = "'SF Mono', Monaco, 'Fira Code', monospace";

// -- Role config --------------------------------------------------------------

const ROLE_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  orchestrator: { icon: "\u{1F9E0}", color: "#a855f7", label: "Orchestrator" },
  architect:    { icon: "\u{1F3D7}\uFE0F", color: "#8b5cf6", label: "Architect" },
  backend:      { icon: "\u2699\uFE0F", color: "#3b82f6", label: "Backend" },
  frontend:     { icon: "\u{1F3A8}", color: "#ec4899", label: "Frontend" },
  tester:       { icon: "\u{1F9EA}", color: "#10b981", label: "Tester" },
  reviewer:     { icon: "\u{1F50D}", color: "#f59e0b", label: "Reviewer" },
  security:     { icon: "\u{1F6E1}\uFE0F", color: "#ef4444", label: "Security" },
  refactorer:   { icon: "\u267B\uFE0F", color: "#06b6d4", label: "Refactorer" },
  devops:       { icon: "\u{1F527}", color: "#14b8a6", label: "DevOps" },
  docs:         { icon: "\u{1F4DD}", color: "#8b5cf6", label: "Docs" },
  fullstack:    { icon: "\u26A1", color: "#6366f1", label: "Fullstack" },
};

const ORCH_STATUS_COLORS: Record<string, string> = {
  running: "#3b82f6",
  done: "#10b981",
  failed: "#ef4444",
  cancelled: "#6b7280",
};

// -- Types --------------------------------------------------------------------

interface HeadOfficeProps {
  projects: Array<{ id: string; name: string; status: string; stack: string[]; tags: string[] }>;
  serverAgents: any[];
  orchestrations: any[];
  onSelectAgent: (id: string) => void;
  onSelectOrchestration: (id: string) => void;
  onNewOrchestration: () => void;
  onSpawnAgent: () => void;
  onNavigate: (view: string) => void;
}

// -- Helpers ------------------------------------------------------------------

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

function formatElapsed(startTime: number | string | undefined): string {
  if (!startTime) return "--";
  const start = typeof startTime === "string" ? new Date(startTime).getTime() : startTime;
  const elapsed = Math.floor((Date.now() - start) / 1000);
  if (elapsed < 60) return `${elapsed}s`;
  if (elapsed < 3600) return `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`;
  return `${Math.floor(elapsed / 3600)}h ${Math.floor((elapsed % 3600) / 60)}m`;
}

function truncate(str: string, max: number): string {
  if (!str) return "";
  return str.length > max ? str.slice(0, max) + "\u2026" : str;
}

function getRoleConfig(role: string): { icon: string; color: string; label: string } {
  const key = (role || "").toLowerCase();
  return ROLE_CONFIG[key] || { icon: "\u{1F916}", color: "#6366f1", label: role || "Agent" };
}

// -- Stat Card ----------------------------------------------------------------

const StatCard = memo(function StatCard({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: string | number;
  color: string;
  icon: string;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        flex: "1 1 0",
        minWidth: 140,
        background: hovered ? COLORS.borderLight : COLORS.card,
        border: `1px solid ${hovered ? color + "44" : COLORS.border}`,
        borderRadius: 10,
        padding: "18px 16px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
        transition: "all 0.2s ease",
        cursor: "default",
        boxShadow: hovered ? `0 0 20px ${color}15` : "none",
      }}
    >
      <span style={{ fontSize: 20, lineHeight: 1 }}>{icon}</span>
      <span
        style={{
          fontSize: 28,
          fontWeight: 700,
          fontFamily: MONO_STACK,
          color,
          lineHeight: 1.1,
        }}
      >
        {value}
      </span>
      <span
        style={{
          fontSize: 11,
          fontFamily: FONT_STACK,
          color: COLORS.textMuted,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          fontWeight: 500,
        }}
      >
        {label}
      </span>
    </div>
  );
});

// -- Agent Card ---------------------------------------------------------------

const AgentCard = memo(function AgentCard({
  agent,
  onClick,
}: {
  agent: any;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const config = getRoleConfig(agent.role || agent.type);
  const isRunning = (agent.status || "").toLowerCase() === "running";

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? COLORS.borderLight : COLORS.card,
        border: `1px solid ${hovered ? config.color + "66" : COLORS.border}`,
        borderRadius: 8,
        padding: "12px 14px",
        display: "flex",
        alignItems: "center",
        gap: 10,
        cursor: "pointer",
        transition: "all 0.2s ease",
        boxShadow: isRunning
          ? `0 0 16px ${config.color}30, inset 0 0 8px ${config.color}08`
          : "none",
      }}
    >
      <span style={{ fontSize: 22, lineHeight: 1, flexShrink: 0 }}>{config.icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            fontFamily: FONT_STACK,
            color: COLORS.textPrimary,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {agent.name || agent.id}
        </div>
        <div
          style={{
            fontSize: 11,
            fontFamily: FONT_STACK,
            color: COLORS.textMuted,
            marginTop: 2,
          }}
        >
          {config.label}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: isRunning ? COLORS.success : COLORS.textMuted,
              boxShadow: isRunning ? `0 0 6px ${COLORS.success}` : "none",
              animation: isRunning ? "pulse 2s ease-in-out infinite" : "none",
            }}
          />
          <span
            style={{
              fontSize: 10,
              fontFamily: MONO_STACK,
              color: isRunning ? COLORS.success : COLORS.textMuted,
              textTransform: "uppercase",
              fontWeight: 500,
            }}
          >
            {agent.status || "idle"}
          </span>
        </div>
        <span
          style={{
            fontSize: 10,
            fontFamily: MONO_STACK,
            color: COLORS.textMuted,
          }}
        >
          {formatElapsed(agent.startedAt || agent.created)}
        </span>
      </div>
    </div>
  );
});

// -- Orchestration Row --------------------------------------------------------

const OrchestrationRow = memo(function OrchestrationRow({
  orch,
  onClick,
}: {
  orch: any;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const status = (orch.status || "running").toLowerCase();
  const statusColor = ORCH_STATUS_COLORS[status] || COLORS.textMuted;

  const subTasks = orch.subTasks || orch.tasks || [];
  const doneTasks = subTasks.filter((t: any) => t.status === "done" || t.status === "completed").length;
  const totalTasks = subTasks.length;

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 14px",
        borderRadius: 6,
        background: hovered ? COLORS.card : "transparent",
        cursor: "pointer",
        transition: "background 0.15s ease",
        borderBottom: `1px solid ${COLORS.border}`,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontFamily: FONT_STACK,
            fontWeight: 500,
            color: COLORS.textPrimary,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {truncate(orch.task || orch.title || orch.description || "Untitled", 50)}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginTop: 4,
          }}
        >
          {totalTasks > 0 && (
            <span
              style={{
                fontSize: 11,
                fontFamily: MONO_STACK,
                color: COLORS.textMuted,
              }}
            >
              {doneTasks}/{totalTasks} done
            </span>
          )}
          <span
            style={{
              fontSize: 10,
              fontFamily: MONO_STACK,
              color: COLORS.textMuted,
            }}
          >
            {formatElapsed(orch.startedAt || orch.created)}
          </span>
        </div>
      </div>
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          fontFamily: MONO_STACK,
          color: statusColor,
          background: statusColor + "18",
          border: `1px solid ${statusColor}33`,
          borderRadius: 4,
          padding: "3px 8px",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          flexShrink: 0,
        }}
      >
        {status}
      </div>
    </div>
  );
});

// -- Quick Action Button ------------------------------------------------------

const QuickActionButton = memo(function QuickActionButton({
  label,
  icon,
  onClick,
  primary,
}: {
  label: string;
  icon: string;
  onClick: () => void;
  primary?: boolean;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 20px",
        borderRadius: 8,
        border: primary
          ? `1px solid ${COLORS.primary}`
          : `1px solid ${COLORS.border}`,
        background: primary
          ? hovered
            ? COLORS.primary
            : COLORS.primary + "cc"
          : hovered
            ? COLORS.card
            : COLORS.panel,
        color: primary ? "#fff" : COLORS.textPrimary,
        fontFamily: FONT_STACK,
        fontSize: 13,
        fontWeight: 600,
        cursor: "pointer",
        transition: "all 0.2s ease",
        boxShadow: primary && hovered
          ? `0 0 20px ${COLORS.primaryGlow}`
          : "none",
        outline: "none",
      }}
    >
      <span style={{ fontSize: 16, lineHeight: 1 }}>{icon}</span>
      {label}
    </button>
  );
});

// -- Panel wrapper ------------------------------------------------------------

function Panel({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        background: COLORS.panel,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 12,
        padding: 20,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// -- Section title ------------------------------------------------------------

function SectionTitle({
  children,
  badge,
}: {
  children: React.ReactNode;
  badge?: string | number;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        marginBottom: 16,
      }}
    >
      <span
        style={{
          fontSize: 15,
          fontWeight: 700,
          fontFamily: FONT_STACK,
          color: COLORS.textPrimary,
          letterSpacing: "-0.01em",
        }}
      >
        {children}
      </span>
      {badge !== undefined && (
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            fontFamily: MONO_STACK,
            color: COLORS.primary,
            background: COLORS.primaryMuted,
            borderRadius: 10,
            padding: "2px 8px",
          }}
        >
          {badge}
        </span>
      )}
    </div>
  );
}

// -- Keyframe injection -------------------------------------------------------

let stylesInjected = false;

function injectKeyframes() {
  if (stylesInjected) return;
  if (typeof document === "undefined") return;
  stylesInjected = true;

  const style = document.createElement("style");
  style.textContent = `
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }
  `;
  document.head.appendChild(style);
}

// -- Main component -----------------------------------------------------------

export default function HeadOffice({
  projects,
  serverAgents,
  orchestrations,
  onSelectAgent,
  onSelectOrchestration,
  onNewOrchestration,
  onSpawnAgent,
  onNavigate,
}: HeadOfficeProps) {
  // Inject pulse keyframe on mount
  useEffect(() => {
    injectKeyframes();
  }, []);

  // Uptime counter
  const [uptimeSeconds, setUptimeSeconds] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setUptimeSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Re-render elapsed times every 5 seconds
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 5000);
    return () => clearInterval(interval);
  }, []);

  // Derived stats
  const stats = useMemo(() => {
    const agents = serverAgents || [];
    const running = agents.filter((a) => (a.status || "").toLowerCase() === "running");
    const completed = agents.filter((a) => (a.status || "").toLowerCase() === "done");
    const failed = agents.filter((a) => (a.status || "").toLowerCase() === "failed");

    return {
      totalProjects: (projects || []).length,
      activeAgents: running.length,
      completed: completed.length,
      failed: failed.length,
      orchestrations: (orchestrations || []).length,
    };
  }, [projects, serverAgents, orchestrations]);

  const runningAgents = useMemo(() => {
    return (serverAgents || []).filter(
      (a) => (a.status || "").toLowerCase() === "running"
    );
  }, [serverAgents]);

  const sortedOrchestrations = useMemo(() => {
    return [...(orchestrations || [])].sort((a, b) => {
      const aTime = new Date(a.startedAt || a.created || 0).getTime();
      const bTime = new Date(b.startedAt || b.created || 0).getTime();
      return bTime - aTime;
    }).slice(0, 20);
  }, [orchestrations]);

  const handleSelectAgent = useCallback(
    (id: string) => onSelectAgent(id),
    [onSelectAgent]
  );

  const handleSelectOrch = useCallback(
    (id: string) => onSelectOrchestration(id),
    [onSelectOrchestration]
  );

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 20,
        padding: 4,
        fontFamily: FONT_STACK,
        color: COLORS.textPrimary,
        minHeight: "100%",
      }}
    >
      {/* Stats Grid */}
      <div
        style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <StatCard
          icon={"\u{1F4C1}"}
          label="Total Projects"
          value={stats.totalProjects}
          color={COLORS.primary}
        />
        <StatCard
          icon={"\u{1F916}"}
          label="Active Agents"
          value={stats.activeAgents}
          color={COLORS.success}
        />
        <StatCard
          icon={"\u2705"}
          label="Completed"
          value={stats.completed}
          color="#10b981"
        />
        <StatCard
          icon={"\u274C"}
          label="Failed"
          value={stats.failed}
          color={COLORS.error}
        />
        <StatCard
          icon={"\u{1F504}"}
          label="Orchestrations"
          value={stats.orchestrations}
          color={COLORS.warning}
        />
        <StatCard
          icon={"\u23F1}\uFE0F"}
          label="Uptime"
          value={formatUptime(uptimeSeconds)}
          color={COLORS.textSecondary}
        />
      </div>

      {/* Middle Row: Live Agents + Orchestrations */}
      <div
        style={{
          display: "flex",
          gap: 16,
          flex: 1,
          minHeight: 0,
        }}
      >
        {/* Live Agents Panel - 60% */}
        <Panel style={{ flex: 6, display: "flex", flexDirection: "column", minHeight: 320, overflow: "hidden" }}>
          <SectionTitle badge={runningAgents.length}>
            Live Agents
          </SectionTitle>

          {runningAgents.length === 0 ? (
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 12,
                padding: 40,
              }}
            >
              <span style={{ fontSize: 36, opacity: 0.3 }}>{"\u{1F916}"}</span>
              <span
                style={{
                  fontSize: 14,
                  color: COLORS.textMuted,
                  fontFamily: FONT_STACK,
                  textAlign: "center",
                }}
              >
                No agents running.
              </span>
              <span
                style={{
                  fontSize: 12,
                  color: COLORS.textMuted,
                  fontFamily: FONT_STACK,
                  opacity: 0.7,
                }}
              >
                Spawn an agent or start an orchestration to get going.
              </span>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                gap: 10,
                overflowY: "auto",
                flex: 1,
                paddingRight: 4,
              }}
            >
              {runningAgents.map((agent) => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  onClick={() => handleSelectAgent(agent.id)}
                />
              ))}
            </div>
          )}
        </Panel>

        {/* Orchestrations Panel - 40% */}
        <Panel style={{ flex: 4, display: "flex", flexDirection: "column", minHeight: 320, overflow: "hidden" }}>
          <SectionTitle badge={stats.orchestrations}>
            Orchestrations
          </SectionTitle>

          {sortedOrchestrations.length === 0 ? (
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 12,
                padding: 40,
              }}
            >
              <span style={{ fontSize: 36, opacity: 0.3 }}>{"\u{1F504}"}</span>
              <span
                style={{
                  fontSize: 14,
                  color: COLORS.textMuted,
                  fontFamily: FONT_STACK,
                  textAlign: "center",
                }}
              >
                No orchestrations yet.
              </span>
              <span
                style={{
                  fontSize: 12,
                  color: COLORS.textMuted,
                  fontFamily: FONT_STACK,
                  opacity: 0.7,
                }}
              >
                Create one to decompose tasks into sub-agents.
              </span>
            </div>
          ) : (
            <div
              style={{
                overflowY: "auto",
                flex: 1,
                paddingRight: 4,
              }}
            >
              {sortedOrchestrations.map((orch) => (
                <OrchestrationRow
                  key={orch.id}
                  orch={orch}
                  onClick={() => handleSelectOrch(orch.id)}
                />
              ))}
            </div>
          )}
        </Panel>
      </div>

      {/* Quick Actions Bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "12px 16px",
          background: COLORS.panel,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 12,
        }}
      >
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            fontFamily: FONT_STACK,
            color: COLORS.textMuted,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            marginRight: 8,
          }}
        >
          Quick Actions
        </span>
        <QuickActionButton
          icon={"\u{1F680}"}
          label="New Orchestration"
          onClick={onNewOrchestration}
          primary
        />
        <QuickActionButton
          icon={"\u{1F916}"}
          label="Spawn Agent"
          onClick={onSpawnAgent}
        />
        <QuickActionButton
          icon={"\u{1F4C2}"}
          label="View All Projects"
          onClick={() => onNavigate("projects-list")}
        />
        <div style={{ flex: 1 }} />
        <span
          style={{
            fontSize: 11,
            fontFamily: MONO_STACK,
            color: COLORS.textMuted,
          }}
        >
          {stats.totalProjects} projects {"\u00B7"} {stats.activeAgents} active
        </span>
      </div>
    </div>
  );
}
