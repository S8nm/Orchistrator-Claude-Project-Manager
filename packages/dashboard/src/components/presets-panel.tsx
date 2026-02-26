"use client";

import { useState, useEffect, useCallback } from "react";
import { fetchPresets, savePresetApi, deletePresetApi } from "@/lib/api";

const ROLE_ICONS: Record<string, string> = {
  orchestrator: "\u{1F9E0}", architect: "\u{1F3D7}\uFE0F", backend: "\u2699\uFE0F",
  frontend: "\u{1F3A8}", tester: "\u{1F9EA}", reviewer: "\u{1F50D}",
  fullstack: "\u{1F527}", devops: "\u{1F680}", security: "\u{1F6E1}\uFE0F",
  docs: "\u{1F4DD}", refactorer: "\u267B\uFE0F",
};

const ROLE_COLORS: Record<string, string> = {
  orchestrator: "#a855f7", architect: "#8b5cf6", backend: "#3b82f6",
  frontend: "#ec4899", tester: "#10b981", reviewer: "#f59e0b",
  fullstack: "#6366f1", devops: "#14b8a6", security: "#ef4444",
  docs: "#8b5cf6", refactorer: "#06b6d4",
};

const AVAILABLE_ROLES = Object.keys(ROLE_ICONS);

const AGENT_MODES = ["autonomous", "supervised", "collaborative"] as const;

interface PresetAgent {
  role: string;
  name: string;
  mode: string;
}

interface Preset {
  id: string;
  name: string;
  type: "role" | "team" | "custom";
  agents: PresetAgent[];
  tags: string[];
  description?: string;
}

interface PresetsPanelProps {
  onSpawn: (preset: any) => void;
  styles: Record<string, any>;
}

const dark = "#080810", panel = "#0d0d1a", card = "#111122", border = "#1a1a33", borderLight = "#252545";

