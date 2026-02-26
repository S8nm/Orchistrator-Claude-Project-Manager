"use client";

import { useMemo } from "react";
import type { OrchestrationPlan, SubTask, AgentRole } from "@orchestrator/shared";

const NODE_W = 180;
const NODE_H = 70;
const GAP_X = 40;
const GAP_Y = 24;
const PADDING = 20;

const STATUS_COLORS: Record<string, string> = {
  pending: "#374151",
  ready: "#6b7280",
  running: "#3b82f6",
  done: "#10b981",
  failed: "#ef4444",
};

const ROLE_ICONS: Record<string, string> = {
  orchestrator: "\u{1F9E0}",
  architect: "\u{1F3D7}\uFE0F",
  backend: "\u2699\uFE0F",
  frontend: "\u{1F3A8}",
  tester: "\u{1F9EA}",
  reviewer: "\u{1F50D}",
  fullstack: "\u{1F527}",
  devops: "\u{1F680}",
  security: "\u{1F6E1}\uFE0F",
  docs: "\u{1F4DD}",
  refactorer: "\u267B\uFE0F",
};

const ROLE_COLORS: Record<string, string> = {
  orchestrator: "#a855f7",
  architect: "#8b5cf6",
  backend: "#3b82f6",
  frontend: "#ec4899",
  tester: "#10b981",
  reviewer: "#f59e0b",
  fullstack: "#6366f1",
  devops: "#14b8a6",
  security: "#ef4444",
  docs: "#8b5cf6",
  refactorer: "#06b6d4",
};

interface NodePosition {
  task: SubTask;
  x: number;
  y: number;
  layer: number;
}

function computeLayers(tasks: SubTask[]): Map<string, number> {
  const layerMap = new Map<string, number>();
  const taskMap = new Map<string, SubTask>();
  for (const t of tasks) {
    taskMap.set(t.id, t);
  }

  function getLayer(id: string, visited: Set<string>): number {
    if (layerMap.has(id)) return layerMap.get(id)!;
    if (visited.has(id)) return 0; // cycle guard
    visited.add(id);

    const task = taskMap.get(id);
    if (!task || task.deps.length === 0) {
      layerMap.set(id, 0);
      return 0;
    }

    let maxDep = 0;
    for (const depId of task.deps) {
      if (taskMap.has(depId)) {
        maxDep = Math.max(maxDep, getLayer(depId, visited) + 1);
      }
    }
    layerMap.set(id, maxDep);
    return maxDep;
  }

  for (const t of tasks) {
    getLayer(t.id, new Set<string>());
  }

  return layerMap;
}

function layoutNodes(tasks: SubTask[]): NodePosition[] {
  const layerMap = computeLayers(tasks);
  const layers = new Map<number, SubTask[]>();

  for (const t of tasks) {
    const layer = layerMap.get(t.id) ?? 0;
    if (!layers.has(layer)) layers.set(layer, []);
    layers.get(layer)!.push(t);
  }

  const positions: NodePosition[] = [];
  const maxLayer = Math.max(0, ...Array.from(layers.keys()));
  const maxNodesInAnyLayer = Math.max(
    1,
    ...Array.from(layers.values()).map((arr) => arr.length),
  );
  const totalHeight = maxNodesInAnyLayer * (NODE_H + GAP_Y) - GAP_Y;

  for (let col = 0; col <= maxLayer; col++) {
    const colTasks = layers.get(col) || [];
    const colHeight = colTasks.length * (NODE_H + GAP_Y) - GAP_Y;
    const offsetY = (totalHeight - colHeight) / 2;

    for (let row = 0; row < colTasks.length; row++) {
      positions.push({
        task: colTasks[row],
        x: PADDING + col * (NODE_W + GAP_X),
        y: PADDING + offsetY + row * (NODE_H + GAP_Y),
        layer: col,
      });
    }
  }

  return positions;
}

function truncate(text: string, maxLen: number): string {
  return text.length > maxLen ? text.slice(0, maxLen - 1) + "\u2026" : text;
}

