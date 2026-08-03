"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import styles from "./Sidebar.module.css";

const navItems = [
  { name: "Overview", path: "/" },
  { name: "Scans", path: "/scans" },
  { name: "Vulnerabilities", path: "/vulnerabilities" },
  { name: "Live Graph", path: "/graph" },
  { name: "Reports", path: "/reports" },
  { name: "System Logs", path: "/logs" },
  { name: "API Docs", path: "/api-docs" },
  { name: "Settings", path: "/settings" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [apiStatus, setApiStatus] = useState<"ok" | "error" | "loading">(
    "loading",
  );
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    const check = async () => {
      try {
        const r = await fetch("/api/health", {
          signal: AbortSignal.timeout(3000),
        });
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
    <aside className={`${styles.sidebar} ${isCollapsed ? styles.collapsed : ""}`}>
      <div className={styles.headerRow}>
        <div className={styles.logo}>
          <div className={styles.logoIcon}>S</div>
          {!isCollapsed && <div className={styles.logoText}>Strix</div>}
        </div>
        <button 
          className={styles.collapseBtn} 
          onClick={() => setIsCollapsed(!isCollapsed)}
          title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {isCollapsed ? "»" : "«"}
        </button>
      </div>

      {/* New Scan CTA */}
      <Link href="/scans?new=1" className={styles.newScanBtn} title="New Scan">
        <span className={styles.plusIcon}>＋</span>
        {!isCollapsed && <span>New Scan</span>}
      </Link>

      <nav className={styles.nav}>
        {navItems.map((item) => {
          const isActive =
            item.path === "/"
              ? pathname === "/"
              : pathname.startsWith(item.path);
          return (
            <Link
              key={item.name}
              href={item.path}
              className={`${styles.navItem} ${isActive ? styles.navItemActive : ""}`}
              title={isCollapsed ? item.name : undefined}
            >
              <span className={styles.icon}>-</span>
              {!isCollapsed && <span>{item.name}</span>}
            </Link>
          );
        })}
      </nav>

      <div className={styles.footer}>
        {/* Health indicator */}
        <div className={styles.healthBadge} title={apiStatus === "ok" ? "API Online" : "API Offline"}>
          <span
            className={styles.healthDot}
            style={{
              background:
                apiStatus === "ok"
                  ? "var(--accent-primary)"
                  : apiStatus === "error"
                    ? "var(--accent-danger)"
                    : "var(--text-secondary)",
              boxShadow:
                apiStatus === "ok" ? "0 0 6px var(--accent-primary)" : "none",
            }}
          />
          {!isCollapsed && (
            <>
              <span className={styles.healthLabel}>
                {apiStatus === "ok"
                  ? "API Online"
                  : apiStatus === "error"
                    ? "API Offline"
                    : "Checking…"}
              </span>
              <Link href="/api-docs" className={styles.docsChip}>
                Swagger
              </Link>
            </>
          )}
        </div>

        <div className={styles.userProfile}>
          <div className={styles.avatar}>A</div>
          {!isCollapsed && (
            <div className={styles.userInfo}>
              <span className={styles.userName}>Admin User</span>
              <span className={styles.userRole}>Security Engineer</span>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
