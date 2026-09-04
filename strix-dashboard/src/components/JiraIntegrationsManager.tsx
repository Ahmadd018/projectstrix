"use client";

import { useEffect, useState } from "react";
import { Ticket, Plus, Trash2, Pencil, CheckCircle2, XCircle, Loader2, Save, X, Share2, Cloud, Server } from "lucide-react";

interface CompanyOption { id: string; label: string }
interface Integration {
  id: string;
  name: string;
  deployment: "CLOUD" | "DATACENTER";
  baseUrl: string;
  authEmail: string;
  projectId: string;
  issueTypeId: string;
  config: { companyFieldId?: string; companyOptions?: CompanyOption[]; participantsFieldId?: string } | null;
  shared: boolean;
  mine: boolean;
  enabled: boolean;
  hasSecret: boolean;
}

// Discovered Bir Ecosystem (m10payments) defaults — a one-click template for the
// Super Admin when creating that Cloud preset.
const BIR_TEMPLATE = {
  name: "Bir Ecosystem",
  deployment: "CLOUD" as const,
  baseUrl: "https://m10payments.atlassian.net",
  projectId: "11527",
  issueTypeId: "10203",
  companyFieldId: "customfield_11630",
  participantsFieldId: "customfield_10797",
  companyOptions: [
    { id: "11414", label: "PashaPay" },
    { id: "11415", label: "Birmarket" },
    { id: "11416", label: "Kapital Bank" },
  ] as CompanyOption[],
};

type Form = {
  id?: string;
  name: string;
  deployment: "CLOUD" | "DATACENTER";
  baseUrl: string;
  authEmail: string;
  authSecret: string;
  projectId: string;
  issueTypeId: string;
  companyFieldId: string;
  participantsFieldId: string;
  companyOptions: CompanyOption[];
  shared: boolean;
};
const EMPTY_FORM: Form = {
  name: "", deployment: "DATACENTER", baseUrl: "", authEmail: "", authSecret: "",
  projectId: "", issueTypeId: "", companyFieldId: "", participantsFieldId: "", companyOptions: [],
  shared: false,
};

