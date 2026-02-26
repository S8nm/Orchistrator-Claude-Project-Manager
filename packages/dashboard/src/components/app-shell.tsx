"use client";

import { useState, useCallback, useMemo, memo } from "react";

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

const STATUS_COLORS: Record<string, string> = {
  active: COLORS.success,
  paused: "#eab308",
  archived: "#6b7280",
};

const FONT_STACK = "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const MONO_STACK = "'SF Mono', Monaco, 'Fira Code', monospace";

const SIDEBAR_WIDTH = 240;

// -- Types --------------------------------------------------------------------

interface Project {
  id: string;
  name: string;
  path: string;
  type: string;
  stack: string[];
  status: string;
  tags: string[];
  remote?: string;
}

interface AppShellProps {
  projects: Project[];
  activeView: string;
  onNavigate: (view: string) => void;
  serverAgents: any[];
  children: React.ReactNode;
}

// -- Nav items ----------------------------------------------------------------

interface NavItem {
  id: string;
  label: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: "head-office", label: "Head Office", icon: "\u{1F3E2}" },
  { id: "orchestrations", label: "Orchestrations", icon: "\u{1F504}" },
  { id: "presets", label: "Presets", icon: "\u{1F3AD}" },
];

// -- View title mapping -------------------------------------------------------

function getViewTitle(activeView: string, projects: Project[]): string {
  const nav = NAV_ITEMS.find((n) => n.id === activeView);
  if (nav) return nav.label;
  const proj = projects.find((p) => p.id === activeView);
  if (proj) return proj.name;
  return "Dashboard";
}

function getBreadcrumb(activeView: string, projects: Project[]): string[] {
  const nav = NAV_ITEMS.find((n) => n.id === activeView);
  if (nav) return ["Orchestrator", nav.label];
  const proj = projects.find((p) => p.id === activeView);
  if (proj) return ["Orchestrator", "Projects", proj.name];
  return ["Orchestrator"];
}

// -- Memoized sub-components --------------------------------------------------

const NavButton = memo(function NavButton({
  item,
  isActive,
  onClick,
}: {
  item: NavItem;
  isActive: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  const style: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 12px",
    margin: "1px 8px",
    borderRadius: 6,
    border: "none",
    borderLeft: isActive ? `3px solid ${COLORS.primary}` : "3px solid transparent",
    background: isActive
      ? COLORS.primaryMuted
      : hovered
        ? "rgba(255, 255, 255, 0.04)"
        : "transparent",
    color: isActive ? COLORS.textPrimary : COLORS.textSecondary,
    cursor: "pointer",
    fontSize: 13,
    fontFamily: FONT_STACK,
    fontWeight: isActive ? 600 : 400,
    textAlign: "left" as const,
    width: "calc(100% - 16px)",
    transition: "background 0.15s ease, color 0.15s ease, border-color 0.15s ease",
  };

  return (
    <button
      style={style}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span style={{ fontSize: 15, width: 20, textAlign: "center" }}>{item.icon}</span>
      <span>{item.label}</span>
    </button>
  );
});

