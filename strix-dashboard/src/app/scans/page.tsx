"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import styles from "./scans.module.css";

interface Scan {
  id: string;
  target: string;
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
  { value: "anthropic/claude-opus-4-5", label: "Anthropic Claude Opus" },
  { value: "anthropic/claude-sonnet-4-5", label: "Anthropic Claude Sonnet" },
  { value: "google/gemini-2.5-pro", label: "Google Gemini 2.5 Pro" },
];

const SCAN_MODES = [
  { value: "quick", label: "Quick", desc: "Fast scan of changed files only" },
  { value: "standard", label: "Standard", desc: "Full application assessment" },
  { value: "deep", label: "Deep", desc: "Exhaustive multi-agent pentest" },
];

function statusBadge(status: Scan["status"]) {
  const map: Record<string, string> = {
    running: "badge-running",
    completed: "badge-completed",
    failed: "badge-failed",
    stopped: "badge-stopped",
  };
  const labels: Record<string, string> = {
    running: "🟢 Running",
    completed: "✅ Completed",
    failed: "❌ Failed",
    stopped: "⏹ Stopped",
  };
  return (
    <span className={`${styles.statusBadge} ${styles[map[status] ?? "badge-stopped"]}`}>
      {labels[status] ?? status}
    </span>
  );
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
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
    llmModel: "openai/gpt-4o",
    apiKey: "",
    scanMode: "standard",
    instruction: "",
  });
  const [error, setError] = useState("");

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
    if (!form.target.trim()) { setError("Target is required"); return; }
    if (!form.apiKey.trim()) { setError("LLM API Key is required"); return; }
    setLaunching(true);
    try {
      const res = await fetch("/api/scans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to start scan"); setLaunching(false); return; }
      setShowModal(false);
      setLaunching(false);
      setForm({ target: "", llmModel: "openai/gpt-4o", apiKey: "", scanMode: "standard", instruction: "" });
      router.push(`/scans/${data.scanId}`);
    } catch {
      setError("Network error. Please try again.");
      setLaunching(false);
    }
  }

  async function handleStop(id: string, e: React.MouseEvent) {
    e.preventDefault();
    await fetch(`/api/scans/${id}`, { method: "DELETE" });
    fetchScans();
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Scans</h1>
          <p className={styles.subtitle}>Launch and monitor your security assessments</p>
        </div>
        <button className={styles.newBtn} onClick={() => setShowModal(true)}>
          <span>＋</span> New Scan
        </button>
      </div>

      {/* Scans Table */}
      <div className={`glass-panel ${styles.tableCard}`}>
        {loading ? (
          <div className={styles.empty}>
            <div className={styles.spinner} />
            <p>Loading scans…</p>
          </div>
        ) : scans.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>🎯</div>
            <h3>No scans yet</h3>
            <p>Launch your first security assessment to get started.</p>
            <button className={styles.newBtn} onClick={() => setShowModal(true)}>
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
              {scans.map((scan) => (
                <tr key={scan.id} onClick={() => router.push(`/scans/${scan.id}`)} className={styles.row}>
                  <td>
                    <div className={styles.targetCell}>
                      <span className={styles.targetIcon}>🎯</span>
                      <span className={styles.targetText}>{scan.target}</span>
                    </div>
                  </td>
                  <td><span className={styles.modeTag}>{scan.scanMode}</span></td>
                  <td className={styles.modelCell}>{scan.llmModel}</td>
                  <td>{statusBadge(scan.status)}</td>
                  <td>
                    <span className={styles.vulnCount}>
                      {scan.vulnCount > 0 ? (
                        <span className={styles.vulnCountBadge}>{scan.vulnCount}</span>
                      ) : "—"}
                    </span>
                  </td>
                  <td className={styles.timeCell}>{timeAgo(scan.startedAt)}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <div className={styles.actions}>
                      <Link href={`/scans/${scan.id}`} className={styles.actionBtn}>
                        View
                      </Link>
                      {scan.status === "running" && (
                        <button
                          className={`${styles.actionBtn} ${styles.stopBtn}`}
                          onClick={(e) => handleStop(scan.id, e)}
                        >
                          Stop
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* New Scan Modal */}
      {showModal && (
        <div className={styles.overlay} onClick={() => !launching && setShowModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>🚀 Launch New Scan</h2>
              <button className={styles.closeBtn} onClick={() => !launching && setShowModal(false)}>✕</button>
            </div>

            <form onSubmit={handleLaunch} className={styles.form}>
              <div className={styles.field}>
                <label className={styles.label}>Target *</label>
                <input
                  className={styles.input}
                  type="text"
                  placeholder="https://app.example.com or ./local-app"
                  value={form.target}
                  onChange={(e) => setForm({ ...form, target: e.target.value })}
                  disabled={launching}
                />
                <span className={styles.hint}>URL, GitHub repo, or local directory path</span>
              </div>

              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label className={styles.label}>LLM Model</label>
                  <select
                    className={styles.select}
                    value={form.llmModel}
                    onChange={(e) => setForm({ ...form, llmModel: e.target.value })}
                    disabled={launching}
                  >
                    {LLM_MODELS.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Scan Mode</label>
                  <select
                    className={styles.select}
                    value={form.scanMode}
                    onChange={(e) => setForm({ ...form, scanMode: e.target.value })}
                    disabled={launching}
                  >
                    {SCAN_MODES.map((m) => (
                      <option key={m.value} value={m.value}>{m.label} — {m.desc}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>LLM API Key *</label>
                <input
                  className={styles.input}
                  type="password"
                  placeholder="sk-... or your provider API key"
                  value={form.apiKey}
                  onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                  disabled={launching}
                  autoComplete="off"
                />
                <span className={styles.hint}>🔒 Never stored — used only for this scan session</span>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Instructions (Optional)</label>
                <textarea
                  className={styles.textarea}
                  placeholder='e.g. "Focus on authentication and IDOR. Use credentials: admin/password123"'
                  value={form.instruction}
                  onChange={(e) => setForm({ ...form, instruction: e.target.value })}
                  disabled={launching}
                  rows={3}
                />
              </div>

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
                <button type="submit" className={styles.launchBtn} disabled={launching}>
                  {launching ? (
                    <><div className={styles.btnSpinner} /> Launching…</>
                  ) : (
                    <><span>🚀</span> Launch Scan</>
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
    <Suspense fallback={<div className={styles.container}><p>Loading...</p></div>}>
      <ScansContent />
    </Suspense>
  );
}
