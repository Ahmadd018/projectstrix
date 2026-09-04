"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Ticket, X, Check, ExternalLink, Loader2, Settings2, Search } from "lucide-react";

// Data Center (wiki-markup) option maps — kept in sync with src/lib/jira.ts.
const DC_SEVERITY_LEVELS = [
  { key: "critical", label: "Critical" },
  { key: "high", label: "High" },
  { key: "medium", label: "Medium" },
  { key: "low", label: "Low" },
  { key: "informational", label: "Informational" },
  { key: "none", label: "None" },
];
const DC_PRIORITIES = [
  { key: "highest", label: "Highest" },
  { key: "high", label: "High" },
  { key: "medium", label: "Medium" },
  { key: "low", label: "Low" },
];
// Cloud priority option ids (discovered from the Vulnerability project).
const CLOUD_PRIORITIES = [
  { id: "1", label: "Highest" },
  { id: "2", label: "High" },
  { id: "3", label: "Medium" },
  { id: "4", label: "Low" },
  { id: "5", label: "Lowest" },
];

function dcSeverityLevel(sev: string): string {
  const s = (sev || "").toLowerCase();
  if (s === "info" || s === "informative" || s === "informational") return "informational";
  if (["critical", "high", "medium", "low"].includes(s)) return s;
  return "none";
}
function dcPriority(sev: string): string {
  const s = (sev || "").toLowerCase();
  if (s === "critical") return "highest";
  if (s === "high") return "high";
  if (s === "medium") return "medium";
  return "low";
}
function cloudPriorityId(sev: string): string {
  const s = (sev || "").toLowerCase();
  if (s === "critical") return "1";
  if (s === "high") return "2";
  if (s === "medium") return "3";
  return "4";
}

interface Integration {
  id: string;
  name: string;
  deployment: "CLOUD" | "DATACENTER";
  config?: { companyFieldId?: string; companyOptions?: { id: string; label: string }[]; participantsFieldId?: string } | null;
  enabled: boolean;
}
interface JiraUser { accountId: string; displayName: string; email?: string }

export interface JiraVuln {
  id: string; // DB uuid
  title: string;
  severity: string;
}

const LAST_INTEGRATION_KEY = "taipan.jira.lastIntegration";

