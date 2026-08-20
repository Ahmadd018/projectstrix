"use client";

import { useState, useEffect, useCallback } from "react";
import { ShieldAlert, Search, Info, Terminal, Lightbulb, X, Loader2, Settings2, Copy, Check, ShieldOff, Ticket, ExternalLink } from "lucide-react";
import { useDialog } from "@/components/DialogProvider";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";

interface Vulnerability {
  id: string;
  title: string;
  severity: "critical" | "high" | "medium" | "low" | "informative" | "info";
  endpoint: string;
  method?: string;
  description: string;
  poc?: string;
  poc_description?: string;
  poc_script_code?: string;
  cvss?: number;
  remediation?: string;
  status?: string;
}

interface Scan {
  id: string;
  target: string;
  status: string;
  vulnerabilities: Vulnerability[];
}

interface VulnWithScan extends Vulnerability {
  scanId: string;
  scanTarget: string;
}

const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3, informative: 4, info: 4 };
const SEVERITIES = ["all", "critical", "high", "medium", "low", "informative"] as const;

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
// Default severity-level / priority from the finding's severity.
function defaultSeverityLevel(sev: string): string {
  const s = sev.toLowerCase();
  if (s === "info" || s === "informative" || s === "informational") return "informational";
  if (["critical", "high", "medium", "low"].includes(s)) return s;
  return "none";
}
function defaultPriority(sev: string): string {
  const s = sev.toLowerCase();
  if (s === "critical") return "highest";
  if (s === "high") return "high";
  if (s === "medium") return "medium";
  return "low";
}

function sevClass(s: string) {
  const normalized = s.toLowerCase() === "info" ? "informative" : s.toLowerCase();
  return `sev sev-${normalized}`;
}

