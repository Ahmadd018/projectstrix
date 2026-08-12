"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  Radar,
  ShieldAlert,
  Activity,
  FileText,
  TerminalSquare,
  BookOpen,
  Settings,
  Plus,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Users,
} from "lucide-react";

const navItems = [
  { name: "Overview",         path: "/",               icon: LayoutDashboard },
  { name: "Scans",            path: "/scans",           icon: Radar },
  { name: "Vulnerabilities",  path: "/vulnerabilities", icon: ShieldAlert },
  { name: "Live Graph",       path: "/graph",           icon: Activity },
  { name: "Reports",          path: "/reports",         icon: FileText },
  { name: "System Logs",      path: "/logs",            icon: TerminalSquare },
  { name: "API Docs",         path: "/api-docs",        icon: BookOpen },
  { name: "Settings",         path: "/settings",        icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [apiStatus, setApiStatus] = useState<"ok" | "error" | "loading">("loading");
  const [collapsed, setCollapsed] = useState(false);
  const [user, setUser] = useState<{ id: string, username: string, role: string } | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated) {
            setUser(data.user);
          }
        }
      } catch (e) {}
    };
    fetchUser();

    const check = async () => {
      try {
        const r = await fetch("/api/health", { signal: AbortSignal.timeout(3000) });
        setApiStatus(r.ok ? "ok" : "error");
      } catch {
        setApiStatus("error");
      }
    };
    check();
    const iv = setInterval(check, 30000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (user?.role === "ADMIN") {
      fetch("/api/users/pending-count").then(r => r.json()).then(data => {
        setPendingCount(data.pendingCount || 0);
      }).catch(console.error);
    }
  }, [user]);

  return (
    <aside className={`sidebar${collapsed ? " collapsed" : ""}`}>
      {/* Logo */}
      <div className="sidebar-header" style={{ justifyContent: collapsed ? "center" : "space-between" }}>
        {!collapsed && (
          <div className="sidebar-logo">
            <div className="sidebar-logo-mark" style={{ background: "transparent", width: 32, height: 32 }}>
              <img src="/logo.svg" alt="Logo" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
            </div>
            <span className="sidebar-logo-text">Project Strix</span>
          </div>
        )}
        <button
          className="sidebar-collapse-btn"
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? "Expand" : "Collapse"}
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>

      {/* New Scan */}
      <div className="sidebar-new-scan">
        <Link href="/scans?new=1" className="btn-new-scan" title="New Scan">
          <Plus size={14} />
          {!collapsed && "New Scan"}
        </Link>
      </div>

      {/* Nav */}
      <nav className="sidebar-nav">
        {navItems.map((item) => {
          if ((item.path === "/logs" || item.path === "/api-docs") && user?.role !== "ADMIN") {
            return null;
          }

          const active =
            item.path === "/" ? pathname === "/" : pathname.startsWith(item.path);
          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              href={item.path}
              className={`nav-link${active ? " active" : ""}`}
              title={collapsed ? item.name : undefined}
            >
              <Icon className="nav-link-icon" />
              {!collapsed && <span className="nav-link-label">{item.name}</span>}
            </Link>
          );
        })}
        {user?.role === "ADMIN" && (
          <Link 
            href="/users" 
            className={`nav-link${pathname === "/users" ? " active" : ""}`}
            title="Team Management"
          >
            <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Users className="nav-link-icon" />
              {pendingCount > 0 && pathname !== "/users" && (
                <span style={{
                  position: "absolute", top: -4, right: -4, background: "var(--sev-critical)", color: "#fff",
                  fontSize: 10, fontWeight: "bold", width: 14, height: 14, borderRadius: "50%",
                  display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid var(--bg-1)"
                }}>{pendingCount}</span>
              )}
            </div>
            {!collapsed && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                <span className="nav-link-label">Team Control</span>
                {pendingCount > 0 && pathname !== "/users" && (
                  <span style={{ background: "var(--sev-critical)", color: "#fff", padding: "2px 6px", borderRadius: 10, fontSize: 11, fontWeight: "bold" }}>
                    {pendingCount}
                  </span>
                )}
              </div>
            )}
          </Link>
        )}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        {/* API Status */}
        <div className="sidebar-api-status" style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px", justifyContent: collapsed ? "center" : "flex-start" }}>
          <span
            className={`status-dot${apiStatus === "ok" ? " online" : " offline"}`}
          />
          {!collapsed && (
            <span className="sidebar-api-text" style={{ fontSize: 12, color: "var(--fg-3)" }}>
              API {apiStatus === "ok" ? "Online" : apiStatus === "error" ? "Offline" : "…"}
            </span>
          )}
        </div>

        {/* User */}
        <div 
          className="sidebar-user" 
          style={{ 
            position: "relative", cursor: "pointer", transition: "background 0.2s", borderRadius: 8, 
            padding: collapsed ? "8px 0" : "8px 12px", 
            display: "flex", alignItems: "center", gap: 10,
            justifyContent: collapsed ? "center" : "flex-start"
          }}
          onClick={() => setShowProfile(true)}
          onMouseOver={e => e.currentTarget.style.background = "var(--bg-2)"}
          onMouseOut={e => e.currentTarget.style.background = "transparent"}
        >
          <div className="sidebar-avatar">{user ? user.username.charAt(0).toUpperCase() : "U"}</div>
          {!collapsed && (
            <div className="sidebar-user-info" style={{ flex: 1 }}>
              <div className="sidebar-user-name" style={{ textTransform: "capitalize" }}>{user ? user.username : "Loading..."}</div>
              <div className="sidebar-user-role">{user ? (user.role === "ADMIN" ? "Administrator" : "Security Engineer") : ""}</div>
            </div>
          )}
          {!collapsed && user && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                fetch("/api/auth/logout", { method: "POST" }).then(() => {
                  window.location.href = "/login";
                });
              }}
              className="btn-ghost"
              style={{ padding: 6, minHeight: 0, color: "var(--fg-3)" }}
              title="Log Out"
            >
              <LogOut size={14} />
            </button>
          )}
        </div>
      </div>

      {/* User Profile Modal */}
      {showProfile && (
        <div 
          style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(4px)",
            zIndex: 9999,
            display: "flex", alignItems: "center", justifyContent: "center",
            animation: "fade 0.2s forwards"
          }}
          onClick={() => setShowProfile(false)}
        >
          <div 
            style={{
              background: "var(--bg-1)",
              border: "1px solid var(--border)",
              borderRadius: 20,
              padding: 40,
              width: 520,
              maxWidth: "90vw",
              display: "flex",
              flexDirection: "column",
              gap: 28,
              boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)",
              animation: "slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards"
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header / Avatar */}
            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
              <div style={{ 
                width: 72, height: 72, borderRadius: "50%", 
                background: "linear-gradient(135deg, var(--fg) 0%, var(--bg-3) 100%)", 
                color: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", 
                fontSize: 28, fontWeight: "bold",
                boxShadow: "0 8px 16px rgba(0,0,0,0.2)"
              }}>
                {user ? user.username.charAt(0).toUpperCase() : "U"}
              </div>
              <div style={{ flex: 1 }}>
                <h2 style={{ fontSize: 22, margin: 0, textTransform: "capitalize", fontWeight: 700, letterSpacing: "-0.02em" }}>{user?.username || "Guest"}</h2>
                <p style={{ color: "var(--fg-3)", fontSize: 14, marginTop: 4, fontWeight: 500 }}>{user?.role === "ADMIN" ? "System Administrator" : "Security Engineer"}</p>
              </div>
              <div style={{ padding: "6px 12px", background: "rgba(74,222,128,0.1)", color: "#4ade80", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                Active
              </div>
            </div>

            {/* Info Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={{ background: "var(--bg-2)", padding: 16, borderRadius: 12 }}>
                <div style={{ color: "var(--fg-3)", fontSize: 12, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>User ID</div>
                <div style={{ fontFamily: "monospace", fontSize: 13, color: "var(--fg)" }}>{user?.id ? user.id.split("-")[0] : "—"}</div>
              </div>
              <div style={{ background: "var(--bg-2)", padding: 16, borderRadius: 12 }}>
                <div style={{ color: "var(--fg-3)", fontSize: 12, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>Account Tier</div>
                <div style={{ fontSize: 13, color: "var(--fg)", fontWeight: 500 }}>Enterprise</div>
              </div>
              <div style={{ background: "var(--bg-2)", padding: 16, borderRadius: 12 }}>
                <div style={{ color: "var(--fg-3)", fontSize: 12, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>Session IP</div>
                <div style={{ fontFamily: "monospace", fontSize: 13, color: "var(--fg)" }}>127.0.0.1</div>
              </div>
              <div style={{ background: "var(--bg-2)", padding: 16, borderRadius: 12 }}>
                <div style={{ color: "var(--fg-3)", fontSize: 12, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>2FA Status</div>
                <div style={{ fontSize: 13, color: "var(--sev-high)", fontWeight: 500 }}>Disabled</div>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: 14, marginTop: 4 }}>
              <Link 
                href="/settings" 
                onClick={() => setShowProfile(false)}
                style={{ 
                  flex: 1, padding: "14px 0", borderRadius: 12, 
                  border: "1px solid var(--border-hi)", background: "var(--bg-2)", 
                  color: "var(--fg)", cursor: "pointer", fontWeight: 600, fontSize: 14,
                  transition: "all 0.2s ease", textAlign: "center", textDecoration: "none",
                  display: "flex", alignItems: "center", justifyContent: "center"
                }}
                onMouseOver={e => {
                  e.currentTarget.style.background = "var(--bg-3)";
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.3)";
                }}
                onMouseOut={e => {
                  e.currentTarget.style.background = "var(--bg-2)";
                  e.currentTarget.style.borderColor = "var(--border-hi)";
                }}
              >
                Settings
              </Link>
              <button 
                style={{ 
                  flex: 1, padding: "14px 0", borderRadius: 12, 
                  border: "1px solid rgba(255, 59, 59, 0.4)", 
                  background: "rgba(255, 59, 59, 0.15)", 
                  color: "#ff6b6b", cursor: "pointer", fontWeight: 600, fontSize: 14,
                  transition: "all 0.2s ease",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8
                }}
                onMouseOver={e => {
                  e.currentTarget.style.background = "rgba(255, 59, 59, 0.3)";
                  e.currentTarget.style.color = "#ffffff";
                  e.currentTarget.style.borderColor = "rgba(255, 59, 59, 0.8)";
                }}
                onMouseOut={e => {
                  e.currentTarget.style.background = "rgba(255, 59, 59, 0.15)";
                  e.currentTarget.style.color = "#ff6b6b";
                  e.currentTarget.style.borderColor = "rgba(255, 59, 59, 0.4)";
                }}
                onClick={() => {
                  fetch("/api/auth/logout", { method: "POST" }).then(() => {
                    window.location.href = "/login";
                  });
                }}
              >
                <LogOut size={16} />
                Sign Out
              </button>
            </div>
          </div>
          <style dangerouslySetInnerHTML={{__html: `
            @keyframes fade { from { opacity: 0; } to { opacity: 1; } }
            @keyframes slideUp { from { opacity: 0; transform: translateY(20px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
          `}} />
        </div>
      )}
    </aside>
  );
}