export function JiraIntegrationsManager({ s }: { s: any }) {
  const [list, setList] = useState<Integration[]>([]);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Form | null>(null); // null = form closed
  const [busy, setBusy] = useState(false);
  const [tests, setTests] = useState<Record<string, { status: "testing" | "ok" | "err"; msg?: string }>>({});
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/jira/integrations");
      const data = await res.json();
      setList(data.integrations || []);
      setIsSuperAdmin(!!data.isSuperAdmin);
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  function openCreate() {
    setErr(null);
    setForm({ ...EMPTY_FORM });
  }
  function openEdit(i: Integration) {
    setErr(null);
    setForm({
      id: i.id, name: i.name, deployment: i.deployment, baseUrl: i.baseUrl, authEmail: i.authEmail,
      authSecret: "", projectId: i.projectId, issueTypeId: i.issueTypeId,
      companyFieldId: i.config?.companyFieldId || "", participantsFieldId: i.config?.participantsFieldId || "",
      companyOptions: i.config?.companyOptions || [], shared: i.shared,
    });
  }
  function applyBirTemplate() {
    setForm((f) => f ? {
      ...f, name: f.name || BIR_TEMPLATE.name, deployment: "CLOUD", baseUrl: BIR_TEMPLATE.baseUrl,
      projectId: BIR_TEMPLATE.projectId, issueTypeId: BIR_TEMPLATE.issueTypeId,
      companyFieldId: BIR_TEMPLATE.companyFieldId, participantsFieldId: BIR_TEMPLATE.participantsFieldId,
      companyOptions: BIR_TEMPLATE.companyOptions,
    } : f);
  }

  async function save() {
    if (!form) return;
    setBusy(true);
    setErr(null);
    const config = form.deployment === "CLOUD"
      ? { companyFieldId: form.companyFieldId || undefined, participantsFieldId: form.participantsFieldId || undefined, companyOptions: form.companyOptions.filter((o) => o.id && o.label) }
      : undefined;
    const body: any = {
      name: form.name, deployment: form.deployment, baseUrl: form.baseUrl, authEmail: form.authEmail,
      projectId: form.projectId, issueTypeId: form.issueTypeId, config, shared: form.shared,
    };
    if (form.authSecret.trim()) body.authSecret = form.authSecret.trim();
    try {
      const res = form.id
        ? await fetch(`/api/jira/integrations/${form.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
        : await fetch("/api/jira/integrations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(out.error || `HTTP ${res.status}`); return; }
      setForm(null);
      await load();
    } catch (e: any) {
      setErr(e?.message || "Network error");
    } finally {
      setBusy(false);
    }
  }

  async function remove(i: Integration) {
    if (!confirm(`Delete integration "${i.name}"? This cannot be undone.`)) return;
    await fetch(`/api/jira/integrations/${i.id}`, { method: "DELETE" });
    await load();
  }

  async function toggleAccept(i: Integration, enabled: boolean) {
    await fetch(`/api/jira/integrations/${i.id}/accept`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled }),
    });
    await load();
  }

  async function test(i: Integration) {
    setTests((t) => ({ ...t, [i.id]: { status: "testing" } }));
    try {
      const res = await fetch(`/api/jira/integrations/${i.id}/test`, { method: "POST" });
      const out = await res.json().catch(() => ({}));
      if (res.ok && out.success) setTests((t) => ({ ...t, [i.id]: { status: "ok", msg: `Connected as ${out.displayName || out.name || "user"}` } }));
      else setTests((t) => ({ ...t, [i.id]: { status: "err", msg: out.error || `HTTP ${res.status}` } }));
    } catch (e: any) {
      setTests((t) => ({ ...t, [i.id]: { status: "err", msg: e?.message || "Network error" } }));
    }
  }

  const badge = (i: Integration) => (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, padding: "2px 8px", borderRadius: 999, background: "var(--bg-3)", color: "var(--fg-2)", border: "1px solid var(--border)" }}>
      {i.deployment === "CLOUD" ? <Cloud size={11} /> : <Server size={11} />}
      {i.deployment === "CLOUD" ? "Cloud" : "Data Center"}
    </span>
  );

  return (
    <div style={s.card}>
      <div style={s.cardHead}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={s.cardTitle}>Jira Integrations</div>
            <div style={s.cardDesc}>Report findings to one or more Jiras. Accept a shared integration or create your own; pick which one at report time.</div>
          </div>
          {!form && (
            <button className="btn-secondary" onClick={openCreate} style={{ display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
              <Plus size={13} /> New integration
            </button>
          )}
        </div>
      </div>

      <div style={s.cardBody}>
        {loading ? (
          <div style={{ display: "flex", gap: 8, alignItems: "center", color: "var(--fg-3)", fontSize: 13 }}>
            <Loader2 size={14} className="animate-spin" /> Loading…
          </div>
        ) : (
          <>
            {/* Integration list */}
            {list.length === 0 && !form && (
              <div style={{ fontSize: 13, color: "var(--fg-3)" }}>No integrations yet. Create one to start reporting to Jira.</div>
            )}
            {list.map((i) => {
              const t = tests[i.id];
              const canManage = i.mine || (i.shared && isSuperAdmin);
              return (
                <div key={i.id} style={{ border: "1px solid var(--border)", borderRadius: "var(--r)", padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <Ticket size={15} />
                    <strong style={{ fontSize: 14 }}>{i.name}</strong>
                    {badge(i)}
                    {i.shared && (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, padding: "2px 8px", borderRadius: 999, background: "rgba(120,120,255,0.12)", color: "var(--fg-2)", border: "1px solid var(--border)" }}>
                        <Share2 size={11} /> Shared{i.mine ? "" : " by admin"}
                      </span>
                    )}
                    <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--fg-3)" }}>{i.baseUrl}</span>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    {/* Shared presets: per-user accept toggle */}
                    {i.shared && !i.mine && (
                      <button
                        className={i.enabled ? "btn-secondary" : "btn-primary"}
                        onClick={() => toggleAccept(i, !i.enabled)}
                        style={{ display: "flex", alignItems: "center", gap: 6 }}
                      >
                        {i.enabled ? <><X size={13} /> Stop using</> : <><CheckCircle2 size={13} /> Use this Jira</>}
                      </button>
                    )}
                    {i.mine && !i.shared && (
                      <span style={{ fontSize: 12, color: "var(--sev-low)", display: "flex", alignItems: "center", gap: 5 }}>
                        <CheckCircle2 size={13} /> Available at report time
                      </span>
                    )}
                    <button className="btn-ghost" onClick={() => test(i)} disabled={t?.status === "testing"} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {t?.status === "testing" ? <Loader2 size={13} className="animate-spin" /> : <Ticket size={13} />} Test
                    </button>
                    {canManage && (
                      <>
                        <button className="btn-ghost" onClick={() => openEdit(i)} style={{ display: "flex", alignItems: "center", gap: 6 }}><Pencil size={13} /> Edit</button>
                        <button className="btn-ghost" onClick={() => remove(i)} style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--sev-critical)", borderColor: "var(--sev-critical-bd)" }}><Trash2 size={13} /> Delete</button>
                      </>
                    )}
                    {t?.status === "ok" && <span style={{ fontSize: 12, color: "var(--sev-low)", display: "flex", alignItems: "center", gap: 5 }}><CheckCircle2 size={13} /> {t.msg}</span>}
                    {t?.status === "err" && <span style={{ fontSize: 12, color: "var(--sev-critical, #e5484d)", display: "flex", alignItems: "center", gap: 5 }}><XCircle size={13} /> {t.msg}</span>}
                  </div>
                </div>
              );
            })}

            {/* Create / edit form */}
            {form && (
              <div style={{ border: "1px solid var(--border-md)", borderRadius: "var(--r)", padding: 16, display: "flex", flexDirection: "column", gap: 14, marginTop: 4 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <strong style={{ fontSize: 14 }}>{form.id ? "Edit integration" : "New integration"}</strong>
                  {!form.id && (
                    <button className="btn-ghost" onClick={applyBirTemplate} style={{ fontSize: 12 }}>Load Bir Ecosystem template</button>
                  )}
                </div>

                <div style={{ display: "flex", gap: 12 }}>
                  <div style={{ ...s.field, flex: 2 }}>
                    <label style={s.label}>Name</label>
                    <input style={s.input} value={form.name} placeholder="Kapitalbank / Bir Ecosystem" onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  </div>
                  <div style={{ ...s.field, flex: 1 }}>
                    <label style={s.label}>Type</label>
                    <select style={s.input} value={form.deployment} onChange={(e) => setForm({ ...form, deployment: e.target.value as any })}>
                      <option value="DATACENTER">Data Center</option>
                      <option value="CLOUD">Cloud</option>
                    </select>
                  </div>
                </div>

                <div style={s.field}>
                  <label style={s.label}>Base URL</label>
                  <input style={s.input} value={form.baseUrl} placeholder={form.deployment === "CLOUD" ? "https://xxx.atlassian.net" : "https://jira.company.com"} onChange={(e) => setForm({ ...form, baseUrl: e.target.value })} />
                </div>

                {form.deployment === "CLOUD" && (
                  <div style={s.field}>
                    <label style={s.label}>Account email</label>
                    <input style={s.input} value={form.authEmail} placeholder="service-account@company.com" onChange={(e) => setForm({ ...form, authEmail: e.target.value })} />
                  </div>
                )}

                <div style={s.field}>
                  <label style={s.label}>{form.deployment === "CLOUD" ? "API token" : "Personal Access Token (PAT)"}</label>
                  <input style={s.input} type="password" value={form.authSecret}
                    placeholder={form.id ? "•••••••• (saved — leave blank to keep)" : (form.deployment === "CLOUD" ? "Atlassian API token" : "Bearer PAT")}
                    onChange={(e) => setForm({ ...form, authSecret: e.target.value })} />
                  <span style={s.hint}>Stored encrypted. {form.deployment === "CLOUD" ? "Basic auth (email:token) against REST v3." : "Sent as Authorization: Bearer against REST v2."}</span>
                </div>

                <div style={{ display: "flex", gap: 12 }}>
                  <div style={{ ...s.field, flex: 1 }}>
                    <label style={s.label}>Project ID</label>
                    <input style={s.input} value={form.projectId} placeholder="e.g. 11527" onChange={(e) => setForm({ ...form, projectId: e.target.value })} />
                  </div>
                  <div style={{ ...s.field, flex: 1 }}>
                    <label style={s.label}>Issue Type ID</label>
                    <input style={s.input} value={form.issueTypeId} placeholder="e.g. 10203" onChange={(e) => setForm({ ...form, issueTypeId: e.target.value })} />
                  </div>
                </div>

                {/* Cloud-specific field config */}
                {form.deployment === "CLOUD" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
                    <div style={{ display: "flex", gap: 12 }}>
                      <div style={{ ...s.field, flex: 1 }}>
                        <label style={s.label}>Company field id</label>
                        <input style={s.input} value={form.companyFieldId} placeholder="customfield_11630" onChange={(e) => setForm({ ...form, companyFieldId: e.target.value })} />
                      </div>
                      <div style={{ ...s.field, flex: 1 }}>
                        <label style={s.label}>Participants field id</label>
                        <input style={s.input} value={form.participantsFieldId} placeholder="customfield_10797" onChange={(e) => setForm({ ...form, participantsFieldId: e.target.value })} />
                      </div>
                    </div>
                    <div style={s.field}>
                      <label style={s.label}>Company options (chosen per ticket)</label>
                      {form.companyOptions.map((o, idx) => (
                        <div key={idx} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                          <input style={{ ...s.input, width: 120 }} value={o.id} placeholder="option id" onChange={(e) => {
                            const next = [...form.companyOptions]; next[idx] = { ...o, id: e.target.value }; setForm({ ...form, companyOptions: next });
                          }} />
                          <input style={{ ...s.input, flex: 1 }} value={o.label} placeholder="label" onChange={(e) => {
                            const next = [...form.companyOptions]; next[idx] = { ...o, label: e.target.value }; setForm({ ...form, companyOptions: next });
                          }} />
                          <button className="btn-ghost" onClick={() => setForm({ ...form, companyOptions: form.companyOptions.filter((_, x) => x !== idx) })} style={{ color: "var(--sev-critical)" }}><Trash2 size={13} /></button>
                        </div>
                      ))}
                      <button className="btn-ghost" style={{ alignSelf: "flex-start", fontSize: 12 }} onClick={() => setForm({ ...form, companyOptions: [...form.companyOptions, { id: "", label: "" }] })}>+ Add option</button>
                    </div>
                  </div>
                )}

                {/* Reporter is chosen per-report by each user (Data Center only). */}
                <div style={{ fontSize: 12, color: "var(--fg-3)", lineHeight: 1.5, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
                  {form.deployment === "DATACENTER"
                    ? "Reporter: tickets default to the shared service account. Each user can choose “Report as me” at report time (needs their email in Settings → Profile)."
                    : "Reporter cannot be set on Cloud Jira for this project (the field isn’t on the create screen), so tickets are always reported by the service account."}
                </div>

                {/* Share toggle — Super Admin only */}
                {isSuperAdmin && (
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--fg-2)", cursor: "pointer" }}>
                    <input type="checkbox" checked={form.shared} onChange={(e) => setForm({ ...form, shared: e.target.checked })} />
                    <Share2 size={13} /> Share with all admins (stream this integration)
                  </label>
                )}

                {err && <div style={{ fontSize: 12, color: "var(--sev-critical, #e5484d)" }}>{err}</div>}

                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                  <button className="btn-ghost" onClick={() => { setForm(null); setErr(null); }}>Cancel</button>
                  <button className="btn-primary" onClick={save} disabled={busy || !form.name.trim() || !form.baseUrl.trim()} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {busy ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} {form.id ? "Save changes" : "Create"}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
