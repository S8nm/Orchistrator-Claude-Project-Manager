"use client";

import { useState, useCallback, useMemo, memo } from "react";

// -- Design System ------------------------------------------------------------

const T = {
  // Backgrounds
  base: "#050508",
  surface1: "#0a0c14",
  surface2: "#10131e",
  surface3: "#181c2e",
  // Borders
  border: "#1e2338",
  borderHover: "#2a3050",
  // Accent colors
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
  // Text
  textPrimary: "#e8ecf4",
  textSecondary: "#7b839a",
  textMuted: "#454d68",
  // Status
  statusActive: "#00d4aa",
  statusPaused: "#ff8b3e",
  statusArchived: "#454d68",
} as const;

const FONT = "'Outfit', sans-serif";
const MONO = "'JetBrains Mono', monospace";

const SIDEBAR_WIDTH = 260;

const STATUS_COLORS: Record<string, string> = {
  active: T.statusActive,
  paused: T.statusPaused,
  archived: T.statusArchived,
};

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
  projects: Array<{
    id: string;
    name: string;
    path: string;
    type: string;
    stack: string[];
    status: string;
    tags: string[];
    remote?: string;
  }>;
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
  count?: number;
}

const NAV_ITEMS: NavItem[] = [
  { id: "head-office", label: "Head Office", icon: "\u{1F3E2}" },
  { id: "orchestrations", label: "Orchestrations", icon: "\u{1F504}" },
  { id: "presets", label: "Presets", icon: "\u{1F3AD}" },
];

// -- Injected styles ----------------------------------------------------------

const INJECTED_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap');

  @keyframes pulse {
    0%, 100% {
      transform: scale(1);
      opacity: 1;
    }
    50% {
      transform: scale(1.5);
      opacity: 0.4;
    }
  }

  @keyframes accentShimmer {
    0% { opacity: 0.7; }
    50% { opacity: 1; }
    100% { opacity: 0.7; }
  }

  .sidebar-scroll::-webkit-scrollbar {
    width: 4px;
  }
  .sidebar-scroll::-webkit-scrollbar-track {
    background: transparent;
  }
  .sidebar-scroll::-webkit-scrollbar-thumb {
    background: ${T.surface3};
    border-radius: 2px;
  }
  .sidebar-scroll::-webkit-scrollbar-thumb:hover {
    background: ${T.textMuted};
  }

  .sidebar-scroll {
    scrollbar-width: thin;
    scrollbar-color: ${T.surface3} transparent;
  }
