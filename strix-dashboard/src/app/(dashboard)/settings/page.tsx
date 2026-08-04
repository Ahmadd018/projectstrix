"use client";

import { useState, useEffect } from "react";
import { Key, Bot, BellRing, Save, CheckCircle2, ChevronRight } from "lucide-react";

const TABS = [
  { id: "api",           label: "API Keys",      icon: Key },
  { id: "agent",         label: "Agent Behavior", icon: Bot },
  { id: "notifications", label: "Notifications",  icon: BellRing },
];

export default function Settings() {
  const [activeTab, setActiveTab] = useState("api");
  const [keys, setKeys] = useState({ openai: "", anthropic: "", gemini: "", deepseek: "", groq: "", openrouter: "", mistral: "", cohere: "" });
  const [agentConfig, setAgentConfig] = useState({ aggressiveness: 50, maxThreads: 4 });
  const [notificationConfig, setNotificationConfig] = useState({ webhookUrl: "", notifyOnStart: false, notifyOnFinish: true });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const savedKeys = localStorage.getItem("strix_api_keys");
    if (savedKeys) setKeys(JSON.parse(savedKeys));
    const savedConfig = localStorage.getItem("strix_agent_config");
    if (savedConfig) setAgentConfig(JSON.parse(savedConfig));
    const savedNotifs = localStorage.getItem("strix_notification_config");
    if (savedNotifs) setNotificationConfig(JSON.parse(savedNotifs));
  }, []);

  const handleSave = (tab: "api" | "agent" | "notifications") => {
    if (tab === "api") localStorage.setItem("strix_api_keys", JSON.stringify(keys));
    else if (tab === "agent") localStorage.setItem("strix_agent_config", JSON.stringify(agentConfig));
    else if (tab === "notifications") localStorage.setItem("strix_notification_config", JSON.stringify(notificationConfig));
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
          {/* API Keys */}
          {activeTab === "api" && (
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
                ] as const).map(({ key, label, placeholder, hint }) => (
                  <div key={key} style={s.field}>
                    <label style={s.label}>{label}</label>
                    <input
                      style={s.input}
                      type="password"
                      placeholder={placeholder}
                      value={keys[key]}
                      onChange={(e) => setKeys({ ...keys, [key]: e.target.value })}
                    />
                    <span style={s.hint}>{hint}</span>
                  </div>
                ))}
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

          {/* Notifications */}
          {activeTab === "notifications" && (
            <div style={s.card}>
              <div style={s.cardHead}>
                <div style={s.cardTitle}>Webhook Notifications</div>
                <div style={s.cardDesc}>Configure webhook URLs to receive scan updates in Slack, Discord, or other services.</div>
              </div>
              <div style={s.cardBody}>
                <div style={s.field}>
                  <label style={s.label}>Webhook URL</label>
                  <input
                    style={s.input}
                    type="url"
                    placeholder="https://hooks.slack.com/... or Discord webhook"
                    value={notificationConfig.webhookUrl}
                    onChange={(e) => setNotificationConfig({ ...notificationConfig, webhookUrl: e.target.value })}
                  />
                  <span style={s.hint}>Standard JSON payload is sent via POST. For Discord, append /slack to the webhook URL.</span>
                </div>
                
                <div style={{ ...s.field, flexDirection: "row", alignItems: "center", gap: 12, marginTop: 12 }}>
                  <input
                    type="checkbox"
                    id="notifyStart"
                    checked={notificationConfig.notifyOnStart}
                    onChange={(e) => setNotificationConfig({ ...notificationConfig, notifyOnStart: e.target.checked })}
                    style={{ width: 16, height: 16, accentColor: "var(--fg)", cursor: "pointer" }}
                  />
                  <div>
                    <label htmlFor="notifyStart" style={{ ...s.label, marginBottom: 2, cursor: "pointer" }}>Notify on Scan Start</label>
                    <div style={s.hint}>Sends an alert when a scan begins execution.</div>
                  </div>
                </div>

                <div style={{ ...s.field, flexDirection: "row", alignItems: "center", gap: 12, marginTop: 12 }}>
                  <input
                    type="checkbox"
                    id="notifyFinish"
                    checked={notificationConfig.notifyOnFinish}
                    onChange={(e) => setNotificationConfig({ ...notificationConfig, notifyOnFinish: e.target.checked })}
                    style={{ width: 16, height: 16, accentColor: "var(--fg)", cursor: "pointer" }}
                  />
                  <div>
                    <label htmlFor="notifyFinish" style={{ ...s.label, marginBottom: 2, cursor: "pointer" }}>Notify on Scan Finish</label>
                    <div style={s.hint}>Sends an alert containing vulnerability counts and final status when a scan completes.</div>
                  </div>
                </div>
              </div>
              <div style={s.cardFoot}>
                {saved && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--sev-low)", marginRight: "auto" }}>
                    <CheckCircle2 size={13} /> Saved
                  </div>
                )}
                <button className="btn-primary" onClick={() => handleSave("notifications")}>
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
