"use client";

import { useEffect, useState } from "react";
import { Download, FileText, CheckCircle2, XCircle, AlertCircle, Calendar, X, Search, FileSpreadsheet, Loader2, FileJson, FileCode, Code, File } from "lucide-react";
import { fetchScanDetails, generateJSON, generateCSV, generateMarkdown, generateHTML, generatePDF } from "@/lib/reportGenerator";
import { useDialog } from "@/components/DialogProvider";

interface Scan {
  id: string;
  target: string;
  status: string;
  vulnCount: number;
  startedAt: string;
  projectName?: string;
  scanMode?: string;
  llmModel?: string;
}

export default function Reports() {
  const [scans, setScans] = useState<Scan[]>([]);
  const [search, setSearch] = useState("");
  const [filterProject, setFilterProject] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedScan, setSelectedScan] = useState<Scan | null>(null);
  const { alert } = useDialog();

  useEffect(() => {
    fetch("/api/scans")
      .then((r) => r.json())
      .then((d) => {
        if (d.scans) {
          setScans(d.scans.filter((s: Scan) => ["completed", "stopped"].includes(s.status)));
        }
      });
  }, []);

  const projects = Array.from(new Set(scans.map(s => s.projectName || "Default"))).sort();

  const filteredScans = scans.filter((s) => {
    const q = search.toLowerCase();
    const targetMatch = s.target?.toLowerCase().includes(q);
    const pName = s.projectName || "Default";
    const projectMatch = pName.toLowerCase().includes(q);
    
    const matchesSearch = targetMatch || projectMatch;
    const matchesProject = filterProject === "all" || pName === filterProject;
    const matchesStatus = filterStatus === "all" || s.status === filterStatus;
    
    return matchesSearch && matchesProject && matchesStatus;
  });

  const [generating, setGenerating] = useState(false);

  const handleDownload = async (format: "json" | "csv" | "md" | "html" | "pdf") => {
    if (!selectedScan) return;
    setGenerating(true);
    const details = await fetchScanDetails(selectedScan.id);
    setGenerating(false);
    
    if (!details) {
      alert("Failed to fetch scan details for report generation.");
      return;
    }

    if (format === "json") generateJSON(details);
    else if (format === "csv") generateCSV(details);
    else if (format === "md") generateMarkdown(details);
    else if (format === "html") generateHTML(details);
    else if (format === "pdf") generatePDF(details);
  };

  return (
    <div className="page" style={{ maxWidth: "none", height: "100%" }}>
      <div className="page-intro" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 className="page-heading">Reports</h1>
          <p className="page-desc">Generate and download executive summaries for completed scans.</p>
        </div>
        
        {/* Filters */}
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ position: "relative", width: 220 }}>
            <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--fg-3)" }} />
            <input 
              type="text" 
              placeholder="Search target..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: "100%", padding: "9px 12px 9px 34px", background: "var(--bg-1)",
                border: "1px solid var(--border)", borderRadius: "var(--r)", color: "var(--fg)",
                fontSize: 13, fontFamily: "var(--font-sans)", outline: "none"
              }}
            />
          </div>
          
          <select 
            value={filterProject} 
            onChange={(e) => setFilterProject(e.target.value)}
            style={{ padding: "9px 12px", background: "var(--bg-1)", border: "1px solid var(--border)", borderRadius: "var(--r)", color: "var(--fg)", fontSize: 13, outline: "none", width: 160 }}
          >
            <option value="all">All Projects</option>
            {projects.map(p => <option key={p} value={p}>{p}</option>)}
          </select>

          <select 
            value={filterStatus} 
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{ padding: "9px 12px", background: "var(--bg-1)", border: "1px solid var(--border)", borderRadius: "var(--r)", color: "var(--fg)", fontSize: 13, outline: "none", width: 140 }}
          >
            <option value="all">All Statuses</option>
            <option value="completed">Completed</option>
            <option value="stopped">Stopped</option>
          </select>
        </div>
      </div>

      <div className="card" style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
        {/* Table header */}
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 2fr 1.5fr 1fr 80px 100px",
          gap: 12, padding: "10px 20px", borderBottom: "1px solid var(--border)",
          fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--fg-3)",
          background: "var(--bg-1)",
        }}>
          <div>Project</div>
          <div>Target</div>
          <div>Details</div>
          <div>Date</div>
          <div>Issues</div>
          <div></div>
        </div>

        {/* Rows */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {filteredScans.length === 0 ? (
            <div className="empty-state">
              <FileText size={36} style={{ opacity: 0.12 }} />
              <p>No completed scans found</p>
              <p style={{ fontSize: 12 }}>{search ? "No scans matched your search." : "Run a scan to completion to generate a report."}</p>
            </div>
          ) : (
            filteredScans.map((scan) => (
              <div
                key={scan.id}
                style={{
                  display: "grid", gridTemplateColumns: "1fr 2fr 1.5fr 1fr 80px 100px",
                  gap: 12, padding: "13px 20px", borderBottom: "1px solid var(--border)",
                  alignItems: "center", transition: "background var(--dur)",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-2)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "")}
              >
                <div style={{ fontSize: 13, fontWeight: 500, color: "var(--fg)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {scan.projectName || "Default"}
                </div>
                <div style={{ fontSize: 12, color: "var(--fg-3)", fontFamily: "var(--font-mono)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {scan.target}
                </div>
                <div style={{ fontSize: 11, color: "var(--fg-3)", display: "flex", flexDirection: "column", gap: 2 }}>
                  <span>{scan.scanMode ? scan.scanMode.charAt(0).toUpperCase() + scan.scanMode.slice(1) : "Standard"} Mode</span>
                  <span style={{ color: "var(--fg-2)" }}>{scan.llmModel || "Auto"}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--fg-3)" }}>
                  <Calendar size={12} />
                  {new Date(scan.startedAt).toLocaleDateString()}
                </div>
                <div>
                  {scan.vulnCount > 0 ? (
                    <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 7px", background: "var(--sev-critical-bg)", color: "var(--sev-critical)", border: "1px solid var(--sev-critical-bd)", borderRadius: "var(--r-sm)" }}>
                      {scan.vulnCount}
                    </span>
                  ) : (
                    <span style={{ fontSize: 12, color: "var(--fg-3)" }}>—</span>
                  )}
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button className="btn-secondary" onClick={() => setSelectedScan(scan)}>
                    <FileText size={12} /> Report
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Report Modal */}
      {selectedScan && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setSelectedScan(null)}>
          <div className="modal" style={{ maxWidth: 640 }}>
            <div className="modal-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <FileText size={16} style={{ color: "var(--fg-2)" }} />
                <span className="modal-title">Executive Summary</span>
              </div>
              <button
                onClick={() => setSelectedScan(null)}
                style={{ background: "none", border: "none", color: "var(--fg-3)", cursor: "pointer", display: "flex", padding: 4, borderRadius: "var(--r-sm)" }}
              >
                <X size={16} />
              </button>
            </div>

            <div className="modal-body">
              {/* 3 stat mini cards */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                {[
                  {
                    label: "Total Issues",
                    icon: <AlertCircle size={12} />,
                    value: <span style={{ fontSize: 28, fontWeight: 700, color: selectedScan.vulnCount > 0 ? "var(--sev-critical)" : "var(--fg)", letterSpacing: -1 }}>{selectedScan.vulnCount}</span>,
                  },
                  {
                    label: "Target",
                    value: <span style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--fg-2)", wordBreak: "break-all" }}>{selectedScan.target}</span>,
                  },
                  {
                    label: "Status",
                    value: selectedScan.status === "completed" ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 5, color: "var(--sev-low)", fontSize: 13, fontWeight: 600 }}>
                        <CheckCircle2 size={14} /> Completed
                      </div>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", gap: 5, color: "var(--fg-3)", fontSize: 13, fontWeight: 600 }}>
                        <XCircle size={14} /> {selectedScan.status}
                      </div>
                    ),
                  },
                ].map(({ label, icon, value }) => (
                  <div key={label} style={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: "var(--r)", padding: "12px 14px" }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--fg-3)", textTransform: "uppercase", letterSpacing: "0.5px", display: "flex", alignItems: "center", gap: 5, marginBottom: 8 }}>
                      {icon} {label}
                    </div>
                    {value}
                  </div>
                ))}
              </div>

              {/* Summary text */}
              <div style={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: "var(--r)", padding: "16px" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fg)", marginBottom: 8 }}>AI Analysis Summary</div>
                <p style={{ fontSize: 13, color: "var(--fg-2)", lineHeight: 1.7 }}>
                  Taipan Autonomous AI has successfully completed the penetration testing phase for the target environment.
                  During execution, the agent explored the exposed attack surface and identified{" "}
                  <strong style={{ color: "var(--fg)" }}>{selectedScan.vulnCount}</strong> potential security vulnerabilities.
                  Review individual findings in the Vulnerabilities tab for reproduction steps and mitigation strategies.
                </p>
              </div>
            </div>

            <div className="modal-footer" style={{ gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
              {generating && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--fg-3)", marginRight: "auto" }}>
                  <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> Generating...
                </div>
              )}
              <button className="btn-ghost" onClick={() => handleDownload("json")} disabled={generating}>
                <FileJson size={13} /> JSON
              </button>
              <button className="btn-ghost" onClick={() => handleDownload("csv")} disabled={generating}>
                <FileSpreadsheet size={13} /> CSV
              </button>
              <button className="btn-ghost" onClick={() => handleDownload("md")} disabled={generating}>
                <FileCode size={13} /> Markdown
              </button>
              <button className="btn-ghost" onClick={() => handleDownload("html")} disabled={generating}>
                <Code size={13} /> HTML
              </button>
              <button className="btn-primary" onClick={() => handleDownload("pdf")} disabled={generating} style={{ gap: 6 }}>
                <File size={13} /> Export PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