export default function VulnerabilitiesPage() {
  const [allVulns, setAllVulns] = useState<VulnWithScan[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<(typeof SEVERITIES)[number]>("all");
  const [search, setSearch] = useState("");
  const [filterProject, setFilterProject] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  const [selected, setSelected] = useState<VulnWithScan | null>(null);

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deletingBulk, setDeletingBulk] = useState(false);
  const [fpText, setFpText] = useState<string | null>(null);
  const [fpCopied, setFpCopied] = useState(false);
  const [jiraVuln, setJiraVuln] = useState<VulnWithScan | null>(null);
  const [jiraForm, setJiraForm] = useState({ summary: "", assignee: "", labels: "", severityLevel: "none", priority: "low" });
  const [jiraSubmitting, setJiraSubmitting] = useState(false);
  const [jiraResult, setJiraResult] = useState<{ key: string; url: string } | null>(null);
  const [jiraError, setJiraError] = useState<string | null>(null);
  const [jiraDesc, setJiraDesc] = useState("");
  const [jiraDescLoading, setJiraDescLoading] = useState(false);
  const [jiraDescNote, setJiraDescNote] = useState<string | null>(null);
  const { confirm, alert } = useDialog();

  async function generateJiraDesc(vulnId: string) {
    setJiraDescLoading(true);
    setJiraDescNote(null);
    try {
      const res = await fetch("/api/jira/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vulnId }),
      });
      const out = await res.json().catch(() => ({}));
      if (res.ok && out.description) {
        setJiraDesc(out.description);
        if (out.generated === false) setJiraDescNote(out.reason || "Used template (AI unavailable).");
      } else {
        setJiraDescNote(out.error || "Could not generate description.");
      }
    } catch (e: any) {
      setJiraDescNote(e?.message || "Network error while generating.");
    } finally {
      setJiraDescLoading(false);
    }
  }

  function openJiraModal(v: VulnWithScan) {
    setJiraForm({
      summary: `[${v.severity.toUpperCase()}] ${v.title}`,
      assignee: "",
      labels: "strix, security",
      severityLevel: defaultSeverityLevel(v.severity),
      priority: defaultPriority(v.severity),
    });
    setJiraResult(null);
    setJiraError(null);
    setJiraDesc("");
    setJiraDescNote(null);
    setJiraVuln(v);
    generateJiraDesc(v.id);
  }

  async function submitJira() {
    if (!jiraVuln) return;
    setJiraSubmitting(true);
    setJiraError(null);
    try {
      const res = await fetch("/api/jira/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vulnId: jiraVuln.id,
          summary: jiraForm.summary,
          assignee: jiraForm.assignee,
          labels: jiraForm.labels.split(",").map((l) => l.trim()).filter(Boolean),
          severityLevel: jiraForm.severityLevel,
          priority: jiraForm.priority,
          description: jiraDesc,
        }),
      });
      const out = await res.json().catch(() => ({}));
      if (res.ok && out.success) {
        setJiraResult({ key: out.key, url: out.url });
      } else {
        setJiraError(out.error || `Request failed (HTTP ${res.status})`);
      }
    } catch (e: any) {
      setJiraError(e?.message || "Network error");
    } finally {
      setJiraSubmitting(false);
    }
  }

  // Best-effort absolute URL from the scan target (host/subdomain) + endpoint path.
  function fullUrl(target: string, endpoint?: string): string {
    if (!endpoint) return target || "";
    if (/^https?:\/\//i.test(endpoint)) return endpoint;
    try {
      const base = /^https?:\/\//i.test(target) ? target : `https://${target}`;
      return new URL(endpoint, base).toString();
    } catch {
      return `${target}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;
    }
  }

  // Build a ready-to-paste, fully-detailed instruction telling the agent to skip
  // this finding. Included with the main instruction, it must carry enough detail
  // (host/subdomain, method, path, parameter/PoC) for the agent to re-identify
  // the exact issue and ignore it.
  function buildFpInstruction(v: VulnWithScan): string {
    const host = (() => {
      try {
        const t = /^https?:\/\//i.test(v.scanTarget) ? v.scanTarget : `https://${v.scanTarget}`;
        return new URL(t).host;
      } catch {
        return v.scanTarget;
      }
    })();
    const method = v.method || "GET";
    const desc = (v.description || "").trim().replace(/\s+/g, " ");
    const poc = (v.poc || v.poc_script_code || v.poc_description || "").trim().replace(/\s+/g, " ");
    const cvss = typeof v.cvss === "number" && v.cvss > 0 ? ` (CVSS ${v.cvss})` : "";

    const header =
      "[KNOWN FALSE POSITIVE — DO NOT REPORT]\n" +
      "The finding below was manually reviewed and confirmed as a FALSE POSITIVE. During this scan, do NOT flag, report, or spend time re-testing it. If you rediscover this exact issue, treat it as a known false positive and ignore it. Only report it if you find a genuinely DIFFERENT vulnerability at the same location.";

    const bullets = [
      `- Title: ${v.title}`,
      `- Severity: ${v.severity}${cvss}`,
      `- Target host: ${host}`,
      `- Endpoint: ${method} ${v.endpoint || "(unspecified)"}`,
      `- Full URL: ${fullUrl(v.scanTarget, v.endpoint)}`,
      poc ? `- Reproduction / payload: ${poc}` : "",
      desc ? `- Original description: ${desc}` : "",
    ].filter(Boolean);

    return `${header}\n\n${bullets.join("\n")}`;
  }

  // Persist the false-positive mark (badge) and update local state.
  async function setFpStatus(v: VulnWithScan, isFp: boolean) {
    const status = isFp ? "FALSE_POSITIVE" : "OPEN";
    setSelected((prev) => (prev && prev.id === v.id ? { ...prev, status } : prev));
    setAllVulns((prev) => prev.map((x) => (x.id === v.id && x.scanId === v.scanId ? { ...x, status } : x)));
    try {
      await fetch("/api/vulnerabilities/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vulnId: v.id, status }),
      });
    } catch {
      /* keep optimistic UI; refresh will reconcile */
    }
  }

  async function copyFp(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setFpCopied(true);
      setTimeout(() => setFpCopied(false), 1500);
    } catch {
      /* clipboard blocked — user can still select the text manually */
    }
  }

  const projects = Array.from(new Set(allVulns.map(v => v.scanTarget)));

  const fetchAll = useCallback(async () => {
    try {
      const res = await fetch("/api/vulnerabilities");
      const data = await res.json();
      
      const vulns = (Array.isArray(data) ? data : []).map((v: any) => ({
        ...v,
        scanTarget: v.scan?.target || "Unknown Target"
      }));

      vulns.sort((a, b) => (SEVERITY_ORDER[a.severity as keyof typeof SEVERITY_ORDER] ?? 5) - (SEVERITY_ORDER[b.severity as keyof typeof SEVERITY_ORDER] ?? 5));
      setAllVulns(vulns);
    } catch (e) {
      console.error("Failed to fetch vulnerabilities", e);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 5000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  async function handleBulkDelete() {
    if (selectedIds.size === 0) return;
    
    confirm(`Are you sure you want to permanently delete ${selectedIds.size} selected vulnerability(s)?`, async () => {
      setDeletingBulk(true);
      try {
        const items = Array.from(selectedIds).map(id => {
          const [scanId, vulnId] = id.split("::");
          return { scanId, vulnId };
        });

        await fetch("/api/vulnerabilities/bulk", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items })
        });
        setSelectedIds(new Set());
        setSelectionMode(false);
        setSelected(null);
        fetchAll();
      } catch (e: any) {
        alert(e.message || "Bulk delete failed");
      } finally {
        setDeletingBulk(false);
      }
    });
  }

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const filtered = allVulns.filter((v) => {
    if (filter !== "all" && v.severity !== filter) return false;
    if (filterProject !== "all" && v.scanTarget !== filterProject) return false;
    if (
      search &&
      !v.title.toLowerCase().includes(search.toLowerCase()) &&
      !v.endpoint.toLowerCase().includes(search.toLowerCase()) &&
      !v.scanTarget.toLowerCase().includes(search.toLowerCase())
    )
      return false;
    return true;
  });

  const counts = {
    all: allVulns.length,
    critical: allVulns.filter((v) => v.severity === "critical").length,
    high: allVulns.filter((v) => v.severity === "high").length,
    medium: allVulns.filter((v) => v.severity === "medium").length,
    low: allVulns.filter((v) => v.severity === "low").length,
    informative: allVulns.filter((v) => v.severity === "informative" || v.severity === "info").length,
  };

  return (
    <div className="page" style={{ height: "100%", maxWidth: "none" }}>
      {/* Header */}
      <div className="page-intro" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 className="page-heading">Vulnerabilities</h1>
          <p className="page-desc">All findings across your security assessments.</p>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          {selectionMode && (
            <button 
              className="btn-primary" 
              style={{ background: selectedIds.size > 0 ? "var(--sev-critical-bg)" : "var(--bg-3)", color: selectedIds.size > 0 ? "var(--sev-critical)" : "var(--fg-3)", border: selectedIds.size > 0 ? "1px solid var(--sev-critical-bd)" : "1px solid var(--border)", pointerEvents: selectedIds.size > 0 ? "auto" : "none" }} 
              onClick={handleBulkDelete}
              disabled={deletingBulk}
            >
              {deletingBulk ? <Loader2 size={14} className="spin" /> : <ShieldAlert size={14} />} Delete Selected ({selectedIds.size})
            </button>
          )}
          <button className="btn-secondary" onClick={() => {
            setSelectionMode(!selectionMode);
            setSelectedIds(new Set());
          }}>
            {selectionMode ? "Cancel" : "Choose Vulnerabilities"}
          </button>
        </div>
      </div>

      {/* Severity stat cards */}
      <div className="stats-grid">
        {(["critical", "high", "medium", "low", "informative"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(filter === s ? "all" : s)}
            className="stat-card"
            style={{
              cursor: "pointer",
              border: filter === s ? "1px solid var(--border-hi)" : undefined,
              background: filter === s ? "var(--bg-2)" : undefined,
              textAlign: "left",
            }}
          >
            <div className="stat-label">
              <span className="stat-label-text">{s}</span>
              <span className={sevClass(s)} style={{ fontSize: 10 }}>{counts[s]}</span>
            </div>
            <div
              className="stat-value"
              style={{
                color:
                  s === "critical" ? "var(--sev-critical)" :
                  s === "high"     ? "var(--sev-high)" :
                  s === "medium"   ? "var(--sev-medium)" :
                  s === "low"      ? "var(--sev-low)" :
                  "var(--sev-informative)",
              }}
            >
              {counts[s]}
            </div>
            <div className="stat-sub">{s.charAt(0).toUpperCase() + s.slice(1)} severity</div>
          </button>
        ))}
      </div>

      {/* Main content */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
          flex: 1,
          minHeight: 0,
        }}
      >
        {/* List */}
        <div className="card" style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Filters */}
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <div className="search-input-wrap" style={{ flex: 1, maxWidth: "100%" }}>
                <Search size={13} className="search-input-icon" />
                <input
                  className="search-input"
                  placeholder="Search by title, endpoint, target…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div style={{ position: "relative" }}>
                <button 
                  className={`btn-secondary ${showFilters ? 'active' : ''}`}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, height: 32, padding: "0 12px", background: showFilters || filterProject !== "all" ? "var(--bg-3)" : "transparent", border: "1px solid var(--border)", borderRadius: "var(--r)", fontSize: 13, color: "var(--fg-2)", cursor: "pointer" }}
                  onClick={() => setShowFilters(!showFilters)}
                >
                  <Settings2 size={14} /> Filters
                  {filterProject !== "all" && (
                    <span style={{ width: 6, height: 6, background: "var(--fg)", borderRadius: "50%" }} />
                  )}
                </button>
                
                {showFilters && (
                  <>
                    <div style={{ position: "fixed", inset: 0, zIndex: 90 }} onClick={() => setShowFilters(false)} />
                    <div className="glass-panel animate-fade-in" style={{ position: "absolute", top: "110%", right: 0, width: 260, zIndex: 100, padding: 16, display: "flex", flexDirection: "column", gap: 16, boxShadow: "0 10px 40px rgba(0,0,0,0.3)" }}>
                      <div>
                        <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--fg-3)", textTransform: "uppercase", marginBottom: 6 }}>Target Project</label>
                        <select value={filterProject} onChange={e => setFilterProject(e.target.value)} style={{ width: "100%", padding: "6px 8px", background: "var(--bg-1)", border: "1px solid var(--border)", borderRadius: "var(--r)", color: "var(--fg)", fontSize: 13 }}>
                          <option value="all">All Projects</option>
                          {projects.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </div>
                      {filterProject !== "all" && (
                        <button 
                          onClick={() => setFilterProject("all")}
                          style={{ background: "none", border: "none", color: "var(--fg-3)", fontSize: 12, cursor: "pointer", textAlign: "left", padding: 0 }}
                        >
                          Clear Filters
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {SEVERITIES.map((s) => (
                <button
                  key={s}
                  onClick={() => setFilter(s)}
                  style={{
                    padding: "3px 10px",
                    borderRadius: "var(--r-sm)",
                    fontSize: 11,
                    fontWeight: 600,
                    textTransform: "capitalize",
                    cursor: "pointer",
                    border: "1px solid",
                    borderColor: filter === s ? "var(--border-hi)" : "var(--border)",
                    background: filter === s ? "var(--bg-4)" : "var(--bg-2)",
                    color: filter === s ? "var(--fg)" : "var(--fg-3)",
                    fontFamily: "var(--font-sans)",
                  }}
                >
                  {s} ({counts[s as keyof typeof counts] ?? counts.all})
                </button>
              ))}
            </div>
          </div>

          {/* Items */}
          <div style={{ flex: 1, overflowY: "auto" }}>
            {loading ? (
              <div className="empty-state">
                <Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} />
              </div>
            ) : filtered.length === 0 ? (
              <div className="empty-state">
                <ShieldAlert size={32} style={{ opacity: 0.2 }} />
                <p>No vulnerabilities found</p>
              </div>
            ) : (
              <>
                {selectionMode && (
                  <div style={{ display: "flex", alignItems: "center", padding: "10px 20px", borderBottom: "1px solid var(--border)", background: "var(--bg-2)", fontSize: 12, fontWeight: 600, color: "var(--fg-3)" }}>
                    <input 
                      type="checkbox" 
                      style={{ accentColor: "var(--fg)", marginRight: 12 }}
                      checked={filtered.length > 0 && selectedIds.size === filtered.length}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedIds(new Set(filtered.map(v => `${v.scanId}::${v.id}`)));
                        else setSelectedIds(new Set());
                      }}
                    />
                    Select All ({filtered.length})
                  </div>
                )}
                {filtered.map((v) => {
                  const uniqueId = `${v.scanId}::${v.id}`;
                  const isSelected = selectedIds.has(uniqueId) || (selected?.id === v.id && selected.scanId === v.scanId);
                  return (
                  <div
                    key={uniqueId}
                    onClick={(e) => {
                      if (selectionMode) {
                        e.preventDefault();
                        toggleSelection(uniqueId);
                      } else {
                        setSelected(isSelected && !selectedIds.has(uniqueId) ? null : v);
                      }
                    }}
                    className="trow"
                    style={{
                      cursor: "pointer",
                      background: isSelected ? "var(--bg-3)" : `var(--sev-${v.severity.toLowerCase() === "info" ? "informative" : v.severity.toLowerCase()}-bg)`,
                      borderBottom: "1px solid rgba(255, 255, 255, 0.03)",
                      borderLeft: `2px solid var(--sev-${v.severity.toLowerCase() === "info" ? "informative" : v.severity.toLowerCase()})`,
                      transition: "background 0.2s"
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.background = "var(--bg-3)";
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.background = `var(--sev-${v.severity.toLowerCase() === "info" ? "informative" : v.severity.toLowerCase()}-bg)`;
                    }}
                  >
                    {selectionMode && (
                      <div style={{ display: "flex", alignItems: "center", marginRight: 12 }} onClick={(e) => e.stopPropagation()}>
                        <input 
                          type="checkbox" 
                          style={{ accentColor: "var(--fg)" }}
                          checked={selectedIds.has(uniqueId)}
                          onChange={() => toggleSelection(uniqueId)}
                        />
                      </div>
                    )}
                    <div className="trow-main">
                    <div className="trow-title">{v.title}</div>
                    <div className="trow-sub">
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>
                        {v.method ?? "GET"} {v.endpoint}
                      </span>
                    </div>
                    <div style={{ marginTop: 4, fontSize: 11, color: "var(--fg-3)" }}>
                      {v.scanTarget}
                    </div>
                  </div>
                  <div className="trow-right" style={{ flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                    {(v.status || "").toUpperCase() === "FALSE_POSITIVE" && (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 9, fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", color: "var(--fg-3)", border: "1px solid var(--border)", borderRadius: 4, padding: "1px 5px" }}>
                        <ShieldOff size={9} /> False positive
                      </span>
                    )}
                    <span className={sevClass(v.severity)}>{v.severity}</span>
                    {v.cvss && (
                      <span style={{ fontSize: 10, color: "var(--fg-3)", fontFamily: "var(--font-mono)" }}>
                        CVSS {v.cvss}
                      </span>
                    )}
                  </div>
                  </div>
                );
                })}
              </>
            )}
            </div>
          </div>

        {/* Detail pane */}
        <div
          className="card"
          style={{
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            opacity: selected ? 1 : 0.4,
            transition: "opacity 0.2s",
            pointerEvents: selected ? "auto" : "none",
          }}
        >
          {selected ? (
            <>
              {/* Detail header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "16px 20px",
                  background: `var(--sev-${selected.severity}-bg)`,
                  borderBottom: `1px solid var(--sev-${selected.severity}-bd)`,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className={sevClass(selected.severity)}>{selected.severity}</span>
                  {(selected.status || "").toUpperCase() === "FALSE_POSITIVE" && (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", color: "var(--fg-2)", border: "1px solid var(--border-hi, var(--border))", borderRadius: 4, padding: "2px 6px" }}>
                      <ShieldOff size={10} /> False positive
                    </span>
                  )}
                  {selected.cvss && (
                    <span style={{ fontSize: 11, color: "var(--fg-3)", fontFamily: "var(--font-mono)" }}>
                      CVSS {selected.cvss}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setSelected(null)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--fg-3)",
                    cursor: "pointer",
                    display: "flex",
                    padding: 4,
                    borderRadius: "var(--r-sm)",
                  }}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Detail body */}
              <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--fg)", marginBottom: 16, lineHeight: 1.4 }}>
                  {selected.title}
                </h2>

                {/* Meta */}
                <div style={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: "var(--r)", padding: "12px 14px", marginBottom: 20, display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", gap: 8, fontSize: 12 }}>
                    <span style={{ color: "var(--fg-3)", width: 64 }}>Target</span>
                    <a href={`/scans/${selected.scanId}`} style={{ color: "var(--fg)", fontWeight: 500, textDecoration: "underline", textDecorationColor: "var(--border-hi)" }}>{selected.scanTarget}</a>
                  </div>
                  <div style={{ display: "flex", gap: 8, fontSize: 12, fontFamily: "var(--font-mono)" }}>
                    <span style={{ color: "var(--fg-3)", fontFamily: "var(--font-sans)", width: 64 }}>Endpoint</span>
                    <span style={{ color: "var(--fg-2)" }}>
                      <span style={{ fontWeight: 700, color: "var(--fg)", marginRight: 6 }}>{selected.method ?? "GET"}</span>
                      {selected.endpoint}
                    </span>
                  </div>
                </div>

                {/* Description */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "var(--fg-2)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>
                    <Info size={12} /> Description
                  </div>
                  <MarkdownRenderer content={selected.description} />
                </div>

                {/* PoC */}
                {(selected.poc || selected.poc_description || selected.poc_script_code) && (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "var(--fg-2)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>
                      <Terminal size={12} /> Proof of Concept
                    </div>
                    
                    {selected.poc_description && (
                      <MarkdownRenderer content={selected.poc_description} />
                    )}
                    {selected.poc_script_code && (
                      <MarkdownRenderer content={selected.poc_script_code} />
                    )}
                    {selected.poc && !selected.poc_script_code && (
                      <MarkdownRenderer content={selected.poc.includes("```") ? selected.poc : `\`\`\`text\n${selected.poc}\n\`\`\``} />
                    )}
                  </div>
                )}

                {/* Remediation */}
                {selected.remediation && (
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "var(--fg-2)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>
                      <Lightbulb size={12} /> Remediation
                    </div>
                      <MarkdownRenderer content={selected.remediation} />
                  </div>
                )}

                {/* Actions: report to Jira (true positive) / mark false positive */}
                <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16, marginTop: 4, display: "flex", flexDirection: "column", gap: 10 }}>
                  <button
                    className="btn-primary"
                    onClick={() => openJiraModal(selected)}
                    style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", justifyContent: "center" }}
                  >
                    <Ticket size={14} />
                    Report to Jira
                  </button>
                  {(selected.status || "").toUpperCase() === "FALSE_POSITIVE" ? (
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        className="btn-secondary"
                        onClick={() => { setFpText(buildFpInstruction(selected)); setFpCopied(false); }}
                        style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, justifyContent: "center" }}
                      >
                        <Copy size={14} /> Copy FP instruction
                      </button>
                      <button
                        className="btn-secondary"
                        onClick={() => setFpStatus(selected, false)}
                        style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}
                      >
                        <X size={14} /> Unmark
                      </button>
                    </div>
                  ) : (
                    <button
                      className="btn-secondary"
                      onClick={() => { setFpText(buildFpInstruction(selected)); setFpCopied(false); setFpStatus(selected, true); }}
                      style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", justifyContent: "center" }}
                    >
                      <ShieldOff size={14} />
                      Mark as false positive
                    </button>
                  )}
                  <p style={{ fontSize: 11, color: "var(--fg-2)", marginTop: 2, lineHeight: 1.5 }}>
                    Report a confirmed finding as a Jira issue, or mark it a false positive (tags the finding and gives you an instruction to paste into a scan).
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className="empty-state">
              <ShieldAlert size={36} style={{ opacity: 0.12 }} />
              <p style={{ maxWidth: 200, textAlign: "center" }}>
                Select a vulnerability to view details
              </p>
            </div>
          )}
        </div>
      </div>

      {/* False-positive instruction popup */}
      {fpText !== null && (
        <div
          onClick={() => setFpText(null)}
          style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
        >
          <div
            className="glass-panel animate-fade-in"
            onClick={(e) => e.stopPropagation()}
            style={{ width: "100%", maxWidth: 560, padding: 20, display: "flex", flexDirection: "column", gap: 12 }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600 }}>
                <ShieldOff size={16} /> False-positive instruction
              </div>
              <button onClick={() => setFpText(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--fg-2)" }}>
                <X size={18} />
              </button>
            </div>
            <p style={{ fontSize: 12, color: "var(--fg-2)", lineHeight: 1.5, margin: 0 }}>
              Copy this and paste it into the <strong>Instruction</strong> field when you start a scan.
            </p>
            <textarea
              readOnly
              value={fpText}
              onFocus={(e) => e.currentTarget.select()}
              style={{ width: "100%", minHeight: 150, resize: "vertical", padding: 12, background: "var(--bg-1)", border: "1px solid var(--border)", borderRadius: "var(--r)", color: "var(--fg)", fontFamily: "var(--font-mono, monospace)", fontSize: 12, lineHeight: 1.5 }}
            />
            <button
              className="btn-primary"
              onClick={() => copyFp(fpText)}
              style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}
            >
              {fpCopied ? <Check size={14} /> : <Copy size={14} />}
              {fpCopied ? "Copied" : "Copy instruction"}
            </button>
          </div>
        </div>
      )}

      {/* Report to Jira modal */}
      {jiraVuln && (
        <div
          onClick={() => setJiraVuln(null)}
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
              <button onClick={() => setJiraVuln(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--fg-2)" }}>
                <X size={18} />
              </button>
            </div>

            {jiraResult ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "var(--sev-low)" }}>
                  <Check size={16} /> Created <strong>{jiraResult.key}</strong>
                </div>
                <a href={jiraResult.url} target="_blank" rel="noopener noreferrer" className="btn-primary" style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center", textDecoration: "none" }}>
                  <ExternalLink size={14} /> Open {jiraResult.key} in Jira
                </a>
              </div>
            ) : (
              <>
                {(() => {
                  const fieldWrap: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 6 };
                  const lbl: React.CSSProperties = { fontSize: 12, fontWeight: 500, color: "var(--fg-2)" };
                  const inp: React.CSSProperties = { width: "100%", padding: "8px 10px", background: "var(--bg-1)", border: "1px solid var(--border)", borderRadius: "var(--r)", color: "var(--fg)", fontSize: 13 };
                  return (
                    <>
                      <div style={fieldWrap}>
                        <label style={lbl}>Summary</label>
                        <input style={inp} value={jiraForm.summary} onChange={(e) => setJiraForm({ ...jiraForm, summary: e.target.value })} />
                      </div>
                      <div style={{ display: "flex", gap: 12 }}>
                        <div style={{ ...fieldWrap, flex: 1 }}>
                          <label style={lbl}>Severity level</label>
                          <select style={inp} value={jiraForm.severityLevel} onChange={(e) => setJiraForm({ ...jiraForm, severityLevel: e.target.value })}>
                            {JIRA_SEVERITY_LEVELS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
                          </select>
                        </div>
                        <div style={{ ...fieldWrap, flex: 1 }}>
                          <label style={lbl}>Priority</label>
                          <select style={inp} value={jiraForm.priority} onChange={(e) => setJiraForm({ ...jiraForm, priority: e.target.value })}>
                            {JIRA_PRIORITIES.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
                          </select>
                        </div>
                      </div>
                      <div style={fieldWrap}>
                        <label style={lbl}>Assignee <span style={{ color: "var(--fg-3)", fontWeight: 400 }}>(username, optional)</span></label>
                        <input style={inp} value={jiraForm.assignee} placeholder="e.g. AghamaliyevAM" onChange={(e) => setJiraForm({ ...jiraForm, assignee: e.target.value })} />
                      </div>
                      <div style={fieldWrap}>
                        <label style={lbl}>Labels <span style={{ color: "var(--fg-3)", fontWeight: 400 }}>(comma-separated)</span></label>
                        <input style={inp} value={jiraForm.labels} placeholder="strix, security" onChange={(e) => setJiraForm({ ...jiraForm, labels: e.target.value })} />
                      </div>
                      <div style={fieldWrap}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <label style={lbl}>Description <span style={{ color: "var(--fg-3)", fontWeight: 400 }}>(AI-generated, editable)</span></label>
                          <button
                            onClick={() => jiraVuln && generateJiraDesc(jiraVuln.id)}
                            disabled={jiraDescLoading}
                            style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "1px solid var(--border)", borderRadius: "var(--r)", color: "var(--fg-2)", fontSize: 11, padding: "3px 8px", cursor: "pointer" }}
                          >
                            {jiraDescLoading ? <Loader2 size={11} className="animate-spin" /> : <Settings2 size={11} />}
                            Regenerate
                          </button>
                        </div>
                        {jiraDescLoading && !jiraDesc ? (
                          <div style={{ ...inp, minHeight: 120, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--fg-3)", fontSize: 12, gap: 8 }}>
                            <Loader2 size={14} className="animate-spin" /> Generating report with AI…
                          </div>
                        ) : (
                          <textarea
                            style={{ ...inp, minHeight: 160, resize: "vertical", fontFamily: "var(--font-mono, monospace)", lineHeight: 1.5 }}
                            value={jiraDesc}
                            onChange={(e) => setJiraDesc(e.target.value)}
                          />
                        )}
                        {jiraDescNote && (
                          <span style={{ fontSize: 11, color: "var(--fg-3)" }}>{jiraDescNote}</span>
                        )}
                      </div>
                    </>
                  );
                })()}

                {jiraError && (
                  <div style={{ fontSize: 12, color: "var(--sev-critical, #e5484d)", background: "rgba(229,72,77,0.08)", border: "1px solid rgba(229,72,77,0.25)", borderRadius: "var(--r)", padding: "8px 10px", lineHeight: 1.5 }}>
                    {jiraError}
                  </div>
                )}

                <button
                  className="btn-primary"
                  disabled={jiraSubmitting || jiraDescLoading || !jiraForm.summary.trim() || !jiraDesc.trim()}
                  onClick={submitJira}
                  style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}
                >
                  {jiraSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Ticket size={14} />}
                  {jiraSubmitting ? "Creating…" : "Create Jira issue"}
                </button>
                <p style={{ fontSize: 11, color: "var(--fg-2)", margin: 0, lineHeight: 1.5 }}>
                  The issue description is generated from the finding as a narrative + mitigation. Configure Jira in Settings → Jira first.
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
