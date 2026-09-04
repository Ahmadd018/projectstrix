"use client";

import { useEffect, useState } from "react";
import { Save, CheckCircle2, Loader2, Users } from "lucide-react";

const PROVIDERS = [
  { key: "openai", label: "OpenAI" },
  { key: "anthropic", label: "Anthropic" },
  { key: "gemini", label: "Google Gemini" },
  { key: "deepseek", label: "DeepSeek" },
  { key: "groq", label: "Groq" },
  { key: "openrouter", label: "OpenRouter" },
  { key: "mistral", label: "Mistral" },
  { key: "cohere", label: "Cohere" },
  { key: "dashscope", label: "DashScope" },
  { key: "moonshot", label: "Moonshot" },
  { key: "vertex_ai", label: "Vertex AI" },
];

// Super Admin-only panel for the shared LLM keys. Self-hides for non-super-admins
// (the GET returns 403). Users opt into these keys per provider on their own tab.
export function SharedKeysAdmin({ s }: { s: any }) {
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [present, setPresent] = useState<Record<string, boolean>>({});
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/admin/shared-keys")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        setShow(true);
        setEnabled(!!d.enabled);
        setPresent(d.keys || {});
      })
      .catch(() => setShow(false))
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setBusy(true);
    // Only send providers the admin actually typed into (blank = clear).
    const keys: Record<string, string> = {};
    for (const [k, v] of Object.entries(inputs)) if (v !== undefined) keys[k] = v;
    const res = await fetch("/api/admin/shared-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled, keys }),
    });
    if (res.ok) {
      const d = await fetch("/api/admin/shared-keys").then((r) => r.json()).catch(() => null);
      if (d) setPresent(d.keys || {});
      setInputs({});
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
    setBusy(false);
  }

  if (loading || !show) return null;

  return (
    <div style={{ ...s.card, marginBottom: 24, borderColor: "var(--border-md)" }}>
      <div style={s.cardHead}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Users size={15} />
          <div>
            <div style={s.cardTitle}>Shared API Keys (Super Admin)</div>
            <div style={s.cardDesc}>Provide keys any user can opt into. Users pick which shared keys to use on their own API Keys tab.</div>
          </div>
        </div>
      </div>
      <div style={s.cardBody}>
        <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "var(--fg-2)", cursor: "pointer", padding: "4px 0" }}>
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Make shared keys available to everyone
        </label>
        {PROVIDERS.map(({ key, label }) => (
          <div key={key} style={s.field}>
            <label style={s.label}>
              {label}
              {present[key] && <span style={{ marginLeft: 8, fontSize: 11, color: "var(--sev-low)" }}>● saved</span>}
            </label>
            <input
              style={s.input}
              type="password"
              placeholder={present[key] ? "•••••••• (saved — blank keeps it; clear by typing a space then Save)" : "Not set"}
              value={inputs[key] ?? ""}
              onChange={(e) => setInputs({ ...inputs, [key]: e.target.value })}
            />
          </div>
        ))}
      </div>
      <div style={s.cardFoot}>
        {saved && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--sev-low)", marginRight: "auto" }}>
            <CheckCircle2 size={13} /> Saved
          </div>
        )}
        <button className="btn-primary" onClick={save} disabled={busy}>
          {busy ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Save Shared Keys
        </button>
      </div>
    </div>
  );
}
