"use client";

import React, { useState, useEffect, useCallback, Suspense, useMemo, Fragment } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import styles from "./scans.module.css";

interface Scan {
  id: string;
  target: string;
  projectName?: string;
  llmModel: string;
  scanMode: string;
  status: "running" | "completed" | "failed" | "stopped";
  startedAt: string;
  finishedAt: string | null;
  vulnCount: number;
}

const LLM_MODELS = [
  { value: "openai/gpt-4o", label: "OpenAI GPT-4o" },
  { value: "openai/gpt-4o-mini", label: "OpenAI GPT-4o Mini" },
  { value: "openai/o1-preview", label: "OpenAI o1-Preview" },
  { value: "openai/o1-mini", label: "OpenAI o1-Mini" },
  { value: "openai/gpt-4-turbo", label: "OpenAI GPT-4 Turbo" },
  { value: "openai/gpt-3.5-turbo", label: "OpenAI GPT-3.5 Turbo" },
  {
    value: "anthropic/claude-3-5-sonnet-latest",
    label: "Anthropic Claude 3.5 Sonnet",
  },
  {
    value: "anthropic/claude-3-5-haiku-latest",
    label: "Anthropic Claude 3.5 Haiku",
  },
  { value: "anthropic/claude-3-opus-latest", label: "Anthropic Claude 3 Opus" },
  { value: "google/gemini-2.5-pro", label: "Google Gemini 2.5 Pro" },
  { value: "google/gemini-1.5-pro", label: "Google Gemini 1.5 Pro" },
  { value: "google/gemini-1.5-flash", label: "Google Gemini 1.5 Flash" },
  { value: "groq/llama3-70b-8192", label: "Groq LLaMA-3 (70B)" },
  { value: "groq/llama3-8b-8192", label: "Groq LLaMA-3 (8B)" },
  { value: "groq/mixtral-8x7b-32768", label: "Groq Mixtral 8x7B" },
  { value: "deepseek/deepseek-chat", label: "DeepSeek Chat" },
  { value: "deepseek/deepseek-coder", label: "DeepSeek Coder" },
  { value: "mistral/mistral-large-latest", label: "Mistral Large" },
];

const SCAN_MODES = [
  { value: "quick", label: "Quick", desc: "Fast scan of changed files only" },
  { value: "standard", label: "Standard", desc: "Full application assessment" },
  { value: "deep", label: "Deep", desc: "Exhaustive multi-agent pentest" },
];

function statusBadge(status: Scan["status"] | string) {
  const map: Record<string, string> = {
    crawling: "badge-running",
    scanning: "badge-running",
    analyzing: "badge-running",
    running: "badge-running",
    completed: "badge-completed",
    failed: "badge-failed",
    stopped: "badge-stopped",
  };
  const labels: Record<string, string> = {
    crawling: " Crawling",
    scanning: " Scanning",
    analyzing: " Analyzing",
    running: " Running",
    completed: " Completed",
    failed: " Failed",
    stopped: " Stopped",
  };
  return (
    <span
      className={`${styles.statusBadge} ${styles[map[status] ?? "badge-stopped"]}`}
    >
      {labels[status] ?? status}
    </span>
  );
}

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

function ScansContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [scans, setScans] = useState<Scan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [form, setForm] = useState({
    target: "",
    projectName: "",
    targetList: "",
    llmModel: "openai/gpt-4o",
    apiKey: "",
    scanMode: "standard",
    instruction: "",
    simulationMode: false,
    scopeMode: "auto",
    diffBase: "",
    configFile: "",
    maxBudget: "",
    maxTurns: "",
    resumeRun: "",
  });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "finished">("all");

  const fetchScans = useCallback(async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch("/api/scans", { signal: controller.signal });
      clearTimeout(timeout);
      const data = await res.json();
      setScans(data.scans ?? []);
    } catch {
      clearTimeout(timeout);
    } finally {
      setLoading(false);
    }
  }, []);

  const filteredScans = scans.filter((scan) => {
    if (filter === "all") return true;
    const isFinished = ["completed", "failed", "stopped"].includes(scan.status);
    if (filter === "active") return !isFinished;
    if (filter === "finished") return isFinished;
    return true;
  });
  const groupedScans = useMemo(() => {
    const groups: Record<string, Scan[]> = {};
    for (const scan of filteredScans) {
      let group = scan.projectName;
      if (!group) {
        try {
          const urlStr = scan.target.startsWith("http") ? scan.target : `http://${scan.target}`;
          group = new URL(urlStr).hostname;
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
  useEffect(() => {
    fetchScans();
    const interval = setInterval(fetchScans, 3000);
    return () => clearInterval(interval);
  }, [fetchScans]);

  // Auto-open modal if ?new=1
  useEffect(() => {
    if (searchParams.get("new") === "1") setShowModal(true);
  }, [searchParams]);

  async function handleLaunch(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.target.trim() && !form.targetList.trim()) {
      setError("Target or Target List is required");
      return;
    }
    if (!form.apiKey.trim()) {
      setError("LLM API Key is required");
      return;
    }
    setLaunching(true);
    try {
      const res = await fetch("/api/scans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to start scan");
        setLaunching(false);
        return;
      }
      setShowModal(false);
      setLaunching(false);
      setForm({
        target: "",
        projectName: "",
        targetList: "",
        llmModel: "openai/gpt-4o",
        apiKey: "",
        scanMode: "standard",
        instruction: "",
        simulationMode: false,
        scopeMode: "auto",
        diffBase: "",
        configFile: "",
        maxBudget: "",
        maxTurns: "",
        resumeRun: "",
      });
      router.push(`/scans/${data.scanId}`);
    } catch {
      setError("Network error. Please try again.");
      setLaunching(false);
    }
  }

  async function handleStop(id: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    await fetch(`/api/scans/${id}`, { method: "DELETE" });
    fetchScans();
  }

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (confirm("Are you sure you want to permanently delete this scan and all its data?")) {
      await fetch(`/api/scans/${id}?purge=true`, { method: "DELETE" });
      fetchScans();
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Scans</h1>
          <p className={styles.subtitle}>
            Launch and monitor your security assessments
          </p>
        </div>
        <button className={styles.newBtn} onClick={() => setShowModal(true)}>
          <span>＋</span> New Scan
        </button>
      </div>

      {/* Scans Table */}
      <div className={`glass-panel ${styles.tableCard}`}>
        <div className={styles.filterTabs}>
          <button 
            className={`${styles.filterTab} ${filter === "all" ? styles.activeTab : ""}`}
            onClick={() => setFilter("all")}
          >
            All Scans
          </button>
          <button 
            className={`${styles.filterTab} ${filter === "active" ? styles.activeTab : ""}`}
            onClick={() => setFilter("active")}
          >
            Active
          </button>
          <button 
            className={`${styles.filterTab} ${filter === "finished" ? styles.activeTab : ""}`}
            onClick={() => setFilter("finished")}
          >
            Finished
          </button>
        </div>
        
        {loading ? (
          <div className={styles.empty}>
            <div className={styles.spinner} />
            <p>Loading scans…</p>
          </div>
        ) : filteredScans.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}></div>
            <h3>No scans yet</h3>
            <p>Launch your first security assessment to get started.</p>
            <button
              className={styles.newBtn}
              onClick={() => setShowModal(true)}
            >
              ＋ Start First Scan
            </button>
          </div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Target</th>
                <th>Mode</th>
                <th>Model</th>
                <th>Status</th>
                <th>Vulns</th>
                <th>Started</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(groupedScans).map(([groupName, scansInGroup]) => (
                <React.Fragment key={groupName}>
                  <tr className={styles.groupHeaderRow}>
                    <td colSpan={7}>
                      <div className={styles.groupHeaderContent}>
                        <span className={styles.groupIcon}>📁</span> {groupName}
                      </div>
                    </td>
                  </tr>
                  {scansInGroup.map((scan, i) => (
                    <tr
                      key={scan.id || `unknown-${i}`}
                      onClick={() => router.push(`/scans/${scan.id || ""}`)}
                      className={styles.row}
                    >
                  <td>
                    <div className={styles.targetCell}>
                      <span className={styles.targetIcon}></span>
                      <span className={styles.targetText}>{scan.target}</span>
                    </div>
                  </td>
                  <td>
                    <span className={styles.modeTag}>{scan.scanMode}</span>
                  </td>
                  <td className={styles.modelCell}>{scan.llmModel}</td>
                  <td>{statusBadge(scan.status)}</td>
                  <td>
                    <span className={styles.vulnCount}>
                      {scan.vulnCount > 0 ? (
                        <span className={styles.vulnCountBadge}>
                          {scan.vulnCount}
                        </span>
                      ) : (
                        "—"
                      )}
                    </span>
                  </td>
                  <td className={styles.timeCell}>{timeAgo(scan.startedAt)}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <div className={styles.actions}>
                      <Link
                        href={`/scans/${scan.id}`}
                        className={styles.actionBtn}
                      >
                        View
                      </Link>
                      {scan.status === "running" ? (
                        <button
                          className={`${styles.actionBtn} ${styles.stopBtn}`}
                          onClick={(e) => handleStop(scan.id, e)}
                        >
                          Stop
                        </button>
                      ) : (
                        <button
                          className={`${styles.actionBtn} ${styles.deleteBtn}`}
                          onClick={(e) => handleDelete(scan.id, e)}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )))}
            </tbody>
          </table>
        )}
      </div>

      {/* New Scan Modal */}
      {showModal && (
        <div
          className={styles.overlay}
          onClick={() => !launching && setShowModal(false)}
        >
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}> Launch New Scan</h2>
              <button
                className={styles.closeBtn}
                onClick={() => !launching && setShowModal(false)}
              ></button>
            </div>

            <form onSubmit={handleLaunch} className={styles.form}>
              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label className={styles.label}>Target</label>
                  <input
                    className={styles.input}
                    type="text"
                    placeholder="https://app.example.com"
                    value={form.target}
                    onChange={(e) => setForm({ ...form, target: e.target.value })}
                    disabled={launching}
                  />
                  <span className={styles.hint}>
                    URL, GitHub repo, or local directory path
                  </span>
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Project / Group Name</label>
                  <input
                    className={styles.input}
                    type="text"
                    placeholder="Auto-detected from target if empty"
                    value={form.projectName}
                    onChange={(e) => setForm({ ...form, projectName: e.target.value })}
                    disabled={launching}
                  />
                  <span className={styles.hint}>
                    Leave blank to group by domain name
                  </span>
                </div>
              </div>

              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label className={styles.label}>LLM Model</label>
                  <select
                    className={styles.select}
                    value={form.llmModel}
                    onChange={(e) =>
                      setForm({ ...form, llmModel: e.target.value })
                    }
                    disabled={launching}
                  >
                    {LLM_MODELS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Scan Mode</label>
                  <select
                    className={styles.select}
                    value={form.scanMode}
                    onChange={(e) =>
                      setForm({ ...form, scanMode: e.target.value })
                    }
                    disabled={launching}
                  >
                    {SCAN_MODES.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label} — {m.desc}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>
                  LLM API Key {!form.simulationMode && "*"}
                </label>
                <input
                  className={styles.input}
                  type="password"
                  placeholder="sk-... or your provider API key"
                  value={form.apiKey}
                  onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                  disabled={launching || form.simulationMode}
                  autoComplete="off"
                />
                <span className={styles.hint}>
                  {form.simulationMode
                    ? "Not required in Simulation Mode"
                    : "Never stored — used only for this scan session"}
                </span>
              </div>

              <div className={styles.field}>
                <label
                  className={styles.label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={form.simulationMode}
                    onChange={(e) =>
                      setForm({ ...form, simulationMode: e.target.checked })
                    }
                    disabled={launching}
                    style={{
                      width: "16px",
                      height: "16px",
                      accentColor: "var(--accent-primary)",
                    }}
                  />
                  Run in Simulation Mode (Mock Scan)
                </label>
                <span className={styles.hint}>
                  Bypasses the real Strix agent and injects realistic mock
                  vulnerabilities for UI demonstration.
                </span>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Instructions (Optional)</label>
                <textarea
                  className={styles.textarea}
                  placeholder='e.g. "Focus on authentication and IDOR. Use credentials: admin/password123"'
                  value={form.instruction}
                  onChange={(e) =>
                    setForm({ ...form, instruction: e.target.value })
                  }
                  disabled={launching}
                  rows={2}
                />
              </div>

              <div
                className={styles.advancedToggle}
                onClick={() => setShowAdvanced(!showAdvanced)}
              >
                <span>{showAdvanced ? "▼" : "▶"} Advanced Configuration</span>
              </div>

              {showAdvanced && (
                <div className={styles.advancedFields}>
                  <div className={styles.field}>
                    <label className={styles.label}>
                      Target List (One per line)
                    </label>
                    <textarea
                      className={styles.textarea}
                      placeholder="https://app.example.com/api&#10;https://app.example.com/admin"
                      value={form.targetList}
                      onChange={(e) =>
                        setForm({ ...form, targetList: e.target.value })
                      }
                      disabled={launching}
                      rows={3}
                    />
                  </div>

                  <div className={styles.fieldRow}>
                    <div className={styles.field}>
                      <label className={styles.label}>Scope Mode</label>
                      <select
                        className={styles.select}
                        value={form.scopeMode}
                        onChange={(e) =>
                          setForm({ ...form, scopeMode: e.target.value })
                        }
                        disabled={launching}
                      >
                        <option value="auto">Auto</option>
                        <option value="diff">Diff</option>
                        <option value="full">Full</option>
                      </select>
                    </div>
                    <div className={styles.field}>
                      <label className={styles.label}>Diff Base</label>
                      <input
                        className={styles.input}
                        type="text"
                        placeholder="e.g. HEAD~1 or origin/main"
                        value={form.diffBase}
                        onChange={(e) =>
                          setForm({ ...form, diffBase: e.target.value })
                        }
                        disabled={launching}
                      />
                    </div>
                  </div>

                  <div className={styles.fieldRow}>
                    <div className={styles.field}>
                      <label className={styles.label}>Max Budget (USD)</label>
                      <input
                        className={styles.input}
                        type="number"
                        placeholder="e.g. 10.00"
                        value={form.maxBudget}
                        onChange={(e) =>
                          setForm({ ...form, maxBudget: e.target.value })
                        }
                        disabled={launching}
                        step="0.1"
                      />
                    </div>
                    <div className={styles.field}>
                      <label className={styles.label}>Max Turns</label>
                      <input
                        className={styles.input}
                        type="number"
                        placeholder="e.g. 50"
                        value={form.maxTurns}
                        onChange={(e) =>
                          setForm({ ...form, maxTurns: e.target.value })
                        }
                        disabled={launching}
                      />
                    </div>
                  </div>

                  <div className={styles.fieldRow}>
                    <div className={styles.field}>
                      <label className={styles.label}>Config File Path</label>
                      <input
                        className={styles.input}
                        type="text"
                        placeholder="e.g. ./strix_config.yaml"
                        value={form.configFile}
                        onChange={(e) =>
                          setForm({ ...form, configFile: e.target.value })
                        }
                        disabled={launching}
                      />
                    </div>
                    <div className={styles.field}>
                      <label className={styles.label}>Resume Run Name</label>
                      <input
                        className={styles.input}
                        type="text"
                        placeholder="e.g. run_12345"
                        value={form.resumeRun}
                        onChange={(e) =>
                          setForm({ ...form, resumeRun: e.target.value })
                        }
                        disabled={launching}
                      />
                    </div>
                  </div>
                </div>
              )}

              {error && <div className={styles.errorBox}>{error}</div>}

              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={() => setShowModal(false)}
                  disabled={launching}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={styles.launchBtn}
                  disabled={launching}
                >
                  {launching ? (
                    <>
                      <div className={styles.btnSpinner} /> Launching…
                    </>
                  ) : (
                    <>
                      <span></span> Launch Scan
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ScansPage() {
  return (
    <Suspense
      fallback={
        <div className={styles.container}>
          <p>Loading...</p>
        </div>
      }
    >
      <ScansContent />
    </Suspense>
  );
}