// Self-contained "Report to Jira" modal. Renders nothing when `vuln` is null.
export function JiraReportModal({ vuln, onClose }: { vuln: JiraVuln | null; onClose: () => void }) {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [intId, setIntId] = useState<string>("");
  const [loadingInts, setLoadingInts] = useState(false);

  const [summary, setSummary] = useState("");
  const [labels, setLabels] = useState("taipan, security");
  // Data Center fields
  const [dcSev, setDcSev] = useState("none");
  const [dcPrio, setDcPrio] = useState("low");
  const [dcAssignee, setDcAssignee] = useState("");
  // Cloud fields
  const [company, setCompany] = useState("");
  const [cloudPrio, setCloudPrio] = useState("4");
  const [duedate, setDuedate] = useState("");
  const [assignee, setAssignee] = useState<JiraUser | null>(null);
  const [participants, setParticipants] = useState<JiraUser[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ key: string; url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [desc, setDesc] = useState("");
  const [descLoading, setDescLoading] = useState(false);
  const [descNote, setDescNote] = useState<string | null>(null);

  const current = integrations.find((i) => i.id === intId) || null;
  const isCloud = current?.deployment === "CLOUD";

  // Load the user's enabled integrations when the modal opens.
  useEffect(() => {
    if (!vuln) return;
    setLoadingInts(true);
    fetch("/api/jira/integrations")
      .then((r) => r.json())
      .then((data) => {
        const enabled: Integration[] = (data.integrations || []).filter((i: Integration) => i.enabled);
        setIntegrations(enabled);
        let pick = "";
        try {
          const last = localStorage.getItem(LAST_INTEGRATION_KEY);
          if (last && enabled.some((i) => i.id === last)) pick = last;
        } catch {}
        if (!pick && enabled.length) pick = enabled[0].id;
        setIntId(pick);
      })
      .catch(() => setIntegrations([]))
      .finally(() => setLoadingInts(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vuln?.id]);

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
    setSummary(`[${(vuln.severity || "").toUpperCase()}] ${vuln.title}`);
    setLabels("taipan, security");
    setDcSev(dcSeverityLevel(vuln.severity));
    setDcPrio(dcPriority(vuln.severity));
    setCloudPrio(cloudPriorityId(vuln.severity));
    setDcAssignee("");
    setCompany("");
    setDuedate("");
    setAssignee(null);
    setParticipants([]);
    setResult(null);
    setError(null);
    setDesc("");
    setDescNote(null);
    generateDesc(vuln.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vuln?.id]);

  // Default the company to the first option when a Cloud integration is selected.
  useEffect(() => {
    if (isCloud && !company && current?.config?.companyOptions?.length) {
      setCompany(current.config.companyOptions[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intId]);

  async function submit() {
    if (!vuln || !current) return;
    setSubmitting(true);
    setError(null);
    try {
      const cleanLabels = labels.split(",").map((l) => l.trim()).filter(Boolean);
      const payload: any = { integrationId: current.id, vulnId: vuln.id, summary, labels: cleanLabels, description: desc };
      if (isCloud) {
        payload.priorityId = cloudPrio;
        payload.company = company;
        payload.duedate = duedate;
        payload.assigneeAccountId = assignee?.accountId || "";
        payload.participants = participants.map((p) => p.accountId);
      } else {
        payload.severityLevel = dcSev;
        payload.priority = dcPrio;
        payload.assignee = dcAssignee;
      }
      const res = await fetch("/api/jira/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const out = await res.json().catch(() => ({}));
      if (res.ok && out.success) {
        setResult({ key: out.key, url: out.url });
        try { localStorage.setItem(LAST_INTEGRATION_KEY, current.id); } catch {}
      } else {
        setError(out.error || `Request failed (HTTP ${res.status})`);
      }
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
        ) : loadingInts ? (
          <div style={{ ...inp, minHeight: 80, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: "var(--fg-3)" }}>
            <Loader2 size={14} className="animate-spin" /> Loading integrations…
          </div>
        ) : integrations.length === 0 ? (
          <div style={{ fontSize: 13, color: "var(--fg-2)", lineHeight: 1.6 }}>
            No Jira integration is enabled for your account. Go to <strong>Settings → Jira</strong>, accept a shared integration or create your own, then try again.
          </div>
        ) : (
          <>
            {/* Send via — integration selector */}
            <div style={fieldWrap}>
              <label style={lbl}>Send via</label>
              <select style={inp} value={intId} onChange={(e) => setIntId(e.target.value)}>
                {integrations.map((i) => (
                  <option key={i.id} value={i.id}>{i.name} · {i.deployment === "CLOUD" ? "Cloud" : "Data Center"}</option>
                ))}
              </select>
            </div>

            <div style={fieldWrap}>
              <label style={lbl}>Summary</label>
              <input style={inp} value={summary} onChange={(e) => setSummary(e.target.value)} />
            </div>

            {isCloud ? (
              <>
                <div style={{ display: "flex", gap: 12 }}>
                  <div style={{ ...fieldWrap, flex: 1 }}>
                    <label style={lbl}>Company</label>
                    <select style={inp} value={company} onChange={(e) => setCompany(e.target.value)}>
                      {(current?.config?.companyOptions || []).map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                    </select>
                  </div>
                  <div style={{ ...fieldWrap, flex: 1 }}>
                    <label style={lbl}>Priority</label>
                    <select style={inp} value={cloudPrio} onChange={(e) => setCloudPrio(e.target.value)}>
                      {CLOUD_PRIORITIES.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                    </select>
                  </div>
                </div>
                <UserPicker label="Assignee" integrationId={current!.id} multi={false}
                  value={assignee ? [assignee] : []} onChange={(u) => setAssignee(u[0] || null)} inp={inp} lbl={lbl} fieldWrap={fieldWrap} />
                <UserPicker label="Participants" integrationId={current!.id} multi
                  value={participants} onChange={setParticipants} inp={inp} lbl={lbl} fieldWrap={fieldWrap} />
                <div style={{ display: "flex", gap: 12 }}>
                  <div style={{ ...fieldWrap, flex: 1 }}>
                    <label style={lbl}>Due date</label>
                    <input style={inp} type="date" value={duedate} onChange={(e) => setDuedate(e.target.value)} />
                  </div>
                  <div style={{ ...fieldWrap, flex: 1 }}>
                    <label style={lbl}>Labels <span style={{ color: "var(--fg-3)", fontWeight: 400 }}>(comma-sep)</span></label>
                    <input style={inp} value={labels} onChange={(e) => setLabels(e.target.value)} />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div style={{ display: "flex", gap: 12 }}>
                  <div style={{ ...fieldWrap, flex: 1 }}>
                    <label style={lbl}>Severity level</label>
                    <select style={inp} value={dcSev} onChange={(e) => setDcSev(e.target.value)}>
                      {DC_SEVERITY_LEVELS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
                    </select>
                  </div>
                  <div style={{ ...fieldWrap, flex: 1 }}>
                    <label style={lbl}>Priority</label>
                    <select style={inp} value={dcPrio} onChange={(e) => setDcPrio(e.target.value)}>
                      {DC_PRIORITIES.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
                    </select>
                  </div>
                </div>
                <div style={fieldWrap}>
                  <label style={lbl}>Assignee <span style={{ color: "var(--fg-3)", fontWeight: 400 }}>(username, optional)</span></label>
                  <input style={inp} value={dcAssignee} placeholder="e.g. AghamaliyevAM" onChange={(e) => setDcAssignee(e.target.value)} />
                </div>
                <div style={fieldWrap}>
                  <label style={lbl}>Labels <span style={{ color: "var(--fg-3)", fontWeight: 400 }}>(comma-separated)</span></label>
                  <input style={inp} value={labels} placeholder="taipan, security" onChange={(e) => setLabels(e.target.value)} />
                </div>
              </>
            )}

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
              disabled={submitting || descLoading || !summary.trim() || !desc.trim() || !current}
              onClick={submit}
              style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <Ticket size={14} />}
              {submitting ? "Creating…" : "Create Jira issue"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// Debounced accountId picker for Cloud assignee / participants.
function UserPicker({
  label, integrationId, multi, value, onChange, inp, lbl, fieldWrap,
}: {
  label: string; integrationId: string; multi: boolean; value: JiraUser[];
  onChange: (u: JiraUser[]) => void; inp: React.CSSProperties; lbl: React.CSSProperties; fieldWrap: React.CSSProperties;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<JiraUser[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback((query: string) => {
    setLoading(true);
    fetch(`/api/jira/integrations/${integrationId}/users?q=${encodeURIComponent(query)}`)
      .then((r) => r.json())
      .then((d) => setResults(d.users || []))
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  }, [integrationId]);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (!open) return;
    timer.current = setTimeout(() => search(q), 250);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [q, open, search]);

  function pick(u: JiraUser) {
    if (multi) {
      if (!value.some((v) => v.accountId === u.accountId)) onChange([...value, u]);
    } else {
      onChange([u]);
      setOpen(false);
    }
    setQ("");
  }
  function remove(id: string) { onChange(value.filter((v) => v.accountId !== id)); }

  return (
    <div style={{ ...fieldWrap, position: "relative" }}>
      <label style={lbl}>{label}</label>
      {value.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 4 }}>
          {value.map((u) => (
            <span key={u.accountId} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, background: "var(--bg-3)", border: "1px solid var(--border)", borderRadius: 999, padding: "3px 10px" }}>
              {u.displayName}
              <X size={12} style={{ cursor: "pointer" }} onClick={() => remove(u.accountId)} />
            </span>
          ))}
        </div>
      )}
      {(multi || value.length === 0) && (
        <div style={{ position: "relative" }}>
          <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--fg-3)" }} />
          <input
            style={{ ...inp, paddingLeft: 30 }}
            placeholder={`Search ${label.toLowerCase()}…`}
            value={q}
            onChange={(e) => { setQ(e.target.value); setOpen(true); }}
            onFocus={() => { setOpen(true); if (!results.length) search(""); }}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
          />
        </div>
      )}
      {open && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 10, background: "var(--bg-1)", border: "1px solid var(--border)", borderRadius: "var(--r)", marginTop: 4, maxHeight: 180, overflowY: "auto", boxShadow: "0 8px 24px rgba(0,0,0,0.3)" }}>
          {loading ? (
            <div style={{ padding: "8px 10px", fontSize: 12, color: "var(--fg-3)", display: "flex", gap: 6, alignItems: "center" }}><Loader2 size={12} className="animate-spin" /> Searching…</div>
          ) : results.length === 0 ? (
            <div style={{ padding: "8px 10px", fontSize: 12, color: "var(--fg-3)" }}>No users found.</div>
          ) : (
            results.map((u) => (
              <div key={u.accountId} onMouseDown={() => pick(u)} style={{ padding: "8px 10px", fontSize: 13, cursor: "pointer", borderBottom: "1px solid var(--border)" }}>
                {u.displayName}{u.email ? <span style={{ color: "var(--fg-3)", fontSize: 11 }}> · {u.email}</span> : null}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
