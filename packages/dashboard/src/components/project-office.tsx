"use client";

import { useState, useEffect, useCallback, useMemo, useRef, memo } from "react";

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
  active: T.success,
  running: "#3b82f6",
  idle: T.textMuted,
  done: T.success,
  failed: T.danger,
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
  return STATUS_COLORS[(status || "").toLowerCase()] || T.textMuted;
}

function normalizePathForMatch(p: string): string {
  return (p || "").replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
}

// -- Style injection ----------------------------------------------------------

let stylesInjected = false;

function injectStyles() {
  if (stylesInjected) return;
  if (typeof document === "undefined") return;
  stylesInjected = true;

  const style = document.createElement("style");
  style.textContent = `
    @keyframes po-fadeInUp {
      from { opacity: 0; transform: translateY(16px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes po-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.35; }
    }
    @keyframes po-blink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0; }
    }
    @keyframes po-scanline {
      0% { background-position: 0 0; }
      100% { background-position: 0 4px; }
    }
    @keyframes po-glow-pulse {
      0%, 100% { box-shadow: var(--glow-idle); }
      50% { box-shadow: var(--glow-active); }
    }
    @keyframes po-dot-pulse {
      0%, 100% { transform: scale(1); opacity: 1; }
      50% { transform: scale(1.4); opacity: 0.7; }
    }
    .po-term-scroll::-webkit-scrollbar { width: 4px; }
    .po-term-scroll::-webkit-scrollbar-track { background: transparent; }
    .po-term-scroll::-webkit-scrollbar-thumb { background: ${T.border}; border-radius: 2px; }
    .po-term-scroll::-webkit-scrollbar-thumb:hover { background: ${T.borderHover}; }
    .po-cmd-scroll::-webkit-scrollbar { width: 5px; }
    .po-cmd-scroll::-webkit-scrollbar-track { background: transparent; }
    .po-cmd-scroll::-webkit-scrollbar-thumb { background: ${T.border}; border-radius: 3px; }
    .po-cmd-scroll::-webkit-scrollbar-thumb:hover { background: ${T.borderHover}; }
  `;
  document.head.appendChild(style);
}

// -- Terminal Agent Card (memoized) -------------------------------------------

