"use client";

import { Lock, LogOut } from "lucide-react";

export default function PendingLockScreen() {
  return (
    <div style={{
      position: "fixed",
      top: 0, left: 0, right: 0, bottom: 0,
      background: "var(--bg)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 9999,
    }}>
      <div style={{
        background: "var(--bg-1)",
        border: "1px solid var(--border)",
        padding: "48px",
        borderRadius: "24px",
        textAlign: "center",
        maxWidth: 400,
        boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)",
        animation: "blurSlideIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards"
      }}>
        <div style={{
          width: 80, height: 80, borderRadius: "50%",
          background: "rgba(250,204,21,0.1)", color: "#facc15",
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 24px auto",
          boxShadow: "0 0 30px rgba(250,204,21,0.2)"
        }}>
          <Lock size={40} />
        </div>
        <h2 style={{ fontSize: 24, margin: "0 0 12px 0", color: "var(--fg)", fontWeight: 700 }}>Account Locked</h2>
        <p style={{ color: "var(--fg-3)", fontSize: 15, margin: "0 0 32px 0", lineHeight: 1.6 }}>
          Your registration was successful, but your account is currently pending administrator approval.
          You will not be able to access the dashboard until an admin approves your request.
        </p>
        <button
          className="btn-ghost"
          onClick={() => {
            fetch("/api/auth/logout", { method: "POST" }).then(() => {
              window.location.href = "/login";
            });
          }}
          style={{ width: "100%", padding: "14px", display: "flex", justifyContent: "center", alignItems: "center", gap: 10, fontSize: 15, color: "var(--sev-critical)" }}
        >
          <LogOut size={18} />
          Sign Out
        </button>
      </div>
    </div>
  );
}
