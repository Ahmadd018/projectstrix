import { useEffect, useRef } from "react";
import styles from "../detail.module.css";

function getLogClass(line: string, s: Record<string, string>) {
  if (line.includes("CRITICAL")) return s.logCritical;
  if (line.includes("HIGH")) return s.logHigh;
  if (line.includes("ERROR") || line.includes("[error]")) return s.logError;
  if (line.includes("completed") || line.includes("complete"))
    return s.logSuccess;
  if (line.includes("[stderr]")) return s.logStderr;
  return "";
}

export default function ScanLogs({
  logs,
  status,
}: {
  logs: string[];
  status: string;
}) {
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  return (
    <div className={`glass-panel ${styles.terminalContainer}`}>
      <div className={styles.terminalHeader}>
        <span className={styles.terminalTitle}>Agent Execution Logs</span>
        {status === "running" && (
          <span className={styles.liveIndicator}>Live</span>
        )}
      </div>
      <div className={styles.terminalBody}>
        {logs.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.spinner} />
            <span>Waiting for agent output...</span>
          </div>
        ) : (
          logs.map((line, i) => (
            <div
              key={i}
              className={`${styles.logLine} ${getLogClass(line, styles)}`}
            >
              {line}
            </div>
          ))
        )}
        <div ref={logEndRef} />
      </div>
    </div>
  );
}
