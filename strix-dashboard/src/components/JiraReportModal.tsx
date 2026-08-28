"use client";

import { useEffect, useState } from "react";
import { Ticket, X, Check, ExternalLink, Loader2, Settings2 } from "lucide-react";

// Jira report modal options (kept in sync with src/lib/jira.ts mappings).
const JIRA_SEVERITY_LEVELS = [
  { key: "critical", label: "Critical" },
  { key: "high", label: "High" },
  { key: "medium", label: "Medium" },
  { key: "low", label: "Low" },
  { key: "informational", label: "Informational" },
  { key: "none", label: "None" },
];
const JIRA_PRIORITIES = [
  { key: "highest", label: "Highest" },
  { key: "high", label: "High" },
  { key: "medium", label: "Medium" },
  { key: "low", label: "Low" },
];

function defaultSeverityLevel(sev: string): string {
  const s = (sev || "").toLowerCase();
  if (s === "info" || s === "informative" || s === "informational") return "informational";
  if (["critical", "high", "medium", "low"].includes(s)) return s;
  return "none";
}
function defaultPriority(sev: string): string {
  const s = (sev || "").toLowerCase();
  if (s === "critical") return "highest";
  if (s === "high") return "high";
  if (s === "medium") return "medium";
  return "low";
}

export interface JiraVuln {
  id: string; // DB uuid
  title: string;
  severity: string;
}

