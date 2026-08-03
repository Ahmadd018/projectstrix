"use client";

import { usePathname, useRouter } from "next/navigation";
import styles from "./Header.module.css";

const routeTitles: Record<string, string> = {
  "/": "Dashboard Overview",
  "/scans": "Scans & Targets",
  "/vulnerabilities": "Vulnerabilities",
  "/graph": "Agent Live Graph",
  "/reports": "Compliance Reports",
  "/logs": "System Logs",
  "/api-docs": "API Documentation",
  "/settings": "Settings",
};

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();

  // Match dynamic routes like /scans/[id]
  let title = "Strix Dashboard";
  for (const [route, label] of Object.entries(routeTitles)) {
    if (pathname === route || (route !== "/" && pathname.startsWith(route))) {
      title = label;
      break;
    }
  }

  return (
    <header className={styles.header}>
      <h1 className={styles.title}>{title}</h1>

      <div className={styles.actions}>
        <div className={styles.statusIndicator}>
          <div className={styles.statusDot} />
          Agents Idle
        </div>
        <button
          className="btn btn-primary"
          onClick={() => router.push("/scans?new=1")}
        >
          + New Scan
        </button>
      </div>
    </header>
  );
}
