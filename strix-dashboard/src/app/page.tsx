"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import styles from "./page.module.css";

interface Scan {
  id: string;
  target: string;
  status: "running" | "completed" | "failed" | "stopped";
  startedAt: string;
  finishedAt: string | null;
  vulnCount: number;
  scanMode: string;
}

interface Vuln {
  id: string;
  title: string;
  severity: "critical" | "high" | "medium" | "low";
  endpoint: string;
  scanTarget: string;
  scanId: string;
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

function securityScore(vulns: Vuln[]) {
  if (vulns.length === 0) return 100;
  let deduction = 0;
  for (const v of vulns) {
    if (v.severity === "critical") deduction += 20;
    else if (v.severity === "high") deduction += 10;
    else if (v.severity === "medium") deduction += 4;
    else deduction += 1;
  }
  return Math.max(0, 100 - deduction);
}

export default function Dashboard() {
  const [scans, setScans] = useState<Scan[]>([]);
  const [recentVulns, setRecentVulns] = useState<Vuln[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch("/api/scans", { signal: controller.signal });
      clearTimeout(timeout);
      const data = await res.json();
      const scanList: Scan[] = data.scans ?? [];
      setScans(scanList);

      // Gather recent vulns from latest 3 scans
      const vulns: Vuln[] = [];
      for (const scan of scanList.slice(0, 3)) {
        try {
          const detail = await fetch(`/api/scans/${scan.id}`).then((r) => r.json());
          for (const v of (detail.vulnerabilities ?? [])) {
            vulns.push({ ...v, scanTarget: scan.target, scanId: scan.id });
          }
        } catch {}
      }
      vulns.sort((a, b) => {
        const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
        return order[a.severity] - order[b.severity];
      });
      setRecentVulns(vulns.slice(0, 5));
    } catch {
      clearTimeout(timeout);
      // On error/timeout, just show empty state instead of infinite spinner
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const totalVulns = scans.reduce((s, sc) => s + sc.vulnCount, 0);
  const criticalVulns = recentVulns.filter((v) => v.severity === "critical").length;
  const activeScans = scans.filter((s) => s.status === "running").length;
  const score = securityScore(recentVulns);

  return (
    <div className={styles.dashboard}>
      {loading ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "300px", gap: "16px", color: "var(--text-secondary)" }}>
          <div className={styles.spinner} />
          <span>Loading dashboard…</span>
        </div>
      ) : (
        <>
          <div className={styles.metricsGrid}>
            {/* Security Score */}
            <div className={`glass-panel ${styles.metricCard}`}>
              <div className={styles.cardGlow} />
              <div className={styles.metricHeader}>
                <span>Security Score</span>
                <span className={styles.icon}>🛡️</span>
              </div>
              <div className={styles.metricValue} style={{ color: score > 70 ? "var(--accent-primary)" : score > 40 ? "var(--accent-warning)" : "var(--accent-danger)" }}>
                {score}/100
              </div>
              <div className={`${styles.metricChange} ${score >= 70 ? styles.changePositive : styles.changeNegative}`}>
                <span>{score >= 70 ? "Good" : score >= 40 ? "Fair" : "Critical"}</span> security posture
              </div>
            </div>

            {/* Critical Vulns */}
            <div className={`glass-panel ${styles.metricCard}`}>
              <div className={styles.cardGlow} />
              <div className={styles.metricHeader}>
                <span>Critical Vulns</span>
                <span className={styles.icon}>🚨</span>
              </div>
              <div className={styles.metricValue} style={{ color: criticalVulns > 0 ? "var(--accent-danger)" : "inherit" }}>
                {criticalVulns}
              </div>
              <div className={`${styles.metricChange} ${criticalVulns > 0 ? styles.changeNegative : styles.changePositive}`}>
                {criticalVulns > 0 ? <><span>⚠ Action required</span></> : <><span>✓ None found</span></>}
              </div>
            </div>

            {/* Active Scans */}
            <div className={`glass-panel ${styles.metricCard}`}>
              <div className={styles.cardGlow} />
              <div className={styles.metricHeader}>
                <span>Active Scans</span>
                <span className={styles.icon}>🎯</span>
              </div>
              <div className={styles.metricValue}>{activeScans}</div>
              <div className={styles.metricChange}>
                {activeScans > 0 ? (
                  <span>Running now · <Link href="/scans" style={{ color: "var(--accent-primary)" }}>View</Link></span>
                ) : (
                  <span>No scans running · <Link href="/scans?new=1" style={{ color: "var(--accent-primary)" }}>Start one</Link></span>
                )}
              </div>
            </div>

            {/* Total Findings */}
            <div className={`glass-panel ${styles.metricCard}`}>
              <div className={styles.cardGlow} />
              <div className={styles.metricHeader}>
                <span>Total Findings</span>
                <span className={styles.icon}>🔍</span>
              </div>
              <div className={styles.metricValue}>{totalVulns}</div>
              <div className={styles.metricChange}>
                <span>Across {scans.length} scan{scans.length !== 1 ? "s" : ""}</span>
              </div>
            </div>
          </div>

          <div className={styles.chartsGrid}>
            {/* Recent Scans */}
            <div className={`glass-panel ${styles.chartCard}`}>
              <div className={styles.chartHeader}>
                <h2 className={styles.chartTitle}>Recent Scans</h2>
                <Link href="/scans" className="btn btn-outline" style={{ padding: "6px 14px", fontSize: "0.82rem" }}>
                  View All →
                </Link>
              </div>
              {scans.length === 0 ? (
                <div className={styles.emptyState}>
                  <p>No scans yet.</p>
                  <Link href="/scans?new=1" className="btn btn-primary" style={{ marginTop: "12px" }}>
                    🚀 Start First Scan
                  </Link>
                </div>
              ) : (
                <div className={styles.scanList}>
                  {scans.slice(0, 5).map((scan) => (
                    <Link key={scan.id} href={`/scans/${scan.id}`} className={styles.scanItem}>
                      <div className={styles.scanInfo}>
                        <span className={styles.scanTarget}>{scan.target}</span>
                        <div className={styles.scanMeta}>
                          <span className={styles.modeTag}>{scan.scanMode}</span>
                          <span style={{ color: "var(--text-secondary)", fontSize: "0.78rem" }}>{timeAgo(scan.startedAt)}</span>
                        </div>
                      </div>
                      <div className={styles.scanRight}>
                        {scan.vulnCount > 0 && (
                          <span className={styles.vulnBadge}>{scan.vulnCount}</span>
                        )}
                        <StatusDot status={scan.status} />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Critical Findings */}
            <div className={`glass-panel ${styles.chartCard}`}>
              <div className={styles.chartHeader}>
                <h2 className={styles.chartTitle}>Recent Findings</h2>
                <Link href="/vulnerabilities" className="btn btn-outline" style={{ padding: "6px 14px", fontSize: "0.82rem" }}>
                  View All →
                </Link>
              </div>
              {recentVulns.length === 0 ? (
                <div className={styles.emptyState}>
                  <p style={{ color: "var(--text-secondary)", fontSize: "0.88rem" }}>
                    {scans.length === 0 ? "Run a scan to discover vulnerabilities." : "No vulnerabilities found in recent scans."}
                  </p>
                </div>
              ) : (
                <div className={styles.vulnList}>
                  {recentVulns.map((v, i) => (
                    <div key={`${v.scanId}-${v.id}-${i}`} className={styles.vulnItem}>
                      <div className={styles.vulnName}>{v.title}</div>
                      <div className={styles.vulnMeta}>
                        <span className={`badge badge-${v.severity}`}>{v.severity}</span>
                        <span style={{ fontSize: "0.78rem", color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "120px" }}>
                          {v.endpoint}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    running: "var(--accent-primary)",
    completed: "var(--accent-info)",
    failed: "var(--accent-danger)",
    stopped: "var(--text-secondary)",
  };
  return (
    <span
      style={{
        width: "8px",
        height: "8px",
        borderRadius: "50%",
        background: colors[status] ?? "var(--text-secondary)",
        display: "inline-block",
        flexShrink: 0,
        ...(status === "running" ? { animation: "pulse 2s infinite" } : {}),
      }}
    />
  );
}
