"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import styles from "./detail.module.css";
import { ScanDetail, Vulnerability, SEVERITY_ORDER } from "./types";
import ScanOverview from "./components/ScanOverview";
import ScanFindings from "./components/ScanFindings";
import ScanLogs from "./components/ScanLogs";
import ScanRaw from "./components/ScanRaw";

export default function ScanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [scan, setScan] = useState<ScanDetail | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [vulns, setVulns] = useState<Vulnerability[]>([]);
  const [activeTab, setActiveTab] = useState<
    "overview" | "vulns" | "logs" | "raw"
  >("overview");
  const [elapsed, setElapsed] = useState("");
  const esRef = useRef<EventSource | null>(null);

  const fetchScan = useCallback(async () => {
    try {
      const res = await fetch(`/api/scans/${id}`);
      if (!res.ok) {
        router.push("/scans");
        return;
      }
      const data = await res.json();
      setScan(data);
      setVulns(
        (data.vulnerabilities ?? []).sort(
          (a: Vulnerability, b: Vulnerability) =>
            SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
        ),
      );
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
        const d =
          new Date(scan.finishedAt).getTime() -
          new Date(scan.startedAt).getTime();
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
          setLogs((prev) => [...prev, msg.text]);
        } else if (msg.type === "vulnerability") {
          setVulns((prev) => {
            if (prev.find((v) => v.id === msg.vuln.id)) return prev;
            return [...prev, msg.vuln].sort(
              (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
            );
          });
        } else if (msg.type === "status") {
          setScan((prev) => (prev ? { ...prev, status: msg.status } : prev));
          fetchScan();
          es.close();
        }
      } catch {}
    };

    es.onerror = () => {
      es.close();
    };

    return () => {
      es.close();
    };
  }, [id, fetchScan]);

  async function handleStop() {
    await fetch(`/api/scans/${id}`, { method: "DELETE" });
    fetchScan();
  }

  if (!scan) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
        <p>Loading scan...</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.breadcrumb}>
          <Link href="/scans" className={styles.backLink}>
            ← Scans
          </Link>
          <span className={styles.sep}>/</span>
          <span className={styles.scanId}>{id.slice(0, 8)}...</span>
        </div>

        <div className={styles.titleRow}>
          <div>
            <h1 className={styles.title}>{scan.scanName ? `${scan.scanName} (${scan.target})` : scan.target}</h1>
            <div className={styles.meta}>
              <span className={styles.metaTag}>{scan.scanMode}</span>
              <span className={styles.metaTag}>{scan.llmModel}</span>
              {elapsed && <span className={styles.metaTime}>{elapsed}</span>}
            </div>
          </div>

          <div className={styles.headerActions}>
            <StatusPill status={scan.status} />
            {scan.status === "running" && (
              <button className="btn btn-danger" onClick={handleStop}>
                Stop Scan
              </button>
            )}
          </div>
        </div>
      </div>

      <div className={styles.tabsNav}>
        <button
          className={`${styles.navTab} ${activeTab === "overview" ? styles.navTabActive : ""}`}
          onClick={() => setActiveTab("overview")}
        >
          Overview
        </button>
        <button
          className={`${styles.navTab} ${activeTab === "vulns" ? styles.navTabActive : ""}`}
          onClick={() => setActiveTab("vulns")}
        >
          Findings
          {vulns.length > 0 && (
            <span className={styles.tabBadge}>{vulns.length}</span>
          )}
        </button>
        <button
          className={`${styles.navTab} ${activeTab === "logs" ? styles.navTabActive : ""}`}
          onClick={() => setActiveTab("logs")}
        >
          Agent Logs
          {scan.status === "running" && <span className={styles.liveDot} />}
        </button>
        <button
          className={`${styles.navTab} ${activeTab === "raw" ? styles.navTabActive : ""}`}
          onClick={() => setActiveTab("raw")}
        >
          Raw Artifacts
        </button>
      </div>

      <div className={styles.tabContent}>
        {activeTab === "overview" && (
          <ScanOverview scan={scan} vulns={vulns} elapsed={elapsed} />
        )}
        {activeTab === "vulns" && <ScanFindings vulns={vulns} />}
        {activeTab === "logs" && <ScanLogs logs={logs} status={scan.status} />}
        {activeTab === "raw" && <ScanRaw scan={scan} />}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    crawling: styles.pillRunning,
    scanning: styles.pillRunning,
    analyzing: styles.pillRunning,
    running: styles.pillRunning,
    completed: styles.pillCompleted,
    failed: styles.pillFailed,
    stopped: styles.pillStopped,
  };
  const labels: Record<string, string> = {
    crawling: "Crawling",
    scanning: "Scanning",
    analyzing: "Analyzing",
    running: "Running",
    completed: "Completed",
    failed: "Failed",
    stopped: "Stopped",
  };
  return (
    <span className={`${styles.statusPill} ${map[status] ?? ""}`}>
      {labels[status] ?? status}
    </span>
  );
}

function formatDuration(ms: number) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}
