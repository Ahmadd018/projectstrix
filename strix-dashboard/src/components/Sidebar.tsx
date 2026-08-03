"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./Sidebar.module.css";

const navItems = [
  { name: "Overview", path: "/", icon: "📊" },
  { name: "Scans", path: "/scans", icon: "🎯" },
  { name: "Vulnerabilities", path: "/vulnerabilities", icon: "🛡️" },
  { name: "Live Graph", path: "/graph", icon: "🕸️" },
  { name: "Auto-Fix PRs", path: "/remediation", icon: "🔧" },
  { name: "Reports", path: "/reports", icon: "📄" },
  { name: "Settings", path: "/settings", icon: "⚙️" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className={styles.sidebar}>
      <div className={styles.logo}>
        <div className={styles.logoIcon}>S</div>
        <div className={styles.logoText}>Strix</div>
      </div>

      <nav className={styles.nav}>
        {navItems.map((item) => {
          const isActive = pathname === item.path;
          return (
            <Link
              key={item.name}
              href={item.path}
              className={`${styles.navItem} ${isActive ? styles.navItemActive : ""}`}
            >
              <span className={styles.icon}>{item.icon}</span>
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      <div className={styles.footer}>
        <div className={styles.userProfile}>
          <div className={styles.avatar}>A</div>
          <div className={styles.userInfo}>
            <span className={styles.userName}>Admin User</span>
            <span className={styles.userRole}>Security Engineer</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