const TerminalAgentCard = memo(function TerminalAgentCard({
  agent,
  agentLogs,
  inputValue,
  onInputChange,
  onSendInput,
  onKill,
  animDelay,
}: {
  agent: any;
  agentLogs: { ts: string; msg: string }[];
  inputValue: string;
  onInputChange: (value: string) => void;
  onSendInput: () => void;
  onKill: () => void;
  animDelay: number;
}) {
  const logsEndRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const config = getRoleConfig(agent.role || agent.type);
  const status = (agent.status || "idle").toLowerCase();
  const isRunning = status === "running";
  const isFailed = status === "failed";
  const isIdle = status === "idle" || status === "done" || status === "stopped";
  const displayLogs = agentLogs.slice(-40);

  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
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

  const borderColor = isFailed
    ? T.danger + "55"
    : isRunning
      ? config.color + "40"
      : T.border;

  const glowShadow = isFailed
    ? `0 0 20px ${T.danger}20, 0 0 40px ${T.danger}10`
    : isRunning
      ? `0 0 20px ${config.color}20, 0 0 40px ${config.color}08`
      : "none";

  return (
    <div
      style={{
        borderRadius: 10,
        border: `1px solid ${borderColor}`,
        background: T.surface2,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        opacity: isIdle ? 0.7 : 1,
        boxShadow: glowShadow,
        transition: "all 0.3s ease",
        animation: `po-fadeInUp 0.4s ease ${animDelay}ms both`,
        ...(isRunning
          ? ({
              "--glow-idle": `0 0 16px ${config.color}18`,
              "--glow-active": `0 0 28px ${config.color}30`,
            } as React.CSSProperties)
          : {}),
      }}
    >
      {/* Title Bar — macOS style */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          height: 28,
          padding: "0 10px",
          background: T.surface3,
          borderTopLeftRadius: 10,
          borderTopRightRadius: 10,
          gap: 6,
        }}
      >
        {/* Traffic light dots */}
        <div style={{ display: "flex", gap: 5, alignItems: "center", flexShrink: 0 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: isIdle ? T.textMuted : T.danger,
              transition: "background 0.2s",
            }}
          />
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: isIdle ? T.textMuted : T.warm,
              transition: "background 0.2s",
            }}
          />
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: isIdle ? T.textMuted : T.success,
              transition: "background 0.2s",
            }}
          />
        </div>

        {/* Agent name + role — centered */}
        <div
          style={{
            flex: 1,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: 5,
            overflow: "hidden",
          }}
        >
          <span style={{ fontSize: 11, lineHeight: 1 }}>{config.icon}</span>
          <span
            style={{
              fontFamily: MONO,
              fontSize: 11,
              fontWeight: 500,
              color: T.textSecondary,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {agent.name || agent.id}
            <span style={{ color: T.textMuted, marginLeft: 4 }}>
              {config.label}
            </span>
          </span>
        </div>

        {/* Status badge + kill */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: isFailed ? T.danger : isRunning ? T.success : getStatusColor(status),
                boxShadow: isRunning ? `0 0 6px ${T.success}` : "none",
                animation: isRunning ? "po-dot-pulse 2s ease-in-out infinite" : "none",
              }}
            />
            <span
              style={{
                fontFamily: MONO,
                fontSize: 9,
                fontWeight: 600,
                color: isFailed ? T.danger : isRunning ? T.success : getStatusColor(status),
                textTransform: "uppercase",
                letterSpacing: "0.04em",
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
                width: 16,
                height: 16,
                borderRadius: 3,
                border: "none",
                background: T.danger + "30",
                color: T.danger,
                fontSize: 9,
                fontWeight: 700,
                cursor: "pointer",
                outline: "none",
                lineHeight: 1,
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = T.danger + "55";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = T.danger + "30";
              }}
            >
              {"\u2715"}
            </button>
          )}
        </div>
      </div>

      {/* Terminal Body */}
      <div
        ref={bodyRef}
        className="po-term-scroll"
        style={{
          height: 240,
          overflowY: "auto",
          background: "#060609",
          padding: "8px 10px",
          fontFamily: MONO,
          fontSize: 10.5,
          lineHeight: 1.7,
          position: "relative",
          // Scanline overlay
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.008) 2px, rgba(255,255,255,0.008) 4px)",
          backgroundSize: "100% 4px",
        }}
      >
        {displayLogs.length === 0 ? (
          <div
            style={{
              color: T.textMuted,
              fontStyle: "italic",
              opacity: 0.5,
              paddingTop: 40,
              textAlign: "center",
              userSelect: "none",
            }}
          >
            Awaiting output...
          </div>
        ) : (
          displayLogs.map((log, i) => {
            const isLast = i === displayLogs.length - 1;
            return (
              <div key={i} style={{ display: "flex", gap: 8 }}>
                <span
                  style={{
                    color: T.textMuted,
                    flexShrink: 0,
                    userSelect: "none",
                    opacity: 0.6,
                    fontSize: 10,
                  }}
                >
                  {log.ts}
                </span>
                <span
                  style={{
                    color: isLast
                      ? config.color
                      : log.msg.startsWith("\u26A0")
                        ? T.warm
                        : log.msg.startsWith(">")
                          ? T.primary
                          : log.msg.includes("\u2713")
                            ? T.success
                            : log.msg.includes("\u2717") || log.msg.includes("ERROR")
                              ? T.danger
                              : T.textSecondary,
                    wordBreak: "break-all",
                    fontWeight: isLast ? 500 : 400,
                  }}
                >
                  {log.msg}
                </span>
              </div>
            );
          })
        )}
        {/* Blinking cursor for running agents */}
        {isRunning && (
          <span
            style={{
              display: "inline-block",
              width: 7,
              height: 14,
              background: config.color,
              animation: "po-blink 1s step-end infinite",
              marginTop: 2,
              verticalAlign: "middle",
            }}
          />
        )}
        <div ref={logsEndRef} />
      </div>

      {/* Input Area — only when running */}
      {isRunning && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "7px 10px",
            borderTop: `1px solid ${T.border}`,
            background: T.surface1,
          }}
        >
          <span
            style={{
              fontFamily: MONO,
              fontSize: 12,
              color: T.primary,
              userSelect: "none",
              flexShrink: 0,
              fontWeight: 700,
            }}
          >
            {"\u276F"}
          </span>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Send command..."
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              color: T.textPrimary,
              fontFamily: MONO,
              fontSize: 11,
              padding: "3px 0",
            }}
          />
          <button
            onClick={onSendInput}
            disabled={!inputValue.trim()}
            style={{
              padding: "3px 10px",
              borderRadius: 4,
              border: `1px solid ${T.primary}44`,
              background: inputValue.trim() ? T.primaryMuted : "transparent",
              color: inputValue.trim() ? T.primary : T.textMuted,
              fontFamily: MONO,
              fontSize: 10,
              fontWeight: 600,
              cursor: inputValue.trim() ? "pointer" : "not-allowed",
              outline: "none",
              transition: "all 0.15s ease",
              flexShrink: 0,
            }}
          >
            Send
          </button>
        </div>
      )}
    </div>
  );
});

