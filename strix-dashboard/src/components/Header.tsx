"use client";

import { usePathname } from "next/navigation";
import styles from "./Header.module.css";

const routeTitles: Record<string, string> = {
  "/": "Dashboard Overview",
  "/scans": "Scans & Targets",
  "/vulnerabilities": "Vulnerabilities",
  "/graph": "Agent Live Graph",
  "/remediation": "Auto-Fix PRs",
  "/reports": "Compliance Reports",
  "/settings": "Settings",
};

export default function Header() {
  const pathname = usePathname();
  const title = routeTitles[pathname] || "Strix Dashboard";

  return (
    <header className={styles.header}>
      <h1 className={styles.title}>{title}</h1>
      
      <div className={styles.actions}>
        <div className={styles.statusIndicator}>
          <div className={styles.statusDot}></div>
          Agents Idle
        </div>
        <button className="btn btn-primary">
          + New Scan
        </button>
      </div>
    </header>
  );
}
