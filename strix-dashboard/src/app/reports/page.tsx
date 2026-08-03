"use client";

import { useEffect, useState } from "react";
import styles from "./reports.module.css";

interface Scan {
  id: string;
  target: string;
  status: string;
  vulnCount: number;
  startedAt: string;
  projectName?: string;
}

export default function Reports() {
  const [scans, setScans] = useState<Scan[]>([]);
  const [selectedScan, setSelectedScan] = useState<Scan | null>(null);

  useEffect(() => {
    fetch("/api/scans")
      .then(r => r.json())
      .then(d => {
        if (d.scans) {
          const completed = d.scans.filter((s: Scan) => ["completed", "stopped"].includes(s.status));
          setScans(completed);
        }
      });
  }, []);

  const handleDownload = () => {
    if (!selectedScan) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(selectedScan, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `report-${selectedScan.id}.json`);
    dlAnchorElem.click();
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Scan Reports</h1>
        <p className={styles.subtitle}>
          Generate and download executive summaries for completed scans.
        </p>
      </div>

      <div className={styles.tableCard}>
        {scans.length > 0 ? (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Project</th>
                <th>Target</th>
                <th>Date</th>
                <th>Vulnerabilities</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {scans.map(scan => (
                <tr key={scan.id} className={styles.row}>
                  <td>{scan.projectName || "Default"}</td>
                  <td className={styles.targetCell}>{scan.target}</td>
                  <td>{new Date(scan.startedAt).toLocaleDateString()}</td>
                  <td>{scan.vulnCount} issues</td>
                  <td>
                    <button 
                      className={styles.actionBtn}
                      onClick={() => setSelectedScan(scan)}
                    >
                      Generate Report
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className={styles.emptyState}>
            <h3>No Completed Scans Found</h3>
            <p>Run a scan to completion to generate a report.</p>
          </div>
        )}
      </div>

      {selectedScan && (
        <div className={styles.overlay} onClick={() => setSelectedScan(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Executive Summary</h2>
              <button className={styles.closeBtn} onClick={() => setSelectedScan(null)} />
            </div>
            
            <div className={styles.modalBody}>
              <div className={styles.statGrid}>
                <div className={styles.statCard}>
                  <div className={styles.statLabel}>Total Issues</div>
                  <div className={`${styles.statValue} ${selectedScan.vulnCount > 0 ? styles.valDanger : styles.valSuccess}`}>
                    {selectedScan.vulnCount}
                  </div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statLabel}>Target</div>
                  <div className={styles.statValue} style={{fontSize: "1rem", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", height: "30px"}}>
                    {selectedScan.target}
                  </div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statLabel}>Status</div>
                  <div className={styles.statValue} style={{fontSize: "1.2rem", color: "var(--text-secondary)", display: "flex", alignItems: "center", justifyContent: "center", height: "30px", textTransform: "capitalize"}}>
                    {selectedScan.status}
                  </div>
                </div>
              </div>

              <div className={styles.reportSection}>
                <h3>AI Analysis Summary</h3>
                <p>
                  Strix Autonomous AI has successfully completed the penetration testing phase for the target environment. 
                  During the execution, the agent explored the exposed attack surface and identified {selectedScan.vulnCount} potential security vulnerabilities. 
                  It is recommended to review the individual findings in the Vulnerabilities tab for detailed reproduction steps and mitigation strategies.
                </p>
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button className={styles.secondaryBtn} onClick={handleDownload}>Download JSON</button>
              <button className={styles.primaryBtn} onClick={() => alert("PDF Export is a mock feature.")}>Export PDF</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
