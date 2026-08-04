import { useState } from "react";
import { Vulnerability } from "../types";
import { SeverityBadge } from "./SeverityBadge";
import styles from "../detail.module.css";

export default function ScanFindings({ vulns }: { vulns: Vulnerability[] }) {
  const [selectedVuln, setSelectedVuln] = useState<Vulnerability | null>(null);

  return (
    <div className={styles.findingsContainer}>
      <div className={`glass-panel ${styles.findingsTableWrapper}`}>
        {vulns.length === 0 ? (
          <div className={styles.emptyState}>No vulnerabilities found yet.</div>
        ) : (
          <table className={styles.findingsTable}>
            <thead>
              <tr>
                <th>Severity</th>
                <th>Title</th>
                <th>Endpoint</th>
                <th>Method</th>
                <th>CVSS</th>
              </tr>
            </thead>
            <tbody>
              {vulns.map((v) => {
                const rowClass = {
                  critical: styles.rowCritical,
                  high: styles.rowHigh,
                  medium: styles.rowMedium,
                  low: styles.rowLow,
                }[v.severity] || styles.rowLow;
                
                return (
                <tr
                  key={v.id}
                  className={`${styles.findingsRow} ${rowClass} ${selectedVuln?.id === v.id ? styles.findingsRowActive : ""}`}
                  onClick={() =>
                    setSelectedVuln(selectedVuln?.id === v.id ? null : v)
                  }
                >
                  <td>
                    <SeverityBadge s={v.severity} />
                  </td>
                  <td className={styles.vulnTitleCell}>{v.title}</td>
                  <td className={styles.codeCell}>{v.endpoint}</td>
                  <td>
                    <span className={styles.methodTag}>
                      {v.method ?? "GET"}
                    </span>
                  </td>
                  <td>
                    {v.cvss ? (
                      <span className={styles.cvssScore}>CVSS {v.cvss}</span>
                    ) : (
                      "-"
                    )}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Right Drawer for PoC details */}
      <div
        className={`glass-panel ${styles.pocDrawer} ${selectedVuln ? styles.pocDrawerOpen : ""}`}
        style={selectedVuln ? { borderLeft: `2px solid var(--sev-${selectedVuln.severity})` } : {}}
      >
        {selectedVuln ? (
          <div className={styles.pocContent}>
            <div className={styles.pocHeader}>
              <SeverityBadge s={selectedVuln.severity} />
              {selectedVuln.cvss && (
                <span className={styles.cvssScore}>
                  CVSS {selectedVuln.cvss}
                </span>
              )}
              <button
                className={styles.closePoC}
                onClick={() => setSelectedVuln(null)}
              >
                ✕
              </button>
            </div>
            <h2 className={styles.pocTitle}>{selectedVuln.title}</h2>

            <div className={styles.pocEndpoint}>
              <span className={styles.methodTag}>
                {selectedVuln.method ?? "GET"}
              </span>
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
                  <p>{selectedVuln.remediation}</p>
                </div>
              </section>
            )}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <p>Select a vulnerability to view details</p>
          </div>
        )}
      </div>
    </div>
  );
}
