"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock, User } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Login failed");
      }

      router.push("/");
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <div className="card animate-fade-in" style={{ width: "100%", maxWidth: 400, padding: 32, display: "flex", flexDirection: "column", gap: 24, boxShadow: "0 20px 40px rgba(0,0,0,0.5)" }}>
      <div style={{ textAlign: "center" }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, color: "var(--fg)", marginBottom: 8 }}>Welcome back</h1>
        <p style={{ fontSize: 14, color: "var(--fg-3)" }}>Log in to access your Strix dashboard.</p>
      </div>

      <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="field">
          <label className="field-label">Username</label>
          <div style={{ position: "relative" }}>
            <User size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--fg-3)" }} />
            <input
              className="field-input"
              style={{ paddingLeft: 40 }}
              placeholder="admin"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
              autoFocus
              required
            />
          </div>
        </div>

        <div className="field">
          <label className="field-label">Password</label>
          <div style={{ position: "relative" }}>
            <Lock size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--fg-3)" }} />
            <input
              className="field-input"
              style={{ paddingLeft: 40 }}
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              required
            />
          </div>
        </div>

        {error && (
          <div style={{ padding: "10px 12px", background: "var(--sev-critical-bg)", border: "1px solid var(--sev-critical-bd)", borderRadius: "var(--r)", fontSize: 13, color: "var(--sev-critical)", textAlign: "center" }}>
            {error}
          </div>
        )}

        <button type="submit" className="btn-primary" style={{ width: "100%", justifyContent: "center", marginTop: 8 }} disabled={loading}>
          {loading ? <><Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> Authenticating...</> : "Log In"}
        </button>
      </form>

      <div style={{ textAlign: "center", fontSize: 13, color: "var(--fg-3)" }}>
        Don't have an account? <a href="/register" style={{ color: "var(--accent)", textDecoration: "none", fontWeight: 500 }}>Create one</a>
      </div>
    </div>
  );
}
