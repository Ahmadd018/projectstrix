"use client";

import { useState, useEffect, useCallback } from "react";
import { ShieldAlert, Search, Info, Terminal, Lightbulb, X, Loader2 } from "lucide-react";

interface Vulnerability {
  id: string;
  title: string;
  severity: "critical" | "high" | "medium" | "low";
  endpoint: string;
  method?: string;
  description: string;
  poc?: string;
  cvss?: number;
  remediation?: string;
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

const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };
const SEVERITIES = ["all", "critical", "high", "medium", "low"] as const;

function sevClass(s: string) {
  return `sev sev-${s}`;
}

export default function VulnerabilitiesPage() {
  const [allVulns, setAllVulns] = useState<VulnWithScan[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<(typeof SEVERITIES)[number]>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<VulnWithScan | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const res = await fetch("/api/scans");
      const data = await res.json();
      const scans: Scan[] = data.scans ?? [];

      const vulns: VulnWithScan[] = [];
      for (const scan of scans) {
        const detail = await fetch(`/api/scans/${scan.id}`).then((r) => r.json());
        for (const v of detail.vulnerabilities ?? []) {
          vulns.push({ ...v, scanId: scan.id, scanTarget: scan.target });
        }
      }

      vulns.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
      setAllVulns(vulns);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 5000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  const filtered = allVulns.filter((v) => {
    if (filter !== "all" && v.severity !== filter) return false;
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
  };

  return (
    <div className="page" style={{ height: "100%", maxWidth: "none" }}>
      {/* Header */}
      <div className="page-intro">
        <h1 className="page-heading">Vulnerabilities</h1>
        <p className="page-desc">All findings across your security assessments.</p>
      </div>

      {/* Severity stat cards */}
      <div className="stats-grid">
        {(["critical", "high", "medium", "low"] as const).map((s) => (
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
                  "var(--sev-low)",
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
            <div className="search-input-wrap" style={{ maxWidth: "100%" }}>
              <Search size={13} className="search-input-icon" />
              <input
                className="search-input"
                placeholder="Search by title, endpoint, target…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
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
              filtered.map((v) => (
                <div
                  key={`${v.scanId}-${v.id}`}
                  onClick={() =>
                    setSelected(
                      selected?.id === v.id && selected.scanId === v.scanId ? null : v
                    )
                  }
                  className="trow"
                  style={{
                    cursor: "pointer",
                    background:
                      selected?.id === v.id && selected.scanId === v.scanId
                        ? "var(--bg-3)"
                        : undefined,
                    borderBottom: "1px solid var(--border)",
                  }}
                >
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
                    <span className={sevClass(v.severity)}>{v.severity}</span>
                    {v.cvss && (
                      <span style={{ fontSize: 10, color: "var(--fg-3)", fontFamily: "var(--font-mono)" }}>
                        CVSS {v.cvss}
                      </span>
                    )}
                  </div>
                </div>
              ))
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
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className={sevClass(selected.severity)}>{selected.severity}</span>
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
                  <p style={{ fontSize: 13, color: "var(--fg-2)", lineHeight: 1.7 }}>{selected.description}</p>
                </div>

                {/* PoC */}
                {selected.poc && (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "var(--fg-2)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>
                      <Terminal size={12} /> Proof of Concept
                    </div>
                    <pre style={{ background: "#000", border: "1px solid var(--border-md)", borderRadius: "var(--r)", padding: "14px", fontSize: 12, fontFamily: "var(--font-mono)", color: "#4ade80", overflowX: "auto", lineHeight: 1.6 }}>
                      <code>{selected.poc}</code>
                    </pre>
                  </div>
                )}

                {/* Remediation */}
                {selected.remediation && (
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "var(--fg-2)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>
                      <Lightbulb size={12} /> Remediation
                    </div>
                    <div style={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: "var(--r)", padding: "14px", fontSize: 13, color: "var(--fg-2)", lineHeight: 1.7 }}>
                      {selected.remediation}
                    </div>
                  </div>
                )}
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
    </div>
  );
}