const ProjectItem = memo(function ProjectItem({
  project,
  isActive,
  onClick,
}: {
  project: Project;
  isActive: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const statusColor = STATUS_COLORS[project.status] || COLORS.textMuted;
  const primaryStack = project.stack.length > 0 ? project.stack[0] : project.type;

  const style: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 12px",
    margin: "1px 8px",
    borderRadius: 6,
    border: "none",
    borderLeft: isActive ? `3px solid ${COLORS.primary}` : "3px solid transparent",
    background: isActive
      ? COLORS.primaryMuted
      : hovered
        ? "rgba(255, 255, 255, 0.04)"
        : "transparent",
    color: isActive ? COLORS.textPrimary : COLORS.textSecondary,
    cursor: "pointer",
    fontSize: 12,
    fontFamily: FONT_STACK,
    fontWeight: isActive ? 500 : 400,
    textAlign: "left" as const,
    width: "calc(100% - 16px)",
    transition: "background 0.15s ease, color 0.15s ease, border-color 0.15s ease",
  };

  return (
    <button
      style={style}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: statusColor,
          flexShrink: 0,
          boxShadow: `0 0 4px ${statusColor}40`,
        }}
      />
      <span
        style={{
          flex: 1,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {project.name}
      </span>
      <span
        style={{
          fontSize: 10,
          fontFamily: MONO_STACK,
          color: COLORS.textMuted,
          background: "rgba(255, 255, 255, 0.05)",
          padding: "1px 5px",
          borderRadius: 3,
          flexShrink: 0,
          maxWidth: 70,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {primaryStack}
      </span>
    </button>
  );
});

// -- Main component -----------------------------------------------------------

export default function AppShell({
  projects,
  activeView,
  onNavigate,
  serverAgents,
  children,
}: AppShellProps) {
  const runningAgentCount = useMemo(
    () => serverAgents.filter((a) => a.status === "running" || a.status === "active").length,
    [serverAgents],
  );

  const activeProjectCount = useMemo(
    () => projects.filter((p) => p.status === "active").length,
    [projects],
  );

  const viewTitle = useMemo(() => getViewTitle(activeView, projects), [activeView, projects]);
  const breadcrumb = useMemo(() => getBreadcrumb(activeView, projects), [activeView, projects]);

  const handleNavClick = useCallback(
    (id: string) => {
      onNavigate(id);
    },
    [onNavigate],
  );

  const handleProjectClick = useCallback(
    (id: string) => {
      onNavigate(id);
    },
    [onNavigate],
  );

  // ---------- Styles ----------

  const rootStyle: React.CSSProperties = {
    display: "flex",
    height: "100vh",
    width: "100vw",
    overflow: "hidden",
    background: COLORS.bg,
    fontFamily: FONT_STACK,
    color: COLORS.textPrimary,
  };

  const sidebarStyle: React.CSSProperties = {
    width: SIDEBAR_WIDTH,
    minWidth: SIDEBAR_WIDTH,
    height: "100vh",
    display: "flex",
    flexDirection: "column",
    background: COLORS.panel,
    borderRight: `1px solid ${COLORS.border}`,
    overflow: "hidden",
  };

  const logoStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "16px 16px 12px",
    borderBottom: `1px solid ${COLORS.border}`,
    flexShrink: 0,
  };

  const navSectionStyle: React.CSSProperties = {
    padding: "8px 0",
    flexShrink: 0,
  };

  const dividerStyle: React.CSSProperties = {
    height: 1,
    background: COLORS.border,
    margin: "4px 16px",
    flexShrink: 0,
  };

  const projectsHeaderStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "10px 16px 4px",
    flexShrink: 0,
  };

  const projectsListStyle: React.CSSProperties = {
    flex: 1,
    overflowY: "auto",
    overflowX: "hidden",
    padding: "2px 0",
    scrollbarWidth: "thin" as any,
    scrollbarColor: `${COLORS.borderLight} transparent`,
  };

  const statsBarStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-around",
    padding: "10px 12px",
    borderTop: `1px solid ${COLORS.border}`,
    flexShrink: 0,
    background: "rgba(0, 0, 0, 0.2)",
  };

  const mainStyle: React.CSSProperties = {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    minWidth: 0,
  };

  const topBarStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 24px",
    borderBottom: `1px solid ${COLORS.border}`,
    background: COLORS.panel,
    flexShrink: 0,
    minHeight: 52,
  };

  const contentStyle: React.CSSProperties = {
    flex: 1,
    overflow: "auto",
    background: COLORS.bg,
  };

  // ---------- Render ----------

  return (
    <div style={rootStyle}>
      {/* Sidebar */}
      <aside style={sidebarStyle}>
        {/* Logo */}
        <div style={logoStyle}>
          <span style={{ fontSize: 18 }}>{"\u26A1"}</span>
          <span
            style={{
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: "-0.01em",
              color: COLORS.textPrimary,
            }}
          >
            Agent Orchestrator
          </span>
        </div>

        {/* Nav items */}
        <nav style={navSectionStyle}>
          {NAV_ITEMS.map((item) => (
            <NavButton
              key={item.id}
              item={item}
              isActive={activeView === item.id}
              onClick={() => handleNavClick(item.id)}
            />
          ))}
        </nav>

        {/* Divider */}
        <div style={dividerStyle} />

        {/* Projects header */}
        <div style={projectsHeaderStyle}>
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: COLORS.textMuted,
            }}
          >
            {"\u{1F4C2}"} Projects
          </span>
          <span
            style={{
              fontSize: 10,
              fontFamily: MONO_STACK,
              color: COLORS.textMuted,
              background: "rgba(255, 255, 255, 0.05)",
              padding: "1px 6px",
              borderRadius: 8,
            }}
          >
            {projects.length}
          </span>
        </div>

        {/* Projects list */}
        <div style={projectsListStyle}>
          {projects.map((project) => (
            <ProjectItem
              key={project.id}
              project={project}
              isActive={activeView === project.id}
              onClick={() => handleProjectClick(project.id)}
            />
          ))}
          {projects.length === 0 && (
            <div
              style={{
                padding: "16px",
                textAlign: "center",
                color: COLORS.textMuted,
                fontSize: 12,
              }}
            >
              No projects registered
            </div>
          )}
        </div>

        {/* Stats bar */}
        <div style={statsBarStyle}>
          <StatBadge
            icon={"\u26A1"}
            value={runningAgentCount}
            label="agents"
            color={runningAgentCount > 0 ? COLORS.success : COLORS.textMuted}
          />
          <div
            style={{
              width: 1,
              height: 16,
              background: COLORS.border,
            }}
          />
          <StatBadge
            icon={"\u{1F4C2}"}
            value={activeProjectCount}
            label="active"
            color={activeProjectCount > 0 ? COLORS.primary : COLORS.textMuted}
          />
        </div>
      </aside>

      {/* Main content */}
      <main style={mainStyle}>
        {/* Top bar */}
        <header style={topBarStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            <h1
              style={{
                fontSize: 16,
                fontWeight: 600,
                margin: 0,
                color: COLORS.textPrimary,
                whiteSpace: "nowrap",
              }}
            >
              {viewTitle}
            </h1>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                fontSize: 12,
                color: COLORS.textMuted,
              }}
            >
              {breadcrumb.map((segment, i) => (
                <span key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  {i > 0 && (
                    <span style={{ color: COLORS.borderLight, fontSize: 10 }}>/</span>
                  )}
                  <span
                    style={{
                      color: i === breadcrumb.length - 1 ? COLORS.textSecondary : COLORS.textMuted,
                    }}
                  >
                    {segment}
                  </span>
                </span>
              ))}
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexShrink: 0,
            }}
          >
            {/* Action buttons area -- consumers can place buttons in children or extend */}
            {runningAgentCount > 0 && (
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  fontSize: 11,
                  fontFamily: MONO_STACK,
                  color: COLORS.success,
                  background: "rgba(16, 185, 129, 0.1)",
                  padding: "4px 10px",
                  borderRadius: 12,
                  border: `1px solid rgba(16, 185, 129, 0.2)`,
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: COLORS.success,
                    animation: "pulse 2s ease-in-out infinite",
                  }}
                />
                {runningAgentCount} running
              </span>
            )}
          </div>
        </header>

        {/* Content area */}
        <div style={contentStyle}>{children}</div>
      </main>

      {/* Pulse animation keyframes */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        aside::-webkit-scrollbar {
          width: 4px;
        }
        aside::-webkit-scrollbar-track {
          background: transparent;
        }
        aside::-webkit-scrollbar-thumb {
          background: ${COLORS.borderLight};
          border-radius: 2px;
        }
        aside::-webkit-scrollbar-thumb:hover {
          background: ${COLORS.textMuted};
        }
      `}</style>
    </div>
  );
}

// -- Small helper component ---------------------------------------------------

function StatBadge({
  icon,
  value,
  label,
  color,
}: {
  icon: string;
  value: number;
  label: string;
  color: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 5,
        fontSize: 11,
        color: COLORS.textSecondary,
      }}
    >
      <span style={{ fontSize: 12 }}>{icon}</span>
      <span style={{ fontFamily: MONO_STACK, fontWeight: 600, color }}>{value}</span>
      <span style={{ color: COLORS.textMuted }}>{label}</span>
    </div>
  );
}