export default function TaskGraph({ plan }: { plan: OrchestrationPlan | null }) {
  const { positions, svgW, svgH, edges } = useMemo(() => {
    if (!plan || plan.subTasks.length === 0) {
      return { positions: [], svgW: 0, svgH: 0, edges: [] };
    }

    const pos = layoutNodes(plan.subTasks);
    const posMap = new Map<string, NodePosition>();
    for (const p of pos) {
      posMap.set(p.task.id, p);
    }

    const maxLayer = Math.max(0, ...pos.map((p) => p.layer));
    const maxNodesInAnyLayer = Math.max(
      1,
      ...Array.from(
        pos.reduce((acc, p) => {
          acc.set(p.layer, (acc.get(p.layer) || 0) + 1);
          return acc;
        }, new Map<number, number>()).values(),
      ),
    );

    const w = PADDING * 2 + (maxLayer + 1) * NODE_W + maxLayer * GAP_X;
    const h = PADDING * 2 + maxNodesInAnyLayer * NODE_H + (maxNodesInAnyLayer - 1) * GAP_Y;

    const edgeList: { from: NodePosition; to: NodePosition }[] = [];
    for (const p of pos) {
      for (const depId of p.task.deps) {
        const depPos = posMap.get(depId);
        if (depPos) {
          edgeList.push({ from: depPos, to: p });
        }
      }
    }

    return { positions: pos, svgW: w, svgH: h, edges: edgeList };
  }, [plan]);

  if (!plan) {
    return (
      <div
        style={{
          background: "#08080f",
          border: "1px solid #1a1a33",
          borderRadius: 10,
          padding: "60px 20px",
          textAlign: "center",
          color: "#374151",
          fontSize: 13,
        }}
      >
        <div style={{ fontSize: 36, marginBottom: 12, opacity: 0.5 }}>
          {"\u{1F5D3}\uFE0F"}
        </div>
        <div>No active orchestration. Start one from the bar above.</div>
      </div>
    );
  }

  const doneTasks = plan.subTasks.filter((t: SubTask) => t.status === "done").length;
  const totalTasks = plan.subTasks.length;
  const statusColor = STATUS_COLORS[plan.status] || "#6b7280";

  return (
    <div
      style={{
        background: "#08080f",
        border: "1px solid #1a1a33",
        borderRadius: 10,
        overflow: "hidden",
      }}
    >
      {/* Status bar */}
      <div
        style={{
          padding: "10px 16px",
          borderBottom: "1px solid #1a1a33",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: 11,
          color: "#94a3b8",
          background: "#0d0d1a",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              padding: "2px 8px",
              borderRadius: 12,
              fontSize: 10,
              fontWeight: 600,
              background: statusColor + "18",
              color: statusColor,
              border: `1px solid ${statusColor}30`,
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: statusColor,
                boxShadow: `0 0 6px ${statusColor}80`,
                display: "inline-block",
              }}
            />
            {plan.status}
          </span>
          <span style={{ color: "#475569" }}>{"\u2502"}</span>
          <span>
            Tasks: <span style={{ color: "#e2e8f0", fontWeight: 600 }}>{doneTasks}</span>
            /{totalTasks}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {plan.tokenEstimate > 0 && (
            <span>
              {"\u{1F4B0}"} ~{(plan.tokenEstimate / 1000).toFixed(1)}k tokens
            </span>
          )}
          {plan.cacheHits > 0 && (
            <span style={{ color: "#10b981" }}>
              {"\u26A1"} {plan.cacheHits} cache hits
            </span>
          )}
        </div>
      </div>

      {/* SVG DAG */}
      <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: 500 }}>
        <svg
          width={Math.max(svgW, 400)}
          height={Math.max(svgH, 120)}
          viewBox={`0 0 ${Math.max(svgW, 400)} ${Math.max(svgH, 120)}`}
          style={{ display: "block" }}
        >
          <defs>
            {/* Animated pulse for running nodes */}
            <style>{`
              @keyframes pulse-glow {
                0%, 100% { opacity: 0.6; }
                50% { opacity: 1; }
              }
              @keyframes dash-flow {
                to { stroke-dashoffset: -12; }
              }
            `}</style>
            {/* Arrow marker */}
            <marker
              id="arrowhead"
              markerWidth="8"
              markerHeight="6"
              refX="8"
              refY="3"
              orient="auto"
            >
              <path d="M0,0 L8,3 L0,6 Z" fill="#374151" />
            </marker>
          </defs>

          {/* Edges (bezier curves) */}
          {edges.map((edge, i) => {
            const x1 = edge.from.x + NODE_W;
            const y1 = edge.from.y + NODE_H / 2;
            const x2 = edge.to.x;
            const y2 = edge.to.y + NODE_H / 2;
            const cx = (x1 + x2) / 2;
            const isRunning = edge.to.task.status === "running";
            const isDone = edge.from.task.status === "done";
            const edgeColor = isDone ? "#10b98140" : "#37415180";

            return (
              <path
                key={`edge-${i}`}
                d={`M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`}
                fill="none"
                stroke={edgeColor}
                strokeWidth={1.5}
                markerEnd="url(#arrowhead)"
                strokeDasharray={isRunning ? "4 4" : "none"}
                style={
                  isRunning
                    ? { animation: "dash-flow 0.6s linear infinite" }
                    : undefined
                }
              />
            );
          })}

          {/* Nodes */}
          {positions.map((pos) => {
            const { task, x, y } = pos;
            const color = ROLE_COLORS[task.role] || "#6366f1";
            const statusClr = STATUS_COLORS[task.status] || "#374151";
            const isRunning = task.status === "running";
            const icon = ROLE_ICONS[task.role] || "\u2699\uFE0F";

            return (
              <g key={task.id}>
                {/* Running glow effect */}
                {isRunning && (
                  <rect
                    x={x - 2}
                    y={y - 2}
                    width={NODE_W + 4}
                    height={NODE_H + 4}
                    rx={10}
                    ry={10}
                    fill="none"
                    stroke={color}
                    strokeWidth={1}
                    opacity={0.4}
                    style={{ animation: "pulse-glow 2s ease-in-out infinite" }}
                  />
                )}

                {/* Node background */}
                <rect
                  x={x}
                  y={y}
                  width={NODE_W}
                  height={NODE_H}
                  rx={8}
                  ry={8}
                  fill="#111122"
                  stroke={isRunning ? color + "80" : "#1a1a33"}
                  strokeWidth={1}
                />

                {/* Top accent line */}
                <rect
                  x={x}
                  y={y}
                  width={NODE_W}
                  height={3}
                  rx={8}
                  ry={8}
                  fill={color}
                  opacity={0.6}
                />
                {/* Cover bottom corners of accent */}
                <rect
                  x={x}
                  y={y + 1}
                  width={NODE_W}
                  height={2}
                  fill={color}
                  opacity={0.6}
                />

                {/* Role icon */}
                <text
                  x={x + 10}
                  y={y + 24}
                  fontSize={14}
                  fill="#e2e8f0"
                >
                  {icon}
                </text>

                {/* Title */}
                <text
                  x={x + 30}
                  y={y + 24}
                  fontSize={11}
                  fontWeight={600}
                  fill="#e2e8f0"
                  fontFamily="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"
                >
                  {truncate(task.title, 18)}
                </text>

                {/* Role label */}
                <text
                  x={x + 30}
                  y={y + 40}
                  fontSize={9}
                  fill={color}
                  fontWeight={500}
                  fontFamily="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"
                >
                  {task.role}
                </text>

                {/* Status dot */}
                <circle
                  cx={x + NODE_W - 16}
                  cy={y + 20}
                  r={4}
                  fill={statusClr}
                  style={
                    isRunning
                      ? { animation: "pulse-glow 1.5s ease-in-out infinite" }
                      : undefined
                  }
                />
                {/* Status dot glow ring for running */}
                {isRunning && (
                  <circle
                    cx={x + NODE_W - 16}
                    cy={y + 20}
                    r={7}
                    fill="none"
                    stroke={statusClr}
                    strokeWidth={1}
                    opacity={0.3}
                    style={{ animation: "pulse-glow 1.5s ease-in-out infinite" }}
                  />
                )}

                {/* Retry count */}
                {task.retryCount > 0 && (
                  <g>
                    <rect
                      x={x + NODE_W - 36}
                      y={y + NODE_H - 20}
                      width={26}
                      height={14}
                      rx={4}
                      ry={4}
                      fill="#ef444420"
                    />
                    <text
                      x={x + NODE_W - 23}
                      y={y + NODE_H - 10}
                      fontSize={8}
                      fill="#ef4444"
                      fontWeight={600}
                      textAnchor="middle"
                      fontFamily="'SF Mono',Monaco,monospace"
                    >
                      R{task.retryCount}
                    </text>
                  </g>
                )}

                {/* Status label at bottom */}
                <text
                  x={x + 10}
                  y={y + NODE_H - 10}
                  fontSize={8}
                  fill={statusClr}
                  fontWeight={500}
                  opacity={0.8}
                  fontFamily="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"
                >
                  {task.status}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