export default function PresetsPanel({ onSpawn, styles: parentStyles }: PresetsPanelProps) {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"all" | "role" | "team" | "custom">("all");
  const [modal, setModal] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [spawning, setSpawning] = useState<string | null>(null);

  // New preset form state
  const [form, setForm] = useState({
    name: "",
    type: "custom" as "role" | "team" | "custom",
    description: "",
    agents: [{ role: "backend", name: "", mode: "autonomous" }] as PresetAgent[],
    tags: "",
  });

  const loadPresets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPresets();
      setPresets(data.presets || []);
    } catch (e: any) {
      setError(e.message || "Failed to load presets");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPresets();
  }, [loadPresets]);

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      await deletePresetApi(id);
      setPresets((prev) => prev.filter((p) => p.id !== id));
    } catch (e: any) {
      setError(e.message || "Failed to delete preset");
    } finally {
      setDeleting(null);
    }
  };

  const handleSpawn = (preset: Preset) => {
    setSpawning(preset.id);
    onSpawn(preset);
    setTimeout(() => setSpawning(null), 1200);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    const newPreset = {
      id: `preset-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: form.name.trim(),
      type: form.type,
      description: form.description.trim(),
      agents: form.agents.filter((a) => a.role),
      tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
    };
    try {
      await savePresetApi(newPreset);
      setPresets((prev) => [...prev, newPreset]);
      setForm({
        name: "",
        type: "custom",
        description: "",
        agents: [{ role: "backend", name: "", mode: "autonomous" }],
        tags: "",
      });
      setModal(false);
    } catch (e: any) {
      setError(e.message || "Failed to save preset");
    }
  };

  const addFormAgent = () => {
    setForm((f) => ({
      ...f,
      agents: [...f.agents, { role: "backend", name: "", mode: "autonomous" }],
    }));
  };

  const removeFormAgent = (index: number) => {
    setForm((f) => ({
      ...f,
      agents: f.agents.filter((_, i) => i !== index),
    }));
  };

  const updateFormAgent = (index: number, field: keyof PresetAgent, value: string) => {
    setForm((f) => ({
      ...f,
      agents: f.agents.map((a, i) => (i === index ? { ...a, [field]: value } : a)),
    }));
  };

  const filtered = activeTab === "all"
    ? presets
    : presets.filter((p) => p.type === activeTab);

  const counts = {
    all: presets.length,
    role: presets.filter((p) => p.type === "role").length,
    team: presets.filter((p) => p.type === "team").length,
    custom: presets.filter((p) => p.type === "custom").length,
  };

  const TYPE_COLORS: Record<string, string> = {
    role: "#818cf8",
    team: "#f59e0b",
    custom: "#10b981",
  };

  const S = {
    input: { width: "100%", padding: "9px 11px", borderRadius: 7, border: `1px solid ${border}`, background: panel, color: "#e2e8f0", fontSize: 12, outline: "none", boxSizing: "border-box" as const } as React.CSSProperties,
    select: { padding: "9px 11px", borderRadius: 7, border: `1px solid ${border}`, background: panel, color: "#e2e8f0", fontSize: 12, outline: "none", cursor: "pointer", width: "100%" } as React.CSSProperties,
    btn: (c = "#6366f1"): React.CSSProperties => ({ padding: "7px 14px", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, background: c, color: "#fff" }),
    btnSm: (c = "#6366f1"): React.CSSProperties => ({ padding: "3px 9px", borderRadius: 5, border: "none", cursor: "pointer", fontSize: 10, fontWeight: 600, background: c + "30", color: c }),
    btnGhost: { padding: "3px 8px", borderRadius: 5, border: `1px solid ${border}`, background: "transparent", color: "#64748b", cursor: "pointer", fontSize: 11 } as React.CSSProperties,
    badge: (c: string): React.CSSProperties => ({ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 12, fontSize: 10, fontWeight: 600, background: c + "18", color: c, border: `1px solid ${c}30` }),
    tab: (active: boolean): React.CSSProperties => ({ padding: "4px 12px", borderRadius: 6, border: active ? "1px solid #6366f1" : `1px solid ${border}`, background: active ? "#6366f120" : "transparent", color: active ? "#a5b4fc" : "#64748b", cursor: "pointer", fontSize: 11, fontWeight: 500 }),
    modal: { position: "fixed" as const, inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 } as React.CSSProperties,
    modalBox: { background: card, border: `1px solid ${borderLight}`, borderRadius: 14, padding: 20, maxWidth: 560, width: "100%", maxHeight: "85vh", overflowY: "auto" as const } as React.CSSProperties,
  };

  if (loading) {
    return (
      <div style={{ padding: "16px 20px" }}>
        <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, padding: 40, textAlign: "center", color: "#475569", fontSize: 12 }}>
          Loading presets...
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "16px 20px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#94a3b8" }}>
          {"\u{1F4E6}"} Agent Presets
        </div>
        <button style={S.btn()} onClick={() => setModal(true)}>
          + New Preset
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div style={{ background: "#ef444418", border: "1px solid #ef444430", borderRadius: 8, padding: "8px 12px", marginBottom: 12, fontSize: 11, color: "#ef4444", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>{error}</span>
          <button onClick={() => setError(null)} style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 14, padding: 0, lineHeight: 1 }}>{"\u00D7"}</button>
        </div>
      )}

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 14, flexWrap: "wrap" }}>
        {(["all", "role", "team", "custom"] as const).map((tab) => (
          <button
            key={tab}
            style={S.tab(activeTab === tab)}
            onClick={() => setActiveTab(tab)}
          >
            {tab === "all" ? "All" : tab[0].toUpperCase() + tab.slice(1)}s
            <span style={{ marginLeft: 4, opacity: 0.6 }}>({counts[tab]})</span>
          </button>
        ))}
      </div>

      {/* Preset grid */}
      {filtered.length === 0 ? (
        <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 10, padding: 40, textAlign: "center", color: "#374151", fontSize: 12 }}>
          {presets.length === 0
            ? "No presets yet \u2014 create one to get started"
            : `No ${activeTab} presets found`}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
          {filtered.map((preset) => {
            const typeColor = TYPE_COLORS[preset.type] || "#64748b";
            const isSpawning = spawning === preset.id;
            const isDeleting = deleting === preset.id;

            return (
              <div
                key={preset.id}
                style={{
                  background: card,
                  border: `1px solid ${border}`,
                  borderRadius: 12,
                  overflow: "hidden",
                  transition: "all 0.3s",
                }}
              >
                {/* Card header */}
                <div style={{ padding: "12px 14px", borderBottom: `1px solid ${border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: "#e2e8f0" }}>
                      {preset.name}
                    </div>
                    <span style={S.badge(typeColor)}>
                      {preset.type}
                    </span>
                  </div>
                  <div style={{ fontSize: 10, color: "#475569" }}>
                    {preset.agents.length} agent{preset.agents.length !== 1 ? "s" : ""}
                  </div>
                </div>

                {/* Description */}
                {preset.description && (
                  <div style={{ padding: "6px 14px", fontSize: 11, color: "#64748b", borderBottom: `1px solid ${border}` }}>
                    {preset.description}
                  </div>
                )}

                {/* Agent list */}
                <div style={{ padding: "10px 14px" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {preset.agents.map((agent, idx) => {
                      const roleColor = ROLE_COLORS[agent.role] || "#64748b";
                      const roleIcon = ROLE_ICONS[agent.role] || "\u{1F916}";
                      return (
                        <div
                          key={idx}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            padding: "5px 8px",
                            background: `${roleColor}08`,
                            borderRadius: 6,
                            border: `1px solid ${roleColor}15`,
                          }}
                        >
                          <span style={{ fontSize: 14 }}>{roleIcon}</span>
                          <span style={{ fontSize: 11, fontWeight: 600, color: roleColor, flex: 1 }}>
                            {agent.name || agent.role}
                          </span>
                          <span style={{
                            fontSize: 9,
                            fontWeight: 500,
                            padding: "1px 6px",
                            borderRadius: 4,
                            background: `${roleColor}15`,
                            color: `${roleColor}cc`,
                          }}>
                            {agent.mode}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Tags */}
                {preset.tags && preset.tags.length > 0 && (
                  <div style={{ padding: "0 14px 10px", display: "flex", flexWrap: "wrap", gap: 3 }}>
                    {preset.tags.map((tag) => (
                      <span
                        key={tag}
                        style={{
                          padding: "2px 7px",
                          borderRadius: 4,
                          fontSize: 9,
                          fontWeight: 500,
                          border: `1px solid ${border}`,
                          background: "transparent",
                          color: "#475569",
                          whiteSpace: "nowrap" as const,
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Actions */}
                <div style={{ padding: "8px 14px", borderTop: `1px solid ${border}`, display: "flex", gap: 6, justifyContent: "flex-end" }}>
                  {preset.type === "custom" && (
                    <button
                      style={{ ...S.btnSm("#ef4444"), opacity: isDeleting ? 0.5 : 1 }}
                      onClick={() => handleDelete(preset.id)}
                      disabled={isDeleting}
                    >
                      {isDeleting ? "Deleting..." : "Delete"}
                    </button>
                  )}
                  <button
                    style={{
                      ...S.btn("#6366f1"),
                      padding: "5px 14px",
                      fontSize: 11,
                      opacity: isSpawning ? 0.7 : 1,
                    }}
                    onClick={() => handleSpawn(preset)}
                    disabled={isSpawning}
                  >
                    {isSpawning ? "\u2713 Spawning..." : "\u{1F680} Spawn"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* New Preset Modal */}
      {modal && (
        <div style={S.modal} onClick={(e: React.MouseEvent) => e.target === e.currentTarget && setModal(false)}>
          <div style={S.modalBox}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>
              New Preset
            </div>

            {/* Name */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: "#64748b", marginBottom: 3 }}>Name</div>
              <input
                style={S.input}
                placeholder="e.g. Full Stack Team"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>

            {/* Type */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: "#64748b", marginBottom: 3 }}>Type</div>
              <div style={{ display: "flex", gap: 4 }}>
                {(["role", "team", "custom"] as const).map((t) => (
                  <button
                    key={t}
                    style={S.tab(form.type === t)}
                    onClick={() => setForm((f) => ({ ...f, type: t }))}
                  >
                    {t[0].toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Description */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: "#64748b", marginBottom: 3 }}>Description</div>
              <input
                style={S.input}
                placeholder="Brief description of this preset..."
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>

            {/* Agents */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <div style={{ fontSize: 11, color: "#64748b" }}>Agents</div>
                <button style={S.btnSm()} onClick={addFormAgent}>+ Add Agent</button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {form.agents.map((agent, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: panel,
                      border: `1px solid ${border}`,
                      borderRadius: 8,
                      padding: 10,
                    }}
                  >
                    <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                      {/* Role select */}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 9, color: "#475569", marginBottom: 2 }}>Role</div>
                        <select
                          style={{ ...S.select, fontSize: 11, padding: "6px 8px" }}
                          value={agent.role}
                          onChange={(e) => updateFormAgent(idx, "role", e.target.value)}
                        >
                          {AVAILABLE_ROLES.map((r) => (
                            <option key={r} value={r}>
                              {ROLE_ICONS[r]} {r}
                            </option>
                          ))}
                        </select>
                      </div>
                      {/* Name input */}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 9, color: "#475569", marginBottom: 2 }}>Name</div>
                        <input
                          style={{ ...S.input, fontSize: 11, padding: "6px 8px" }}
                          placeholder={agent.role}
                          value={agent.name}
                          onChange={(e) => updateFormAgent(idx, "name", e.target.value)}
                        />
                      </div>
                      {/* Mode select */}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 9, color: "#475569", marginBottom: 2 }}>Mode</div>
                        <select
                          style={{ ...S.select, fontSize: 11, padding: "6px 8px" }}
                          value={agent.mode}
                          onChange={(e) => updateFormAgent(idx, "mode", e.target.value)}
                        >
                          {AGENT_MODES.map((m) => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    {/* Remove agent button */}
                    {form.agents.length > 1 && (
                      <div style={{ display: "flex", justifyContent: "flex-end" }}>
                        <button
                          style={{ ...S.btnSm("#ef4444"), fontSize: 9 }}
                          onClick={() => removeFormAgent(idx)}
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Tags */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: "#64748b", marginBottom: 3 }}>
                Tags <span style={{ color: "#374151" }}>(comma-separated)</span>
              </div>
              <input
                style={S.input}
                placeholder="e.g. fullstack, microservices, api"
                value={form.tags}
                onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
              />
            </div>

            {/* Modal actions */}
            <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
              <button style={S.btnGhost} onClick={() => setModal(false)}>Cancel</button>
              <button
                style={{ ...S.btn(), opacity: form.name.trim() ? 1 : 0.4 }}
                onClick={handleSave}
                disabled={!form.name.trim()}
              >
                Save Preset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
