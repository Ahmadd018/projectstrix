"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import styles from "./detail.module.css";

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

interface ScanDetail {
  id: string;
  target: string;
  llmModel: string;
  scanMode: string;
  status: "running" | "completed" | "failed" | "stopped";
  startedAt: string;
  finishedAt: string | null;
  vulnerabilities: Vulnerability[];
}

const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

function SeverityBadge({ s }: { s: string }) {
  const cls = { critical: "badge-critical", high: "badge-high", medium: "badge-medium", low: "badge-low" }[s] ?? "badge-low";
  return <span className={`badge ${cls}`}>{s}</span>;
}

export default function ScanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [scan, setScan] = useState<ScanDetail | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [vulns, setVulns] = useState<Vulnerability[]>([]);
  const [selectedVuln, setSelectedVuln] = useState<Vulnerability | null>(null);
  const [activeTab, setActiveTab] = useState<"logs" | "vulns">("logs");
  const logEndRef = useRef<HTMLDivElement>(null);
  const [elapsed, setElapsed] = useState("");
  const esRef = useRef<EventSource | null>(null);

  const fetchScan = useCallback(async () => {
    try {
      const res = await fetch(`/api/scans/${id}`);
      if (!res.ok) { router.push("/scans"); return; }
      const data = await res.json();
      setScan(data);
      setVulns((data.vulnerabilities ?? []).sort(
        (a: Vulnerability, b: Vulnerability) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
      ));
    } catch {}
  }, [id, router]);

  useEffect(() => {
    fetchScan();
  }, [fetchScan]);

  // Elapsed timer
  useEffect(() => {
    if (!scan) return;
    if (scan.status !== "running") {
      if (scan.finishedAt && scan.startedAt) {
        const d = new Date(scan.finishedAt).getTime() - new Date(scan.startedAt).getTime();
        setElapsed(formatDuration(d));
      }
      return;
    }
    const interval = setInterval(() => {
      const d = Date.now() - new Date(scan.startedAt).getTime();
      setElapsed(formatDuration(d));
    }, 1000);
    return () => clearInterval(interval);
  }, [scan]);

  // SSE stream
  useEffect(() => {
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }

    const es = new EventSource(`/api/scans/${id}/stream`);
    esRef.current = es;

    es.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === "log") {
          setLogs((prev) => [...prev, msg.line]);
        } else if (msg.type === "vulnerability") {
          setVulns((prev) => {
            if (prev.find((v) => v.id === msg.vuln.id)) return prev;
            return [...prev, msg.vuln].sort(
              (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
            );
          });
        } else if (msg.type === "status") {
          setScan((prev) => prev ? { ...prev, status: msg.status } : prev);
          fetchScan();
          es.close();
        }
      } catch {}
    };

    es.onerror = () => { es.close(); };

    return () => { es.close(); };
  }, [id, fetchScan]);

  // Auto-scroll logs
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  async function handleStop() {
    await fetch(`/api/scans/${id}`, { method: "DELETE" });
    fetchScan();
  }

  if (!scan) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
        <p>Loading scan…</p>
      </div>
    );
  }

  const criticalCount = vulns.filter((v) => v.severity === "critical").length;
  const highCount = vulns.filter((v) => v.severity === "high").length;

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.breadcrumb}>
          <Link href="/scans" className={styles.backLink}>← Scans</Link>
          <span className={styles.sep}>/</span>
          <span className={styles.scanId}>{id.slice(0, 8)}…</span>
        </div>

        <div className={styles.titleRow}>
          <div>
            <h1 className={styles.title}>{scan.target}</h1>
            <div className={styles.meta}>
              <span className={styles.metaTag}>{scan.scanMode}</span>
              <span className={styles.metaTag}>{scan.llmModel}</span>
              {elapsed && <span className={styles.metaTime}>⏱ {elapsed}</span>}
            </div>
          </div>

          <div className={styles.headerActions}>
            <StatusPill status={scan.status} />
            {scan.status === "running" && (
              <button className={styles.stopBtn} onClick={handleStop}>⏹ Stop Scan</button>
            )}
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className={styles.statsRow}>
        <div className={`glass-panel ${styles.statCard}`}>
          <span className={styles.statLabel}>Total Findings</span>
          <span className={styles.statValue}>{vulns.length}</span>
        </div>
        <div className={`glass-panel ${styles.statCard} ${styles.statCritical}`}>
          <span className={styles.statLabel}>Critical</span>
          <span className={styles.statValue}>{criticalCount}</span>
        </div>
        <div className={`glass-panel ${styles.statCard} ${styles.statHigh}`}>
          <span className={styles.statLabel}>High</span>
          <span className={styles.statValue}>{highCount}</span>
        </div>
        <div className={`glass-panel ${styles.statCard}`}>
          <span className={styles.statLabel}>Status</span>
          <span className={styles.statValue} style={{ fontSize: "1rem", textTransform: "capitalize" }}>{scan.status}</span>
        </div>
      </div>

      {/* Main content */}
      <div className={styles.mainGrid}>
        {/* Left panel: Logs + Vulns tabs */}
        <div className={`glass-panel ${styles.leftPanel}`}>
          <div className={styles.tabs}>
            <button
              className={`${styles.tab} ${activeTab === "logs" ? styles.tabActive : ""}`}
              onClick={() => setActiveTab("logs")}
            >
              🖥 Agent Logs
              {scan.status === "running" && <span className={styles.liveDot} />}
            </button>
            <button
              className={`${styles.tab} ${activeTab === "vulns" ? styles.tabActive : ""}`}
              onClick={() => setActiveTab("vulns")}
            >
              🛡 Findings
              {vulns.length > 0 && <span className={styles.countBadge}>{vulns.length}</span>}
            </button>
          </div>

          {activeTab === "logs" ? (
            <div className={styles.logPane}>
              {logs.length === 0 ? (
                <div className={styles.logEmpty}>
                  <div className={styles.spinner} />
                  <span>Waiting for agent output…</span>
                </div>
              ) : (
                logs.map((line, i) => (
                  <div key={i} className={`${styles.logLine} ${getLogClass(line, styles)}`}>
                    <span className={styles.logText}>{line}</span>
                  </div>
                ))
              )}
              <div ref={logEndRef} />
            </div>
          ) : (
            <div className={styles.vulnList}>
              {vulns.length === 0 ? (
                <div className={styles.logEmpty}>
                  <span>No vulnerabilities found yet.</span>
                </div>
              ) : (
                vulns.map((v) => (
                  <div
                    key={v.id}
                    className={`${styles.vulnItem} ${selectedVuln?.id === v.id ? styles.vulnItemActive : ""}`}
                    onClick={() => setSelectedVuln(selectedVuln?.id === v.id ? null : v)}
                  >
                    <div className={styles.vulnItemHeader}>
                      <SeverityBadge s={v.severity} />
                      <span className={styles.vulnTitle}>{v.title}</span>
                    </div>
                    <div className={styles.vulnEndpoint}>
                      <span className={styles.methodTag}>{v.method ?? "GET"}</span>
                      {v.endpoint}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Right panel: PoC Drawer */}
        <div className={`glass-panel ${styles.rightPanel} ${selectedVuln ? styles.rightPanelOpen : ""}`}>
          {selectedVuln ? (
            <div className={styles.pocContent}>
              <div className={styles.pocHeader}>
                <SeverityBadge s={selectedVuln.severity} />
                {selectedVuln.cvss && (
                  <span className={styles.cvssScore}>CVSS {selectedVuln.cvss}</span>
                )}
                <button className={styles.closePoC} onClick={() => setSelectedVuln(null)}>✕</button>
              </div>
              <h2 className={styles.pocTitle}>{selectedVuln.title}</h2>

              <div className={styles.pocEndpoint}>
                <span className={styles.methodTag}>{selectedVuln.method ?? "GET"}</span>
                <code>{selectedVuln.endpoint}</code>
              </div>

              <section className={styles.pocSection}>
                <h3>Description</h3>
                <p>{selectedVuln.description}</p>
              </section>

              {selectedVuln.poc && (
                <section className={styles.pocSection}>
                  <h3>Proof of Concept</h3>
                  <pre className={styles.pocCode}>{selectedVuln.poc}</pre>
                </section>
              )}

              {selectedVuln.remediation && (
                <section className={styles.pocSection}>
                  <h3>Remediation</h3>
                  <div className={styles.remediationBox}>
                    <span>💡</span>
                    <p>{selectedVuln.remediation}</p>
                  </div>
                </section>
              )}
            </div>
          ) : (
            <div className={styles.pocEmpty}>
              <span className={styles.pocEmptyIcon}>🔍</span>
              <p>Select a vulnerability to view details & PoC</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    running: styles.pillRunning,
    completed: styles.pillCompleted,
    failed: styles.pillFailed,
    stopped: styles.pillStopped,
  };
  const labels: Record<string, string> = {
    running: "🟢 Running",
    completed: "✅ Completed",
    failed: "❌ Failed",
    stopped: "⏹ Stopped",
  };
  return <span className={`${styles.statusPill} ${map[status] ?? ""}`}>{labels[status] ?? status}</span>;
}

function getLogClass(line: string, s: Record<string, string>) {
  if (line.includes("CRITICAL") || line.includes("🚨")) return s.logCritical;
  if (line.includes("HIGH") || line.includes("⚠️")) return s.logHigh;
  if (line.includes("ERROR") || line.includes("[error]")) return s.logError;
  if (line.includes("✅") || line.includes("completed") || line.includes("complete")) return s.logSuccess;
  if (line.includes("[stderr]")) return s.logStderr;
  return "";
}

function formatDuration(ms: number) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}