`;

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
    height: 36,
    padding: "0 14px",
    margin: "2px 10px",
    borderRadius: 6,
    border: "none",
    borderLeft: isActive
      ? `2px solid ${T.primary}`
      : "2px solid transparent",
    background: isActive
      ? T.primaryMuted
      : hovered
        ? T.surface3
        : "transparent",
    color: isActive
      ? T.primary
      : hovered
        ? T.textPrimary
        : T.textSecondary,
    cursor: "pointer",
    fontSize: 13,
    fontFamily: FONT,
    fontWeight: isActive ? 500 : 400,
    textAlign: "left" as const,
    width: "calc(100% - 20px)",
    transition: "all 0.2s ease",
    outline: "none",
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
          fontSize: 16,
          width: 20,
          textAlign: "center",
          lineHeight: 1,
          filter: isActive ? "saturate(1.3)" : "saturate(0.7)",
          transition: "filter 0.2s ease",
        }}
      >
        {item.icon}
      </span>
      <span style={{ flex: 1 }}>{item.label}</span>
      {item.count !== undefined && item.count > 0 && (
        <span
          style={{
            fontSize: 10,
            fontFamily: MONO,
            fontWeight: 600,
            color: T.textMuted,
            background: "rgba(255, 255, 255, 0.06)",
            padding: "1px 6px",
            borderRadius: 8,
            minWidth: 18,
            textAlign: "center",
          }}
        >
          {item.count}
        </span>
      )}
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
  const statusColor = STATUS_COLORS[project.status] || T.textMuted;
  const primaryStack = project.stack.length > 0 ? project.stack[0] : project.type;

  const style: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 8,
    height: 32,
    padding: "0 14px",
    margin: "1px 10px",
    borderRadius: 5,
    border: "none",
    background: isActive
      ? T.primaryMuted
      : hovered
        ? T.surface2
        : "transparent",
    color: isActive
      ? T.primary
      : hovered
        ? T.textPrimary
        : T.textSecondary,
    cursor: "pointer",
    fontSize: 12,
    fontFamily: FONT,
    fontWeight: isActive ? 500 : 400,
    textAlign: "left" as const,
    width: "calc(100% - 20px)",
    transition: "all 0.2s ease",
    outline: "none",
  };

  return (
    <button
      style={style}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Status dot */}
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: statusColor,
          flexShrink: 0,
          boxShadow: project.status === "active"
            ? `0 0 6px ${statusColor}60`
            : "none",
          transition: "box-shadow 0.2s ease",
        }}
      />
      {/* Name */}
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
      {/* Stack tag pill */}
      <span
        style={{
          fontSize: 9,
          fontFamily: MONO,
          fontWeight: 500,
          color: T.textMuted,
          background: isActive
            ? "rgba(0, 212, 170, 0.08)"
            : "rgba(255, 255, 255, 0.04)",
          padding: "2px 6px",
          borderRadius: 3,
          flexShrink: 0,
          maxWidth: 70,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          letterSpacing: "0.02em",
          transition: "background 0.2s ease",
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
  const activeCount = useMemo(
    () => serverAgents.filter((a) => a.status === "running" || a.status === "active").length,
    [serverAgents],
  );

  const projectCount = useMemo(
    () => projects.length,
    [projects],
  );

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

  // ---------- Render ----------

  return (
    <>
      <style>{INJECTED_STYLES}</style>

      {/* Fixed sidebar */}
      <aside
        style={{
          position: "fixed",
          left: 0,
          top: 0,
          width: SIDEBAR_WIDTH,
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          // Subtle vertical gradient, slightly lighter at top
          background: `linear-gradient(180deg, ${T.surface1} 0%, rgba(8, 10, 16, 1) 100%)`,
          borderRight: `1px solid ${T.border}`,
          overflow: "hidden",
          zIndex: 100,
          fontFamily: FONT,
        }}
      >
        {/* Left edge accent gradient line */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: 2,
            height: "100%",
            background: `linear-gradient(180deg, ${T.primary} 0%, ${T.secondary} 100%)`,
            zIndex: 1,
            animation: "accentShimmer 4s ease-in-out infinite",
          }}
        />

        {/* Subtle noise texture overlay (CSS-only repeating gradient trick) */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: 0.03,
            background: [
              "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 4px)",
              "repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(255,255,255,0.02) 2px, rgba(255,255,255,0.02) 4px)",
            ].join(", "),
            pointerEvents: "none",
            zIndex: 0,
          }}
        />

        {/* Logo area */}
        <div
          style={{
            height: 60,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "0 18px",
            flexShrink: 0,
            position: "relative",
            zIndex: 2,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* Teal diamond accent */}
            <span
              style={{
                display: "inline-block",
                width: 8,
                height: 8,
                background: T.primary,
                transform: "rotate(45deg)",
                borderRadius: 1.5,
                boxShadow: `0 0 10px ${T.primaryGlow}, 0 0 20px ${T.primaryMuted}`,
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontFamily: MONO,
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: 3,
                textTransform: "uppercase",
                color: T.primary,
                lineHeight: 1,
              }}
            >
              ORCHESTRATOR
            </span>
          </div>
          <span
            style={{
              fontFamily: MONO,
              fontSize: 9,
              color: T.textMuted,
              marginTop: 4,
              marginLeft: 16,
              letterSpacing: "0.03em",
            }}
          >
            v2.0 — mission control
          </span>
        </div>

        {/* Navigation items */}
        <nav
          style={{
            padding: "6px 0",
            flexShrink: 0,
            position: "relative",
            zIndex: 2,
          }}
        >
          {NAV_ITEMS.map((item) => (
            <NavButton
              key={item.id}
              item={item}
              isActive={activeView === item.id}
              onClick={() => handleNavClick(item.id)}
            />
          ))}
        </nav>

        {/* Divider with PROJECTS label */}
        <div
          style={{
            position: "relative",
            zIndex: 2,
            margin: "16px 14px",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <div
            style={{
              flex: 1,
              height: 1,
              background: T.border,
            }}
          />
          <span
            style={{
              fontFamily: MONO,
              fontSize: 9,
              fontWeight: 500,
              textTransform: "uppercase",
              letterSpacing: 2,
              color: T.textMuted,
              flexShrink: 0,
            }}
          >
            PROJECTS
          </span>
          <div
            style={{
              flex: 1,
              height: 1,
              background: T.border,
            }}
          />
        </div>

        {/* Projects list (scrollable) */}
        <div
          className="sidebar-scroll"
          style={{
            flex: 1,
            overflowY: "auto",
            overflowX: "hidden",
            padding: "2px 0",
            position: "relative",
            zIndex: 2,
          }}
        >
          {projects.map((project) => (
            <ProjectItem
              key={project.id}
              project={project as Project}
              isActive={activeView === project.id}
              onClick={() => handleProjectClick(project.id)}
            />
          ))}
          {projects.length === 0 && (
            <div
              style={{
                padding: "24px 18px",
                textAlign: "center",
                color: T.textMuted,
                fontSize: 11,
                fontFamily: MONO,
                letterSpacing: "0.02em",
              }}
            >
              No projects registered
            </div>
          )}
        </div>

        {/* Bottom stats bar */}
        <div
          style={{
            height: 48,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 20,
            borderTop: `1px solid ${T.border}`,
            background: T.surface1,
            flexShrink: 0,
            position: "relative",
            zIndex: 2,
          }}
        >
          {/* Active agents */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontFamily: MONO,
              fontSize: 10,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: activeCount > 0 ? T.success : T.textMuted,
                animation: activeCount > 0 ? "pulse 2s ease-in-out infinite" : "none",
                flexShrink: 0,
              }}
            />
            <span
              style={{
                color: activeCount > 0 ? T.success : T.textMuted,
                fontWeight: 600,
              }}
            >
              {activeCount}
            </span>
            <span style={{ color: T.textMuted }}>active</span>
          </div>

          {/* Separator */}
          <div
            style={{
              width: 1,
              height: 14,
              background: T.border,
            }}
          />

          {/* Total projects */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontFamily: MONO,
              fontSize: 10,
            }}
          >
            <span
              style={{
                color: T.textSecondary,
                fontWeight: 600,
              }}
            >
              {projectCount}
            </span>
            <span style={{ color: T.textMuted }}>projects</span>
          </div>
        </div>
      </aside>

      {/* Main content area */}
      <main
        style={{
          marginLeft: SIDEBAR_WIDTH,
          minHeight: "100vh",
          background: T.base,
          fontFamily: FONT,
          color: T.textPrimary,
        }}
      >
        {children}
      </main>
    </>
  );
}