// -- Command Terminal (bottom, collapsible) ------------------------------------

const CommandTerminal = memo(function CommandTerminal({
  projectName,
  isOpen,
  onToggle,
  commandInput,
  onCommandInputChange,
  commandOutput,
  isRunningCommand,
  onRunCommand,
  quickCommands,
}: {
  projectName: string;
  isOpen: boolean;
  onToggle: () => void;
  commandInput: string;
  onCommandInputChange: (v: string) => void;
  commandOutput: string;
  isRunningCommand: boolean;
  onRunCommand: () => void;
  quickCommands: Record<string, string>;
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

  const cmdEntries = Object.entries(quickCommands || {});

  return (
    <div style={{ flexShrink: 0 }}>
      {/* Toggle button */}
      <button
        onClick={onToggle}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          width: "100%",
          padding: "9px 14px",
          background: T.surface3,
          border: `1px solid ${T.border}`,
          borderRadius: isOpen ? "10px 10px 0 0" : 10,
          color: T.textSecondary,
          fontFamily: MONO,
          fontSize: 11,
          fontWeight: 600,
          cursor: "pointer",
          outline: "none",
          textAlign: "left",
          transition: "all 0.2s ease",
          letterSpacing: "0.06em",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.color = T.textPrimary;
          (e.currentTarget as HTMLButtonElement).style.borderColor = T.borderHover;
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.color = T.textSecondary;
          (e.currentTarget as HTMLButtonElement).style.borderColor = T.border;
        }}
      >
        TERMINAL {isOpen ? "\u25BE" : "\u25B8"}
        {isRunningCommand && (
          <span
            style={{
              fontSize: 10,
              color: T.warm,
              animation: "po-pulse 1.2s ease-in-out infinite",
              marginLeft: 6,
            }}
          >
            Running...
          </span>
        )}
      </button>

      {/* Expanded terminal */}
      {isOpen && (
        <div
          style={{
            border: `1px solid ${T.border}`,
            borderTop: "none",
            borderRadius: "0 0 10px 10px",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            height: 300,
          }}
        >
          {/* Title bar */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              height: 28,
              padding: "0 10px",
              background: T.surface3,
              gap: 6,
            }}
          >
            <div style={{ display: "flex", gap: 5, alignItems: "center", flexShrink: 0 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: T.danger }} />
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: T.warm }} />
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: T.success }} />
            </div>
            <span
              style={{
                flex: 1,
                textAlign: "center",
                fontFamily: MONO,
                fontSize: 11,
                color: T.textMuted,
              }}
            >
              Project Terminal {"\u2014"} {projectName}
            </span>
          </div>

          {/* Quick command pills */}
          {cmdEntries.length > 0 && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 5,
                padding: "6px 10px",
                background: T.surface2,
                borderBottom: `1px solid ${T.border}`,
              }}
            >
              {cmdEntries.map(([label, cmd]) => (
                <button
                  key={label}
                  onClick={() => onCommandInputChange(cmd)}
                  style={{
                    padding: "3px 9px",
                    borderRadius: 4,
                    border: `1px solid ${T.border}`,
                    background: T.surface3,
                    color: T.textSecondary,
                    fontFamily: MONO,
                    fontSize: 9,
                    fontWeight: 500,
                    cursor: "pointer",
                    outline: "none",
                    transition: "all 0.15s ease",
                    whiteSpace: "nowrap",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = T.primary + "55";
                    (e.currentTarget as HTMLButtonElement).style.color = T.primary;
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = T.border;
                    (e.currentTarget as HTMLButtonElement).style.color = T.textSecondary;
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {/* Output area */}
          <div
            ref={outputRef}
            className="po-cmd-scroll"
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "8px 10px",
              background: "#060609",
              fontFamily: MONO,
              fontSize: 10.5,
              lineHeight: 1.7,
              color: T.textSecondary,
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
              backgroundImage:
                "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.008) 2px, rgba(255,255,255,0.008) 4px)",
              backgroundSize: "100% 4px",
            }}
          >
            {commandOutput || (
              <span style={{ color: T.textMuted, fontStyle: "italic", opacity: 0.4 }}>
                Type a command below or click a quick action...
              </span>
            )}
          </div>

          {/* Command input */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 10px",
              background: T.surface1,
              borderTop: `1px solid ${T.border}`,
            }}
          >
            <span
              style={{
                fontFamily: MONO,
                fontSize: 12,
                color: T.primary,
                userSelect: "none",
                flexShrink: 0,
                fontWeight: 700,
              }}
            >
              $
            </span>
            <input
              type="text"
              value={commandInput}
              onChange={(e) => onCommandInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Run a command..."
              disabled={isRunningCommand}
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                outline: "none",
                color: T.textPrimary,
                fontFamily: MONO,
                fontSize: 11,
                padding: "3px 0",
              }}
            />
            <button
              onClick={onRunCommand}
              disabled={isRunningCommand || !commandInput.trim()}
              style={{
                padding: "4px 12px",
                borderRadius: 4,
                border: `1px solid ${T.primary}44`,
                background:
                  !isRunningCommand && commandInput.trim()
                    ? T.primaryMuted
                    : "transparent",
                color:
                  !isRunningCommand && commandInput.trim()
                    ? T.primary
                    : T.textMuted,
                fontFamily: MONO,
                fontSize: 10,
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
        </div>
      )}
    </div>
  );
});

