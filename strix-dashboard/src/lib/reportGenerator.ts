import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface Vulnerability {
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
    return await res.json();
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
    const order = { critical: 0, high: 1, medium: 2, low: 3 };
    return (order[a.severity] ?? 99) - (order[b.severity] ?? 99);
  }).forEach(v => {
    md += `| **${v.severity.toUpperCase()}** | ${v.title} | \`${v.method || "GET"} ${v.endpoint}\` |\n`;
  });

  md += `\n## Detailed Findings\n\n`;
  vulnerabilities.forEach((v, idx) => {
    md += `### ${idx + 1}. [${v.severity.toUpperCase()}] ${v.title}\n\n`;
    md += `**Endpoint:** \`${v.method || "GET"} ${v.endpoint}\`\n`;
    if (v.cvss) md += `**CVSS Score:** ${v.cvss}\n`;
    md += `\n**Description:**\n${v.description}\n\n`;
    if (v.remediation) {
      md += `**Remediation:**\n${v.remediation}\n\n`;
    }
    if (v.poc) {
      md += `**Proof of Concept:**\n\`\`\`text\n${v.poc}\n\`\`\`\n\n`;
    }
    md += `---\n\n`;
  });

  downloadFile(md, "text/markdown", `strix-report-${details.scan.id}.md`);
}

export function generateHTML(details: ScanDetails) {
  const { scan, vulnerabilities } = details;
  const date = new Date(scan.startedAt).toLocaleString();
  
  const vulnsHtml = vulnerabilities.sort((a, b) => {
    const order = { critical: 0, high: 1, medium: 2, low: 3 };
    return (order[a.severity] ?? 99) - (order[b.severity] ?? 99);
  }).map((v, i) => `
    <div class="vuln-card sev-${v.severity}">
      <div class="vuln-header">
        <h3>${i + 1}. ${v.title}</h3>
        <span class="badge sev-${v.severity}">${v.severity.toUpperCase()}</span>
      </div>
      <p><strong>Endpoint:</strong> <code>${v.method || 'GET'} ${v.endpoint}</code></p>
      ${v.cvss ? `<p><strong>CVSS:</strong> ${v.cvss}</p>` : ''}
      <h4>Description</h4>
      <p>${v.description.replace(/\\n/g, '<br>')}</p>
      ${v.remediation ? `<h4>Remediation</h4><p>${v.remediation.replace(/\\n/g, '<br>')}</p>` : ''}
      ${v.poc ? `<h4>Proof of Concept</h4><pre><code>${v.poc.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>` : ''}
    </div>
  `).join('');

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Strix Security Report - ${scan.target}</title>
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
    <p>Target: <strong>${scan.target}</strong></p>
  </div>
  <div class="meta">
    <div>
      <p><strong>Project:</strong> ${scan.projectName || 'Default'}</p>
      <p><strong>Date:</strong> ${date}</p>
    </div>
    <div>
      <p><strong>Total Findings:</strong> ${scan.vulnCount}</p>
      <p><strong>Mode/Model:</strong> ${scan.scanMode} - ${scan.llmModel.split('/').pop()}</p>
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
  doc.text(`Generated by Strix Security`, 14, 30);
  
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
    const order = { critical: 0, high: 1, medium: 2, low: 3 };
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
      doc.text(`${i + 1}. [${v.severity.toUpperCase()}] ${v.title}`, 14, y);
      y += 8;
      
      doc.setFontSize(10);
      doc.setTextColor(80);
      doc.text(`Endpoint: ${v.method || 'GET'} ${v.endpoint}`, 14, y);
      y += 6;
      if (v.cvss) {
        doc.text(`CVSS: ${v.cvss}`, 14, y);
        y += 6;
      }
      
      doc.setTextColor(40);
      y += 4;
      const descLines = doc.splitTextToSize(`Description: ${v.description.substring(0, 300)}${v.description.length > 300 ? '...' : ''}`, 180);
      doc.text(descLines, 14, y);
      y += descLines.length * 5 + 10;
    });
  }
  
  doc.save(`strix-report-${scan.id}.pdf`);
}
