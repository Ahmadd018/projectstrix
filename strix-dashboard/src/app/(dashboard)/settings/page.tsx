"use client";

import { useState, useEffect } from "react";
import { Key, Bot, Save, CheckCircle2, ChevronRight, Settings2, Ticket, User } from "lucide-react";
import { JiraIntegrationsManager } from "@/components/JiraIntegrationsManager";
import { SharedKeysAdmin } from "@/components/SharedKeysAdmin";

const TABS = [
  { id: "profile",       label: "Profile",        icon: User },
  { id: "api",           label: "API Keys",      icon: Key },
  { id: "agent",         label: "Agent Behavior", icon: Bot },
  { id: "jira",          label: "Jira",           icon: Ticket },
  { id: "preferences",   label: "Preferences",    icon: Settings2 },
];

export default function Settings() {
  const [activeTab, setActiveTab] = useState("api");
  const [keys, setKeys] = useState({ openai: "", anthropic: "", gemini: "", deepseek: "", groq: "", openrouter: "", mistral: "", cohere: "", dashscope: "", moonshot: "", vertex_ai: "" });
  const [customModels, setCustomModels] = useState<{value: string, label: string}[]>([]);
  const [agentConfig, setAgentConfig] = useState({ aggressiveness: 50, maxThreads: 4 });
  const [preferencesConfig, setPreferencesConfig] = useState({ theme: "dark", defaultModel: "openai/gpt-4o", autoDeleteDays: 0 });
  const [saved, setSaved] = useState(false);
  // Shared (admin-provided) keys the user can opt into, per provider.
  const [sharedAvailable, setSharedAvailable] = useState<string[]>([]);
  const [sharedOptIn, setSharedOptIn] = useState<string[]>([]);
  // Profile identity used to set the Jira reporter.
  const [profile, setProfile] = useState({ username: "", email: "", jiraUsername: "" });

  useEffect(() => {
    fetch("/api/user/keys")
      .then(r => r.json())
      .then(data => {
        if (!data.error && Object.keys(data).length > 0) {
          setKeys(prev => ({ ...prev, ...data }));
        }
      })
      .catch(() => {});

    fetch("/api/user/shared-keys")
      .then(r => r.json())
      .then(data => {
        if (!data.error) {
          setSharedAvailable(data.enabled ? (data.available || []) : []);
          setSharedOptIn(data.optIn || []);
        }
      })
      .catch(() => {});

    fetch("/api/user/profile")
      .then(r => r.json())
      .then(data => {
        if (!data.error) setProfile({ username: data.username || "", email: data.email || "", jiraUsername: data.jiraUsername || "" });
      })
      .catch(() => {});

    fetch("/api/user/settings")
      .then(r => r.json())
      .then(data => {
        if (!data.error) {
          if (data.settings) {
            setAgentConfig({ aggressiveness: data.settings.aggressiveness, maxThreads: data.settings.maxThreads });
            setPreferencesConfig({
              theme: data.settings.theme || "dark",
              defaultModel: data.settings.defaultModel || "openai/gpt-4o",
              autoDeleteDays: data.settings.autoDeleteDays || 0
            });
          }
          if (data.customModels) {
            setCustomModels(data.customModels.map((m: any) => ({ value: m.value, label: m.label })));
          }
        }
      })
      .catch(() => {});
  }, []);

  const handleSave = async (tab: "api" | "agent" | "preferences" | "profile") => {
    if (tab === "profile") {
      await fetch("/api/user/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: profile.email, jiraUsername: profile.jiraUsername })
      });
    }
    else if (tab === "api") {
      await fetch("/api/user/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(keys)
      });
      await fetch("/api/user/shared-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providers: sharedOptIn })
      });
      const validModels = customModels.filter(m => m.value.trim() && m.label.trim());
      await fetch("/api/user/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "customModels", data: validModels })
      });
    }
    else if (tab === "agent" || tab === "preferences") {
      await fetch("/api/user/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "settings",
          data: { ...agentConfig, ...preferencesConfig }
        })
      });
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const s: any = {
    page: { padding: 28, display: "flex", flexDirection: "column", gap: 24, height: "100%", overflowY: "auto" },
    layout: { display: "flex", gap: 20, flex: 1 },
    nav: { width: 200, flexShrink: 0, display: "flex", flexDirection: "column", gap: 2 },
    navBtn: (active: boolean): React.CSSProperties => ({
      display: "flex", alignItems: "center", gap: 8, width: "100%",
      padding: "9px 12px", borderRadius: "var(--r)", border: "1px solid",
      borderColor: active ? "var(--border-md)" : "transparent",
      background: active ? "var(--bg-3)" : "none",
      color: active ? "var(--fg)" : "var(--fg-3)",
      fontSize: 13, fontWeight: 500, fontFamily: "var(--font-sans)",
      cursor: "pointer", textAlign: "left", transition: "all var(--dur)",
    }),
    card: { background: "var(--bg-1)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", overflow: "hidden", flex: 1 },
    cardHead: { padding: "18px 20px", borderBottom: "1px solid var(--border)" },
    cardTitle: { fontSize: 14, fontWeight: 600, color: "var(--fg)" },
    cardDesc: { fontSize: 12, color: "var(--fg-3)", marginTop: 4 },
    cardBody: { padding: "20px", display: "flex", flexDirection: "column", gap: 18 },
    cardFoot: { padding: "14px 20px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 12 },
    field: { display: "flex", flexDirection: "column", gap: 6 },
    label: { fontSize: 12, fontWeight: 500, color: "var(--fg-2)" },
    input: {
      padding: "8px 12px", background: "var(--bg-2)", border: "1px solid var(--border-md)",
      borderRadius: "var(--r)", color: "var(--fg)", fontSize: 13,
      fontFamily: "var(--font-sans)", outline: "none",
    },
    hint: { fontSize: 11, color: "var(--fg-3)" },
    sliderWrap: { display: "flex", flexDirection: "column", gap: 8 },
    sliderRow: { display: "flex", justifyContent: "space-between", alignItems: "center" },
    sliderVal: { fontSize: 14, fontWeight: 700, color: "var(--fg)", fontFamily: "var(--font-mono)" },
    sliderTrack: (pct: number): React.CSSProperties => ({
      width: "100%", height: 4, background: "var(--bg-3)", borderRadius: 2, position: "relative",
      backgroundImage: `linear-gradient(to right, var(--fg) ${pct}%, var(--bg-3) ${pct}%)`,
    }),
  };

  return (
    <div style={s.page}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.5px", color: "var(--fg)" }}>Settings</h1>
        <p style={{ fontSize: 13, color: "var(--fg-3)", marginTop: 4 }}>Configure global preferences and AI agent behavior.</p>
      </div>

      <div style={s.layout}>
        {/* Side nav */}
        <nav style={s.nav}>
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} style={s.navBtn(activeTab === id)} onClick={() => setActiveTab(id)}>
              <Icon size={14} />
              {label}
              {activeTab === id && <ChevronRight size={12} style={{ marginLeft: "auto", opacity: 0.5 }} />}
            </button>
          ))}
        </nav>

        {/* Content */}
        <div style={{ flex: 1 }}>
          {/* Profile */}
          {activeTab === "profile" && (
            <div style={s.card}>
              <div style={s.cardHead}>
                <div style={s.cardTitle}>Profile</div>
                <div style={s.cardDesc}>Your identity for Jira. When an integration is set to use it, tickets you report are filed under your Jira user.</div>
              </div>
              <div style={s.cardBody}>
                <div style={s.field}>
                  <label style={s.label}>Username</label>
                  <input style={{ ...s.input, opacity: 0.6 }} value={profile.username} disabled />
                  <span style={s.hint}>Your Taipan login. Not editable here.</span>
                </div>
                <div style={s.field}>
                  <label style={s.label}>Email</label>
                  <input
                    style={s.input}
                    type="email"
                    placeholder="you@company.com"
                    value={profile.email}
                    onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                  />
                  <span style={s.hint}>Matched to your Jira account to set you as the ticket <strong>reporter</strong> (Data Center Jira).</span>
                </div>
                <div style={s.field}>
                  <label style={s.label}>Jira username <span style={{ color: "var(--fg-3)", fontWeight: 400 }}>(optional)</span></label>
                  <input
                    style={s.input}
                    type="text"
                    placeholder="e.g. AghamaliyevAM"
                    value={profile.jiraUsername}
                    onChange={(e) => setProfile({ ...profile, jiraUsername: e.target.value })}
                  />
                  <span style={s.hint}>Overrides the email lookup if your Jira username differs from your email.</span>
                </div>
              </div>
              <div style={s.cardFoot}>
                {saved && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--sev-low)", marginRight: "auto" }}>
                    <CheckCircle2 size={13} /> Saved
                  </div>
                )}
                <button className="btn-primary" onClick={() => handleSave("profile")}>
                  <Save size={13} /> Save Profile
                </button>
              </div>
            </div>
          )}

          {/* API Keys */}
          {activeTab === "api" && (
            <>
            <SharedKeysAdmin s={s} />
            <div style={s.card}>
              <div style={s.cardHead}>
                <div style={s.cardTitle}>API Keys</div>
                <div style={s.cardDesc}>Configure external LLM providers for autonomous analysis.</div>
              </div>
              <div style={s.cardBody}>
                {([
                  { key: "openai",     label: "OpenAI API Key",        placeholder: "sk-…",      hint: "Used for gpt-4o models during penetration testing." },
                  { key: "anthropic",  label: "Anthropic API Key",     placeholder: "sk-ant-…",  hint: "Used for claude-3.5-sonnet reasoning capabilities." },
                  { key: "gemini",     label: "Google Gemini API Key", placeholder: "AIza…",     hint: "Used for gemini-2.5-pro multimodal analysis." },
                  { key: "deepseek",   label: "DeepSeek API Key",      placeholder: "sk-…",      hint: "Used for DeepSeek v3 and DeepSeek Coder models." },
                  { key: "groq",       label: "Groq API Key",          placeholder: "gsk_…",     hint: "Used for ultra-fast Llama 3 and Mixtral models." },
                  { key: "openrouter", label: "OpenRouter API Key",    placeholder: "sk-or-…",   hint: "Used for unified access to dozens of models." },
                  { key: "mistral",    label: "Mistral API Key",       placeholder: "…",         hint: "Used for Mistral Large and other models." },
                  { key: "cohere",     label: "Cohere API Key",        placeholder: "…",         hint: "Used for Command R+ and other Cohere models." },
                  { key: "dashscope",  label: "DashScope API Key",     placeholder: "sk-…",      hint: "Used for Qwen models via Alibaba Cloud DashScope." },
                  { key: "moonshot",   label: "Moonshot API Key",      placeholder: "sk-…",      hint: "Used for Kimi models via Moonshot AI." },
                  { key: "vertex_ai",  label: "Vertex AI API Key",     placeholder: "…",         hint: "Used for Gemini models via Google Cloud Vertex AI." },
                ] as any).map(({ key, label, placeholder, hint }: any) => {
                  const canShare = sharedAvailable.includes(key);
                  const usingShared = canShare && sharedOptIn.includes(key);
                  return (
                  <div key={key} style={s.field}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <label style={s.label}>{label}</label>
                      {canShare && (
                        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--fg-2)", cursor: "pointer" }}>
                          <input
                            type="checkbox"
                            checked={usingShared}
                            onChange={(e) => setSharedOptIn(e.target.checked ? [...sharedOptIn, key] : sharedOptIn.filter((p) => p !== key))}
                          />
                          Use shared key
                        </label>
                      )}
                    </div>
                    <input
                      style={{ ...s.input, opacity: usingShared ? 0.5 : 1 }}
                      type="password"
                      placeholder={usingShared ? "Using the shared key provided by the admin" : placeholder}
                      value={keys[key as keyof typeof keys]}
                      disabled={usingShared}
                      onChange={(e) => setKeys({ ...keys, [key]: e.target.value })}
                    />
                    <span style={s.hint}>{usingShared ? "This provider will use the admin-shared key." : hint}</span>
                  </div>
                  );
                })}
              </div>
              <div style={s.cardFoot}>
                {saved && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--sev-low)", marginRight: "auto" }}>
                    <CheckCircle2 size={13} /> Saved
                  </div>
                )}
                <button className="btn-primary" onClick={() => handleSave("api")}>
                  <Save size={13} /> Save Configuration
                </button>
              </div>
            </div>

            <div style={{ ...s.card, marginTop: 24 }}>
              <div style={s.cardHead}>
                <div style={s.cardTitle}>Custom Models</div>
                <div style={s.cardDesc}>Add custom LiteLLM compatible models (e.g., fine-tunes, local Ollama endpoints).</div>
              </div>
              <div style={s.cardBody}>
                {customModels.map((model, i) => (
                  <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                      <label style={s.label}>Model ID (LiteLLM Format)</label>
                      <input
                        style={s.input}
                        placeholder="e.g. openai/ft:gpt-4o-my-custom-model"
                        value={model.value}
                        onChange={(e) => {
                          const newModels = [...customModels];
                          newModels[i].value = e.target.value;
                          setCustomModels(newModels);
                        }}
                      />
                    </div>
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                      <label style={s.label}>Display Name</label>
                      <input
                        style={s.input}
                        placeholder="e.g. My Custom GPT-4o"
                        value={model.label}
                        onChange={(e) => {
                          const newModels = [...customModels];
                          newModels[i].label = e.target.value;
                          setCustomModels(newModels);
                        }}
                      />
                    </div>
                    <button
                      className="btn-ghost"
                      style={{ marginTop: 22, color: "var(--sev-critical)", borderColor: "var(--sev-critical-bd)" }}
                      onClick={() => {
                        const newModels = customModels.filter((_, idx) => idx !== i);
                        setCustomModels(newModels);
                      }}
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  className="btn-ghost"
                  style={{ alignSelf: "flex-start" }}
                  onClick={() => setCustomModels([...customModels, { value: "", label: "" }])}
                >
                  + Add Custom Model
                </button>
              </div>
              <div style={s.cardFoot}>
                {saved && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--sev-low)", marginRight: "auto" }}>
                    <CheckCircle2 size={13} /> Saved
                  </div>
                )}
                <button className="btn-primary" onClick={() => handleSave("api")}>
                  <Save size={13} /> Save Configuration
                </button>
              </div>
            </div>
          </>
          )}

          {/* Agent Behavior */}
          {activeTab === "agent" && (
            <div style={s.card}>
              <div style={s.cardHead}>
                <div style={s.cardTitle}>Agent Behavior</div>
                <div style={s.cardDesc}>Tune the heuristics and aggressiveness of the autonomous agent.</div>
              </div>
              <div style={s.cardBody}>
                {/* Aggressiveness */}
                <div style={s.sliderWrap}>
                  <div style={s.sliderRow}>
                    <span style={s.label}>Exploitation Aggressiveness</span>
                    <span style={s.sliderVal}>{agentConfig.aggressiveness}%</span>
                  </div>
                  <input
                    type="range"
                    min={0} max={100} step={1}
                    value={agentConfig.aggressiveness}
                    onChange={(e) => setAgentConfig({ ...agentConfig, aggressiveness: Number(e.target.value) })}
                    style={{ width: "100%", accentColor: "var(--fg)", cursor: "pointer" }}
                  />
                  <span style={s.hint}>Higher values allow the agent to attempt more intrusive exploits and bypasses.</span>
                </div>

                {/* Max Threads */}
                <div style={s.sliderWrap}>
                  <div style={s.sliderRow}>
                    <span style={s.label}>Max Concurrent Threads</span>
                    <span style={s.sliderVal}>{agentConfig.maxThreads}</span>
                  </div>
                  <input
                    type="range"
                    min={1} max={16} step={1}
                    value={agentConfig.maxThreads}
                    onChange={(e) => setAgentConfig({ ...agentConfig, maxThreads: Number(e.target.value) })}
                    style={{ width: "100%", accentColor: "var(--fg)", cursor: "pointer" }}
                  />
                  <span style={s.hint}>Number of parallel tasks the agent can spawn during reconnaissance.</span>
                </div>
              </div>
              <div style={s.cardFoot}>
                {saved && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--sev-low)", marginRight: "auto" }}>
                    <CheckCircle2 size={13} /> Saved
                  </div>
                )}
                <button className="btn-primary" onClick={() => handleSave("agent")}>
                  <Save size={13} /> Save Configuration
                </button>
              </div>
            </div>
          )}

          {/* Jira */}
          {activeTab === "jira" && <JiraIntegrationsManager s={s} />}

          {/* Preferences */}
          {activeTab === "preferences" && (
            <div style={s.card}>
              <div style={s.cardHead}>
                <div style={s.cardTitle}>Global Preferences</div>
                <div style={s.cardDesc}>Configure default workspace and interface settings.</div>
              </div>
              <div style={s.cardBody}>


                <div style={s.field}>
                  <label style={s.label}>Default LLM Model</label>
                  <select
                    style={s.input}
                    value={preferencesConfig.defaultModel}
                    onChange={(e) => setPreferencesConfig({ ...preferencesConfig, defaultModel: e.target.value })}
                  >
                    <option value="openai/gpt-4o">OpenAI GPT-4o</option>
                    <option value="anthropic/claude-3-5-sonnet-latest">Anthropic Claude 3.5 Sonnet</option>
                    <option value="google/gemini-2.5-pro">Google Gemini 2.5 Pro</option>
                    <option value="deepseek/deepseek-v3">DeepSeek v3</option>
                    <option value="groq/llama-3.3-70b-versatile">Groq Llama 3.3 70B</option>
                    <option value="openrouter/auto">OpenRouter Auto</option>
                  </select>
                  <span style={s.hint}>The standard model selected automatically when starting a new scan.</span>
                </div>

                <div style={s.field}>
                  <label style={s.label}>Auto-Delete Scans</label>
                  <select
                    style={s.input}
                    value={preferencesConfig.autoDeleteDays}
                    onChange={(e) => setPreferencesConfig({ ...preferencesConfig, autoDeleteDays: Number(e.target.value) })}
                  >
                    <option value={0}>Never Delete</option>
                    <option value={7}>After 7 Days</option>
                    <option value={30}>After 30 Days</option>
                    <option value={90}>After 90 Days</option>
                  </select>
                  <span style={s.hint}>Scans older than this duration will be automatically deleted from the database to save space.</span>
                </div>
              </div>
              <div style={s.cardFoot}>
                {saved && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--sev-low)", marginRight: "auto" }}>
                    <CheckCircle2 size={13} /> Saved
                  </div>
                )}
                <button className="btn-primary" onClick={() => handleSave("preferences")}>
                  <Save size={13} /> Save Configuration
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
