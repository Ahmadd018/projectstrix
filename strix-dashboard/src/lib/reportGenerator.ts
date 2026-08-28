import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface Vulnerability {
  id: string;
  title: string;
  severity: "critical" | "high" | "medium" | "low" | "info" | "informative";
  endpoint: string;
  method?: string;
  description: string;
  impact?: string;
  target?: string;
  technical_analysis?: string;
  poc_description?: string;
  poc_script_code?: string;
  remediation_steps?: string;
  evidence?: string;
  assumptions?: string;
  fix_effort?: string;
  cvss?: number;
  cvss_breakdown?: any;
  cwe?: string;
  finding_class?: string;
  agent_id?: string;
  agent_name?: string;
}

export interface ScanDetails {
  scan: {
    id: string;
    target: string;
    status: string;
    vulnCount: number;
    startedAt: string;
    finishedAt?: string;
    projectName?: string;
    scanMode: string;
    llmModel: string;
  };
  vulnerabilities: Vulnerability[];
}

export async function fetchScanDetails(id: string): Promise<ScanDetails | null> {
  try {
    const res = await fetch(`/api/scans/${id}`);
    if (!res.ok) return null;
    const data = await res.json();
    
    const { vulnerabilities, ...scan } = data;
    return { scan: scan as any, vulnerabilities: vulnerabilities || [] };
  } catch {
    return null;
  }
}

function downloadFile(content: string, type: string, filename: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function generateJSON(details: ScanDetails) {
  downloadFile(
    JSON.stringify(details, null, 2),
    "application/json",
    `strix-report-${details.scan.id}.json`
  );
}

export function generateCSV(details: ScanDetails) {
  const headers = ["ID", "Severity", "Title", "Method", "Endpoint", "CVSS"];
  const rows = details.vulnerabilities.map((v) => [
    v.id,
    v.severity.toUpperCase(),
    `"${v.title.replace(/"/g, '""')}"`,
    v.method || "GET",
    `"${v.endpoint.replace(/"/g, '""')}"`,
    v.cvss || "",
  ]);

  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  downloadFile(csv, "text/csv", `strix-report-${details.scan.id}.csv`);
}

export function generateMarkdown(details: ScanDetails) {
  const { scan, vulnerabilities } = details;
  const project = scan.projectName || "Default Project";
  const date = new Date(scan.startedAt).toLocaleString();

  let md = `# Security Scan Report: ${project}\n\n`;
  md += `**Target:** ${scan.target}\n`;
  md += `**Scan ID:** ${scan.id}\n`;
  md += `**Date:** ${date}\n`;
  md += `**Mode:** ${scan.scanMode} | **Model:** ${scan.llmModel}\n`;
  md += `**Total Vulnerabilities:** ${scan.vulnCount}\n\n`;

  md += `## Findings Summary\n\n`;
  md += `| Severity | Title | Endpoint |\n`;
  md += `|----------|-------|----------|\n`;
  
  vulnerabilities.sort((a, b) => {
    const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, informative: 4, info: 4 };
    return (order[a.severity] ?? 99) - (order[b.severity] ?? 99);
  }).forEach(v => {
    md += `| **${v.severity.toUpperCase()}** | ${v.title} | \`${v.method || "GET"} ${v.endpoint}\` |\n`;
  });

  md += `\n## Detailed Findings\n\n`;
  vulnerabilities.forEach((v, idx) => {
    md += `### ${idx + 1}. [${v.severity.toUpperCase()}] ${v.title}\n\n`;
    md += `**Endpoint:** \`${v.method || "GET"} ${v.endpoint}\`\n`;
    if (v.cvss) md += `**CVSS Score:** ${v.cvss}\n`;
    if (v.cwe) md += `**CWE:** ${v.cwe}\n`;
    if (v.fix_effort) md += `**Fix Effort:** ${v.fix_effort}\n`;
    md += `\n**Description:**\n${v.description}\n\n`;
    if (v.impact) md += `**Impact:**\n${v.impact}\n\n`;
    if (v.technical_analysis) md += `**Technical Analysis:**\n${v.technical_analysis}\n\n`;
    if (v.poc_description) md += `**PoC Description:**\n${v.poc_description}\n\n`;
    if (v.poc_script_code) md += `**PoC Script / Code:**\n${v.poc_script_code}\n\n`;
    if (v.evidence) md += `**Evidence:**\n${v.evidence}\n\n`;
    if (v.remediation_steps) md += `**Remediation Steps:**\n${v.remediation_steps}\n\n`;
    if (v.assumptions) md += `**Assumptions:**\n${v.assumptions}\n\n`;
    md += `---\n\n`;
  });

  downloadFile(md, "text/markdown", `strix-report-${details.scan.id}.md`);
}

