"use client";

import React, { useState, useEffect, useCallback, Suspense, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Play, Trash2, Square, Folder, FolderOpen,
  Search, Plus, Loader2, Settings2, ChevronDown, ChevronRight
} from "lucide-react";

interface Scan {
  id: string;
  target: string;
  scanName?: string;
  projectName?: string;
  llmModel: string;
  scanMode: string;
  status: "running" | "completed" | "failed" | "stopped" | "crawling" | "scanning" | "analyzing";
  startedAt: string;
  finishedAt: string | null;
  vulnCount: number;
  period?: "none" | "daily" | "weekly" | "monthly";
}

const LLM_MODELS = [
  // OpenAI
  { value: "openai/gpt-4o", label: "OpenAI GPT-4o" },
  { value: "openai/gpt-4o-mini", label: "OpenAI GPT-4o Mini" },
  { value: "openai/o1-preview", label: "OpenAI o1-Preview" },
  { value: "openai/gpt-5", label: "OpenAI GPT-5" },
  // Anthropic
  { value: "anthropic/claude-3-5-sonnet-latest", label: "Anthropic Claude 3.5 Sonnet" },
  { value: "anthropic/claude-3-5-haiku-latest", label: "Anthropic Claude 3.5 Haiku" },
  { value: "anthropic/claude-3-opus-latest", label: "Anthropic Claude 3 Opus" },
  // Google
  { value: "google/gemini-2.5-pro", label: "Google Gemini 2.5 Pro" },
  { value: "google/gemini-3-pro", label: "Google Gemini 3 Pro" },
  // DeepSeek
  { value: "deepseek/deepseek-coder", label: "DeepSeek Coder" },
  { value: "deepseek/deepseek-v3", label: "DeepSeek v3" },
  // Groq
  { value: "groq/llama3-70b-8192", label: "Groq Llama 3 70B" },
  { value: "groq/mixtral-8x7b-32768", label: "Groq Mixtral 8x7B" },
  // OpenRouter
  { value: "openrouter/anthropic/claude-3.5-sonnet", label: "OpenRouter Claude 3.5 Sonnet" },
  { value: "openrouter/meta-llama/llama-3.1-405b-instruct", label: "OpenRouter Llama 3.1 405B" },
  // Mistral
  { value: "mistral/mistral-large-latest", label: "Mistral Large" },
  // Cohere
  { value: "cohere/command-r-plus", label: "Cohere Command R+" },
  // Local (Ollama)
  { value: "ollama/llama3.1:70b", label: "Local: Llama 3.1 70B (Ollama)" },
  { value: "ollama/qwen2.5:72b", label: "Local: Qwen 2.5 72B (Ollama)" },
  { value: "ollama/deepseek-v3", label: "Local: DeepSeek v3 (Ollama)" },
];

const SCAN_MODES = [
  { value: "quick", label: "Quick" },
  { value: "standard", label: "Standard" },
  { value: "deep", label: "Deep" },
];

