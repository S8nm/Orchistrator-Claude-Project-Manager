"use client";

import { useState, useEffect, useCallback, useMemo, memo } from "react";
import type { HierarchyNode, HierarchyRegistry } from "@orchestrator/shared";

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
} as const;

const FONT = "'Outfit', sans-serif";
const MONO = "'JetBrains Mono', monospace";

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

// -- Status Config ------------------------------------------------------------

interface StatusVisual {
  dotColor: string;
  textColor: string;
  label: string;
  pulse: boolean;
  glow: boolean;
}

const STATUS_VISUALS: Record<string, StatusVisual> = {
  cold:     { dotColor: T.textMuted,  textColor: T.textMuted,    label: "Cold",     pulse: false, glow: false },
  spawning: { dotColor: "#facc15",    textColor: "#facc15",      label: "Spawning", pulse: true,  glow: false },
  idle:     { dotColor: T.success,    textColor: T.success,      label: "Idle",     pulse: true,  glow: false },
  active:   { dotColor: T.success,    textColor: T.success,      label: "Active",   pulse: false, glow: true  },
  dormant:  { dotColor: T.textMuted,  textColor: T.textMuted,    label: "Dormant",  pulse: false, glow: false },
  done:     { dotColor: T.success,    textColor: T.success,      label: "Done",     pulse: false, glow: false },
  failed:   { dotColor: T.danger,     textColor: T.danger,       label: "Failed",   pulse: false, glow: false },
  shutdown: { dotColor: "#374151",    textColor: "#374151",       label: "Shutdown", pulse: false, glow: false },
};

