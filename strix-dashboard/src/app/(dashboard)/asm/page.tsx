"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Network,
  Search,
  RefreshCw,
  Trash2,
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
  Loader2,
  ExternalLink,
  Boxes,
  Radar,
  Crosshair,
} from "lucide-react";
import { useDialog } from "@/components/DialogProvider";
import { LLM_MODELS } from "@/lib/models";

interface FoundCve {
  cve: string;
  cvss: number | null;
  severity: string | null;
  summary: string;
  fixedVersion: string | null;
}

interface Technology {
  id: string;
  target: string;
  vendor: string;
  product: string;
  version: string;
  ecosystem: string;
  category: string;
  description: string;
  evidence: string;
  cveStatus: string;
  foundCves: FoundCve[] | null;
  versionCheckedAt: string | null;
  cveCheckedAt: string | null;
  lastSeenAt: string;
  updatedAt: string;
}

interface Settings {
  cveLookupEnabled: boolean;
  cveLookupIntervalHours: number;
  cveLookupModel: string;
}

const STATUS_META: Record<string, { label: string; color: string; bg: string; Icon: any }> = {
  vulnerable: { label: "Vulnerable", color: "#ff6b6b", bg: "rgba(255,59,59,0.12)", Icon: ShieldAlert },
  clean: { label: "Clean", color: "#4ade80", bg: "rgba(74,222,128,0.12)", Icon: ShieldCheck },
  checking: { label: "Checking…", color: "#60a5fa", bg: "rgba(59,130,246,0.12)", Icon: Loader2 },
  unknown: { label: "Not checked", color: "var(--fg-3)", bg: "var(--bg-2)", Icon: ShieldQuestion },
};

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] || STATUS_META.unknown;
  const { Icon } = meta;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 10px",
        borderRadius: 20,
        fontSize: 12,
        fontWeight: 600,
        color: meta.color,
        background: meta.bg,
        border: `1px solid ${meta.color}33`,
      }}
    >
      <Icon size={12} className={status === "checking" ? "spin" : undefined} /> {meta.label}
    </span>
  );
}