export function generateHTML(details: ScanDetails) {
  const { scan, vulnerabilities } = details;
  const date = new Date(scan.startedAt).toLocaleString();

  // M-4: escape every interpolated field. Vulnerability content is derived from
  // target-influenced agent output, so raw HTML here is a stored/exported XSS sink.
  const esc = (s: unknown = "") =>
    String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  const nl = (s: unknown = "") => esc(s).replace(/\r?\n|\\n/g, "<br>");

  const vulnsHtml = vulnerabilities.sort((a, b) => {
    const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, informative: 4, info: 4 };
    return (order[a.severity] ?? 99) - (order[b.severity] ?? 99);
  }).map((v, i) => `
    <div class="vuln-card sev-${esc(v.severity)}">
      <div class="vuln-header">
        <h3>${i + 1}. ${esc(v.title)}</h3>
        <span class="badge sev-${esc(v.severity)}">${esc(v.severity.toUpperCase())}</span>
      </div>
      <p><strong>Endpoint:</strong> <code>${esc(v.method || 'GET')} ${esc(v.endpoint)}</code></p>
      ${v.cvss ? `<p><strong>CVSS:</strong> ${esc(v.cvss)}</p>` : ''}
      ${v.cwe ? `<p><strong>CWE:</strong> ${esc(v.cwe)}</p>` : ''}
      ${v.fix_effort ? `<p><strong>Fix Effort:</strong> ${esc(v.fix_effort)}</p>` : ''}
      <h4>Description</h4>
      <p>${nl(v.description)}</p>
      ${v.impact ? `<h4>Impact</h4><p>${nl(v.impact)}</p>` : ''}
      ${v.technical_analysis ? `<h4>Technical Analysis</h4><p>${nl(v.technical_analysis)}</p>` : ''}
      ${v.poc_description ? `<h4>PoC Description</h4><p>${nl(v.poc_description)}</p>` : ''}
      ${v.poc_script_code ? `<h4>PoC Script / Code</h4><pre><code>${esc(v.poc_script_code)}</code></pre>` : ''}
      ${v.evidence ? `<h4>Evidence</h4><pre><code>${esc(v.evidence)}</code></pre>` : ''}
      ${v.remediation_steps ? `<h4>Remediation Steps</h4><p>${nl(v.remediation_steps)}</p>` : ''}
      ${v.assumptions ? `<h4>Assumptions</h4><p>${nl(v.assumptions)}</p>` : ''}
    </div>
  `).join('');

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Taipan Security Report - ${esc(scan.target)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 900px; margin: 0 auto; padding: 40px 20px; background: #f9f9f9; }
    .header { text-align: center; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 2px solid #eaeaea; }
    h1 { margin: 0 0 10px 0; color: #111; }
    .meta { display: flex; justify-content: space-between; background: #fff; padding: 20px; border-radius: 8px; border: 1px solid #eaeaea; margin-bottom: 40px; }
    .meta div { flex: 1; }
    .vuln-card { background: #fff; border: 1px solid #eaeaea; border-left: 4px solid #ccc; border-radius: 8px; padding: 24px; margin-bottom: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.02); }
    .vuln-card.sev-critical { border-left-color: #ff3b3b; }
    .vuln-card.sev-high { border-left-color: #ff9800; }
    .vuln-card.sev-medium { border-left-color: #fbc02d; }
    .vuln-card.sev-low { border-left-color: #4caf50; }
    .vuln-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid #eaeaea; padding-bottom: 12px; margin-bottom: 16px; }
    .vuln-header h3 { margin: 0; color: #111; font-size: 1.2rem; }
    .badge { padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: bold; color: #fff; }
    .badge.sev-critical { background: #ff3b3b; }
    .badge.sev-high { background: #ff9800; }
    .badge.sev-medium { background: #fbc02d; }
    .badge.sev-low { background: #4caf50; }
    h4 { margin: 16px 0 8px 0; color: #444; }
    p { margin: 0 0 12px 0; }
    pre { background: #f4f4f4; padding: 12px; border-radius: 6px; overflow-x: auto; font-family: 'Courier New', Courier, monospace; font-size: 0.9rem; border: 1px solid #ddd; }
    code { font-family: 'Courier New', Courier, monospace; font-size: 0.9rem; background: #f4f4f4; padding: 2px 4px; border-radius: 4px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Security Scan Report</h1>
    <p>Target: <strong>${esc(scan.target)}</strong></p>
  </div>
  <div class="meta">
    <div>
      <p><strong>Project:</strong> ${esc(scan.projectName || 'Default')}</p>
      <p><strong>Date:</strong> ${esc(date)}</p>
    </div>
    <div>
      <p><strong>Total Findings:</strong> ${esc(scan.vulnCount)}</p>
      <p><strong>Mode/Model:</strong> ${esc(scan.scanMode)} - ${esc(scan.llmModel.split('/').pop())}</p>
    </div>
  </div>
  <h2>Detailed Findings</h2>
  ${vulnsHtml || '<p>No vulnerabilities found.</p>'}
</body>
</html>
  `;
  downloadFile(html, "text/html", `strix-report-${details.scan.id}.html`);
}

export function generatePDF(details: ScanDetails) {
  const { scan, vulnerabilities } = details;
  const doc = new jsPDF();
  
  // Header
  doc.setFontSize(22);
  doc.text("Security Scan Report", 14, 22);
  
  doc.setFontSize(11);
  doc.setTextColor(100);
  doc.text(`Generated by Taipan Security`, 14, 30);
  
  // Metadata
  doc.setTextColor(0);
  doc.setFontSize(12);
  doc.text(`Target: ${scan.target}`, 14, 45);
  doc.text(`Project: ${scan.projectName || "Default"}`, 14, 52);
  doc.text(`Date: ${new Date(scan.startedAt).toLocaleString()}`, 14, 59);
  doc.text(`Mode: ${scan.scanMode}`, 120, 45);
  doc.text(`Model: ${scan.llmModel}`, 120, 52);
  doc.text(`Total Findings: ${scan.vulnCount}`, 120, 59);
  
  // Findings Table
  doc.setFontSize(16);
  doc.text("Findings Summary", 14, 75);
  
  const sortedVulns = vulnerabilities.sort((a, b) => {
    const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, informative: 4, info: 4 };
    return (order[a.severity] ?? 99) - (order[b.severity] ?? 99);
  });

  autoTable(doc, {
    startY: 80,
    head: [["Severity", "Title", "Endpoint", "CVSS"]],
    body: sortedVulns.map(v => [
      v.severity.toUpperCase(),
      v.title,
      `${v.method || 'GET'} ${v.endpoint}`,
      v.cvss || "-"
    ]),
    headStyles: { fillColor: [41, 41, 41] },
    willDrawCell: function(data) {
      if (data.section === 'body' && data.column.index === 0) {
        const sev = data.cell.raw;
        if (sev === "CRITICAL") data.cell.styles.textColor = [255, 59, 59];
        if (sev === "HIGH") data.cell.styles.textColor = [255, 152, 0];
        if (sev === "MEDIUM") data.cell.styles.textColor = [251, 192, 45];
        if (sev === "LOW") data.cell.styles.textColor = [76, 175, 80];
        data.cell.styles.fontStyle = 'bold';
      }
    }
  });
  
  // Detailed findings
  let finalY = (doc as any).lastAutoTable.finalY || 80;
  
  if (sortedVulns.length > 0) {
    doc.addPage();
    doc.setFontSize(18);
    doc.text("Detailed Findings", 14, 22);
    let y = 35;
    
    sortedVulns.forEach((v, i) => {
      if (y > 250) {
        doc.addPage();
        y = 20;
      }
      
      doc.setFontSize(14);
      doc.setTextColor(0);
      doc.setFont("helvetica", "bold");
      doc.text(`${i + 1}. [${v.severity.toUpperCase()}] ${v.title}`, 14, y);
      y += 8;
      
      doc.setFontSize(10);
      doc.setTextColor(80);
      doc.setFont("helvetica", "normal");
      doc.text(`Endpoint: ${v.method || 'GET'} ${v.endpoint}`, 14, y);
      y += 6;
      if (v.cvss) { doc.text(`CVSS: ${v.cvss}`, 14, y); y += 6; }
      if (v.cwe) { doc.text(`CWE: ${v.cwe}`, 14, y); y += 6; }
      if (v.fix_effort) { doc.text(`Fix Effort: ${v.fix_effort}`, 14, y); y += 6; }
      y += 2;
      
      const addSection = (title: string, content: string | undefined) => {
        if (!content) return;
        if (y > 270) { doc.addPage(); y = 20; }
        doc.setFontSize(10);
        doc.setTextColor(0);
        doc.setFont("helvetica", "bold");
        doc.text(title, 14, y);
        y += 5;
        
        doc.setFontSize(9);
        doc.setTextColor(40);
        doc.setFont("helvetica", "normal");
        const textToSplit = content.substring(0, 10000); // safety bound
        const lines = doc.splitTextToSize(textToSplit, 180);
        
        lines.forEach((line: string) => {
            if (y > 280) { doc.addPage(); y = 20; }
            doc.text(line, 14, y);
            y += 4;
        });
        y += 4;
      };

      addSection("Description:", v.description);
      addSection("Impact:", v.impact);
      addSection("Technical Analysis:", v.technical_analysis);
      addSection("PoC Description:", v.poc_description);
      addSection("PoC Script / Code:", v.poc_script_code);
      addSection("Remediation Steps:", v.remediation_steps);
      addSection("Evidence:", v.evidence);
      addSection("Assumptions:", v.assumptions);
    });
  }
  
  doc.save(`strix-report-${scan.id}.pdf`);
}
