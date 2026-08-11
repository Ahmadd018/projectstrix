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
          <div className="sidebar-logo-mark" style={{ background: "transparent" }}>
            <img src="/logo.png" alt="Logo" style={{ width: 28, height: 28, objectFit: "contain" }} />
          </div>
          {!collapsed && <span className="sidebar-logo-text">Strix Security</span>}
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
        <div className="sidebar-user" style={{ position: "relative" }}>
          <div className="sidebar-avatar">{user ? user.username.charAt(0).toUpperCase() : "U"}</div>
          {!collapsed && (
            <div className="sidebar-user-info" style={{ flex: 1 }}>
              <div className="sidebar-user-name" style={{ textTransform: "capitalize" }}>{user ? user.username : "Loading..."}</div>
              <div className="sidebar-user-role">{user ? (user.role === "ADMIN" ? "Administrator" : "Security Engineer") : ""}</div>
            </div>
          )}
          {!collapsed && user && (
            <button
              onClick={async () => {
                await fetch("/api/auth/logout", { method: "POST" });
                window.location.href = "/login";
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
    </aside>
  );
}