function timeAgo(iso: string) {
  if (!iso) return "Unknown";
  const time = new Date(iso).getTime();
  if (isNaN(time)) return "Unknown";
  const diff = Date.now() - time;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function statusLedClass(status: string) {
  const isActive = ["crawling", "scanning", "analyzing", "running"].includes(status);
  if (isActive) return "status-led running";
  if (status === "completed") return "status-led completed";
  if (status === "failed") return "status-led failed";
  if (status === "scheduled") return "status-led running";
  return "status-led stopped";
}

function ScansContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [scans, setScans] = useState<Scan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [scanToDelete, setScanToDelete] = useState<string | null>(null);
  const [launching, setLaunching] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "finished">("all");
  const [filterMode, setFilterMode] = useState("all");
  const [filterModel, setFilterModel] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  
  const [scheduleModal, setScheduleModal] = useState<{ scanId: string, period: string, llmModel: string } | null>(null);
  const [scheduling, setScheduling] = useState(false);

  function getApiKey(model: string): string {
    if (model.startsWith("ollama/")) return ""; // Ollama doesn't need a key
    try {
      const savedKeys = JSON.parse(localStorage.getItem("strix_api_keys") || "{}");
      if (model.startsWith("openai/")) return savedKeys.openai || "";
      if (model.startsWith("anthropic/")) return savedKeys.anthropic || "";
      if (model.startsWith("google/")) return savedKeys.gemini || "";
      if (model.startsWith("deepseek/")) return savedKeys.deepseek || "";
      if (model.startsWith("groq/")) return savedKeys.groq || "";
      if (model.startsWith("openrouter/")) return savedKeys.openrouter || "";
      if (model.startsWith("mistral/")) return savedKeys.mistral || "";
      if (model.startsWith("cohere/")) return savedKeys.cohere || "";
    } catch (e) {}
    return "";
  }

  const [form, setForm] = useState({
    target: "",
    scanName: "",
    targetList: "",
    projectName: "",
    llmModel: "openai/gpt-4o",
    scanMode: "standard",
    instruction: "",
    simulationMode: false,
    scheduledAt: "",
    // Advanced
    scopeMode: "auto",
    diffBase: "",
    configFile: "",
    maxBudget: "",
    maxTurns: "",
    resumeRun: "",
  });

  const fetchScans = useCallback(async () => {
    try {
      const res = await fetch("/api/scans");
      const data = await res.json();
      setScans(data.scans ?? []);
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchScans();
    const interval = setInterval(fetchScans, 5000);
    return () => clearInterval(interval);
  }, [fetchScans]);

  useEffect(() => {
    if (searchParams.get("new") === "1") setShowModal(true);
  }, [searchParams]);

  const filteredScans = scans.filter((scan) => {
    if (filter !== "all") {
      const isFinished = ["completed", "failed", "stopped"].includes(scan.status);
      if (filter === "active" && isFinished) return false;
      if (filter === "finished" && !isFinished) return false;
    }
    if (filterMode !== "all" && scan.scanMode !== filterMode) return false;
    if (filterModel !== "all" && scan.llmModel !== filterModel) return false;
    return true;
  });

  const groupedScans = useMemo(() => {
    const groups: Record<string, Scan[]> = {};
    for (const scan of filteredScans) {
      let group = scan.projectName;
      if (!group) {
        try {
          group = new URL(scan.target.startsWith("http") ? scan.target : `http://${scan.target}`).hostname;
        } catch {
          group = "Other";
        }
      }
      if (!group) group = "Other";
      if (!groups[group]) groups[group] = [];
      groups[group].push(scan);
    }
    return groups;
  }, [filteredScans]);

  const toggleGroup = (g: string) =>
    setCollapsedGroups((prev) => ({ ...prev, [g]: !prev[g] }));

  async function handleLaunch(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.target.trim() && !form.targetList.trim()) return setError("Target is required");
    
    const apiKey = getApiKey(form.llmModel);
    if (!apiKey && !form.simulationMode && !form.llmModel.startsWith("ollama/")) {
      return setError(`Please configure your API Key in Settings first.`);
    }

    setLaunching(true);
    try {
      let notificationConfig = null;
      try {
        const savedNotifs = localStorage.getItem("strix_notification_config");
        if (savedNotifs) notificationConfig = JSON.parse(savedNotifs);
      } catch (e) {}

      const payload = { ...form, apiKey, notificationConfig };
      if (payload.scheduledAt) {
        payload.scheduledAt = new Date(payload.scheduledAt).toISOString();
      }

      const res = await fetch("/api/scans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to start scan");
      setShowModal(false);
      router.push(`/scans/${data.scanId}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLaunching(false);
    }
  }

  async function handleStop(id: string, e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    await fetch(`/api/scans/${id}`, { method: "DELETE" });
    fetchScans();
  }

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    setScanToDelete(id);
  }

  async function confirmDelete() {
    if (!scanToDelete) return;
    await fetch(`/api/scans/${scanToDelete}?purge=true`, { method: "DELETE" });
    setScanToDelete(null);
    fetchScans();
  }

  async function handleSchedulePeriod(scan: Scan, period: string) {
    if (period === "none") {
      // Clear period immediately
      await fetch(`/api/scans/${scan.id}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period: "none" })
      });
      fetchScans();
      return;
    }
    // For new periods, just show confirm dialog
    setScheduleModal({ scanId: scan.id, period, llmModel: scan.llmModel });
  }

  async function confirmSchedule() {
    if (!scheduleModal) return;
    setScheduling(true);
    try {
      const apiKey = getApiKey(scheduleModal.llmModel);
      if (!apiKey && !scheduleModal.llmModel.startsWith("ollama/")) {
         throw new Error(`Please configure your API Key for ${scheduleModal.llmModel} in Settings first.`);
      }

      const res = await fetch(`/api/scans/${scheduleModal.scanId}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period: scheduleModal.period, apiKey })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to schedule");
      setScheduleModal(null);
      fetchScans();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setScheduling(false);
    }
  }

  return (
    <div className="page" style={{ height: "100%", maxWidth: "none", gap: 16 }}>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 className="page-heading">Scans</h1>
          <p className="page-desc">Launch and monitor your security assessments.</p>
        </div>
        <button className="btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={14} /> New Scan
        </button>
      </div>

      {/* Main card */}
      <div className="card" style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
        {/* Filter bar */}
        <div className="scan-filter-bar" style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div className="filter-tabs">
            {(["all", "active", "finished"] as const).map((t) => (
              <button key={t} className={`filter-tab${filter === t ? " active" : ""}`} onClick={() => setFilter(t)}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          <div style={{ position: "relative" }}>
            <button 
              className={`btn-secondary ${showFilters ? 'active' : ''}`}
              style={{ display: 'flex', alignItems: 'center', gap: 6, height: 32, padding: "0 12px", background: showFilters || filterMode !== "all" || filterModel !== "all" ? "var(--bg-3)" : "transparent", border: "1px solid var(--border)", borderRadius: "var(--r)", fontSize: 13, color: "var(--fg-2)", cursor: "pointer" }}
              onClick={() => setShowFilters(!showFilters)}
            >
              <Settings2 size={14} /> Filters
              {(filterMode !== "all" || filterModel !== "all") && (
                <span style={{ width: 6, height: 6, background: "var(--fg)", borderRadius: "50%" }} />
              )}
            </button>
            
            {showFilters && (
              <>
                <div style={{ position: "fixed", inset: 0, zIndex: 90 }} onClick={() => setShowFilters(false)} />
                <div className="glass-panel animate-fade-in" style={{ position: "absolute", top: "110%", left: 0, width: 260, zIndex: 100, padding: 16, display: "flex", flexDirection: "column", gap: 16, boxShadow: "0 10px 40px rgba(0,0,0,0.3)" }}>
                  <div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--fg-3)", textTransform: "uppercase", marginBottom: 6 }}>Scan Mode</label>
                    <select value={filterMode} onChange={e => setFilterMode(e.target.value)} style={{ width: "100%", padding: "6px 8px", background: "var(--bg-1)", border: "1px solid var(--border)", borderRadius: "var(--r)", color: "var(--fg)", fontSize: 13 }}>
                      <option value="all">All Modes</option>
                      {SCAN_MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--fg-3)", textTransform: "uppercase", marginBottom: 6 }}>LLM Model</label>
                    <select value={filterModel} onChange={e => setFilterModel(e.target.value)} style={{ width: "100%", padding: "6px 8px", background: "var(--bg-1)", border: "1px solid var(--border)", borderRadius: "var(--r)", color: "var(--fg)", fontSize: 13 }}>
                      <option value="all">All Models</option>
                      {LLM_MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                  </div>
                  {(filterMode !== "all" || filterModel !== "all") && (
                    <button 
                      onClick={() => { setFilterMode("all"); setFilterModel("all"); }}
                      style={{ background: "none", border: "none", color: "var(--fg-3)", fontSize: 12, cursor: "pointer", textAlign: "left", padding: 0 }}
                    >
                      Clear Filters
                    </button>
                  )}
                </div>
              </>
            )}
          </div>

          <span style={{ fontSize: 12, color: "var(--fg-3)", marginLeft: "auto" }}>
            {filteredScans.length} scan{filteredScans.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Table header */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "2fr 1fr 1.5fr 1fr 1.5fr 100px 60px 80px",
          gap: 12,
          padding: "10px 20px",
          borderBottom: "1px solid var(--border)",
          fontSize: 11,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.5px",
          color: "var(--fg-3)",
          position: "sticky",
          top: 0,
          background: "var(--bg-1)",
          zIndex: 10,
        }}>
          <div>Target</div>
          <div>Mode</div>
          <div>Model</div>
          <div>Status</div>
          <div>Date</div>
          <div>Period</div>
          <div>Vulns</div>
          <div></div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {loading ? (
            <div className="empty-state">
              <Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} />
            </div>
          ) : filteredScans.length === 0 ? (
            <div className="empty-state">
              <Search size={32} style={{ opacity: 0.15 }} />
              <p>No scans found</p>
              <button className="btn-primary" onClick={() => setShowModal(true)} style={{ marginTop: 4 }}>
                <Plus size={14} /> New Scan
              </button>
            </div>
          ) : (
            Object.entries(groupedScans).map(([group, groupScans]) => {
              const isCollapsed = collapsedGroups[group];
              return (
                <div key={group}>
                  {/* Group header */}
                  <div
                    onClick={() => toggleGroup(group)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "8px 20px",
                      background: "var(--bg-2)",
                      borderBottom: "1px solid var(--border)",
                      cursor: "pointer",
                      userSelect: "none",
                    }}
                  >
                    {isCollapsed
                      ? <Folder size={13} style={{ color: "var(--fg-3)" }} />
                      : <FolderOpen size={13} style={{ color: "var(--fg-3)" }} />}
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--fg-2)" }}>{group}</span>
                    <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--fg-3)" }}>
                      {groupScans.length}
                    </span>
                    {isCollapsed
                      ? <ChevronRight size={12} style={{ color: "var(--fg-3)" }} />
                      : <ChevronDown size={12} style={{ color: "var(--fg-3)" }} />}
                  </div>

                  {/* Group rows */}
                  {!isCollapsed && groupScans.map((scan) => (
                    <div
                      key={scan.id}
                      onClick={() => router.push(`/scans/${scan.id}`)}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "2fr 1fr 1.5fr 1fr 1.5fr 100px 60px 80px",
                        gap: 12,
                        padding: "12px 20px",
                        borderBottom: "1px solid var(--border)",
                        cursor: "pointer",
                        alignItems: "center",
                        transition: "background var(--dur)",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-2)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                      className="scan-row"
                    >
                      <div style={{ fontSize: 13, fontWeight: 500, color: "var(--fg)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {scan.scanName ? <span style={{ fontWeight: 600 }}>{scan.scanName} <span style={{ fontWeight: 400, color: "var(--fg-3)" }}>({scan.target})</span></span> : scan.target}
                      </div>
                      <div>
                        <span className="tag" style={{ textTransform: "capitalize" }}>{scan.scanMode}</span>
                      </div>
                      <div style={{ fontSize: 11, color: "var(--fg-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {scan.llmModel}
                      </div>
                      <div>
                        <div className="status-badge">
                          <span className={statusLedClass(scan.period && scan.period !== "none" && !["running", "crawling", "scanning", "analyzing"].includes(scan.status) ? "scheduled" : scan.status)} />
                          <span style={{ fontSize: 11, textTransform: "capitalize", letterSpacing: "0.3px" }}>
                            {scan.period && scan.period !== "none" && !["running", "crawling", "scanning", "analyzing"].includes(scan.status) ? "scheduled" : scan.status}
                          </span>
                        </div>
                      </div>
                      <div style={{ fontSize: 11, color: "var(--fg-3)" }}>
                        {new Date(scan.startedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                      </div>
                      <div onClick={(e) => e.stopPropagation()}>
                        <select
                          value={scan.period || "none"}
                          onChange={(e) => handleSchedulePeriod(scan, e.target.value)}
                          style={{
                            background: "var(--bg-1)",
                            border: "1px solid var(--border)",
                            color: "var(--fg)",
                            fontSize: 11,
                            padding: "2px 6px",
                            borderRadius: "var(--r)",
                            cursor: "pointer",
                            width: "100%",
                          }}
                        >
                          <option value="none">None</option>
                          <option value="daily">Daily</option>
                          <option value="weekly">Weekly</option>
                          <option value="monthly">Monthly</option>
                        </select>
                      </div>
                      <div>
                        {scan.vulnCount > 0 ? (
                          <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 6px", background: "var(--sev-critical-bg)", color: "var(--sev-critical)", border: "1px solid var(--sev-critical-bd)", borderRadius: "var(--r-sm)" }}>
                            {scan.vulnCount}
                          </span>
                        ) : (
                          <span style={{ color: "var(--fg-3)", fontSize: 13 }}>—</span>
                        )}
                      </div>
                      <div
                        style={{ display: "flex", justifyContent: "flex-end", gap: 4 }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {["running", "crawling", "scanning", "analyzing"].includes(scan.status) ? (
                          <button
                            className="btn-ghost"
                            style={{ padding: "4px 8px", fontSize: 11, color: "var(--sev-critical)", borderColor: "var(--sev-critical-bd)" }}
                            onClick={(e) => handleStop(scan.id, e)}
                            title="Stop"
                          >
                            <Square size={11} />
                          </button>
                        ) : (
                          <button
                            className="btn-ghost"
                            style={{ padding: "4px 8px", fontSize: 11 }}
                            onClick={(e) => handleDelete(scan.id, e)}
                            title="Delete"
                          >
                            <Trash2 size={11} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* New Scan Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">Launch New Scan</div>
            </div>
            <form onSubmit={handleLaunch}>
              <div className="modal-body">
                <div className="field-grid">
                  <div className="field">
                    <label className="field-label">Target(s) *</label>
                    <textarea
                      className="field-input"
                      style={{ minHeight: 60, resize: "vertical" }}
                      placeholder="https://app.example.com&#10;192.168.1.42&#10;./my-project"
                      value={form.targetList || form.target}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val.includes('\n')) {
                          setForm({ ...form, target: "", targetList: val });
                        } else {
                          setForm({ ...form, target: val, targetList: "" });
                        }
                      }}
                      disabled={launching}
                    />
                  </div>
                  <div className="field">
                    <label className="field-label">Scan Name (Optional)</label>
                    <input
                      className="field-input"
                      placeholder="e.g. Weekly Payment Test"
                      value={form.scanName}
                      onChange={(e) => setForm({ ...form, scanName: e.target.value })}
                      disabled={launching}
                    />
                  </div>
                </div>
                <div className="field-grid">
                  <div className="field">
                    <label className="field-label">Project Group</label>
                    <select
                      className="field-select"
                      value={Object.keys(groupedScans).includes(form.projectName) ? form.projectName : (form.projectName ? "custom" : "")}
                      onChange={(e) => {
                        if (e.target.value === "custom") {
                          setForm({ ...form, projectName: "New Project" });
                        } else {
                          setForm({ ...form, projectName: e.target.value });
                        }
                      }}
                      disabled={launching}
                    >
                      <option value="">Auto-detected / Default</option>
                      {Object.keys(groupedScans).map((g) => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                      <option value="custom">+ Custom Project...</option>
                    </select>
                    {!Object.keys(groupedScans).includes(form.projectName) && form.projectName !== "" && (
                      <input
                        style={{ marginTop: 8 }}
                        className="field-input animate-fade-in"
                        placeholder="Enter project name"
                        value={form.projectName}
                        onChange={(e) => setForm({ ...form, projectName: e.target.value })}
                        disabled={launching}
                        autoFocus
                      />
                    )}
                  </div>
                </div>

                <div className="field-grid">
                  <div className="field">
                    <label className="field-label">LLM Model</label>
                    <select
                      className="field-select"
                      value={form.llmModel}
                      onChange={(e) => setForm({ ...form, llmModel: e.target.value })}
                      disabled={launching}
                    >
                      {LLM_MODELS.map((m) => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label className="field-label">Scan Mode</label>
                    <select
                      className="field-select"
                      value={form.scanMode}
                      onChange={(e) => setForm({ ...form, scanMode: e.target.value })}
                      disabled={launching}
                    >
                      {SCAN_MODES.map((m) => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="field">
                  <label className="field-label">Custom Instructions (Optional)</label>
                  <textarea
                    className="field-input"
                    style={{ minHeight: 60, resize: "vertical" }}
                    placeholder="e.g. Focus on authentication vulnerabilities, use admin:password123"
                    value={form.instruction}
                    onChange={(e) => setForm({ ...form, instruction: e.target.value })}
                    disabled={launching}
                  />
                </div>

                <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", padding: "10px 12px", background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: "var(--r)" }}>
                  <input
                    type="checkbox"
                    style={{ marginTop: 2, accentColor: "var(--fg)", flexShrink: 0 }}
                    checked={form.simulationMode}
                    onChange={(e) => setForm({ ...form, simulationMode: e.target.checked })}
                    disabled={launching}
                  />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "var(--fg)" }}>Simulation Mode</div>
                    <div style={{ fontSize: 12, color: "var(--fg-3)", marginTop: 2 }}>
                      Inject mock vulnerabilities for UI demonstration.
                    </div>
                  </div>
                </label>

                {/* Advanced */}
                <button
                  type="button"
                  className="btn-ghost"
                  style={{ width: "100%", justifyContent: "space-between" }}
                  onClick={() => setShowAdvanced(!showAdvanced)}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Settings2 size={13} /> Advanced
                  </span>
                  {showAdvanced ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                </button>

                {showAdvanced && (
                  <>
                    <div className="field">
                      <label className="field-label">Scheduled Time</label>
                      <input
                        className="field-input"
                        type="datetime-local"
                        value={form.scheduledAt}
                        onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
                      />
                    </div>
                    
                    <div className="field-grid">
                      <div className="field">
                        <label className="field-label">Scope Mode</label>
                        <select
                          className="field-select"
                          value={form.scopeMode}
                          onChange={(e) => setForm({ ...form, scopeMode: e.target.value })}
                        >
                          <option value="auto">Auto (PR diff-scope if available)</option>
                          <option value="diff">Diff (force changed-files only)</option>
                          <option value="full">Full (disable diff-scope)</option>
                        </select>
                      </div>
                      <div className="field">
                        <label className="field-label">Diff Base Branch/Commit</label>
                        <input
                          className="field-input"
                          placeholder="e.g. origin/main"
                          value={form.diffBase}
                          onChange={(e) => setForm({ ...form, diffBase: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="field">
                      <label className="field-label">Custom Config File Path</label>
                      <input
                        className="field-input"
                        placeholder="/path/to/custom/cli-config.json"
                        value={form.configFile}
                        onChange={(e) => setForm({ ...form, configFile: e.target.value })}
                      />
                    </div>

                    <div className="field-grid">
                      <div className="field">
                        <label className="field-label">Max Budget (USD)</label>
                        <input
                          className="field-input"
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="e.g. 50.00"
                          value={form.maxBudget}
                          onChange={(e) => setForm({ ...form, maxBudget: e.target.value })}
                        />
                      </div>
                      <div className="field">
                        <label className="field-label">Max Turns per Agent</label>
                        <input
                          className="field-input"
                          type="number"
                          min="1"
                          placeholder="e.g. 500"
                          value={form.maxTurns}
                          onChange={(e) => setForm({ ...form, maxTurns: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="field">
                      <label className="field-label">Resume Previous Scan (Run Name/UUID)</label>
                      <input
                        className="field-input"
                        placeholder="e.g. 3a9e3..."
                        value={form.resumeRun}
                        onChange={(e) => setForm({ ...form, resumeRun: e.target.value })}
                      />
                    </div>
                  </>
                )}

                {error && (
                  <div style={{ padding: "10px 12px", background: "var(--sev-critical-bg)", border: "1px solid var(--sev-critical-bd)", borderRadius: "var(--r)", fontSize: 13, color: "var(--sev-critical)" }}>
                    {error}
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-ghost" onClick={() => setShowModal(false)} disabled={launching}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={launching}>
                  {launching ? (
                    <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Launching…</>
                  ) : (
                    <><Play size={13} /> Launch Scan</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {scanToDelete && (
        <div className="modal-overlay" onClick={() => setScanToDelete(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <div className="modal-title" style={{ color: "var(--sev-critical)" }}>Delete Scan</div>
            </div>
            <div className="modal-body" style={{ color: "var(--fg-2)" }}>
              Are you sure you want to permanently delete this scan? All associated data and vulnerabilities will be removed from the system. This action cannot be undone.
            </div>
            <div className="modal-footer">
              <button className="btn-ghost" onClick={() => setScanToDelete(null)}>Cancel</button>
              <button className="btn-primary" style={{ background: "var(--sev-critical)", borderColor: "var(--sev-critical-bd)", color: "#fff" }} onClick={confirmDelete}>
                <Trash2 size={13} /> Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule API Key Modal */}
      {scheduleModal && (
        <div className="modal-overlay" onClick={() => { setScheduleModal(null); setError(""); }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <div className="modal-title">Schedule Recurring Scan</div>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 13, color: "var(--fg-2)", marginBottom: 16 }}>
                You selected <strong>{scheduleModal.period}</strong>. Strix will automatically use the saved API Key for <strong>{scheduleModal.llmModel}</strong> to run this scan in the background.
              </p>
              {error && (
                <div style={{ marginTop: 12, padding: "8px", background: "var(--sev-critical-bg)", border: "1px solid var(--sev-critical-bd)", borderRadius: "var(--r)", fontSize: 12, color: "var(--sev-critical)" }}>
                  {error}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-ghost" onClick={() => { setScheduleModal(null); setError(""); }} disabled={scheduling}>Cancel</button>
              <button className="btn-primary" onClick={confirmSchedule} disabled={scheduling}>
                {scheduling ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Play size={13} />} Confirm Schedule
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ScansPage() {
  return (
    <Suspense fallback={
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--fg-3)" }}>
        <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} />
      </div>
    }>
      <ScansContent />
    </Suspense>
  );
}
