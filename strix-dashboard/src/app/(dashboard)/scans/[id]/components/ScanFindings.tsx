import { useState } from "react";
import { ScanDetail, Vulnerability } from "../types";
import { SeverityBadge } from "./SeverityBadge";
import styles from "../detail.module.css";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/cjs/styles/prism";
import { Copy, Check } from "lucide-react";

const CodeBlock = ({ node, inline, className, children, ...props }: any) => {
  const [copied, setCopied] = useState(false);
  const match = /language-(\w+)/.exec(className || "");
  const lang = match ? match[1] : "text";
  const codeString = String(children).replace(/\n$/, "");

  const handleCopy = () => {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(codeString);
    } else {
      // Fallback for non-HTTPS environments
      const textArea = document.createElement("textarea");
      textArea.value = codeString;
      textArea.style.position = "absolute";
      textArea.style.left = "-999999px";
      document.body.prepend(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
      } catch (error) {
        console.error(error);
      } finally {
        textArea.remove();
      }
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!inline) {
    return (
      <div style={{ position: "relative", marginTop: "12px", marginBottom: "12px", borderRadius: "8px", overflow: "hidden", border: "1px solid #333" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#1a1a1a", padding: "6px 12px", borderBottom: "1px solid #333" }}>
          <span style={{ fontSize: "12px", color: "#888", fontFamily: "monospace", textTransform: "uppercase" }}>{lang}</span>
          <button 
            onClick={handleCopy}
            style={{ display: "flex", alignItems: "center", gap: "6px", background: "none", border: "none", color: copied ? "#4caf50" : "#aaa", cursor: "pointer", fontSize: "12px" }}
            title="Copy code"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
        <SyntaxHighlighter
          style={vscDarkPlus as any}
          language={lang}
          PreTag="div"
          customStyle={{ margin: 0, padding: "16px", background: "#0d0d0d", fontSize: "13px" }}
          {...props}
        >
          {codeString}
        </SyntaxHighlighter>
      </div>
    );
  }
  return (
    <code className={className} style={{ background: "rgba(255,255,255,0.1)", padding: "2px 4px", borderRadius: "4px", fontFamily: "monospace" }} {...props}>
      {children}
    </code>
  );
};

export default function ScanFindings({ scan, vulns }: { scan: ScanDetail, vulns: Vulnerability[] }) {
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
                const bgMap = {
                  critical: styles.rowCritical,
                  high: styles.rowHigh,
                  medium: styles.rowMedium,
                  low: styles.rowLow,
                  informative: styles.rowInformative,
                };
                const rowClass = bgMap[v.severity] || styles.rowLow;
                
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
              <p>{selectedVuln.description}</p>
            </section>

            <section className={styles.pocSection}>
              <h3>Proof of Concept (PoC)</h3>
              {selectedVuln.poc || selectedVuln.poc_description || selectedVuln.poc_script_code ? (
                <>
                  {selectedVuln.poc_description && (
                    <p style={{ marginBottom: '12px' }}>{selectedVuln.poc_description}</p>
                  )}
                  {selectedVuln.poc_script_code && (
                    <ReactMarkdown components={{ code: CodeBlock }}>
                      {selectedVuln.poc_script_code}
                    </ReactMarkdown>
                  )}
                  {selectedVuln.poc && !selectedVuln.poc_script_code && (
                    <ReactMarkdown components={{ code: CodeBlock }}>
                      {selectedVuln.poc.includes("```") ? selectedVuln.poc : `\`\`\`text\n${selectedVuln.poc}\n\`\`\``}
                    </ReactMarkdown>
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