// -- Empty State --------------------------------------------------------------

function EmptyState({ onSpawnAgent }: { onSpawnAgent: () => void }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 20,
        padding: 80,
        animation: "po-fadeInUp 0.5s ease both",
      }}
    >
      {/* Terminal ASCII art icon */}
      <div
        style={{
          fontFamily: MONO,
          fontSize: 13,
          lineHeight: 1.4,
          color: T.textMuted,
          opacity: 0.25,
          textAlign: "center",
          whiteSpace: "pre",
          userSelect: "none",
        }}
      >
        {`  +-----------------------+\n  |  $  _                 |\n  |                       |\n  |     No agents here    |\n  |                       |\n  +-----------------------+`}
      </div>
      <span
        style={{
          fontSize: 16,
          fontFamily: FONT,
          fontWeight: 600,
          color: T.textSecondary,
          letterSpacing: "-0.01em",
        }}
      >
        No agents deployed
      </span>
      <span
        style={{
          fontSize: 13,
          fontFamily: FONT,
          color: T.textMuted,
          textAlign: "center",
          maxWidth: 340,
          lineHeight: 1.55,
        }}
      >
        Spawn an agent to get started. Agents will appear as live terminal windows with real-time output.
      </span>
      <button
        onClick={onSpawnAgent}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          marginTop: 8,
          padding: "10px 24px",
          borderRadius: 8,
          border: "none",
          background: hovered ? T.primary : T.primary + "dd",
          color: T.base,
          fontFamily: FONT,
          fontSize: 14,
          fontWeight: 700,
          cursor: "pointer",
          outline: "none",
          transition: "all 0.2s ease",
          boxShadow: hovered
            ? `0 0 24px ${T.primaryGlow}, 0 4px 12px rgba(0,0,0,0.4)`
            : `0 0 12px ${T.primaryGlow}`,
          letterSpacing: "-0.01em",
        }}
      >
        Spawn Agent
      </button>
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
  useEffect(() => {
    injectStyles();
  }, []);

  // Local state
  const [commandInput, setCommandInput] = useState("");
  const [commandOutput, setCommandOutput] = useState("");
  const [isRunningCommand, setIsRunningCommand] = useState(false);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [agentInputs, setAgentInputs] = useState<Record<string, string>>({});
  const [hoveredBtn, setHoveredBtn] = useState<string | null>(null);

  // Filter agents belonging to this project
  const projectAgents = useMemo(() => {
    if (!serverAgents || serverAgents.length === 0) return [];
    const projectPath = normalizePathForMatch(project.path);
    return serverAgents.filter((agent) => {
      if (agent.projectId && agent.projectId === project.id) return true;
      const agentCwd = normalizePathForMatch(agent.cwd || "");
      if (projectPath && agentCwd && agentCwd.startsWith(projectPath)) return true;
      return false;
    });
  }, [serverAgents, project.id, project.path]);

  // GitHub URL from remote
  const githubUrl = useMemo(() => {
    if (!project.remote) return null;
    const remote = project.remote;
    if (remote.startsWith("http")) return remote;
    const sshMatch = remote.match(/git@github\.com:(.+?)(?:\.git)?$/);
    if (sshMatch) return `https://github.com/${sshMatch[1]}`;
    return remote;
  }, [project.remote]);

  // Running agent count
  const runningCount = useMemo(() => {
    return projectAgents.filter(
      (a) => (a.status || "").toLowerCase() === "running",
    ).length;
  }, [projectAgents]);

  // Handlers
  const handleRunCommand = useCallback(() => {
    const cmd = commandInput.trim();
    if (!cmd || isRunningCommand) return;
    setIsRunningCommand(true);
    setCommandOutput((prev) => (prev ? prev + "\n" : "") + `$ ${cmd}\n`);
    setCommandInput("");
    onRunCommand(cmd, project.path);
    setTimeout(() => {
      setIsRunningCommand(false);
      setCommandOutput((prev) => prev + "Command dispatched.\n");
    }, 2000);
  }, [commandInput, isRunningCommand, onRunCommand, project.path]);

  const handleAgentInputChange = useCallback((agentId: string, value: string) => {
    setAgentInputs((prev) => ({ ...prev, [agentId]: value }));
  }, []);

  const handleAgentSendInput = useCallback(
    (agentId: string) => {
      const input = (agentInputs[agentId] || "").trim();
      if (!input) return;
      onSendInput(agentId, input);
      setAgentInputs((prev) => ({ ...prev, [agentId]: "" }));
    },
    [agentInputs, onSendInput],
  );

  // Button builder helper
  const mkBtn = (
    id: string,
    label: string,
    onClick: () => void,
    variant: "primary" | "warm" | "surface" | "link",
  ): React.CSSProperties & { _meta?: any } => {
    const isH = hoveredBtn === id;
    const bg: Record<string, string> = {
      primary: isH ? T.primary : T.primary + "dd",
      warm: isH ? T.warm : T.warm + "dd",
      surface: isH ? T.surface3 : T.surface2,
      link: isH ? T.surface3 : T.surface2,
    };
    const fg: Record<string, string> = {
      primary: T.base,
      warm: T.base,
      surface: T.textPrimary,
      link: T.textSecondary,
    };
    const bdr: Record<string, string> = {
      primary: "transparent",
      warm: "transparent",
      surface: T.border,
      link: T.border,
    };
    return {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      padding: "7px 16px",
      borderRadius: 7,
      border: `1px solid ${bdr[variant]}`,
      background: bg[variant],
      color: fg[variant],
      fontFamily: FONT,
      fontSize: 12,
      fontWeight: 600,
      cursor: "pointer",
      outline: "none",
      transition: "all 0.2s ease",
      flexShrink: 0,
      boxShadow:
        (variant === "primary" && isH)
          ? `0 0 18px ${T.primaryGlow}`
          : (variant === "warm" && isH)
            ? `0 0 18px ${T.warmMuted}`
            : "none",
    } as React.CSSProperties;
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 14,
        fontFamily: FONT,
        color: T.textPrimary,
        minHeight: "100%",
      }}
    >
      {/* ---- Project Header ---- */}
      <div
        style={{
          background: T.surface1,
          backgroundImage: `linear-gradient(90deg, ${T.surface2} 0%, transparent 60%)`,
          borderRadius: 12,
          padding: "22px 26px 18px",
          display: "flex",
          alignItems: "flex-start",
          gap: 20,
          flexWrap: "wrap",
          minHeight: 100,
        }}
      >
        {/* Left side */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1
            style={{
              margin: 0,
              fontSize: 24,
              fontWeight: 700,
              fontFamily: FONT,
              color: T.textPrimary,
              letterSpacing: "-0.02em",
              lineHeight: 1.15,
            }}
          >
            {project.name}
          </h1>

          {/* Path */}
          <div
            style={{
              marginTop: 5,
              fontFamily: MONO,
              fontSize: 11,
              color: T.textMuted,
              cursor: "default",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              maxWidth: 500,
            }}
            title={project.path}
          >
            {project.path}
          </div>

          {/* Stack tags + status */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 5,
              marginTop: 10,
            }}
          >
            {project.stack.map((s) => (
              <span
                key={s}
                style={{
                  fontFamily: MONO,
                  fontSize: 9,
                  fontWeight: 500,
                  color: T.primary,
                  background: T.surface3,
                  padding: "2px 8px",
                  borderRadius: 4,
                  whiteSpace: "nowrap",
                  letterSpacing: "0.02em",
                }}
              >
                {s}
              </span>
            ))}
            {project.tags
              .filter((tag) => !project.stack.includes(tag))
              .map((tag) => (
                <span
                  key={tag}
                  style={{
                    fontFamily: MONO,
                    fontSize: 9,
                    fontWeight: 500,
                    color: T.secondary,
                    background: T.secondaryMuted,
                    padding: "2px 8px",
                    borderRadius: 4,
                    whiteSpace: "nowrap",
                    letterSpacing: "0.02em",
                  }}
                >
                  {tag}
                </span>
              ))}
            {/* Status badge */}
            <span
              style={{
                fontFamily: MONO,
                fontSize: 9,
                fontWeight: 600,
                color: getStatusColor(project.status),
                background: getStatusColor(project.status) + "18",
                border: `1px solid ${getStatusColor(project.status)}33`,
                padding: "2px 9px",
                borderRadius: 4,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              {project.status || "unknown"}
            </span>
          </div>
        </div>

        {/* Right side */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: 10,
            flexShrink: 0,
          }}
        >
          {/* Action buttons */}
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
            <button
              onClick={onSpawnAgent}
              onMouseEnter={() => setHoveredBtn("spawn")}
              onMouseLeave={() => setHoveredBtn(null)}
              style={mkBtn("spawn", "Spawn Agent", onSpawnAgent, "primary")}
            >
              Spawn Agent
            </button>
            <button
              onClick={() => setTerminalOpen(true)}
              onMouseEnter={() => setHoveredBtn("terminal")}
              onMouseLeave={() => setHoveredBtn(null)}
              style={mkBtn("terminal", "Terminal", () => {}, "surface")}
            >
              Terminal
            </button>
            <button
              onClick={() => onBootstrap(project.path)}
              onMouseEnter={() => setHoveredBtn("bootstrap")}
              onMouseLeave={() => setHoveredBtn(null)}
              style={mkBtn("bootstrap", "Bootstrap", () => {}, "warm")}
            >
              Bootstrap
            </button>
            {githubUrl && (
              <button
                onClick={() => window.open(githubUrl, "_blank")}
                onMouseEnter={() => setHoveredBtn("github")}
                onMouseLeave={() => setHoveredBtn(null)}
                style={mkBtn("github", "GitHub", () => {}, "link")}
              >
                GitHub
              </button>
            )}
          </div>

          {/* Agent count */}
          <span
            style={{
              fontFamily: MONO,
              fontSize: 10,
              color: T.textMuted,
            }}
          >
            {projectAgents.length} agent{projectAgents.length !== 1 ? "s" : ""}
            {runningCount > 0 && (
              <>
                {" \u00B7 "}
                <span style={{ color: T.success }}>
                  {runningCount} running
                </span>
              </>
            )}
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
            gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))",
            gap: 12,
            flex: 1,
          }}
        >
          {projectAgents.map((agent, idx) => (
            <TerminalAgentCard
              key={agent.id}
              agent={agent}
              agentLogs={logs[agent.id] || []}
              inputValue={agentInputs[agent.id] || ""}
              onInputChange={(v) => handleAgentInputChange(agent.id, v)}
              onSendInput={() => handleAgentSendInput(agent.id)}
              onKill={() => onKillAgent(agent.id)}
              animDelay={idx * 60}
            />
          ))}
        </div>
      )}

      {/* ---- Command Terminal ---- */}
      <CommandTerminal
        projectName={project.name}
        isOpen={terminalOpen}
        onToggle={() => setTerminalOpen((o) => !o)}
        commandInput={commandInput}
        onCommandInputChange={setCommandInput}
        commandOutput={commandOutput}
        isRunningCommand={isRunningCommand}
        onRunCommand={handleRunCommand}
        quickCommands={project.commands}
      />
    </div>
  );
}
