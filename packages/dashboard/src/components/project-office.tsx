"use client";

import { useState, useEffect, useCallback, useMemo, useRef, memo } from "react";

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
  danger: "#ef4444",
  textPrimary: "#e2e8f0",
  textSecondary: "#94a3b8",
  textMuted: "#64748b",
  terminalBg: "#08080f",
  terminalText: "#4ade80",
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

const STATUS_COLORS: Record<string, string> = {
  active: "#10b981",
  running: "#3b82f6",
  idle: "#64748b",
  done: "#10b981",
  failed: "#ef4444",
  stopped: "#6b7280",
  archived: "#475569",
};

// -- Types --------------------------------------------------------------------

interface ProjectOfficeProps {
  project: {
    id: string;
    name: string;
    path: string;
    type: string;
    stack: string[];
    status: string;
    tags: string[];
    remote?: string;
    commands: Record<string, string>;
  };
  serverAgents: any[];
  logs: Record<string, { ts: string; msg: string }[]>;
  onSpawnAgent: () => void;
  onSendInput: (agentId: string, input: string) => void;
  onKillAgent: (agentId: string) => void;
  onRunCommand: (command: string, cwd: string) => void;
  onBootstrap: (projectPath: string) => void;
}

// -- Helpers ------------------------------------------------------------------

function getRoleConfig(role: string): { icon: string; color: string; label: string } {
  const key = (role || "").toLowerCase();
  return ROLE_CONFIG[key] || { icon: "\u{1F916}", color: "#6366f1", label: role || "Agent" };
}

function getStatusColor(status: string): string {
  return STATUS_COLORS[(status || "").toLowerCase()] || COLORS.textMuted;
}

function normalizePathForMatch(p: string): string {
  return (p || "").replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
}

// -- Keyframe injection -------------------------------------------------------

let stylesInjected = false;

function injectKeyframes() {
  if (stylesInjected) return;
  if (typeof document === "undefined") return;
  stylesInjected = true;

  const style = document.createElement("style");
  style.textContent = `
    @keyframes po-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }
    @keyframes po-glow {
      0%, 100% { box-shadow: 0 0 12px var(--glow-color, rgba(99,102,241,0.3)); }
      50% { box-shadow: 0 0 24px var(--glow-color, rgba(99,102,241,0.5)); }
    }
    .po-terminal-scroll::-webkit-scrollbar { width: 6px; }
    .po-terminal-scroll::-webkit-scrollbar-track { background: transparent; }
    .po-terminal-scroll::-webkit-scrollbar-thumb { background: #252545; border-radius: 3px; }
    .po-terminal-scroll::-webkit-scrollbar-thumb:hover { background: #353560; }
    .po-agent-logs::-webkit-scrollbar { width: 4px; }
    .po-agent-logs::-webkit-scrollbar-track { background: transparent; }
    .po-agent-logs::-webkit-scrollbar-thumb { background: #1a1a33; border-radius: 2px; }
  `;
  document.head.appendChild(style);
}

// -- Status Badge -------------------------------------------------------------

const StatusBadge = memo(function StatusBadge({ status }: { status: string }) {
  const color = getStatusColor(status);
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        fontFamily: MONO_STACK,
        color,
        background: color + "18",
        border: `1px solid ${color}33`,
        borderRadius: 4,
        padding: "3px 10px",
        textTransform: "uppercase",
        letterSpacing: "0.04em",
      }}
    >
      {status || "unknown"}
    </span>
  );
});

// -- Stack Tag ----------------------------------------------------------------

