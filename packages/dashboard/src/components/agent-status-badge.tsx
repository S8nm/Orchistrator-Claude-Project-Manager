"use client";

const STATUS_CONFIG: Record<string, { color: string; label: string; animate: boolean }> = {
  cold:     { color: "#454d68", label: "Cold",     animate: false },
  spawning: { color: "#f59e0b", label: "Spawning", animate: true },
  idle:     { color: "#00d4aa", label: "Idle",     animate: true },
  active:   { color: "#4ade80", label: "Active",   animate: true },
  dormant:  { color: "#454d68", label: "Dormant",  animate: false },
  done:     { color: "#4ade80", label: "Done",     animate: false },
  failed:   { color: "#f87171", label: "Failed",   animate: false },
  shutdown: { color: "#333",    label: "Shutdown",  animate: false },
};

interface AgentStatusBadgeProps {
  status: string;
  size?: "sm" | "md" | "lg";
}

export default function AgentStatusBadge({ status, size = "md" }: AgentStatusBadgeProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.cold;
  const dotSize = size === "sm" ? 6 : size === "md" ? 8 : 10;
  const fontSize = size === "sm" ? 9 : size === "md" ? 10 : 12;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
      }}
    >
      <span
        style={{
          width: dotSize,
          height: dotSize,
          borderRadius: "50%",
          background: config.color,
          display: "inline-block",
          boxShadow: config.animate ? `0 0 6px ${config.color}` : "none",
          animation: config.animate ? "statusPulse 2s ease-in-out infinite" : "none",
        }}
      />
      <span
        style={{
          fontSize,
          color: config.color,
          fontWeight: 500,
          fontFamily: "'JetBrains Mono', monospace",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        {config.label}
      </span>
      <style>{`
        @keyframes statusPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </span>
  );
}
