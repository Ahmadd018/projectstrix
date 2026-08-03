"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { 
  LayoutDashboard, 
  Radar, 
  ShieldAlert, 
  ActivitySquare, 
  FileText, 
  TerminalSquare, 
  BookOpen, 
  Settings,
  Plus,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  ShieldX
} from "lucide-react";

const navItems = [
  { name: "Overview", path: "/", icon: LayoutDashboard },
  { name: "Scans", path: "/scans", icon: Radar },
  { name: "Vulnerabilities", path: "/vulnerabilities", icon: ShieldAlert },
  { name: "Live Graph", path: "/graph", icon: ActivitySquare },
  { name: "Reports", path: "/reports", icon: FileText },
  { name: "System Logs", path: "/logs", icon: TerminalSquare },
  { name: "API Docs", path: "/api-docs", icon: BookOpen },
  { name: "Settings", path: "/settings", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [apiStatus, setApiStatus] = useState<"ok" | "error" | "loading">("loading");
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
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
    <aside 
      className={`relative flex flex-col h-full bg-background/95 backdrop-blur-xl border-r border-border transition-all duration-300 ${isCollapsed ? "w-20" : "w-64"}`}
    >
      <div className="flex items-center justify-between p-4 h-16 border-b border-border/50">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="flex items-center justify-center min-w-8 w-8 h-8 rounded-lg bg-primary/20 border border-primary/50 text-primary font-bold">
            S
          </div>
          {!isCollapsed && <span className="font-heading text-lg font-bold tracking-wide whitespace-nowrap">Strix Security</span>}
        </div>
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="text-muted-foreground hover:text-foreground transition-colors p-1"
        >
          {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      <div className="p-4">
        <Link 
          href="/scans?new=1" 
          className={`flex items-center justify-center gap-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-lg p-2.5 transition-all shadow-[0_0_15px_rgba(0,230,118,0.15)] hover:shadow-[0_0_25px_rgba(0,230,118,0.25)] ${isCollapsed ? "" : "w-full"}`}
          title="New Scan"
        >
          <Plus size={18} className="shrink-0" />
          {!isCollapsed && <span className="font-medium whitespace-nowrap">New Scan</span>}
        </Link>
      </div>

      <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto overflow-x-hidden">
        {navItems.map((item) => {
          const isActive = item.path === "/" ? pathname === "/" : pathname.startsWith(item.path);
          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              href={item.path}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all whitespace-nowrap ${isActive ? "bg-primary/10 text-primary border border-primary/20" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
              title={isCollapsed ? item.name : undefined}
            >
              <Icon size={18} className={`shrink-0 ${isActive ? "drop-shadow-[0_0_8px_rgba(0,230,118,0.5)]" : ""}`} />
              {!isCollapsed && <span className="font-medium text-sm">{item.name}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-border/50">
        <div className={`flex items-center gap-3 mb-4 ${isCollapsed ? "justify-center" : ""}`}>
          <div className="relative flex items-center justify-center">
            {apiStatus === "ok" ? (
              <ShieldCheck size={20} className="text-primary drop-shadow-[0_0_8px_rgba(0,230,118,0.5)]" />
            ) : (
              <ShieldX size={20} className="text-destructive drop-shadow-[0_0_8px_rgba(255,76,76,0.5)]" />
            )}
            <span className={`absolute top-0 right-0 w-2 h-2 rounded-full ${apiStatus === "ok" ? "bg-primary animate-pulse" : "bg-destructive"}`}></span>
          </div>
          {!isCollapsed && (
            <div className="flex flex-col">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">API Status</span>
              <span className={`text-sm font-medium ${apiStatus === "ok" ? "text-primary" : "text-destructive"}`}>
                {apiStatus === "ok" ? "Online" : "Offline"}
              </span>
            </div>
          )}
        </div>

        <div className={`flex items-center gap-3 ${isCollapsed ? "justify-center" : ""}`}>
          <div className="w-8 h-8 rounded-full bg-secondary border border-border flex items-center justify-center text-sm font-bold text-foreground shrink-0">
            A
          </div>
          {!isCollapsed && (
            <div className="flex flex-col overflow-hidden">
              <span className="text-sm font-medium text-foreground truncate">Admin User</span>
              <span className="text-xs text-muted-foreground truncate">Security Engineer</span>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
