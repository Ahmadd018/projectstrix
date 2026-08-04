"use client";

import { usePathname, useRouter } from "next/navigation";
import { Plus, Bell, Search, CheckCircle2, XCircle, Clock } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";

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

interface InAppNotif {
  id: string;
  title: string;
  message: string;
  type: "success" | "error" | "info";
  time: string;
  read: boolean;
  link?: string;
}

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();

  const [showNotifs, setShowNotifs] = useState(false);
  const [notifs, setNotifs] = useState<InAppNotif[]>([]);
  const activeScansRef = useRef<Record<string, string>>({});
  const initialFetchDone = useRef(false);

  // Load from local storage on mount
  useEffect(() => {
    const saved = localStorage.getItem("strix_inapp_notifs");
    if (saved) {
      try { setNotifs(JSON.parse(saved)); } catch (e) {}
    }
  }, []);

  // Save to local storage when notifs change
  useEffect(() => {
    if (notifs.length > 0) {
      localStorage.setItem("strix_inapp_notifs", JSON.stringify(notifs));
    }
  }, [notifs]);

  const pollScans = useCallback(async () => {
    try {
      const res = await fetch("/api/scans");
      if (!res.ok) return;
      const data = await res.json();
      
      const currentActive = activeScansRef.current;
      const newActive: Record<string, string> = {};
      
      let newNotifs: InAppNotif[] = [];

      for (const scan of data) {
        newActive[scan.id] = scan.status;
        
        // If we already tracked this scan and it changed from running/crawling to completed/failed
        if (
          initialFetchDone.current &&
          (currentActive[scan.id] === "running" || currentActive[scan.id] === "crawling" || currentActive[scan.id] === "scanning" || currentActive[scan.id] === "analyzing") &&
          (scan.status === "completed" || scan.status === "failed")
        ) {
          const type = scan.status === "completed" ? "success" : "error";
          const title = scan.status === "completed" ? "Scan Completed" : "Scan Failed";
          const message = `Scan for ${scan.target} has finished. ${scan.vulnCount > 0 ? `Found ${scan.vulnCount} vulnerabilities.` : "No vulnerabilities found."}`;
          
          newNotifs.push({
            id: Math.random().toString(36).substring(7),
            title,
            message,
            type,
            time: new Date().toISOString(),
            read: false,
            link: `/scans/${scan.id}`
          });
        }
      }

      if (newNotifs.length > 0) {
        setNotifs(prev => [...newNotifs, ...prev].slice(0, 50)); // keep last 50
      }

      activeScansRef.current = newActive;
      initialFetchDone.current = true;
    } catch (e) {}
  }, []);

  useEffect(() => {
    pollScans();
    const interval = setInterval(pollScans, 5000);
    return () => clearInterval(interval);
  }, [pollScans]);

  const unreadCount = notifs.filter(n => !n.read).length;

  const handleNotifClick = (n: InAppNotif) => {
    setNotifs(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x));
    setShowNotifs(false);
    if (n.link) router.push(n.link);
  };

  const markAllRead = () => {
    setNotifs(prev => prev.map(x => ({ ...x, read: true })));
  };

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
        <div style={{ position: "relative" }}>
          <button 
            className="header-icon-btn" 
            onClick={() => setShowNotifs(!showNotifs)}
          >
            <Bell size={15} />
            {unreadCount > 0 && (
              <span className="notif-dot" style={{ display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, width: 14, height: 14, top: 4, right: 4 }}>
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>
          
          {showNotifs && (
            <>
              <div 
                style={{ position: "fixed", inset: 0, zIndex: 90 }} 
                onClick={() => setShowNotifs(false)} 
              />
              <div 
                className="glass-panel animate-fade-in" 
                style={{ 
                  position: "absolute", top: "110%", right: 0, 
                  width: 320, zIndex: 100, padding: 0, 
                  display: "flex", flexDirection: "column",
                  maxHeight: 400, overflow: "hidden",
                  boxShadow: "0 10px 40px rgba(0,0,0,0.3)",
                  border: "1px solid var(--border-md)"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fg)" }}>Notifications</div>
                  {unreadCount > 0 && (
                    <button onClick={markAllRead} style={{ fontSize: 11, color: "var(--fg-3)", background: "none", border: "none", cursor: "pointer" }}>
                      Mark all as read
                    </button>
                  )}
                </div>
                
                <div style={{ overflowY: "auto", flex: 1, padding: "8px 0" }}>
                  {notifs.length === 0 ? (
                    <div style={{ padding: 24, textAlign: "center", color: "var(--fg-3)", fontSize: 12 }}>
                      No notifications yet
                    </div>
                  ) : (
                    notifs.map(n => (
                      <div 
                        key={n.id} 
                        onClick={() => handleNotifClick(n)}
                        style={{ 
                          padding: "12px 16px", 
                          display: "flex", gap: 12,
                          cursor: "pointer",
                          background: n.read ? "transparent" : "var(--bg-2)",
                          borderBottom: "1px solid var(--border)"
                        }}
                      >
                        <div style={{ flexShrink: 0, marginTop: 2 }}>
                          {n.type === "success" ? <CheckCircle2 size={14} color="var(--sev-low)" /> : 
                           n.type === "error" ? <XCircle size={14} color="var(--sev-critical)" /> : 
                           <Clock size={14} color="var(--fg-3)" />}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: n.read ? "var(--fg-2)" : "var(--fg)", marginBottom: 4 }}>
                            {n.title}
                          </div>
                          <div style={{ fontSize: 11, color: "var(--fg-3)", lineHeight: 1.4 }}>
                            {n.message}
                          </div>
                          <div style={{ fontSize: 10, color: "var(--fg-4)", marginTop: 6 }}>
                            {new Date(n.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>

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