// Self-contained "Report to Jira" modal. Renders nothing when `vuln` is null.
export function JiraReportModal({ vuln, onClose }: { vuln: JiraVuln | null; onClose: () => void }) {
  const [form, setForm] = useState({ summary: "", assignee: "", labels: "", severityLevel: "none", priority: "low" });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ key: string; url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [desc, setDesc] = useState("");
  const [descLoading, setDescLoading] = useState(false);
  const [descNote, setDescNote] = useState<string | null>(null);

  async function generateDesc(vulnId: string) {
    setDescLoading(true);
    setDescNote(null);
    try {
      const res = await fetch("/api/jira/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vulnId }),
      });
      const out = await res.json().catch(() => ({}));
      if (res.ok && out.description) {
        setDesc(out.description);
        if (out.generated === false) setDescNote(out.reason || "Used template (AI unavailable).");
      } else {
        setDescNote(out.error || "Could not generate description.");
      }
    } catch (e: any) {
      setDescNote(e?.message || "Network error while generating.");
    } finally {
      setDescLoading(false);
    }
  }

  // Initialize the form whenever a new vuln is opened.
  useEffect(() => {
    if (!vuln) return;
    setForm({
      summary: `[${(vuln.severity || "").toUpperCase()}] ${vuln.title}`,
      assignee: "",
      labels: "strix, security",
      severityLevel: defaultSeverityLevel(vuln.severity),
      priority: defaultPriority(vuln.severity),
    });
    setResult(null);
    setError(null);
    setDesc("");
    setDescNote(null);
    generateDesc(vuln.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vuln?.id]);

  async function submit() {
    if (!vuln) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/jira/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vulnId: vuln.id,
          summary: form.summary,
          assignee: form.assignee,
          labels: form.labels.split(",").map((l) => l.trim()).filter(Boolean),
          severityLevel: form.severityLevel,
          priority: form.priority,
          description: desc,
        }),
      });
      const out = await res.json().catch(() => ({}));
      if (res.ok && out.success) setResult({ key: out.key, url: out.url });
      else setError(out.error || `Request failed (HTTP ${res.status})`);
    } catch (e: any) {
      setError(e?.message || "Network error");
    } finally {
      setSubmitting(false);
    }
  }

  if (!vuln) return null;

  const fieldWrap: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 6 };
  const lbl: React.CSSProperties = { fontSize: 12, fontWeight: 500, color: "var(--fg-2)" };
  const inp: React.CSSProperties = { width: "100%", padding: "8px 10px", background: "var(--bg-1)", border: "1px solid var(--border)", borderRadius: "var(--r)", color: "var(--fg)", fontSize: 13 };

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
    >
      <div
        className="glass-panel animate-fade-in"
        onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 560, padding: 20, display: "flex", flexDirection: "column", gap: 14, maxHeight: "90vh", overflowY: "auto" }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600 }}>
            <Ticket size={16} /> Report to Jira
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--fg-2)" }}>
            <X size={18} />
          </button>
        </div>

        {result ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "var(--sev-low)" }}>
              <Check size={16} /> Created <strong>{result.key}</strong>
            </div>
            <a href={result.url} target="_blank" rel="noopener noreferrer" className="btn-primary" style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center", textDecoration: "none" }}>
              <ExternalLink size={14} /> Open {result.key} in Jira
            </a>
          </div>
        ) : (
          <>
            <div style={fieldWrap}>
              <label style={lbl}>Summary</label>
              <input style={inp} value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} />
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ ...fieldWrap, flex: 1 }}>
                <label style={lbl}>Severity level</label>
                <select style={inp} value={form.severityLevel} onChange={(e) => setForm({ ...form, severityLevel: e.target.value })}>
                  {JIRA_SEVERITY_LEVELS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
                </select>
              </div>
              <div style={{ ...fieldWrap, flex: 1 }}>
                <label style={lbl}>Priority</label>
                <select style={inp} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                  {JIRA_PRIORITIES.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
                </select>
              </div>
            </div>
            <div style={fieldWrap}>
              <label style={lbl}>Assignee <span style={{ color: "var(--fg-3)", fontWeight: 400 }}>(username, optional)</span></label>
              <input style={inp} value={form.assignee} placeholder="e.g. AghamaliyevAM" onChange={(e) => setForm({ ...form, assignee: e.target.value })} />
            </div>
            <div style={fieldWrap}>
              <label style={lbl}>Labels <span style={{ color: "var(--fg-3)", fontWeight: 400 }}>(comma-separated)</span></label>
              <input style={inp} value={form.labels} placeholder="strix, security" onChange={(e) => setForm({ ...form, labels: e.target.value })} />
            </div>
            <div style={fieldWrap}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <label style={lbl}>Description <span style={{ color: "var(--fg-3)", fontWeight: 400 }}>(AI-generated, editable)</span></label>
                <button
                  onClick={() => generateDesc(vuln.id)}
                  disabled={descLoading}
                  style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "1px solid var(--border)", borderRadius: "var(--r)", color: "var(--fg-2)", fontSize: 11, padding: "3px 8px", cursor: "pointer" }}
                >
                  {descLoading ? <Loader2 size={11} className="animate-spin" /> : <Settings2 size={11} />}
                  Regenerate
                </button>
              </div>
              {descLoading && !desc ? (
                <div style={{ ...inp, minHeight: 120, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--fg-3)", fontSize: 12, gap: 8 }}>
                  <Loader2 size={14} className="animate-spin" /> Generating report with AI…
                </div>
              ) : (
                <textarea
                  style={{ ...inp, minHeight: 160, resize: "vertical", fontFamily: "var(--font-mono, monospace)", lineHeight: 1.5 }}
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                />
              )}
              {descNote && <span style={{ fontSize: 11, color: "var(--fg-3)" }}>{descNote}</span>}
            </div>

            {error && (
              <div style={{ fontSize: 12, color: "var(--sev-critical, #e5484d)", background: "rgba(229,72,77,0.08)", border: "1px solid rgba(229,72,77,0.25)", borderRadius: "var(--r)", padding: "8px 10px", lineHeight: 1.5 }}>
                {error}
              </div>
            )}

            <button
              className="btn-primary"
              disabled={submitting || descLoading || !form.summary.trim() || !desc.trim()}
              onClick={submit}
              style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <Ticket size={14} />}
              {submitting ? "Creating…" : "Create Jira issue"}
            </button>
            <p style={{ fontSize: 11, color: "var(--fg-2)", margin: 0, lineHeight: 1.5 }}>
              The issue description is generated from the finding as a narrative + mitigation. Configure Jira in Settings → Jira first.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