const StackTag = memo(function StackTag({ label }: { label: string }) {
  return (
    <span
      style={{
        fontSize: 11,
        fontFamily: MONO_STACK,
        color: COLORS.textSecondary,
        background: COLORS.primaryMuted,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 4,
        padding: "2px 8px",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
});

// -- Action Button ------------------------------------------------------------

const ActionButton = memo(function ActionButton({
  label,
  icon,
  onClick,
  variant = "secondary",
  small,
  disabled,
}: {
  label: string;
  icon?: string;
  onClick: () => void;
  variant?: "primary" | "danger" | "secondary";
  small?: boolean;
  disabled?: boolean;
}) {
  const [hovered, setHovered] = useState(false);

  const bgMap = {
    primary: hovered ? COLORS.primary : COLORS.primary + "cc",
    danger: hovered ? COLORS.danger : COLORS.danger + "cc",
    secondary: hovered ? COLORS.card : "transparent",
  };

  const borderMap = {
    primary: COLORS.primary,
    danger: COLORS.danger,
    secondary: COLORS.borderLight,
  };

  return (
    <button
      onClick={disabled ? undefined : onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: small ? "5px 12px" : "8px 16px",
        borderRadius: 6,
        border: `1px solid ${borderMap[variant]}`,
        background: bgMap[variant],
        color: variant === "secondary" ? COLORS.textPrimary : "#fff",
        fontFamily: FONT_STACK,
        fontSize: small ? 11 : 13,
        fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        transition: "all 0.2s ease",
        outline: "none",
        flexShrink: 0,
        boxShadow:
          variant === "primary" && hovered
            ? `0 0 16px ${COLORS.primaryGlow}`
            : variant === "danger" && hovered
              ? `0 0 16px rgba(239, 68, 68, 0.25)`
              : "none",
      }}
    >
      {icon && <span style={{ fontSize: small ? 12 : 14, lineHeight: 1 }}>{icon}</span>}
      {label}
    </button>
  );
});

// -- Agent Card ---------------------------------------------------------------

const AgentCard = memo(function AgentCard({
  agent,
  agentLogs,
  inputValue,
  onInputChange,
  onSendInput,
  onKill,
}: {
  agent: any;
  agentLogs: { ts: string; msg: string }[];
  inputValue: string;
  onInputChange: (value: string) => void;
  onSendInput: () => void;
  onKill: () => void;
}) {
  const logsEndRef = useRef<HTMLDivElement>(null);
  const config = getRoleConfig(agent.role || agent.type);
  const status = (agent.status || "idle").toLowerCase();
  const isRunning = status === "running";
  const displayLogs = agentLogs.slice(-15);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [displayLogs.length]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        onSendInput();
      }
    },
    [onSendInput],
  );

  return (
    <div
      style={{
        background: COLORS.card,
        border: `1px solid ${isRunning ? config.color + "55" : COLORS.border}`,
        borderRadius: 10,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        transition: "all 0.3s ease",
        boxShadow: isRunning
          ? `0 0 20px ${config.color}25, inset 0 0 10px ${config.color}08`
          : "none",
        opacity: status === "idle" || status === "done" || status === "stopped" ? 0.7 : 1,
      }}
    >
      {/* Card Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "12px 14px",
          borderBottom: `1px solid ${COLORS.border}`,
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
              color: config.color,
              marginTop: 1,
            }}
          >
            {config.label}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <div
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: isRunning ? COLORS.success : getStatusColor(status),
              boxShadow: isRunning ? `0 0 6px ${COLORS.success}` : "none",
              animation: isRunning ? "po-pulse 2s ease-in-out infinite" : "none",
            }}
          />
          <span
            style={{
              fontSize: 10,
              fontFamily: MONO_STACK,
              color: isRunning ? COLORS.success : getStatusColor(status),
              textTransform: "uppercase",
              fontWeight: 500,
            }}
          >
            {status}
          </span>
        </div>
        {isRunning && (
          <button
            onClick={onKill}
            title="Kill agent"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 26,
              height: 26,
              borderRadius: 5,
              border: `1px solid ${COLORS.danger}55`,
              background: "transparent",
              color: COLORS.danger,
              fontSize: 12,
              cursor: "pointer",
              transition: "all 0.15s ease",
              flexShrink: 0,
              outline: "none",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = COLORS.danger + "22";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "transparent";
            }}
          >
            {"\u2716"}
          </button>
        )}
      </div>

      {/* Live terminal output */}
      <div
        className="po-agent-logs"
        style={{
          flex: 1,
          minHeight: 120,
          maxHeight: 200,
          overflowY: "auto",
          background: COLORS.terminalBg,
          padding: "8px 10px",
          fontFamily: MONO_STACK,
          fontSize: 11,
          lineHeight: 1.6,
        }}
      >
        {displayLogs.length === 0 ? (
          <div
            style={{
              color: COLORS.textMuted,
              fontStyle: "italic",
              opacity: 0.6,
              paddingTop: 8,
              textAlign: "center",
            }}
          >
            Awaiting output...
          </div>
        ) : (
          displayLogs.map((log, i) => (
            <div key={i} style={{ display: "flex", gap: 8 }}>
              <span style={{ color: COLORS.textMuted, flexShrink: 0, userSelect: "none" }}>
                {log.ts}
              </span>
              <span
                style={{
                  color: log.msg.startsWith("\u26A0")
                    ? COLORS.warning
                    : log.msg.startsWith(">")
                      ? COLORS.primary
                      : log.msg.includes("\u2713")
                        ? COLORS.success
                        : log.msg.includes("\u2717")
                          ? COLORS.error
                          : COLORS.terminalText,
                  wordBreak: "break-all",
                }}
              >
                {log.msg}
              </span>
            </div>
          ))
        )}
        <div ref={logsEndRef} />
      </div>

      {/* Input field */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "8px 10px",
          borderTop: `1px solid ${COLORS.border}`,
          background: COLORS.card,
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontFamily: MONO_STACK,
            color: COLORS.primary,
            userSelect: "none",
            flexShrink: 0,
          }}
        >
          {">"}
        </span>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isRunning ? "Send command..." : "Agent not running"}
          disabled={!isRunning}
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            outline: "none",
            color: COLORS.textPrimary,
            fontFamily: MONO_STACK,
            fontSize: 12,
            padding: "4px 0",
            opacity: isRunning ? 1 : 0.4,
          }}
        />
        <button
          onClick={onSendInput}
          disabled={!isRunning || !inputValue.trim()}
          style={{
            padding: "4px 10px",
            borderRadius: 4,
            border: `1px solid ${COLORS.primary}55`,
            background: isRunning && inputValue.trim() ? COLORS.primary + "33" : "transparent",
            color: isRunning && inputValue.trim() ? COLORS.primary : COLORS.textMuted,
            fontFamily: MONO_STACK,
            fontSize: 10,
            fontWeight: 600,
            cursor: isRunning && inputValue.trim() ? "pointer" : "not-allowed",
            outline: "none",
            transition: "all 0.15s ease",
            flexShrink: 0,
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
});

