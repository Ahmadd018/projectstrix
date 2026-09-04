import { useState } from "react";
import { ScanDetail, Vulnerability } from "../types";
import { SeverityBadge } from "./SeverityBadge";
import styles from "../detail.module.css";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { Ticket, ShieldOff, Copy, X } from "lucide-react";
import { JiraReportModal, JiraVuln } from "@/components/JiraReportModal";
import { FpInstructionModal } from "@/components/FpInstructionModal";
import { buildFpInstruction } from "@/lib/fpInstruction";

export default function ScanFindings({ scan, vulns }: { scan: ScanDetail, vulns: Vulnerability[] }) {
  const [selectedVuln, setSelectedVuln] = useState<Vulnerability | null>(null);
  // Local overrides so the badge/buttons update immediately after an action,
  // without waiting for the next poll of the scan detail.
  const [statusOverrides, setStatusOverrides] = useState<Record<string, string>>({});
  const [fpText, setFpText] = useState<string | null>(null);
  const [jiraVuln, setJiraVuln] = useState<JiraVuln | null>(null);

  function effectiveStatus(v: Vulnerability): string {
    return (statusOverrides[v.id] || v.status || "OPEN").toUpperCase();
  }

  function fpInput(v: Vulnerability) {
    return {
      title: v.title,
      severity: v.severity,
      endpoint: v.endpoint,
      method: v.method,
      description: v.description,
      poc: v.poc,
      poc_description: v.poc_description,
      poc_script_code: v.poc_script_code,
      cvss: v.cvss,
      target: v.target || scan.target,
    };
  }

  async function setFpStatus(v: Vulnerability, isFp: boolean) {
    const status = isFp ? "FALSE_POSITIVE" : "OPEN";
    setStatusOverrides((prev) => ({ ...prev, [v.id]: status }));
    if (!v.dbId) return; // Not yet synced to DB — badge still updates locally.
    try {
      await fetch("/api/vulnerabilities/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vulnId: v.dbId, status }),
      });
      if (isFp) {
        // Also record it in the target domain's FP instructions (md file).
        await fetch("/api/fp-instructions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ vulnId: v.dbId }),
        });
      } else {
        // Unmarking — remove the FP instruction file for this finding.
        await fetch("/api/fp-instructions", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ vulnId: v.dbId }),
        });
      }
    } catch {
      /* keep optimistic UI; next poll reconciles */
    }
  }

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
                const bgMap = {
                  critical: styles.rowCritical,
                  high: styles.rowHigh,
                  medium: styles.rowMedium,
                  low: styles.rowLow,
                  informative: styles.rowInformative,
                  info: styles.rowInformative,
                } as Record<string, string>;
                const normalizedSev = v.severity.toLowerCase() === "info" ? "informative" : v.severity.toLowerCase();
                const rowClass = bgMap[normalizedSev] || styles.rowLow;
                const isFp = effectiveStatus(v) === "FALSE_POSITIVE";

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
                  <td className={styles.vulnTitleCell}>
                    {v.title}
                    {isFp && (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 9, fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", color: "#888", border: "1px solid #333", borderRadius: 4, padding: "1px 5px", marginLeft: 8, verticalAlign: "middle" }}>
                        <ShieldOff size={9} /> False positive
                      </span>
                    )}
                  </td>
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
              {effectiveStatus(selectedVuln) === "FALSE_POSITIVE" && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", color: "#aaa", border: "1px solid #444", borderRadius: 4, padding: "2px 6px" }}>
                  <ShieldOff size={10} /> False positive
                </span>
              )}
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

            <div className={styles.pocEndpoint} style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px', color: '#888', textTransform: 'uppercase' }}>Target Domain:</span>
                <span style={{ color: '#e5e5e5', fontFamily: 'monospace' }}>{selectedVuln.target || scan.target}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
                <span className={styles.methodTag}>
                  {selectedVuln.method ?? "GET"}
                </span>
                <code style={{ wordBreak: 'break-all' }}>{selectedVuln.endpoint}</code>
              </div>
            </div>

            <section className={styles.pocSection}>
              <h3>Description</h3>
              <MarkdownRenderer content={selectedVuln.description} />
            </section>

            <section className={styles.pocSection}>
              <h3>Proof of Concept (PoC)</h3>
              {selectedVuln.poc || selectedVuln.poc_description || selectedVuln.poc_script_code ? (
                <>
                  {selectedVuln.poc_description && (
                    <MarkdownRenderer content={selectedVuln.poc_description} />
                  )}
                  {selectedVuln.poc_script_code && (
                    <MarkdownRenderer content={selectedVuln.poc_script_code} />
                  )}
                  {selectedVuln.poc && !selectedVuln.poc_script_code && (
                    <MarkdownRenderer content={selectedVuln.poc.includes("```") ? selectedVuln.poc : `\`\`\`text\n${selectedVuln.poc}\n\`\`\``} />
                  )}
                </>
              ) : (
                <div style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', border: '1px dashed #333', borderRadius: '8px', color: '#888', fontSize: '13px' }}>
                  No automated PoC snippet was recorded for this specific finding. Check the Raw Artifacts or Logs for full exploitation steps.
                </div>
              )}
            </section>

            {selectedVuln.remediation && (
              <section className={styles.pocSection}>
                <h3>Remediation</h3>
                  <MarkdownRenderer content={selectedVuln.remediation} />
              </section>
            )}

            {/* Actions: report to Jira (true positive) / mark false positive */}
            <div style={{ borderTop: "1px solid var(--border, #333)", paddingTop: 16, marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
              <button
                className="btn-primary"
                disabled={!selectedVuln.dbId}
                onClick={() => selectedVuln.dbId && setJiraVuln({ id: selectedVuln.dbId, title: selectedVuln.title, severity: selectedVuln.severity })}
                style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", justifyContent: "center", opacity: selectedVuln.dbId ? 1 : 0.5, cursor: selectedVuln.dbId ? "pointer" : "not-allowed" }}
              >
                <Ticket size={14} />
                Report to Jira
              </button>
              {effectiveStatus(selectedVuln) === "FALSE_POSITIVE" ? (
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    className="btn-secondary"
                    onClick={() => setFpText(buildFpInstruction(fpInput(selectedVuln)))}
                    style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, justifyContent: "center" }}
                  >
                    <Copy size={14} /> Copy FP instruction
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={() => setFpStatus(selectedVuln, false)}
                    style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}
                  >
                    <X size={14} /> Unmark
                  </button>
                </div>
              ) : (
                <button
                  className="btn-secondary"
                  onClick={() => { setFpText(buildFpInstruction(fpInput(selectedVuln))); setFpStatus(selectedVuln, true); }}
                  style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", justifyContent: "center" }}
                >
                  <ShieldOff size={14} />
                  Mark as false positive
                </button>
              )}
              <p style={{ fontSize: 11, color: "#888", marginTop: 2, lineHeight: 1.5 }}>
                {selectedVuln.dbId
                  ? "Report a confirmed finding as a Jira issue, or mark it a false positive (tags it, saves an FP instruction for this domain, and auto-applies it to future scans)."
                  : "Triage actions become available once this finding is synced (a moment after it is discovered, or when the scan completes)."}
              </p>
            </div>
          </div>
        ) : (
          <div className={styles.emptyState}>
            <p>Select a vulnerability to view details</p>
          </div>
        )}
      </div>

      <FpInstructionModal text={fpText} onClose={() => setFpText(null)} />
      <JiraReportModal vuln={jiraVuln} onClose={() => setJiraVuln(null)} />
    </div>
  );
}