function getStatusVisual(status: string): StatusVisual {
  return STATUS_VISUALS[status] || STATUS_VISUALS.cold;
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
    @keyframes ht-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.35; }
    }

    @keyframes ht-glow {
      0%, 100% { box-shadow: 0 0 6px rgba(74, 222, 128, 0.4); }
      50% { box-shadow: 0 0 18px rgba(74, 222, 128, 0.8); }
    }

    @keyframes ht-glow-dot {
      0%, 100% { box-shadow: 0 0 4px currentColor; }
      50% { box-shadow: 0 0 12px currentColor; }
    }

    @keyframes ht-fadeInUp {
      from {
        opacity: 0;
        transform: translateY(8px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .ht-scrollbar::-webkit-scrollbar {
      width: 4px;
    }
    .ht-scrollbar::-webkit-scrollbar-track {
      background: transparent;
    }
    .ht-scrollbar::-webkit-scrollbar-thumb {
      background: ${T.border};
      border-radius: 2px;
    }
    .ht-scrollbar::-webkit-scrollbar-thumb:hover {
      background: ${T.borderHover};
    }
  `;
  document.head.appendChild(style);
}

// -- Props --------------------------------------------------------------------

interface HierarchyTreeProps {
  registry: HierarchyRegistry;
  nodes: HierarchyNode[];
  onSelectNode?: (node: HierarchyNode) => void;
  onSendTask?: (task: string) => void;
  onDeactivate?: () => void;
  selectedNodeId?: string | null;
}

// -- Status Badge Component ---------------------------------------------------

const StatusBadge = memo(function StatusBadge({
  status,
  size = "normal",
}: {
  status: string;
  size?: "normal" | "small";
}) {
  const vis = getStatusVisual(status);
  const dotSize = size === "small" ? 5 : 7;
  const fontSize = size === "small" ? 9 : 10;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: size === "small" ? "1px 6px" : "2px 8px",
        borderRadius: 12,
        fontSize,
        fontWeight: 600,
        fontFamily: MONO,
        background: vis.textColor + "18",
        color: vis.textColor,
        border: `1px solid ${vis.textColor}30`,
        lineHeight: 1.4,
      }}
    >
      {/* Status indicator */}
      {status === "done" ? (
        <span style={{ fontSize: dotSize + 3, lineHeight: 1 }}>{"\u2713"}</span>
      ) : status === "failed" ? (
        <span style={{ fontSize: dotSize + 3, lineHeight: 1 }}>{"\u2717"}</span>
      ) : status === "dormant" ? (
        <span style={{ fontSize: dotSize + 1, lineHeight: 1, opacity: 0.6 }}>zzz</span>
      ) : (
        <span
          style={{
            width: dotSize,
            height: dotSize,
            borderRadius: "50%",
            background: vis.dotColor,
            display: "inline-block",
            flexShrink: 0,
            animation: vis.pulse
              ? "ht-pulse 2s ease-in-out infinite"
              : vis.glow
                ? "ht-glow-dot 1.5s ease-in-out infinite"
                : "none",
            boxShadow: vis.glow ? `0 0 8px ${vis.dotColor}` : "none",
            color: vis.dotColor,
          }}
        />
      )}
      {vis.label}
    </span>
  );
});

// -- Orchestrator Node --------------------------------------------------------

const OrchestratorNode = memo(function OrchestratorNode({
  node,
  isSelected,
  onClick,
}: {
  node: HierarchyNode;
  isSelected: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const config = getRoleConfig(node.role);
  const vis = getStatusVisual(node.status);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 260,
        margin: "0 auto",
        background: T.surface2,
        border: `2px solid ${isSelected ? config.color : hovered ? T.borderHover : T.border}`,
        borderRadius: 12,
        padding: "20px 24px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 10,
        cursor: "pointer",
        transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
        boxShadow: isSelected
          ? `0 0 24px ${config.color}30, 0 4px 20px rgba(0,0,0,0.3)`
          : vis.glow
            ? `0 0 20px ${vis.dotColor}20`
            : hovered
              ? "0 4px 20px rgba(0,0,0,0.3)"
              : "none",
        animation: "ht-fadeInUp 0.4s cubic-bezier(0.4, 0, 0.2, 1) both",
        position: "relative",
      }}
    >
      {/* Icon */}
      <span style={{ fontSize: 36, lineHeight: 1 }}>{config.icon}</span>

      {/* Label */}
      <span
        style={{
          fontSize: 15,
          fontWeight: 700,
          fontFamily: FONT,
          color: T.textPrimary,
          letterSpacing: "0.02em",
        }}
      >
        {config.label}
      </span>

      {/* Status badge */}
      <StatusBadge status={node.status} />

      {/* Tasks completed */}
      <span
        style={{
          fontSize: 10,
          fontFamily: MONO,
          color: T.textMuted,
          fontWeight: 500,
        }}
      >
        {node.tasksCompleted} tasks completed
        {node.tasksFailed > 0 && (
          <span style={{ color: T.danger, marginLeft: 6 }}>
            {node.tasksFailed} failed
          </span>
        )}
      </span>
    </div>
  );
});

// -- Leader Card --------------------------------------------------------------

const LeaderCard = memo(function LeaderCard({
  node,
  isSelected,
  onClick,
}: {
  node: HierarchyNode;
  isSelected: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const config = getRoleConfig(node.role);
  const vis = getStatusVisual(node.status);
  const isActive = node.status === "active";
  const isDormant = node.status === "dormant";

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 160,
        background: isDormant ? T.surface1 : T.surface2,
        border: `1px solid ${
          isSelected
            ? config.color
            : isActive
              ? config.color + "60"
              : hovered
                ? T.borderHover
                : T.border
        }`,
        borderRadius: 10,
        padding: "14px 16px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        cursor: "pointer",
        transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
        opacity: isDormant ? 0.55 : 1,
        transform: hovered ? "translateY(-2px)" : "translateY(0)",
        boxShadow: isSelected
          ? `0 0 20px ${config.color}30, 0 4px 16px rgba(0,0,0,0.3)`
          : isActive
            ? `0 0 16px ${config.color}20`
            : hovered
              ? "0 4px 16px rgba(0,0,0,0.3)"
              : "none",
        animation: isActive ? "ht-glow 3s ease-in-out infinite" : "none",
        flexShrink: 0,
      }}
    >
      {/* Icon */}
      <span style={{ fontSize: 24, lineHeight: 1 }}>{config.icon}</span>

      {/* Role name */}
      <span
        style={{
          fontSize: 12,
          fontWeight: 600,
          fontFamily: FONT,
          color: isDormant ? T.textMuted : T.textPrimary,
          textAlign: "center",
          lineHeight: 1.2,
        }}
      >
        {config.label}
      </span>

      {/* Status */}
      <StatusBadge status={node.status} size="small" />

      {/* Task count */}
      {node.tasksCompleted > 0 && (
        <span
          style={{
            fontSize: 9,
            fontFamily: MONO,
            color: T.textMuted,
            fontWeight: 500,
          }}
        >
          {node.tasksCompleted} done
        </span>
      )}
    </div>
  );
});

// -- Employee Card ------------------------------------------------------------

const EmployeeCard = memo(function EmployeeCard({
  node,
  isSelected,
  onClick,
}: {
  node: HierarchyNode;
  isSelected: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const config = getRoleConfig(node.role);
  const isDormant = node.status === "dormant";

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 130,
        background: isDormant ? T.base : T.surface1,
        border: `1px solid ${
          isSelected
            ? config.color
            : hovered
              ? T.borderHover
              : T.border
        }`,
        borderRadius: 8,
        padding: "10px 12px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
        cursor: "pointer",
        transition: "all 0.2s ease",
        opacity: isDormant ? 0.45 : 1,
        transform: hovered ? "translateY(-1px)" : "translateY(0)",
        boxShadow: isSelected
          ? `0 0 14px ${config.color}25`
          : hovered
            ? "0 2px 10px rgba(0,0,0,0.25)"
            : "none",
        flexShrink: 0,
      }}
    >
      {/* Icon + status in row */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 16, lineHeight: 1 }}>{config.icon}</span>
        <StatusBadge status={node.status} size="small" />
      </div>

      {/* Current task snippet */}
      {node.currentTaskId && (
        <span
          style={{
            fontSize: 9,
            fontFamily: MONO,
            color: T.textMuted,
            textAlign: "center",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            maxWidth: "100%",
          }}
        >
          {node.currentTaskId.length > 14
            ? node.currentTaskId.slice(0, 14) + "\u2026"
            : node.currentTaskId}
        </span>
      )}
    </div>
  );
});

// -- Connecting Lines ---------------------------------------------------------

function VerticalLine({ height }: { height: number }) {
  return (
    <div
      style={{
        width: 1,
        height,
        background: T.border,
        margin: "0 auto",
        flexShrink: 0,
      }}
    />
  );
}

function HorizontalConnector({ childCount }: { childCount: number }) {
  if (childCount <= 0) return null;

  return (
    <div
      style={{
        position: "relative",
        height: 20,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Vertical stem from parent */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: "50%",
          width: 1,
          height: 10,
          background: T.border,
          transform: "translateX(-0.5px)",
        }}
      />

      {/* Horizontal bar */}
      {childCount > 1 && (
        <div
          style={{
            position: "absolute",
            top: 10,
            left: `calc(50% - ${(childCount - 1) * 88}px)`,
            right: `calc(50% - ${(childCount - 1) * 88}px)`,
            height: 1,
            background: T.border,
          }}
        />
      )}

      {/* Vertical stubs dropping down to each child */}
      <div
        style={{
          position: "absolute",
          top: 10,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: childCount === 1 ? "center" : "space-between",
          padding: childCount === 1 ? 0 : `0 calc(50% - ${(childCount - 1) * 88}px)`,
        }}
      >
        {Array.from({ length: childCount }).map((_, i) => (
          <div
            key={i}
            style={{
              width: 1,
              height: 10,
              background: T.border,
            }}
          />
        ))}
      </div>
    </div>
  );
}

// -- Task Input Bar -----------------------------------------------------------

const PRESET_COMMANDS = [
  { label: "Fix Bug", task: "Fix the reported bug" },
  { label: "Add Feature", task: "Add the requested feature" },
  { label: "Run Tests", task: "Run all tests and report results" },
  { label: "Review Code", task: "Review recent changes for issues" },
];

const TaskInputBar = memo(function TaskInputBar({
  onSendTask,
}: {
  onSendTask?: (task: string) => void;
}) {
  const [taskInput, setTaskInput] = useState("");
  const [hoveredPreset, setHoveredPreset] = useState<number | null>(null);
  const [sendHovered, setSendHovered] = useState(false);

  const handleSend = useCallback(() => {
    const trimmed = taskInput.trim();
    if (!trimmed || !onSendTask) return;
    onSendTask(trimmed);
    setTaskInput("");
  }, [taskInput, onSendTask]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handlePreset = useCallback(
    (task: string) => {
      if (onSendTask) onSendTask(task);
    },
    [onSendTask],
  );

  return (
    <div
      style={{
        background: T.surface2,
        border: `1px solid ${T.border}`,
        borderRadius: 10,
        padding: "14px 18px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        animation: "ht-fadeInUp 0.4s cubic-bezier(0.4, 0, 0.2, 1) 0.3s both",
      }}
    >
      {/* Input row */}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          type="text"
          value={taskInput}
          onChange={(e) => setTaskInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Describe a task to send to the orchestrator..."
          style={{
            flex: 1,
            background: T.surface1,
            border: `1px solid ${T.border}`,
            borderRadius: 6,
            padding: "10px 14px",
            fontSize: 12,
            fontFamily: FONT,
            color: T.textPrimary,
            outline: "none",
            transition: "border-color 0.2s ease",
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = T.primary;
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = T.border;
          }}
        />
        <button
          onClick={handleSend}
          onMouseEnter={() => setSendHovered(true)}
          onMouseLeave={() => setSendHovered(false)}
          disabled={!taskInput.trim() || !onSendTask}
          style={{
            padding: "10px 20px",
            borderRadius: 6,
            border: "none",
            background: taskInput.trim() && onSendTask ? T.primary : T.surface3,
            color: taskInput.trim() && onSendTask ? "#ffffff" : T.textMuted,
            fontFamily: FONT,
            fontSize: 12,
            fontWeight: 700,
            cursor: taskInput.trim() && onSendTask ? "pointer" : "not-allowed",
            transition: "all 0.2s ease",
            boxShadow:
              sendHovered && taskInput.trim() && onSendTask
                ? `0 0 16px ${T.primaryGlow}`
                : "none",
            transform: sendHovered && taskInput.trim() ? "scale(1.02)" : "scale(1)",
            outline: "none",
            letterSpacing: "0.02em",
            flexShrink: 0,
          }}
        >
          Send
        </button>
      </div>

      {/* Preset buttons */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {PRESET_COMMANDS.map((preset, i) => (
          <button
            key={preset.label}
            onClick={() => handlePreset(preset.task)}
            onMouseEnter={() => setHoveredPreset(i)}
            onMouseLeave={() => setHoveredPreset(null)}
            style={{
              padding: "5px 12px",
              borderRadius: 14,
              border: `1px solid ${T.border}`,
              background: hoveredPreset === i ? T.surface3 : "transparent",
              color: hoveredPreset === i ? T.textPrimary : T.textSecondary,
              fontFamily: MONO,
              fontSize: 10,
              fontWeight: 500,
              cursor: onSendTask ? "pointer" : "not-allowed",
              transition: "all 0.15s ease",
              outline: "none",
              opacity: onSendTask ? 1 : 0.5,
            }}
          >
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  );
});

// -- Main Component -----------------------------------------------------------

export default function HierarchyTree({
  registry,
  nodes,
  onSelectNode,
  onSendTask,
  onDeactivate,
  selectedNodeId,
}: HierarchyTreeProps) {
  // Inject styles on mount
  useEffect(() => {
    injectStyles();
  }, []);

  // Build node map for quick lookups
  const nodeMap = useMemo(() => {
    const map = new Map<string, HierarchyNode>();
    for (const n of nodes) {
      map.set(n.id, n);
    }
    return map;
  }, [nodes]);

  // Find the orchestrator node
  const orchestratorNode = useMemo(() => {
    return nodeMap.get(registry.orchestratorNodeId) || null;
  }, [nodeMap, registry.orchestratorNodeId]);

  // Find leader nodes
  const leaderNodes = useMemo(() => {
    const leaders: HierarchyNode[] = [];
    for (const nodeId of Object.values(registry.leaders)) {
      const node = nodeMap.get(nodeId);
      if (node) leaders.push(node);
    }
    // Sort by role for consistent ordering
    leaders.sort((a, b) => a.role.localeCompare(b.role));
    return leaders;
  }, [registry.leaders, nodeMap]);

  // Map leader -> employees
  const leaderEmployees = useMemo(() => {
    const map = new Map<string, HierarchyNode[]>();
    for (const leader of leaderNodes) {
      const employees: HierarchyNode[] = [];
      for (const childId of leader.childIds) {
        const child = nodeMap.get(childId);
        if (child) employees.push(child);
      }
      if (employees.length > 0) {
        map.set(leader.id, employees);
      }
    }
    return map;
  }, [leaderNodes, nodeMap]);

  const handleNodeClick = useCallback(
    (node: HierarchyNode) => {
      if (onSelectNode) onSelectNode(node);
    },
    [onSelectNode],
  );

  const [deactivateHovered, setDeactivateHovered] = useState(false);

  // Find orchestrator status for the header
  const orchStatus = orchestratorNode?.status || "cold";
  const orchStatusVis = getStatusVisual(orchStatus);

  // Empty state
  if (nodes.length === 0) {
    return (
      <div
        style={{
          background: T.surface1,
          border: `1px solid ${T.border}`,
          borderRadius: 12,
          padding: "60px 20px",
          textAlign: "center",
          fontFamily: FONT,
          animation: "ht-fadeInUp 0.4s cubic-bezier(0.4, 0, 0.2, 1) both",
        }}
      >
        <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.2, lineHeight: 1 }}>
          {"\u{1F9E0}"}
        </div>
        <div
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: T.textSecondary,
            marginBottom: 8,
          }}
        >
          No hierarchy active
        </div>
        <div
          style={{
            fontSize: 12,
            color: T.textMuted,
            marginBottom: 20,
          }}
        >
          Activate to begin orchestrating agents for{" "}
          <span style={{ color: T.primary, fontWeight: 600 }}>
            {registry.projectName}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 0,
        fontFamily: FONT,
        color: T.textPrimary,
      }}
    >
      {/* ================================================================== */}
      {/* Header Bar                                                         */}
      {/* ================================================================== */}
      <div
        style={{
          background: T.surface2,
          border: `1px solid ${T.border}`,
          borderRadius: "12px 12px 0 0",
          padding: "12px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "none",
        }}
      >
        {/* Left: project name + status */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span
            style={{
              fontSize: 14,
              fontWeight: 700,
              fontFamily: FONT,
              color: T.textPrimary,
              letterSpacing: "0.01em",
            }}
          >
            {registry.projectName}
          </span>
          <StatusBadge status={orchStatus} />
        </div>

        {/* Right: deactivate button */}
        {onDeactivate && (
          <button
            onClick={onDeactivate}
            onMouseEnter={() => setDeactivateHovered(true)}
            onMouseLeave={() => setDeactivateHovered(false)}
            style={{
              padding: "6px 14px",
              borderRadius: 6,
              border: `1px solid ${deactivateHovered ? T.danger + "60" : T.border}`,
              background: deactivateHovered ? T.dangerMuted : "transparent",
              color: deactivateHovered ? T.danger : T.textSecondary,
              fontFamily: FONT,
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.2s ease",
              outline: "none",
              letterSpacing: "0.02em",
            }}
          >
            Deactivate
          </button>
        )}
      </div>

      {/* ================================================================== */}
      {/* Tree Body                                                          */}
      {/* ================================================================== */}
      <div
        className="ht-scrollbar"
        style={{
          background: T.surface1,
          border: `1px solid ${T.border}`,
          borderTop: `1px solid ${T.border}`,
          padding: "24px 20px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 0,
          overflowX: "auto",
          overflowY: "auto",
          maxHeight: 600,
        }}
      >
        {/* Orchestrator Node */}
        {orchestratorNode && (
          <OrchestratorNode
            node={orchestratorNode}
            isSelected={selectedNodeId === orchestratorNode.id}
            onClick={() => handleNodeClick(orchestratorNode)}
          />
        )}

        {/* Vertical line from orchestrator to leaders */}
        {leaderNodes.length > 0 && <VerticalLine height={24} />}

        {/* Horizontal connector branching to leaders */}
        {leaderNodes.length > 0 && (
          <HorizontalConnector childCount={leaderNodes.length} />
        )}

        {/* Leader Row */}
        {leaderNodes.length > 0 && (
          <div
            style={{
              display: "flex",
              gap: 16,
              justifyContent: "center",
              flexWrap: "wrap",
              width: "100%",
            }}
          >
            {leaderNodes.map((leader) => (
              <div
                key={leader.id}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 0,
                }}
              >
                <LeaderCard
                  node={leader}
                  isSelected={selectedNodeId === leader.id}
                  onClick={() => handleNodeClick(leader)}
                />

                {/* Employees under this leader */}
                {leaderEmployees.has(leader.id) && (
                  <>
                    <VerticalLine height={16} />
                    <HorizontalConnector
                      childCount={leaderEmployees.get(leader.id)!.length}
                    />
                    <div
                      style={{
                        display: "flex",
                        gap: 10,
                        justifyContent: "center",
                        flexWrap: "wrap",
                      }}
                    >
                      {leaderEmployees.get(leader.id)!.map((employee) => (
                        <EmployeeCard
                          key={employee.id}
                          node={employee}
                          isSelected={selectedNodeId === employee.id}
                          onClick={() => handleNodeClick(employee)}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ================================================================== */}
      {/* Task Input Bar                                                     */}
      {/* ================================================================== */}
      <div
        style={{
          borderRadius: "0 0 12px 12px",
          overflow: "hidden",
        }}
      >
        <TaskInputBar onSendTask={onSendTask} />
      </div>
    </div>
  );
}
