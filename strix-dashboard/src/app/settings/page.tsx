"use client";

import { useState, useEffect } from "react";
import styles from "./settings.module.css";

export default function Settings() {
  const [activeTab, setActiveTab] = useState("api");
  const [keys, setKeys] = useState({ openai: "", anthropic: "", gemini: "" });
  const [agentConfig, setAgentConfig] = useState({ aggressiveness: 50, maxThreads: 4 });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    // Load from localStorage if available
    const savedKeys = localStorage.getItem("strix_api_keys");
    if (savedKeys) setKeys(JSON.parse(savedKeys));
    
    const savedConfig = localStorage.getItem("strix_agent_config");
    if (savedConfig) setAgentConfig(JSON.parse(savedConfig));
  }, []);

  const handleSave = () => {
    if (activeTab === "api") {
      localStorage.setItem("strix_api_keys", JSON.stringify(keys));
    } else if (activeTab === "agent") {
      localStorage.setItem("strix_agent_config", JSON.stringify(agentConfig));
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Settings</h1>
        <p className={styles.subtitle}>
          Configure global preferences and AI agent behavior.
        </p>
      </div>

      <div className={styles.layout}>
        <div className={styles.sidebar}>
          <button 
            className={`${styles.tab} ${activeTab === "api" ? styles.tabActive : ""}`}
            onClick={() => setActiveTab("api")}
          >
            API Keys
          </button>
          <button 
            className={`${styles.tab} ${activeTab === "agent" ? styles.tabActive : ""}`}
            onClick={() => setActiveTab("agent")}
          >
            Agent Behavior
          </button>
          <button 
            className={`${styles.tab} ${activeTab === "notifications" ? styles.tabActive : ""}`}
            onClick={() => setActiveTab("notifications")}
          >
            Notifications
          </button>
        </div>

        <div className={styles.content}>
          {activeTab === "api" && (
            <div>
              <h2 className={styles.sectionTitle}>API Configuration</h2>
              <div className={styles.formGroup}>
                <label className={styles.label}>OpenAI API Key</label>
                <input 
                  type="password" 
                  className={styles.input} 
                  placeholder="sk-..."
                  value={keys.openai}
                  onChange={e => setKeys({...keys, openai: e.target.value})}
                />
                <span className={styles.hint}>Used for gpt-4o models during penetration testing.</span>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Anthropic API Key</label>
                <input 
                  type="password" 
                  className={styles.input} 
                  placeholder="sk-ant-..."
                  value={keys.anthropic}
                  onChange={e => setKeys({...keys, anthropic: e.target.value})}
                />
                <span className={styles.hint}>Used for claude-3.5-sonnet reasoning capabilities.</span>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Google Gemini API Key</label>
                <input 
                  type="password" 
                  className={styles.input} 
                  placeholder="AIza..."
                  value={keys.gemini}
                  onChange={e => setKeys({...keys, gemini: e.target.value})}
                />
              </div>
              <button className={styles.saveBtn} onClick={handleSave}>Save API Keys</button>
              {saved && <span className={styles.savedMsg}>Saved successfully!</span>}
            </div>
          )}

          {activeTab === "agent" && (
            <div>
              <h2 className={styles.sectionTitle}>Agent Behavior</h2>
              <div className={styles.formGroup}>
                <label className={styles.label}>Exploitation Aggressiveness: {agentConfig.aggressiveness}%</label>
                <input 
                  type="range" 
                  min="0" max="100" 
                  className={styles.slider}
                  value={agentConfig.aggressiveness}
                  onChange={e => setAgentConfig({...agentConfig, aggressiveness: parseInt(e.target.value)})}
                />
                <span className={styles.hint}>Higher values allow the agent to attempt more intrusive exploits.</span>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Max Concurrent Threads: {agentConfig.maxThreads}</label>
                <input 
                  type="range" 
                  min="1" max="16" 
                  className={styles.slider}
                  value={agentConfig.maxThreads}
                  onChange={e => setAgentConfig({...agentConfig, maxThreads: parseInt(e.target.value)})}
                />
                <span className={styles.hint}>Number of parallel tasks the agent can spawn during reconnaissance.</span>
              </div>
              <button className={styles.saveBtn} onClick={handleSave}>Save Configuration</button>
              {saved && <span className={styles.savedMsg}>Saved successfully!</span>}
            </div>
          )}

          {activeTab === "notifications" && (
            <div>
              <h2 className={styles.sectionTitle}>Notifications</h2>
              <p style={{ color: "var(--text-secondary)" }}>Slack/Webhook integrations coming soon.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