// Derive the host/subdomain from a target string (URL or bare host) for grouping.
function hostOf(target: string): string {
  const t = (target || "").trim();
  if (!t) return "(unknown)";
  try {
    return new URL(t.includes("://") ? t : `https://${t}`).hostname || t;
  } catch {
    return t.replace(/^[a-z]+:\/\//i, "").split("/")[0] || t;
  }
}

function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso).getTime();
  const s = Math.floor((Date.now() - d) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function AsmPage() {
  const [techs, setTechs] = useState<Technology[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [collapsedHosts, setCollapsedHosts] = useState<Set<string>>(new Set());
  const [instructions, setInstructions] = useState<{ id: string; title: string; content: string }[]>([]);
  const [customModels, setCustomModels] = useState<{ value: string; label: string }[]>([]);
  // Model used by the MANUAL actions (lookup / cve scan / full scan). Seeded from
  // the configured lookup model once settings load.
  const [manualModel, setManualModel] = useState("");
  const [fullScan, setFullScan] = useState<{ techId: string; label: string } | null>(null);
  const [fsInstruction, setFsInstruction] = useState("");
  const [fsModel, setFsModel] = useState("");
  const [fsLaunching, setFsLaunching] = useState(false);
  const { confirm, alert } = useDialog();

  const fetchData = async () => {
    try {
      const res = await fetch("/api/technologies");
      if (res.ok) {
        const data = await res.json();
        setTechs(data.technologies || []);
        setSettings(data.settings || null);
        setIsAdmin(!!data.isAdmin);
        // Seed the manual-action model from the configured lookup model, once.
        setManualModel((prev) => prev || data.settings?.cveLookupModel || "");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    fetch("/api/instructions")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setInstructions(Array.isArray(d) ? d : []))
      .catch(() => {});
    fetch("/api/user/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.customModels) setCustomModels(d.customModels); })
      .catch(() => {});
    const iv = setInterval(fetchData, 15000); // reflect scheduler progress live
    return () => clearInterval(iv);
  }, []);

  const counts = useMemo(() => {
    const c = { total: techs.length, vulnerable: 0, clean: 0, unknown: 0, checking: 0 };
    for (const t of techs) {
      if (t.cveStatus === "vulnerable") c.vulnerable++;
      else if (t.cveStatus === "clean") c.clean++;
      else if (t.cveStatus === "checking") c.checking++;
      else c.unknown++;
    }
    return c;
  }, [techs]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return techs.filter((t) => {
      if (statusFilter !== "all" && t.cveStatus !== statusFilter) return false;
      if (!q) return true;
      return (
        t.product.toLowerCase().includes(q) ||
        t.vendor.toLowerCase().includes(q) ||
        t.target.toLowerCase().includes(q) ||
        t.version.toLowerCase().includes(q)
      );
    });
  }, [techs, search, statusFilter]);

  // Group the filtered inventory by subdomain/host.
  const groups = useMemo(() => {
    const map = new Map<string, Technology[]>();
    for (const t of filtered) {
      const h = hostOf(t.target);
      if (!map.has(h)) map.set(h, []);
      map.get(h)!.push(t);
    }
    return Array.from(map.entries())
      .map(([host, items]) => ({
        host,
        items,
        vulnerable: items.filter((i) => i.cveStatus === "vulnerable").length,
      }))
      .sort((a, b) => b.vulnerable - a.vulnerable || a.host.localeCompare(b.host));
  }, [filtered]);

  const toggleHost = (host: string) => {
    setCollapsedHosts((prev) => {
      const next = new Set(prev);
      next.has(host) ? next.delete(host) : next.add(host);
      return next;
    });
  };

  const handleRunLookup = async (id: string) => {
    // Optimistically flip the row to "checking" so the UI responds instantly.
    setTechs((prev) => prev.map((t) => (t.id === id ? { ...t, cveStatus: "checking" } : t)));
    try {
      const res = await fetch(`/api/technologies?id=${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: manualModel || undefined }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to start lookup");
      }
      fetchData();
    } catch (e: any) {
      alert(e.message, "Error");
      fetchData();
    }
  };

  const handleCveScan = (id: string, label: string) => {
    confirm(
      `Start a CVE scan of "${label}"? This runs your "cve_scan" instruction against the target to validate/exploit known CVEs.`,
      async () => {
        try {
          const res = await fetch(`/api/technologies?id=${id}&action=cvescan`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ model: manualModel || undefined }),
          });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || "Failed to start CVE scan");
          }
          alert("CVE scan started. Track it on the Scans page.", "Scan launched");
        } catch (e: any) {
          alert(e.message, "Error");
        }
      },
      "Run CVE scan",
    );
  };

  const openFullScan = (id: string, label: string) => {
    setFsInstruction("");
    setFsModel(manualModel || settings?.cveLookupModel || "");
    setFullScan({ techId: id, label });
  };

  const startFullScan = async () => {
    if (!fullScan) return;
    setFsLaunching(true);
    try {
      const res = await fetch(`/api/technologies?id=${fullScan.techId}&action=fullscan`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction: fsInstruction.trim() || undefined, model: fsModel || undefined }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to start scan");
      }
      setFullScan(null);
      alert("Full scan started. Track it on the Scans page.", "Scan launched");
    } catch (e: any) {
      alert(e.message, "Error");
    } finally {
      setFsLaunching(false);
    }
  };

  const handleDelete = (id: string) => {
    confirm("Remove this asset from the ASM inventory?", async () => {
      try {
        const res = await fetch(`/api/technologies?id=${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Failed to delete");
        fetchData();
      } catch (e: any) {
        alert(e.message, "Error");
      }
    }, "Remove Asset");
  };

  const updateSettings = async (patch: Partial<Settings>) => {
    if (!settings) return;
    const next = { ...settings, ...patch };
    setSettings(next); // optimistic
    try {
      const res = await fetch("/api/technologies/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error("Failed to save settings");
      const data = await res.json();
      setSettings(data);
    } catch (e: any) {
      alert(e.message, "Error");
      fetchData();
    }
  };

  const renderTechRow = (t: Technology) => {
    const cves = Array.isArray(t.foundCves) ? t.foundCves : [];
    const isOpen = expanded === t.id;
    const label = [t.vendor, t.product].filter(Boolean).join(" ") || t.product;
    const bareHost = hostOf(t.target);
    // Show the full target as a subline only when it carries more than the host.
    const showTargetSub = t.target && t.target !== bareHost && t.target !== `https://${bareHost}` && t.target !== `http://${bareHost}`;
    return (
      <React.Fragment key={t.id}>
        <tr
          style={{ borderTop: "1px solid var(--border)", cursor: cves.length ? "pointer" : "default" }}
          onClick={() => cves.length && setExpanded(isOpen ? null : t.id)}
        >
          <td style={{ padding: "12px 16px" }}>
            <div style={{ fontWeight: 600, color: "var(--fg)" }}>{t.product}</div>
            {t.vendor && <div style={{ fontSize: 11, color: "var(--fg-3)", marginTop: 2 }}>{t.vendor}</div>}
            {showTargetSub && (
              <div style={{ fontSize: 10, color: "var(--fg-3)", marginTop: 2, fontFamily: "var(--font-mono)", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {t.target}
              </div>
            )}
          </td>
          <td style={{ padding: "12px 16px" }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: t.version ? "var(--fg)" : "var(--fg-3)" }}>
              {t.version || "unknown"}
            </span>
          </td>
          <td style={{ padding: "12px 16px", color: "var(--fg-2)" }}>{t.category || t.ecosystem || "—"}</td>
          <td style={{ padding: "12px 16px" }}>
            <StatusBadge status={t.cveStatus} />
            {cves.length > 0 && (
              <span style={{ marginLeft: 8, fontSize: 11, color: "var(--fg-3)" }}>
                {cves.length} CVE{cves.length > 1 ? "s" : ""} {isOpen ? "▲" : "▼"}
              </span>
            )}
          </td>
          <td style={{ padding: "12px 16px", color: "var(--fg-3)", fontSize: 12 }}>{timeAgo(t.cveCheckedAt)}</td>
          <td style={{ padding: "12px 16px", textAlign: "right", whiteSpace: "nowrap" }}>
            <button
              onClick={(e) => { e.stopPropagation(); handleRunLookup(t.id); }}
              className="btn-icon"
              title="Run CVE lookup now (checks this target immediately, and runs a cve_scan if a CVE is found)"
              style={{ marginRight: 4 }}
              disabled={t.cveStatus === "checking"}
            >
              <RefreshCw size={15} className={t.cveStatus === "checking" ? "spin" : undefined} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleCveScan(t.id, label); }}
              className="btn-icon"
              title="Run a CVE scan now (validate/exploit known CVEs via the cve_scan instruction)"
              style={{ marginRight: 4 }}
            >
              <Crosshair size={15} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); openFullScan(t.id, label); }}
              className="btn-icon"
              title="Run a full security scan of this target (complete pentest, all vulnerability classes)"
              style={{ marginRight: 4 }}
            >
              <Radar size={15} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleDelete(t.id); }}
              className="btn-icon"
              title="Remove"
              style={{ color: "var(--sev-critical)" }}
            >
              <Trash2 size={15} />
            </button>
          </td>
        </tr>
        {isOpen && cves.length > 0 && (
          <tr style={{ background: "var(--bg-2)" }}>
            <td colSpan={6} style={{ padding: "14px 24px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {cves.map((c) => (
                  <div key={c.cve} style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    <a
                      href={`https://nvd.nist.gov/vuln/detail/${c.cve}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--brand)", display: "inline-flex", alignItems: "center", gap: 4, fontWeight: 600 }}
                    >
                      {c.cve} <ExternalLink size={11} />
                    </a>
                    {c.cvss != null && (
                      <span style={{ fontSize: 11, color: "var(--fg-2)", background: "var(--bg-3)", padding: "2px 8px", borderRadius: 12 }}>
                        CVSS {c.cvss}
                      </span>
                    )}
                    {c.severity && (
                      <span style={{ fontSize: 11, color: "var(--fg-3)", textTransform: "capitalize" }}>{c.severity}</span>
                    )}
                    {c.fixedVersion && (
                      <span style={{ fontSize: 11, color: "#4ade80" }}>fixed in {c.fixedVersion}</span>
                    )}
                    {c.summary && (
                      <span style={{ fontSize: 12, color: "var(--fg-3)", flex: 1, minWidth: 200 }}>{c.summary}</span>
                    )}
                  </div>
                ))}
              </div>
            </td>
          </tr>
        )}
      </React.Fragment>
    );
  };

  const tiles = [
    { label: "Assets tracked", value: counts.total, color: "var(--fg)", Icon: Boxes },
    { label: "Vulnerable", value: counts.vulnerable, color: "#ff6b6b", Icon: ShieldAlert },
    { label: "Clean", value: counts.clean, color: "#4ade80", Icon: ShieldCheck },
    { label: "Awaiting check", value: counts.unknown + counts.checking, color: "#60a5fa", Icon: ShieldQuestion },
  ];

  return (
    <div className="page" style={{ maxWidth: 1400, margin: "0 auto", width: "100%", padding: "28px 32px" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } } .spin { animation: spin 1s linear infinite; }`}</style>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--fg)", display: "flex", alignItems: "center", gap: 10, margin: 0 }}>
            <Network size={22} style={{ color: "var(--brand)" }} /> Attack Surface Management
          </h1>
          <p style={{ color: "var(--fg-3)", fontSize: 13, marginTop: 6, maxWidth: 720 }}>
            Third-party & vendor solutions discovered across your scans. Taipan re-verifies each version and searches
            published advisories for CVEs; a confirmed CVE automatically launches a full <code>cve_scan</code>.
          </p>
        </div>
        <button onClick={fetchData} className="btn-secondary" style={{ gap: 8 }}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Automation control */}
      {settings && (
        <div
          style={{
            marginTop: 20,
            padding: "14px 18px",
            background: "var(--bg-1)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span
              style={{
                width: 9,
                height: 9,
                borderRadius: "50%",
                background: settings.cveLookupEnabled ? "#4ade80" : "var(--fg-3)",
                boxShadow: settings.cveLookupEnabled ? "0 0 8px #4ade80" : "none",
              }}
            />
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--fg)" }}>
                Automatic CVE lookup {settings.cveLookupEnabled ? "enabled" : "disabled"}
              </div>
              <div style={{ fontSize: 12, color: "var(--fg-3)", marginTop: 2 }}>
                {settings.cveLookupEnabled
                  ? `Re-checks each asset every ${settings.cveLookupIntervalHours}h.`
                  : "Assets are inventoried but not automatically re-checked."}
                {!isAdmin && " Only admins can change this."}
              </div>
            </div>
          </div>
          {isAdmin && (
            <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--fg-2)" }}>
                Model
                <select
                  value={settings.cveLookupModel || ""}
                  onChange={(e) => updateSettings({ cveLookupModel: e.target.value })}
                  style={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 6, color: "var(--fg)", fontSize: 13, padding: "6px 8px", maxWidth: 220 }}
                >
                  {[...LLM_MODELS, ...customModels].map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--fg-2)" }}>
                Interval (h)
                <input
                  type="number"
                  min={1}
                  max={720}
                  value={settings.cveLookupIntervalHours}
                  onChange={(e) => setSettings({ ...settings, cveLookupIntervalHours: Number(e.target.value) })}
                  onBlur={(e) => updateSettings({ cveLookupIntervalHours: Number(e.target.value) })}
                  style={{
                    width: 72,
                    padding: "6px 8px",
                    background: "var(--bg-2)",
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    color: "var(--fg)",
                    fontSize: 13,
                  }}
                />
              </label>
              <button
                onClick={() => updateSettings({ cveLookupEnabled: !settings.cveLookupEnabled })}
                className={settings.cveLookupEnabled ? "btn-secondary" : "btn-primary"}
                style={{ gap: 8 }}
              >
                {settings.cveLookupEnabled ? "Disable" : "Enable"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Summary tiles */}
      <div style={{ marginTop: 20, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
        {tiles.map((t) => {
          const { Icon } = t;
          return (
            <div key={t.label} style={{ background: "var(--bg-1)", border: "1px solid var(--border)", borderRadius: "var(--r)", padding: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--fg-3)", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                <Icon size={14} style={{ color: t.color }} /> {t.label}
              </div>
              <div style={{ fontSize: 30, fontWeight: 700, color: t.color, marginTop: 8 }}>{t.value}</div>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div style={{ marginTop: 22, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: "var(--r)", padding: "8px 12px", flex: 1, minWidth: 220 }}>
          <Search size={14} color="var(--fg-3)" />
          <input
            type="text"
            placeholder="Search product, vendor, target, version…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "var(--fg)", fontSize: 13 }}
          />
        </div>
        <div style={{ display: "flex", gap: 4, background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: "var(--r)", padding: 4 }}>
          {["all", "vulnerable", "clean", "unknown"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              style={{
                padding: "6px 12px",
                fontSize: 12,
                fontWeight: 600,
                borderRadius: 6,
                border: "none",
                cursor: "pointer",
                textTransform: "capitalize",
                background: statusFilter === s ? "var(--bg-3)" : "transparent",
                color: statusFilter === s ? "var(--fg)" : "var(--fg-3)",
              }}
            >
              {s === "unknown" ? "Not checked" : s}
            </button>
          ))}
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--fg-3)" }}>
          <span style={{ whiteSpace: "nowrap" }}>Manual scan model</span>
          <select
            value={manualModel}
            onChange={(e) => setManualModel(e.target.value)}
            title="Model used by the ↻ CVE lookup and ⌖ CVE scan buttons"
            style={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: "var(--r)", color: "var(--fg)", fontSize: 12, padding: "8px 10px", maxWidth: 220 }}
          >
            {[...LLM_MODELS, ...customModels].map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </label>
      </div>

      {/* Inventory grouped by subdomain / host */}
      {loading ? (
        <div style={{ marginTop: 16, padding: 40, textAlign: "center", color: "var(--fg-3)", background: "var(--bg-1)", border: "1px solid var(--border)", borderRadius: "var(--r)" }}>
          <Loader2 size={18} className="spin" style={{ verticalAlign: "middle", marginRight: 8 }} /> Loading inventory…
        </div>
      ) : groups.length === 0 ? (
        <div style={{ marginTop: 16, padding: 48, textAlign: "center", color: "var(--fg-3)", background: "var(--bg-1)", border: "1px solid var(--border)", borderRadius: "var(--r)" }}>
          <Network size={40} style={{ opacity: 0.2, marginBottom: 12 }} />
          <div style={{ fontSize: 15, fontWeight: 500, color: "var(--fg-2)" }}>No assets yet</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>
            Vendor solutions detected during scans will appear here automatically, grouped by subdomain.
          </div>
        </div>
      ) : (
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 14 }}>
          {groups.map((g) => {
            const collapsed = collapsedHosts.has(g.host);
            return (
              <div key={g.host} style={{ background: "var(--bg-1)", border: "1px solid var(--border)", borderRadius: "var(--r)", overflow: "hidden" }}>
                {/* Host header */}
                <div
                  onClick={() => toggleHost(g.host)}
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", cursor: "pointer", background: "var(--bg-2)", userSelect: "none" }}
                >
                  <span style={{ color: "var(--fg-3)", fontSize: 12, width: 12, display: "inline-block" }}>{collapsed ? "▶" : "▼"}</span>
                  <Network size={15} style={{ color: "var(--brand)", flexShrink: 0 }} />
                  <span style={{ fontSize: 14, fontWeight: 700, color: "var(--fg)", fontFamily: "var(--font-mono)" }}>{g.host}</span>
                  <span style={{ fontSize: 12, color: "var(--fg-3)" }}>
                    {g.items.length} asset{g.items.length > 1 ? "s" : ""}
                  </span>
                  {g.vulnerable > 0 && (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, color: "#ff6b6b", background: "rgba(255,59,59,0.12)", border: "1px solid #ff6b6b33", padding: "2px 8px", borderRadius: 20 }}>
                      <ShieldAlert size={11} /> {g.vulnerable} vulnerable
                    </span>
                  )}
                </div>

                {!collapsed && (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 820 }}>
                      <thead>
                        <tr style={{ textAlign: "left", color: "var(--fg-3)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                          <th style={{ padding: "10px 16px", fontWeight: 600 }}>Product</th>
                          <th style={{ padding: "10px 16px", fontWeight: 600 }}>Version</th>
                          <th style={{ padding: "10px 16px", fontWeight: 600 }}>Category</th>
                          <th style={{ padding: "10px 16px", fontWeight: 600 }}>CVE Status</th>
                          <th style={{ padding: "10px 16px", fontWeight: 600 }}>Last checked</th>
                          <th style={{ padding: "10px 16px", fontWeight: 600, textAlign: "right" }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>{g.items.map((t) => renderTechRow(t))}</tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Full-scan modal — choose an instruction from the pool (optional) */}
      {fullScan && (
        <div
          onClick={() => !fsLaunching && setFullScan(null)}
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--bg-1)", border: "1px solid var(--border-hi, var(--border))",
              borderRadius: 16, padding: 28, width: 620, maxWidth: "95vw",
              maxHeight: "90vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: 18,
            }}
          >
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--fg)", margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
                <Radar size={18} style={{ color: "var(--brand)" }} /> Run full scan
              </h2>
              <p style={{ color: "var(--fg-3)", fontSize: 13, marginTop: 6 }}>
                Complete pentest of <span style={{ color: "var(--fg-2)", fontWeight: 600 }}>{fullScan.label}</span>. You can optionally load an instruction from your pool to steer it.
              </p>
            </div>

            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "var(--fg-2)", display: "block", marginBottom: 6 }}>Model</label>
              <select
                value={fsModel}
                onChange={(e) => setFsModel(e.target.value)}
                style={{ width: "100%", background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--fg)", fontSize: 13, padding: "10px 12px" }}
              >
                {[...LLM_MODELS, ...customModels].map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: "var(--fg-2)" }}>Instructions (optional)</label>
                {instructions.length > 0 && (
                  <select
                    onChange={(e) => { if (e.target.value) setFsInstruction(e.target.value); }}
                    style={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 6, color: "var(--fg)", fontSize: 12, padding: "4px 8px" }}
                    defaultValue=""
                  >
                    <option value="">Load from Pool…</option>
                    {instructions.map((i) => (
                      <option key={i.id} value={i.content}>{i.title}</option>
                    ))}
                  </select>
                )}
              </div>
              <textarea
                value={fsInstruction}
                onChange={(e) => setFsInstruction(e.target.value)}
                placeholder="e.g. Focus on authentication and access-control issues; creds admin:demo…"
                maxLength={8000}
                style={{
                  width: "100%", minHeight: 140, resize: "vertical",
                  background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 8,
                  color: "var(--fg)", fontSize: 13, padding: "10px 12px", fontFamily: "var(--font-mono)", lineHeight: 1.5, outline: "none",
                }}
              />
              <div style={{ textAlign: "right", fontSize: 11, color: "var(--fg-3)", marginTop: 4 }}>
                {fsInstruction.length}/8000
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button onClick={() => setFullScan(null)} className="btn-secondary" disabled={fsLaunching}>
                Cancel
              </button>
              <button onClick={startFullScan} className="btn-primary" disabled={fsLaunching} style={{ gap: 8 }}>
                {fsLaunching ? <Loader2 size={14} className="spin" /> : <Radar size={14} />}
                {fsLaunching ? "Starting…" : "Start scan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
