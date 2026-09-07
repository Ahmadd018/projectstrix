"use client";

import { useEffect, useState, useCallback } from "react";
import { ShieldOff, Loader2, Trash2, Globe, FileText, Pencil, Save, X } from "lucide-react";
import { useDialog } from "@/components/DialogProvider";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";

interface FpDomain {
  domain: string;
  host: string;
  entryCount: number;
  size: number;
  updatedAt: string;
}

interface FpFinding {
  id: string;
  title: string;
  content: string;
  updatedAt: string;
}

export default function FpInstructionsPage() {
  const [domains, setDomains] = useState<FpDomain[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [findings, setFindings] = useState<FpFinding[]>([]);
  const [findingsLoading, setFindingsLoading] = useState(false);
  const { confirm, alert } = useDialog();

  // Inline edit of a single finding's markdown content.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  function startEdit(finding: FpFinding) {
    setEditingId(finding.id);
    setEditContent(finding.content);
  }
  function cancelEdit() {
    setEditingId(null);
    setEditContent("");
  }
  async function saveEdit(domain: string, finding: FpFinding) {
    if (!editContent.trim()) {
      alert("Content cannot be empty.", "Error");
      return;
    }
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/fp-instructions/${encodeURIComponent(domain)}?file=${encodeURIComponent(finding.id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editContent }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save");
      }
      cancelEdit();
      await fetchFindings(domain);
      fetchDomains();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Save failed", "Error");
    } finally {
      setSavingEdit(false);
    }
  }

  const fetchDomains = useCallback(async () => {
    try {
      const res = await fetch("/api/fp-instructions");
      const data = await res.json();
      const list: FpDomain[] = Array.isArray(data.domains) ? data.domains : [];
      setDomains(list);
      setSelected((cur) => cur ?? (list.length > 0 ? list[0].domain : null));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchFindings = useCallback(async (domain: string) => {
    setFindingsLoading(true);
    try {
      const res = await fetch(`/api/fp-instructions/${encodeURIComponent(domain)}`);
      const data = res.ok ? await res.json() : { findings: [] };
      setFindings(Array.isArray(data.findings) ? data.findings : []);
    } catch {
      setFindings([]);
    } finally {
      setFindingsLoading(false);
    }
  }, []);

  // Poll the shared registry so FPs added by other users show up here too.
  useEffect(() => {
    fetchDomains();
    const iv = setInterval(fetchDomains, 10000);
    return () => clearInterval(iv);
  }, [fetchDomains]);

  useEffect(() => {
    if (!selected) { setFindings([]); return; }
    fetchFindings(selected);
    const iv = setInterval(() => fetchFindings(selected), 10000);
    return () => clearInterval(iv);
  }, [selected, fetchFindings]);

  async function handleDeleteDomain(domain: string) {
    confirm(`Remove ALL false-positive instructions for ${domain}? Future scans of this target will no longer skip them.`, async () => {
      try {
        const res = await fetch(`/api/fp-instructions/${encodeURIComponent(domain)}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Failed to delete");
        if (selected === domain) setSelected(null);
        fetchDomains();
      } catch (e) {
        alert(e instanceof Error ? e.message : "Delete failed", "Error");
      }
    }, "Delete Domain FPs");
  }

  async function handleDeleteFinding(domain: string, finding: FpFinding) {
    confirm(`Remove this false positive ("${finding.title}")? It will no longer be skipped on future scans of ${domain}.`, async () => {
      try {
        const res = await fetch(`/api/fp-instructions/${encodeURIComponent(domain)}?file=${encodeURIComponent(finding.id)}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Failed to delete");
        await fetchFindings(domain);
        fetchDomains();
      } catch (e) {
        alert(e instanceof Error ? e.message : "Delete failed", "Error");
      }
    }, "Delete False Positive");
  }

  return (
    <div className="page" style={{ height: "100%", maxWidth: "none", gap: 0, padding: 0, display: "flex", flexDirection: "row", overflow: "hidden" }}>
      {/* Left: domain folders */}
      <div style={{ width: 320, background: "var(--bg-1)", borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--fg)", display: "flex", alignItems: "center", gap: 8 }}>
            <ShieldOff size={16} /> FP Instructions
          </h2>
          <p style={{ fontSize: 11, color: "var(--fg-3)", marginTop: 6, lineHeight: 1.5 }}>
            Known false positives, one folder per target domain. Shared across all users and auto-applied to future scans so agents skip them.
          </p>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: 8, display: "flex", flexDirection: "column", gap: 4 }}>
          {loading ? (
            <div style={{ padding: 20, textAlign: "center", color: "var(--fg-3)", fontSize: 13 }}>Loading…</div>
          ) : domains.length === 0 ? (
            <div style={{ padding: 20, textAlign: "center", color: "var(--fg-3)", fontSize: 13 }}>
              No FP instructions yet.<br />Mark a finding as false positive to create one.
            </div>
          ) : (
            domains.map((d) => (
              <div
                key={d.domain}
                onClick={() => setSelected(d.domain)}
                style={{
                  padding: "12px 16px", borderRadius: "var(--r)", cursor: "pointer", transition: "all 0.2s",
                  background: selected === d.domain ? "var(--bg-3)" : "transparent",
                  border: selected === d.domain ? "1px solid var(--border)" : "1px solid transparent",
                }}
                onMouseEnter={(e) => { if (selected !== d.domain) e.currentTarget.style.background = "var(--bg-2)"; }}
                onMouseLeave={(e) => { if (selected !== d.domain) e.currentTarget.style.background = "transparent"; }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fg)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "flex", alignItems: "center", gap: 6 }}>
                  <Globe size={12} style={{ color: "var(--fg-3)", flexShrink: 0 }} /> {d.host}
                </div>
                <div style={{ fontSize: 11, color: "var(--fg-3)", marginTop: 4 }}>
                  {d.entryCount} {d.entryCount === 1 ? "finding" : "findings"} · {new Date(d.updatedAt).toLocaleDateString()}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right: findings for the selected domain, one card each */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "var(--bg)" }}>
        {selected ? (
          <>
            <div style={{ padding: "16px 32px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--fg)", fontFamily: "var(--font-mono)", display: "flex", alignItems: "center", gap: 8 }}>
                <Globe size={15} style={{ color: "var(--fg-3)" }} /> {selected}
                <span style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--fg-3)", fontWeight: 400 }}>
                  · {findings.length} {findings.length === 1 ? "finding" : "findings"}
                </span>
              </div>
              <button onClick={() => handleDeleteDomain(selected)} className="btn-secondary" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--sev-critical)" }}>
                <Trash2 size={13} /> Delete all
              </button>
            </div>
            <div style={{ flex: 1, padding: "24px 32px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 16 }}>
              {findingsLoading && findings.length === 0 ? (
                <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
                  <Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} />
                </div>
              ) : findings.length === 0 ? (
                <div style={{ color: "var(--fg-3)", fontSize: 13, textAlign: "center", padding: 40 }}>No findings in this domain.</div>
              ) : (
                findings.map((f) => (
                  <div key={f.id} style={{ border: "1px solid var(--border)", borderRadius: "var(--r)", background: "var(--bg-1)", overflow: "hidden" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderBottom: "1px solid var(--border)", background: "var(--bg-2)" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "var(--fg)" }}>
                        <FileText size={13} style={{ color: "var(--fg-3)" }} /> {f.title}
                      </span>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        {editingId === f.id ? (
                          <>
                            <button
                              onClick={() => saveEdit(selected, f)}
                              className="btn-icon"
                              style={{ color: "var(--sev-low)" }}
                              title="Save changes"
                              disabled={savingEdit}
                            >
                              {savingEdit ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Save size={14} />}
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="btn-icon"
                              style={{ color: "var(--fg-3)" }}
                              title="Cancel"
                              disabled={savingEdit}
                            >
                              <X size={14} />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => startEdit(f)}
                              className="btn-icon"
                              style={{ color: "var(--fg-3)" }}
                              title="Edit this false positive"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => handleDeleteFinding(selected, f)}
                              className="btn-icon"
                              style={{ color: "var(--sev-critical)" }}
                              title="Delete this false positive"
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    {editingId === f.id ? (
                      <div style={{ padding: "12px 16px" }}>
                        <textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          spellCheck={false}
                          style={{
                            width: "100%", minHeight: 220, resize: "vertical",
                            background: "var(--bg-2)", border: "1px solid var(--border-md)",
                            borderRadius: "var(--r)", color: "var(--fg)", padding: "10px 12px",
                            fontSize: 12.5, lineHeight: 1.6, fontFamily: "var(--font-mono)", outline: "none",
                          }}
                        />
                        <div style={{ fontSize: 11, color: "var(--fg-3)", marginTop: 6 }}>
                          Markdown. This exact text is injected into future scans of this target so agents skip the finding.
                        </div>
                      </div>
                    ) : (
                      <div style={{ padding: "12px 16px" }} className="markdown-body">
                        <MarkdownRenderer content={f.content} />
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "var(--fg-3)" }}>
            <ShieldOff size={48} style={{ opacity: 0.2, marginBottom: 16 }} />
            <div style={{ fontSize: 16, fontWeight: 500, color: "var(--fg-2)" }}>No domain selected</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>Select a target domain to view its false positives one by one.</div>
          </div>
        )}
      </div>
    </div>
  );
}
