"use client";

import { usePathname, useRouter } from "next/navigation";
import { Button } from "./ui/button";
import { Plus, Bell, Search, Activity } from "lucide-react";
import { Input } from "./ui/input";

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
    <header className="sticky top-0 z-50 flex items-center justify-between px-6 h-16 bg-background/80 backdrop-blur-md border-b border-border/50">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-heading font-semibold tracking-tight">{title}</h1>
      </div>

      <div className="flex items-center gap-6">
        <div className="relative hidden md:flex items-center">
          <Search className="absolute left-3 text-muted-foreground w-4 h-4" />
          <Input 
            type="text" 
            placeholder="Search targets or vulns..." 
            className="pl-9 w-64 bg-secondary/50 border-border/50 focus-visible:ring-primary/50"
          />
        </div>

        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground bg-secondary/30 px-3 py-1.5 rounded-full border border-border/50">
          <Activity className="w-4 h-4 text-primary" />
          <span className="hidden sm:inline">Agents Idle</span>
        </div>
        
        <button className="relative p-2 text-muted-foreground hover:text-foreground transition-colors">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-destructive border-2 border-background"></span>
        </button>

        <Button
          onClick={() => router.push("/scans?new=1")}
          className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_0_15px_rgba(0,230,118,0.2)]"
        >
          <Plus size={16} />
          New Scan
        </Button>
      </div>
    </header>
  );
}
