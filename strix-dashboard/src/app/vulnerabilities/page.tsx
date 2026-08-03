"use client";

import { useState, useEffect, useCallback } from "react";
import styles from "./vulns.module.css";

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

function SeverityBadge({ s }: { s: string }) {
  const cls: Record<string, string> = {
    critical: "badge-critical", high: "badge-high", medium: "badge-medium", low: "badge-low"
  };
  return <span className={`badge ${cls[s] ?? "badge-low"}`}>{s}</span>;
}

export default function VulnerabilitiesPage() {
  const [allVulns, setAllVulns] = useState<VulnWithScan[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<typeof SEVERITIES[number]>("all");
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
        for (const v of (detail.vulnerabilities ?? [])) {
          vulns.push({ ...v, scanId: scan.id, scanTarget: scan.target });
        }
      }

      // Sort by severity
      vulns.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
      setAllVulns(vulns);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
    // Refresh every 5s if any scan running
    const interval = setInterval(fetchAll, 5000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  const filtered = allVulns.filter((v) => {
    if (filter !== "all" && v.severity !== filter) return false;
    if (search && !v.title.toLowerCase().includes(search.toLowerCase()) &&
        !v.endpoint.toLowerCase().includes(search.toLowerCase()) &&
        !v.scanTarget.toLowerCase().includes(search.toLowerCase())) return false;
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
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Vulnerabilities</h1>
          <p className={styles.subtitle}>All findings across your security assessments</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className={styles.summaryRow}>
        {(["critical", "high", "medium", "low"] as const).map((s) => (
          <button
            key={s}
            className={`glass-panel ${styles.summaryCard} ${filter === s ? styles.summaryActive : ""} ${styles[`summary_${s}`]}`}
            onClick={() => setFilter(filter === s ? "all" : s)}
          >
            <span className={styles.summaryCount}>{counts[s]}</span>
            <span className={styles.summaryLabel}>{s}</span>
          </button>
        ))}
      </div>

      <div className={styles.mainLayout}>
        {/* Left: list */}
        <div className={`glass-panel ${styles.listPanel}`}>
          {/* Filters bar */}
          <div className={styles.filtersBar}>
            <input
              className={styles.searchInput}
              type="text"
              placeholder="Search by title, endpoint, target…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className={styles.filterTabs}>
              {SEVERITIES.map((s) => (
                <button
                  key={s}
                  className={`${styles.filterTab} ${filter === s ? styles.filterTabActive : ""}`}
                  onClick={() => setFilter(s)}
                >
                  {s} {counts[s as keyof typeof counts] > 0 && s !== "all" ? `(${counts[s as keyof typeof counts]})` : s === "all" ? `(${counts.all})` : ""}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className={styles.empty}>
              <div className={styles.spinner} />
              <p>Loading vulnerabilities…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className={styles.empty}>
              <span className={styles.emptyIcon}>🛡️</span>
              <h3>{allVulns.length === 0 ? "No vulnerabilities found" : "No results for this filter"}</h3>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.88rem" }}>
                {allVulns.length === 0
                  ? "Run a scan to discover security vulnerabilities."
                  : "Try changing the filter or search term."}
              </p>
            </div>
          ) : (
            <div className={styles.vulnList}>
              {filtered.map((v) => (
                <div
                  key={`${v.scanId}-${v.id}`}
                  className={`${styles.vulnCard} ${selected?.id === v.id && selected.scanId === v.scanId ? styles.vulnCardActive : ""}`}
                  onClick={() => setSelected(selected?.id === v.id && selected.scanId === v.scanId ? null : v)}
                >
                  <div className={styles.vulnCardTop}>
                    <SeverityBadge s={v.severity} />
                    {v.cvss && <span className={styles.cvssTag}>CVSS {v.cvss}</span>}
                  </div>
                  <div className={styles.vulnCardTitle}>{v.title}</div>
                  <div className={styles.vulnCardMeta}>
                    <span className={styles.methodTag}>{v.method ?? "GET"}</span>
                    <code className={styles.endpoint}>{v.endpoint}</code>
                  </div>
                  <div className={styles.vulnCardScan}>
                    🎯 <span>{v.scanTarget}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: PoC drawer */}
        <div className={`glass-panel ${styles.drawer} ${selected ? styles.drawerOpen : ""}`}>
          {selected ? (
            <div className={styles.drawerContent}>
              <div className={styles.drawerHeader}>
                <SeverityBadge s={selected.severity} />
                {selected.cvss && (
                  <span className={styles.cvssScore}>CVSS {selected.cvss}</span>
                )}
                <button className={styles.closeBtn} onClick={() => setSelected(null)}>✕</button>
              </div>

              <h2 className={styles.drawerTitle}>{selected.title}</h2>

              <div className={styles.drawerTarget}>
                🎯 <a href={`/scans/${selected.scanId}`} className={styles.scanLink}>{selected.scanTarget}</a>
              </div>

              <div className={styles.drawerEndpoint}>
                <span className={styles.methodTag}>{selected.method ?? "GET"}</span>
                <code>{selected.endpoint}</code>
              </div>

              <section className={styles.section}>
                <h3>Description</h3>
                <p>{selected.description}</p>
              </section>

              {selected.poc && (
                <section className={styles.section}>
                  <h3>Proof of Concept</h3>
                  <pre className={styles.pocCode}>{selected.poc}</pre>
                </section>
              )}

              {selected.remediation && (
                <section className={styles.section}>
                  <h3>Remediation</h3>
                  <div className={styles.remediationBox}>
                    <span>💡</span>
                    <p>{selected.remediation}</p>
                  </div>
                </section>
              )}
            </div>
          ) : (
            <div className={styles.drawerEmpty}>
              <span className={styles.drawerEmptyIcon}>🔍</span>
              <p>Select a vulnerability to view details & Proof of Concept</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
