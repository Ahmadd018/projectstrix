"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { ScanDetail, Vulnerability } from "../types";
import styles from "../detail.module.css";

interface Props {
  scan: ScanDetail;
  vulns: Vulnerability[];
  elapsed: string;
}

export default function ScanOverview({ scan, vulns, elapsed }: Props) {
  const critical = vulns.filter((v) => v.severity === "critical").length;
  const high = vulns.filter((v) => v.severity === "high").length;
  const medium = vulns.filter((v) => v.severity === "medium").length;
  const low = vulns.filter((v) => v.severity === "low").length;
  const total = vulns.length;
  const [copied, setCopied] = useState(false);

  const handleCopyId = () => {
    navigator.clipboard.writeText(scan.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const maxSeverity =
    critical > 0
      ? "Critical"
      : high > 0
        ? "High"
        : medium > 0
          ? "Medium"
          : low > 0
            ? "Low"
            : "Secure";
  const riskScore =
    total === 0
      ? 100
      : Math.max(0, 100 - (critical * 20 + high * 10 + medium * 5 + low * 1));

  return (
    <div className={styles.overviewContainer}>
      <div className={styles.statsRow}>
        <div className={`glass-panel ${styles.statCard}`}>
          <span className={styles.statLabel}>Total Findings</span>
          <span className={styles.statValue}>{total}</span>
        </div>
        <div
          className={`glass-panel ${styles.statCard} ${styles.statCritical}`}
        >
          <span className={styles.statLabel}>Critical Findings</span>
          <span className={styles.statValue}>{critical}</span>
        </div>
        <div className={`glass-panel ${styles.statCard} ${styles.statHigh}`}>
          <span className={styles.statLabel}>High Findings</span>
          <span className={styles.statValue}>{high}</span>
        </div>
        <div className={`glass-panel ${styles.statCard}`}>
          <span className={styles.statLabel}>Overall Risk Score</span>
          <span
            className={`${styles.statValue} ${riskScore < 50 ? styles.textDanger : riskScore < 80 ? styles.textWarning : styles.textSuccess}`}
          >
            {riskScore}/100
          </span>
        </div>
      </div>

      <div className={styles.overviewGrid}>
        <div className={`glass-panel ${styles.card}`}>
          <h3 className={styles.cardTitle}>Vulnerability Distribution</h3>
          {total === 0 ? (
            <div className={styles.emptyState}>
              No vulnerabilities detected.
            </div>
          ) : (
            <div className={styles.distributionBars}>
              <div className={styles.distRow}>
                <span className={styles.distLabel}>Critical</span>
                <div className={styles.distTrack}>
                  <div
                    className={`${styles.distFill} ${styles.bgCritical}`}
                    style={{ width: `${(critical / total) * 100}%` }}
                  ></div>
                </div>
                <span className={styles.distCount}>{critical}</span>
              </div>
              <div className={styles.distRow}>
                <span className={styles.distLabel}>High</span>
                <div className={styles.distTrack}>
                  <div
                    className={`${styles.distFill} ${styles.bgHigh}`}
                    style={{ width: `${(high / total) * 100}%` }}
                  ></div>
                </div>
                <span className={styles.distCount}>{high}</span>
              </div>
              <div className={styles.distRow}>
                <span className={styles.distLabel}>Medium</span>
                <div className={styles.distTrack}>
                  <div
                    className={`${styles.distFill} ${styles.bgMedium}`}
                    style={{ width: `${(medium / total) * 100}%` }}
                  ></div>
                </div>
                <span className={styles.distCount}>{medium}</span>
              </div>
              <div className={styles.distRow}>
                <span className={styles.distLabel}>Low</span>
                <div className={styles.distTrack}>
                  <div
                    className={`${styles.distFill} ${styles.bgLow}`}
                    style={{ width: `${(low / total) * 100}%` }}
                  ></div>
                </div>
                <span className={styles.distCount}>{low}</span>
              </div>
            </div>
          )}
        </div>

        <div className={`glass-panel ${styles.card}`}>
          <h3 className={styles.cardTitle}>Scan Metadata</h3>
          <div className={styles.metadataList}>
            <div className={styles.metaItem}>
              <span className={styles.metaKey}>Scan UUID (Run ID)</span>
              <span 
                className={styles.metaValue} 
                style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", color: "var(--brand)" }}
                onClick={handleCopyId}
                title="Click to copy UUID"
              >
                {scan.id}
                {copied ? <Check size={14} color="var(--sev-low)" /> : <Copy size={14} />}
              </span>
            </div>
            <div className={styles.metaItem}>
              <span className={styles.metaKey}>Target URL / Path</span>
              <span className={styles.metaValue}>{scan.target}</span>
            </div>
            <div className={styles.metaItem}>
              <span className={styles.metaKey}>LLM Model Engine</span>
              <span className={styles.metaValue}>{scan.llmModel}</span>
            </div>
            <div className={styles.metaItem}>
              <span className={styles.metaKey}>Scan Mode</span>
              <span
                className={styles.metaValue}
                style={{ textTransform: "capitalize" }}
              >
                {scan.scanMode}
              </span>
            </div>
            <div className={styles.metaItem}>
              <span className={styles.metaKey}>Execution Time</span>
              <span className={styles.metaValue}>{elapsed || "0s"}</span>
            </div>
            <div className={styles.metaItem}>
              <span className={styles.metaKey}>Current Status</span>
              <span
                className={styles.metaValue}
                style={{ textTransform: "capitalize" }}
              >
                {scan.status}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
