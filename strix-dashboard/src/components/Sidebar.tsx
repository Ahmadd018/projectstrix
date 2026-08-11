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

  return (
    <aside className={`sidebar${collapsed ? " collapsed" : ""}`}>
      {/* Logo */}
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <div className="sidebar-logo-mark" style={{ background: "transparent", width: 32, height: 32 }}>
            <img src="/logo.svg" alt="Logo" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          </div>
          {!collapsed && <span className="sidebar-logo-text">Project Strix</span>}
        </div>
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
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        {/* API Status */}
        <div className="sidebar-api-status">
          <span
            className={`status-dot${apiStatus === "ok" ? " online" : " offline"}`}
          />
          {!collapsed && (
            <span className="sidebar-api-text">
              API {apiStatus === "ok" ? "Online" : apiStatus === "error" ? "Offline" : "…"}
            </span>
          )}
        </div>

        {/* User */}
        <div 
          className="sidebar-user" 
          style={{ position: "relative", cursor: "pointer", transition: "background 0.2s", borderRadius: 8, padding: "8px 12px" }}
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
              borderRadius: 16,
              padding: 24,
              width: 300,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 16,
              boxShadow: "0 20px 40px rgba(0,0,0,0.5)",
              animation: "slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards"
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--fg)", color: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: "bold" }}>
              {user ? user.username.charAt(0).toUpperCase() : "U"}
            </div>
            <div style={{ textAlign: "center" }}>
              <h2 style={{ fontSize: 20, margin: 0, textTransform: "capitalize" }}>{user?.username || "Guest"}</h2>
              <p style={{ color: "var(--fg-3)", fontSize: 13, marginTop: 4 }}>{user?.role === "ADMIN" ? "Administrator" : "Security Engineer"}</p>
            </div>
            <div style={{ width: "100%", background: "var(--bg-2)", padding: 12, borderRadius: 8, fontSize: 12, color: "var(--fg-2)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span>User ID:</span>
                <span style={{ fontFamily: "monospace" }}>{user?.id.split("-")[0]}...</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Status:</span>
                <span style={{ color: "var(--sev-low)" }}>Active</span>
              </div>
            </div>
            <button 
              className="btn-danger" 
              style={{ width: "100%", padding: 10, borderRadius: 8, border: "none", background: "var(--sev-critical-bg)", color: "var(--sev-critical)", cursor: "pointer", fontWeight: 600, transition: "background 0.2s" }}
              onMouseOver={e => e.currentTarget.style.background = "var(--sev-critical-bd)"}
              onMouseOut={e => e.currentTarget.style.background = "var(--sev-critical-bg)"}
              onClick={() => {
                fetch("/api/auth/logout", { method: "POST" }).then(() => {
                  window.location.href = "/login";
                });
              }}
            >
              Sign Out
            </button>
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
