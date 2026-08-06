"use client";

import { useState, useEffect, useRef } from "react";
import styles from "./logs.module.css";

export default function LogsPage() {
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const terminalRef = useRef<HTMLDivElement>(null);

  const fetchLogs = async () => {
    try {
      const res = await fetch("/api/logs", {
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.logs) {
        setLogs(data.logs);
      }
    } catch (e: any) {
      // Ignore AbortError or standard fetch connection errors during dev recompilation
      if (e.name !== "AbortError" && e.message !== "Failed to fetch") {
        console.error("Error fetching logs:", e);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    const iv = setInterval(fetchLogs, 3000);
    return () => clearInterval(iv);
  }, []);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs]);

  const parseLogLine = (line: string, index: number) => {
    // Expected format: [STRIX][LEVEL][TIMESTAMP][TAG] Message
    const match = line.match(/^\[STRIX\]\[(.*?)\]\[(.*?)\]\[(.*?)\]\s(.*)/);

    if (match) {
      const [, level, timestamp, tag, message] = match;
      const levelClass = styles[level.toLowerCase()] || "";

      return (
        <div key={index} className={styles.logLine}>
          <span className={styles.timestamp}>
            [{new Date(timestamp).toLocaleTimeString()}]
          </span>
          <span className={`${styles.level} ${levelClass}`}>[{level}]</span>
          <span className={styles.tag}>[{tag}]</span>
          <span className={styles.message}> {message}</span>
        </div>
      );
    }

    // Fallback for non-standard lines
    return (
      <div key={index} className={styles.logLine}>
        {line}
      </div>
    );
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>System Logs</h1>
          <p className={styles.subtitle}>
            Real-time dashboard and agent activity logs
          </p>
        </div>
        <button className="btn btn-outline" onClick={fetchLogs}>
          Refresh
        </button>
      </div>

      <div className={styles.terminal} ref={terminalRef}>
        {loading && logs.length === 0 ? (
          <div className={styles.empty}>Loading logs...</div>
        ) : logs.length === 0 ? (
          <div className={styles.empty}>No logs available yet.</div>
        ) : (
          logs.map((line, i) => parseLogLine(line, i))
        )}
      </div>
    </div>
  );
}