// -- Command Terminal ---------------------------------------------------------

const CommandTerminal = memo(function CommandTerminal({
  isOpen,
  onToggle,
  commandInput,
  onCommandInputChange,
  commandOutput,
  isRunningCommand,
  onRunCommand,
  commandHistory,
}: {
  isOpen: boolean;
  onToggle: () => void;
  commandInput: string;
  onCommandInputChange: (v: string) => void;
  commandOutput: string;
  isRunningCommand: boolean;
  onRunCommand: () => void;
  commandHistory: string[];
}) {
  const outputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [commandOutput]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        onRunCommand();
      }
    },
    [onRunCommand],
  );

  return (
    <div
      style={{
        background: COLORS.panel,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 10,
        overflow: "hidden",
        transition: "all 0.25s ease",
      }}
    >
      {/* Toggle header */}
      <button
        onClick={onToggle}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          width: "100%",
          padding: "10px 16px",
          background: "transparent",
          border: "none",
          color: COLORS.textSecondary,
          fontFamily: MONO_STACK,
          fontSize: 12,
          fontWeight: 600,
          cursor: "pointer",
          outline: "none",
          textAlign: "left",
          transition: "color 0.15s ease",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.color = COLORS.textPrimary;
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.color = COLORS.textSecondary;
        }}
      >
        <span
          style={{
            display: "inline-block",
            transition: "transform 0.2s ease",
            transform: isOpen ? "rotate(90deg)" : "rotate(0deg)",
            fontSize: 10,
          }}
        >
          {"\u25B6"}
        </span>
        Terminal
        {isRunningCommand && (
          <span
            style={{
              fontSize: 10,
              color: COLORS.warning,
              animation: "po-pulse 1.5s ease-in-out infinite",
            }}
          >
            Running...
          </span>
        )}
      </button>

      {/* Expanded content */}
      {isOpen && (
        <div style={{ borderTop: `1px solid ${COLORS.border}` }}>
          {/* Command input */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 16px",
              background: COLORS.terminalBg,
            }}
          >
            <span
              style={{
                fontFamily: MONO_STACK,
                fontSize: 12,
                color: COLORS.success,
                userSelect: "none",
                flexShrink: 0,
              }}
            >
              $
            </span>
            <input
              type="text"
              value={commandInput}
              onChange={(e) => onCommandInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Run a command in this project..."
              disabled={isRunningCommand}
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                outline: "none",
                color: COLORS.textPrimary,
                fontFamily: MONO_STACK,
                fontSize: 12,
                padding: "4px 0",
              }}
            />
            <button
              onClick={onRunCommand}
              disabled={isRunningCommand || !commandInput.trim()}
              style={{
                padding: "5px 14px",
                borderRadius: 4,
                border: `1px solid ${COLORS.success}55`,
                background:
                  !isRunningCommand && commandInput.trim()
                    ? COLORS.success + "22"
                    : "transparent",
                color:
                  !isRunningCommand && commandInput.trim()
                    ? COLORS.success
                    : COLORS.textMuted,
                fontFamily: MONO_STACK,
                fontSize: 11,
                fontWeight: 600,
                cursor:
                  !isRunningCommand && commandInput.trim() ? "pointer" : "not-allowed",
                outline: "none",
                transition: "all 0.15s ease",
                flexShrink: 0,
              }}
            >
              {isRunningCommand ? "Running..." : "Run"}
            </button>
          </div>

          {/* Output area */}
          {commandOutput && (
            <div
              ref={outputRef}
              className="po-terminal-scroll"
              style={{
                maxHeight: 220,
                overflowY: "auto",
                padding: "10px 16px",
                background: COLORS.terminalBg,
                borderTop: `1px solid ${COLORS.border}`,
                fontFamily: MONO_STACK,
                fontSize: 11,
                lineHeight: 1.6,
                color: COLORS.terminalText,
                whiteSpace: "pre-wrap",
                wordBreak: "break-all",
              }}
            >
              {commandOutput}
            </div>
          )}

          {/* Command history */}
          {commandHistory.length > 0 && (
            <div
              style={{
                padding: "8px 16px",
                borderTop: `1px solid ${COLORS.border}`,
                background: COLORS.card,
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontFamily: FONT_STACK,
                  color: COLORS.textMuted,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginBottom: 6,
                  fontWeight: 600,
                }}
              >
                Recent Commands
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {commandHistory.slice(-8).reverse().map((cmd, i) => (
                  <button
                    key={i}
                    onClick={() => onCommandInputChange(cmd)}
                    style={{
                      padding: "3px 8px",
                      borderRadius: 3,
                      border: `1px solid ${COLORS.border}`,
                      background: "transparent",
                      color: COLORS.textSecondary,
                      fontFamily: MONO_STACK,
                      fontSize: 10,
                      cursor: "pointer",
                      outline: "none",
                      transition: "all 0.15s ease",
                      maxWidth: 200,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.background = COLORS.card;
                      (e.currentTarget as HTMLButtonElement).style.borderColor = COLORS.borderLight;
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                      (e.currentTarget as HTMLButtonElement).style.borderColor = COLORS.border;
                    }}
                  >
                    {cmd}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

// -- Empty State --------------------------------------------------------------

function EmptyState({ onSpawnAgent }: { onSpawnAgent: () => void }) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        padding: 60,
        background: COLORS.panel,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 12,
      }}
    >
      <span style={{ fontSize: 48, opacity: 0.25 }}>{"\u{1F3E2}"}</span>
      <span
        style={{
          fontSize: 16,
          fontFamily: FONT_STACK,
          fontWeight: 600,
          color: COLORS.textSecondary,
        }}
      >
        No agents in this office
      </span>
      <span
        style={{
          fontSize: 13,
          fontFamily: FONT_STACK,
          color: COLORS.textMuted,
          textAlign: "center",
          maxWidth: 360,
          lineHeight: 1.5,
        }}
      >
        Spawn an agent to start working on this project. Agents will appear here with live terminal
        output and interactive controls.
      </span>
      <div style={{ marginTop: 8 }}>
        <ActionButton
          icon={"\u{1F916}"}
          label="Spawn Agent"
          onClick={onSpawnAgent}
          variant="primary"
        />
      </div>
    </div>
  );
}

// -- Main Component -----------------------------------------------------------

export default function ProjectOffice({
  project,
  serverAgents,
  logs,
  onSpawnAgent,
  onSendInput,
  onKillAgent,
  onRunCommand,
  onBootstrap,
}: ProjectOfficeProps) {
  // Inject keyframes on mount
  useEffect(() => {
    injectKeyframes();
  }, []);

  // Local state
  const [commandInput, setCommandInput] = useState("");
  const [commandOutput, setCommandOutput] = useState("");
  const [isRunningCommand, setIsRunningCommand] = useState(false);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [agentInputs, setAgentInputs] = useState<Record<string, string>>({});

  // Filter agents belonging to this project
  const projectAgents = useMemo(() => {
    if (!serverAgents || serverAgents.length === 0) return [];
    const projectPath = normalizePathForMatch(project.path);
    return serverAgents.filter((agent) => {
      // Match by projectId
      if (agent.projectId && agent.projectId === project.id) return true;
      // Match by cwd containing project path
      const agentCwd = normalizePathForMatch(agent.cwd || "");
      if (projectPath && agentCwd && agentCwd.startsWith(projectPath)) return true;
      return false;
    });
  }, [serverAgents, project.id, project.path]);

  // Extract GitHub URL from remote
  const githubUrl = useMemo(() => {
    if (!project.remote) return null;
    const remote = project.remote;
    if (remote.startsWith("http")) return remote;
    // Convert git@ SSH URL to HTTPS
    const sshMatch = remote.match(/git@github\.com:(.+?)(?:\.git)?$/);
    if (sshMatch) return `https://github.com/${sshMatch[1]}`;
    return remote;
  }, [project.remote]);

  // Handle running a command in the terminal
  const handleRunCommand = useCallback(() => {
    const cmd = commandInput.trim();
    if (!cmd || isRunningCommand) return;

    setIsRunningCommand(true);
    setCommandOutput((prev) => (prev ? prev + "\n" : "") + `$ ${cmd}\n`);
    setCommandHistory((prev) => {
      const filtered = prev.filter((c) => c !== cmd);
      return [...filtered, cmd];
    });
    setCommandInput("");

    // Call the parent handler
    onRunCommand(cmd, project.path);

    // Simulate waiting state — parent is responsible for actual execution
    // Reset running state after a timeout as a fallback
    setTimeout(() => {
      setIsRunningCommand(false);
      setCommandOutput((prev) => prev + "Command dispatched.\n");
    }, 2000);
  }, [commandInput, isRunningCommand, onRunCommand, project.path]);

  // Handle agent input change
  const handleAgentInputChange = useCallback((agentId: string, value: string) => {
    setAgentInputs((prev) => ({ ...prev, [agentId]: value }));
  }, []);

  // Handle sending input to agent
  const handleAgentSendInput = useCallback(
    (agentId: string) => {
      const input = (agentInputs[agentId] || "").trim();
      if (!input) return;
      onSendInput(agentId, input);
      setAgentInputs((prev) => ({ ...prev, [agentId]: "" }));
    },
    [agentInputs, onSendInput],
  );

  // Count running agents
  const runningCount = useMemo(() => {
    return projectAgents.filter(
      (a) => (a.status || "").toLowerCase() === "running",
    ).length;
  }, [projectAgents]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
        fontFamily: FONT_STACK,
        color: COLORS.textPrimary,
        minHeight: "100%",
      }}
    >
      {/* ---- Project Header ---- */}
      <div
        style={{
          background: COLORS.panel,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 12,
          padding: "20px 24px",
        }}
      >
        {/* Top row: name + status + tags */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <h1
                style={{
                  margin: 0,
                  fontSize: 22,
                  fontWeight: 700,
                  fontFamily: FONT_STACK,
                  color: COLORS.textPrimary,
                  letterSpacing: "-0.02em",
                  lineHeight: 1.2,
                }}
              >
                {project.name}
              </h1>
              <StatusBadge status={project.status} />
            </div>

            {/* Stack tags */}
            {project.stack.length > 0 && (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 6,
                  marginTop: 10,
                }}
              >
                {project.stack.map((s) => (
                  <StackTag key={s} label={s} />
                ))}
                {project.tags
                  .filter((t) => !project.stack.includes(t))
                  .map((t) => (
                    <StackTag key={t} label={t} />
                  ))}
              </div>
            )}

            {/* Path */}
            <div
              style={{
                marginTop: 8,
                fontSize: 11,
                fontFamily: MONO_STACK,
                color: COLORS.textMuted,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={project.path}
            >
              {project.path}
            </div>
          </div>

          {/* Action buttons */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
              flexShrink: 0,
            }}
          >
            <ActionButton
              icon={"\u{1F916}"}
              label="Spawn Agent"
              onClick={onSpawnAgent}
              variant="primary"
            />
            <ActionButton
              icon={"\u{1F4BB}"}
              label="Run Command"
              onClick={() => {
                setTerminalOpen(true);
              }}
              variant="secondary"
            />
            <ActionButton
              icon={"\u{1F3D7}\uFE0F"}
              label="Bootstrap"
              onClick={() => onBootstrap(project.path)}
              variant="secondary"
            />
            {githubUrl && (
              <ActionButton
                icon={"\u{1F517}"}
                label="GitHub"
                onClick={() => window.open(githubUrl, "_blank")}
                variant="secondary"
              />
            )}
          </div>
        </div>

        {/* Agent count summary */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            marginTop: 14,
            paddingTop: 14,
            borderTop: `1px solid ${COLORS.border}`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 14 }}>{"\u{1F916}"}</span>
            <span
              style={{
                fontSize: 12,
                fontFamily: MONO_STACK,
                color: COLORS.textSecondary,
              }}
            >
              {projectAgents.length} agent{projectAgents.length !== 1 ? "s" : ""}
            </span>
          </div>
          {runningCount > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: COLORS.success,
                  boxShadow: `0 0 6px ${COLORS.success}`,
                  animation: "po-pulse 2s ease-in-out infinite",
                }}
              />
              <span
                style={{
                  fontSize: 12,
                  fontFamily: MONO_STACK,
                  color: COLORS.success,
                }}
              >
                {runningCount} running
              </span>
            </div>
          )}
          <div style={{ flex: 1 }} />
          <span
            style={{
              fontSize: 11,
              fontFamily: MONO_STACK,
              color: COLORS.textMuted,
            }}
          >
            {project.type}
          </span>
        </div>
      </div>

      {/* ---- Agent Grid ---- */}
      {projectAgents.length === 0 ? (
        <EmptyState onSpawnAgent={onSpawnAgent} />
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
            gap: 14,
            flex: 1,
          }}
        >
          {projectAgents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              agentLogs={logs[agent.id] || []}
              inputValue={agentInputs[agent.id] || ""}
              onInputChange={(v) => handleAgentInputChange(agent.id, v)}
              onSendInput={() => handleAgentSendInput(agent.id)}
              onKill={() => onKillAgent(agent.id)}
            />
          ))}
        </div>
      )}

      {/* ---- Command Terminal ---- */}
      <CommandTerminal
        isOpen={terminalOpen}
        onToggle={() => setTerminalOpen((o) => !o)}
        commandInput={commandInput}
        onCommandInputChange={setCommandInput}
        commandOutput={commandOutput}
        isRunningCommand={isRunningCommand}
        onRunCommand={handleRunCommand}
        commandHistory={commandHistory}
      />
    </div>
  );
}
