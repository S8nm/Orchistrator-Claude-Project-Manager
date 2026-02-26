"use client";

import { useState, useEffect, useCallback, useMemo, memo } from "react";

// -- Design System ------------------------------------------------------------

const T = {
  base: "#050508",
  surface1: "#0a0c14",
  surface2: "#10131e",
  surface3: "#181c2e",
  border: "#1e2338",
  borderHover: "#2a3050",
  primary: "#00d4aa",
  primaryMuted: "rgba(0, 212, 170, 0.12)",
  primaryGlow: "rgba(0, 212, 170, 0.3)",
  secondary: "#5b6cf7",
  secondaryMuted: "rgba(91, 108, 247, 0.12)",
  warm: "#ff8b3e",
  warmMuted: "rgba(255, 139, 62, 0.12)",
  danger: "#f87171",
  dangerMuted: "rgba(248, 113, 113, 0.12)",
  success: "#4ade80",
  textPrimary: "#e8ecf4",
  textSecondary: "#7b839a",
  textMuted: "#454d68",
  statusActive: "#00d4aa",
  statusPaused: "#ff8b3e",
  statusArchived: "#454d68",
} as const;

const FONT = "'Outfit', sans-serif";
const MONO = "'JetBrains Mono', monospace";

// -- Role Config --------------------------------------------------------------

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
  done: T.success,
  completed: T.success,
  failed: T.danger,
  cancelled: T.textMuted,
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
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatElapsed(startTime: number | string | undefined): string {
  if (!startTime) return "--";
  const start = typeof startTime === "string" ? new Date(startTime).getTime() : startTime;
  const elapsed = Math.floor((Date.now() - start) / 1000);
  if (elapsed < 0) return "--";
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
  return ROLE_CONFIG[key] || { icon: "\u{1F916}", color: T.secondary, label: role || "Agent" };
}

// -- Style Injection ----------------------------------------------------------

let stylesInjected = false;

