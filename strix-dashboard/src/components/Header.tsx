"use client";

import { usePathname, useRouter } from "next/navigation";
import { Plus, Bell, Search, Activity } from "lucide-react";

const routeTitles: Record<string, string> = {
  "/":               "Overview",
  "/scans":          "Scans",
  "/vulnerabilities":"Vulnerabilities",
  "/graph":          "Live Graph",
  "/reports":        "Reports",
  "/logs":           "System Logs",
  "/api-docs":       "API Docs",
  "/settings":       "Settings",
};

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();

  let title = "Dashboard";
  for (const [route, label] of Object.entries(routeTitles)) {
    if (pathname === route || (route !== "/" && pathname.startsWith(route))) {
      title = label;
      break;
    }
  }

  return (
    <header className="header">
      <span className="header-title">{title}</span>

      <div className="header-right">
        {/* Search */}
        <div className="header-search">
          <Search className="header-search-icon" size={14} />
          <input type="text" placeholder="Search targets or vulns…" />
        </div>

        {/* Agent status pill */}
        <div className="header-pill">
          <span className="header-pill-dot" />
          <span>Agents Idle</span>
        </div>

        {/* Notifications */}
        <button className="header-icon-btn">
          <Bell size={15} />
          <span className="notif-dot" />
        </button>

        {/* New Scan */}
        <button
          className="btn-primary"
          onClick={() => router.push("/scans?new=1")}
        >
          <Plus size={14} />
          New Scan
        </button>
      </div>
    </header>
  );
}