function injectStyles() {
  if (stylesInjected) return;
  if (typeof document === "undefined") return;
  stylesInjected = true;

  const style = document.createElement("style");
  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap');
    @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap');

    @keyframes ho-fadeInUp {
      from {
        opacity: 0;
        transform: translateY(8px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @keyframes ho-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.35; }
    }

    @keyframes ho-glow-pulse {
      0%, 100% { box-shadow: 0 0 4px rgba(0, 212, 170, 0.4); }
      50% { box-shadow: 0 0 10px rgba(0, 212, 170, 0.7); }
    }

    @keyframes ho-shimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }

    .ho-scrollbar::-webkit-scrollbar {
      width: 4px;
    }
    .ho-scrollbar::-webkit-scrollbar-track {
      background: transparent;
    }
    .ho-scrollbar::-webkit-scrollbar-thumb {
      background: ${T.border};
      border-radius: 2px;
    }
    .ho-scrollbar::-webkit-scrollbar-thumb:hover {
      background: ${T.borderHover};
    }
  `;
  document.head.appendChild(style);
}

// -- Stat Card ----------------------------------------------------------------

interface StatCardProps {
  label: string;
  value: string | number;
  color: string;
  delay: number;
}

const StatCard = memo(function StatCard({ label, value, color, delay }: StatCardProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        flex: "1 1 0",
        minWidth: 120,
        height: 80,
        background: T.surface2,
        borderRadius: 8,
        padding: "14px 16px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        cursor: "default",
        position: "relative",
        overflow: "hidden",
        transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
        animation: `ho-fadeInUp 0.4s cubic-bezier(0.4, 0, 0.2, 1) ${delay}ms both`,
        borderBottom: hovered ? `2px solid ${color}` : "2px solid transparent",
        boxShadow: hovered ? `0 4px 20px ${color}15` : "none",
      }}
    >
      <span
        style={{
          fontSize: 28,
          fontWeight: 700,
          fontFamily: MONO,
          color: color,
          lineHeight: 1,
          letterSpacing: "-0.02em",
        }}
      >
        {value}
      </span>
      <span
        style={{
          fontSize: 10,
          fontFamily: MONO,
          color: T.textMuted,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          fontWeight: 500,
          lineHeight: 1,
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
  const status = (agent.status || "idle").toLowerCase();
  const isRunning = status === "running";

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: T.surface2,
        border: `1px solid ${hovered ? T.borderHover : T.border}`,
        borderLeft: isRunning ? `2px solid ${config.color}` : `1px solid ${hovered ? T.borderHover : T.border}`,
        borderRadius: 8,
        padding: "14px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        cursor: "pointer",
        transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
        transform: hovered ? "translateY(-1px)" : "translateY(0)",
        boxShadow: isRunning
          ? `0 0 20px ${config.color}18, 0 2px 8px rgba(0,0,0,0.3)`
          : hovered
            ? "0 2px 12px rgba(0,0,0,0.3)"
            : "none",
      }}
    >
      {/* Top row: icon + name + role */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 20, lineHeight: 1, flexShrink: 0 }}>
          {config.icon}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              fontFamily: FONT,
              color: T.textPrimary,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              lineHeight: 1.2,
            }}
          >
            {agent.name || agent.id}
          </div>
          <div
            style={{
              fontSize: 9,
              fontFamily: MONO,
              fontWeight: 500,
              color: config.color,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginTop: 2,
              lineHeight: 1,
            }}
          >
            {config.label}
          </div>
        </div>
      </div>

      {/* Bottom row: status + elapsed */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: isRunning ? T.statusActive : T.textMuted,
              boxShadow: isRunning ? `0 0 8px ${T.statusActive}` : "none",
              animation: isRunning ? "ho-pulse 2s ease-in-out infinite" : "none",
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontSize: 10,
              fontFamily: MONO,
              color: isRunning ? T.statusActive : T.textMuted,
              textTransform: "capitalize",
              fontWeight: 500,
            }}
          >
            {status}
          </span>
        </div>
        <span
          style={{
            fontSize: 10,
            fontFamily: MONO,
            color: T.textMuted,
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
  const statusColor = ORCH_STATUS_COLORS[status] || T.textMuted;

  const subTasks = orch.subTasks || orch.tasks || [];
  const doneTasks = subTasks.filter(
    (t: any) => t.status === "done" || t.status === "completed"
  ).length;
  const totalTasks = subTasks.length;

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? T.surface3 : T.surface2,
        padding: 12,
        borderRadius: 6,
        marginBottom: 6,
        cursor: "pointer",
        transition: "background 0.15s ease",
      }}
    >
      {/* Task description */}
      <div
        style={{
          fontSize: 12,
          fontFamily: FONT,
          fontWeight: 500,
          color: T.textPrimary,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          lineHeight: 1.3,
          marginBottom: 8,
        }}
      >
        {truncate(orch.task || orch.title || orch.description || "Untitled", 60)}
      </div>

      {/* Bottom: status badge + fraction + elapsed */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          style={{
            fontSize: 9,
            fontWeight: 600,
            fontFamily: MONO,
            color: statusColor,
            background: statusColor + "18",
            border: `1px solid ${statusColor}30`,
            borderRadius: 10,
            padding: "2px 8px",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            flexShrink: 0,
            lineHeight: 1.4,
          }}
        >
          {status}
        </span>
        {totalTasks > 0 && (
          <span
            style={{
              fontSize: 10,
              fontFamily: MONO,
              color: T.textMuted,
              fontWeight: 500,
            }}
          >
            {doneTasks}/{totalTasks}
          </span>
        )}
        <span
          style={{
            fontSize: 10,
            fontFamily: MONO,
            color: T.textMuted,
            marginLeft: "auto",
          }}
        >
          {formatElapsed(orch.startedAt || orch.created)}
        </span>
      </div>
    </div>
  );
});

// -- Section Header -----------------------------------------------------------

const SectionHeader = memo(function SectionHeader({
  title,
  color,
  pulseDot,
  badge,
}: {
  title: string;
  color: string;
  pulseDot?: boolean;
  badge?: string | number;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        marginBottom: 14,
      }}
    >
      {pulseDot && (
        <div
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: color,
            boxShadow: `0 0 8px ${color}`,
            animation: "ho-pulse 2s ease-in-out infinite",
            flexShrink: 0,
          }}
        />
      )}
      <span
        style={{
          fontSize: 11,
          fontFamily: MONO,
          fontWeight: 600,
          color: color,
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          lineHeight: 1,
        }}
      >
        {title}
      </span>
      {badge !== undefined && (
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            fontFamily: MONO,
            color: color,
            background: color + "18",
            borderRadius: 10,
            padding: "2px 7px",
            lineHeight: 1.3,
          }}
        >
          {badge}
        </span>
      )}
    </div>
  );
});

// -- Main Component -----------------------------------------------------------

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
  // Inject styles on mount
  useEffect(() => {
    injectStyles();
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
    const completed = agents.filter(
      (a) => {
        const s = (a.status || "").toLowerCase();
        return s === "done" || s === "completed";
      }
    );
    const failed = agents.filter((a) => (a.status || "").toLowerCase() === "failed");

    return {
      totalProjects: (projects || []).length,
      activeAgents: running.length,
      completed: completed.length,
      failed: failed.length,
      orchestrations: (orchestrations || []).length,
    };
  }, [projects, serverAgents, orchestrations]);

  const liveAgents = useMemo(() => {
    return (serverAgents || []).filter(
      (a) => (a.status || "").toLowerCase() === "running"
    );
  }, [serverAgents]);

  const sortedOrchestrations = useMemo(() => {
    return [...(orchestrations || [])]
      .sort((a, b) => {
        const aTime = new Date(a.startedAt || a.created || 0).getTime();
        const bTime = new Date(b.startedAt || b.created || 0).getTime();
        return bTime - aTime;
      })
      .slice(0, 20);
  }, [orchestrations]);

  const handleSelectAgent = useCallback(
    (id: string) => onSelectAgent(id),
    [onSelectAgent]
  );

  const handleSelectOrch = useCallback(
    (id: string) => onSelectOrchestration(id),
    [onSelectOrchestration]
  );

  const handleNewOrch = useCallback(() => onNewOrchestration(), [onNewOrchestration]);
  const handleSpawn = useCallback(() => onSpawnAgent(), [onSpawnAgent]);
  const handleNavigateProjects = useCallback(
    () => onNavigate("projects-list"),
    [onNavigate]
  );

  // Hover states for action buttons
  const [hoveredAction, setHoveredAction] = useState<string | null>(null);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
        padding: 0,
        fontFamily: FONT,
        color: T.textPrimary,
        minHeight: "100%",
      }}
    >
      {/* ============================================================ */}
      {/* Row 1: Stats Strip (full width)                              */}
      {/* ============================================================ */}
      <div
        style={{
          display: "flex",
          gap: 8,
          width: "100%",
        }}
      >
        <StatCard
          label="Projects"
          value={stats.totalProjects}
          color={T.secondary}
          delay={0}
        />
        <StatCard
          label="Active Agents"
          value={stats.activeAgents}
          color={T.primary}
          delay={50}
        />
        <StatCard
          label="Completed"
          value={stats.completed}
          color={T.success}
          delay={100}
        />
        <StatCard
          label="Failed"
          value={stats.failed}
          color={T.danger}
          delay={150}
        />
        <StatCard
          label="Orchestrations"
          value={stats.orchestrations}
          color={T.warm}
          delay={200}
        />
        <StatCard
          label="Uptime"
          value={formatUptime(uptimeSeconds)}
          color={T.textSecondary}
          delay={250}
        />
      </div>

      {/* ============================================================ */}
      {/* Row 2: Live Agents (60%) + Orchestrations (40%)              */}
      {/* ============================================================ */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "3fr 2fr",
          gap: 12,
          flex: 1,
          minHeight: 0,
        }}
      >
        {/* Live Agents Panel */}
        <div
          style={{
            background: T.surface1,
            border: `1px solid ${T.border}`,
            borderRadius: 10,
            padding: "18px 20px",
            display: "flex",
            flexDirection: "column",
            minHeight: 340,
            overflow: "hidden",
            animation: "ho-fadeInUp 0.5s cubic-bezier(0.4, 0, 0.2, 1) 0.1s both",
          }}
        >
          <SectionHeader
            title="LIVE AGENTS"
            color={T.primary}
            pulseDot={liveAgents.length > 0}
            badge={liveAgents.length > 0 ? liveAgents.length : undefined}
          />

          {liveAgents.length === 0 ? (
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                padding: 40,
              }}
            >
              <span style={{ fontSize: 40, opacity: 0.15, lineHeight: 1 }}>
                {"\u{1F916}"}
              </span>
              <span
                style={{
                  fontSize: 13,
                  fontFamily: FONT,
                  fontWeight: 500,
                  color: T.textMuted,
                  textAlign: "center",
                }}
              >
                No active agents
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontFamily: FONT,
                  color: T.textMuted,
                  opacity: 0.6,
                  textAlign: "center",
                }}
              >
                Spawn an agent or start an orchestration
              </span>
            </div>
          ) : (
            <div
              className="ho-scrollbar"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                gap: 8,
                overflowY: "auto",
                flex: 1,
                paddingRight: 4,
              }}
            >
              {liveAgents.map((agent) => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  onClick={() => handleSelectAgent(agent.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Orchestrations Panel */}
        <div
          style={{
            background: T.surface1,
            border: `1px solid ${T.border}`,
            borderRadius: 10,
            padding: "18px 20px",
            display: "flex",
            flexDirection: "column",
            minHeight: 340,
            overflow: "hidden",
            animation: "ho-fadeInUp 0.5s cubic-bezier(0.4, 0, 0.2, 1) 0.15s both",
          }}
        >
          <SectionHeader
            title="ORCHESTRATIONS"
            color={T.warm}
            badge={stats.orchestrations > 0 ? stats.orchestrations : undefined}
          />

          {sortedOrchestrations.length === 0 ? (
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                padding: 40,
              }}
            >
              <span style={{ fontSize: 40, opacity: 0.15, lineHeight: 1 }}>
                {"\u{1F504}"}
              </span>
              <span
                style={{
                  fontSize: 13,
                  fontFamily: FONT,
                  fontWeight: 500,
                  color: T.textMuted,
                  textAlign: "center",
                }}
              >
                No orchestrations yet
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontFamily: FONT,
                  color: T.textMuted,
                  opacity: 0.6,
                  textAlign: "center",
                }}
              >
                Decompose tasks into coordinated sub-agents
              </span>
            </div>
          ) : (
            <div
              className="ho-scrollbar"
              style={{
                overflowY: "auto",
                flex: 1,
                maxHeight: 400,
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
        </div>
      </div>

      {/* ============================================================ */}
      {/* Row 3: Quick Actions Bar (full width)                        */}
      {/* ============================================================ */}
      <div
        style={{
          background: T.surface2,
          borderTop: `1px solid ${T.border}`,
          borderRadius: 10,
          height: 56,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 20px",
          gap: 10,
          animation: "ho-fadeInUp 0.5s cubic-bezier(0.4, 0, 0.2, 1) 0.2s both",
        }}
      >
        {/* NEW ORCHESTRATION button */}
        <button
          onClick={handleNewOrch}
          onMouseEnter={() => setHoveredAction("new-orch")}
          onMouseLeave={() => setHoveredAction(null)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 18px",
            borderRadius: 6,
            border: "none",
            background: T.primary,
            color: "#ffffff",
            fontFamily: FONT,
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
            transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
            boxShadow: hoveredAction === "new-orch"
              ? `0 0 24px ${T.primaryGlow}, 0 2px 8px rgba(0,0,0,0.3)`
              : `0 0 12px ${T.primaryGlow}`,
            transform: hoveredAction === "new-orch" ? "scale(1.02)" : "scale(1)",
            outline: "none",
            letterSpacing: "0.02em",
          }}
        >
          NEW ORCHESTRATION
        </button>

        {/* SPAWN AGENT button */}
        <button
          onClick={handleSpawn}
          onMouseEnter={() => setHoveredAction("spawn")}
          onMouseLeave={() => setHoveredAction(null)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 18px",
            borderRadius: 6,
            border: `1px solid ${T.border}`,
            background: hoveredAction === "spawn" ? T.secondaryMuted : T.surface3,
            color: T.secondary,
            fontFamily: FONT,
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            transition: "all 0.2s ease",
            outline: "none",
            letterSpacing: "0.02em",
          }}
        >
          SPAWN AGENT
        </button>

        {/* ALL PROJECTS button */}
        <button
          onClick={handleNavigateProjects}
          onMouseEnter={() => setHoveredAction("projects")}
          onMouseLeave={() => setHoveredAction(null)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 18px",
            borderRadius: 6,
            border: "none",
            background: "transparent",
            color: hoveredAction === "projects" ? T.textPrimary : T.textSecondary,
            fontFamily: FONT,
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            transition: "all 0.2s ease",
            outline: "none",
            letterSpacing: "0.02em",
          }}
        >
          ALL PROJECTS
        </button>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Right: summary */}
        <span
          style={{
            fontSize: 10,
            fontFamily: MONO,
            color: T.textMuted,
            fontWeight: 500,
            whiteSpace: "nowrap",
          }}
        >
          {stats.totalProjects} projects {"\u00B7"} {stats.activeAgents} active
        </span>
      </div>
    </div>
  );
}
