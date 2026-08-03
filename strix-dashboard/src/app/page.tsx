"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Shield, Activity, Target, AlertTriangle, ArrowRight, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Scan {
  id: string;
  target: string;
  status: "running" | "completed" | "failed" | "stopped";
  startedAt: string;
  finishedAt: string | null;
  vulnCount: number;
  scanMode: string;
}

interface Vuln {
  id: string;
  title: string;
  severity: "critical" | "high" | "medium" | "low";
  endpoint: string;
  scanTarget: string;
  scanId: string;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function securityScore(vulns: Vuln[]) {
  if (vulns.length === 0) return 100;
  let deduction = 0;
  for (const v of vulns) {
    if (v.severity === "critical") deduction += 20;
    else if (v.severity === "high") deduction += 10;
    else if (v.severity === "medium") deduction += 4;
    else deduction += 1;
  }
  return Math.max(0, 100 - deduction);
}

export default function Dashboard() {
  const [scans, setScans] = useState<Scan[]>([]);
  const [recentVulns, setRecentVulns] = useState<Vuln[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch("/api/scans", { signal: controller.signal });
      clearTimeout(timeout);
      const data = await res.json();
      const scanList: Scan[] = data.scans ?? [];
      setScans(scanList);

      const vulns: Vuln[] = [];
      for (const scan of scanList.slice(0, 3)) {
        try {
          const detail = await fetch(`/api/scans/${scan.id}`).then((r) => r.json());
          for (const v of detail.vulnerabilities ?? []) {
            vulns.push({ ...v, scanTarget: scan.target, scanId: scan.id });
          }
        } catch {}
      }
      vulns.sort((a, b) => {
        const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
        return order[a.severity] - order[b.severity];
      });
      setRecentVulns(vulns.slice(0, 5));
    } catch {
      clearTimeout(timeout);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const totalVulns = scans.reduce((s, sc) => s + sc.vulnCount, 0);
  const criticalVulns = recentVulns.filter((v) => v.severity === "critical").length;
  const activeScans = scans.filter((s) => s.status === "running").length;
  const score = securityScore(recentVulns);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-3 text-muted-foreground font-medium">Loading dashboard...</span>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 h-full overflow-y-auto">
      <div>
        <h2 className="text-3xl font-heading font-bold tracking-tight mb-2">Overview</h2>
        <p className="text-muted-foreground">Monitor your security posture and active scanning agents.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-background/40 backdrop-blur-md border-border/50 shadow-lg relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Security Score</CardTitle>
            <Shield className={`w-4 h-4 ${score >= 70 ? "text-primary" : score >= 40 ? "text-warning" : "text-destructive"}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-4xl font-bold font-heading ${score >= 70 ? "text-primary drop-shadow-[0_0_10px_rgba(0,230,118,0.5)]" : score >= 40 ? "text-warning" : "text-destructive"}`}>
              {score}/100
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {score >= 70 ? "Good" : score >= 40 ? "Fair" : "Critical"} security posture
            </p>
          </CardContent>
        </Card>

        <Card className="bg-background/40 backdrop-blur-md border-border/50 shadow-lg relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-destructive/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Critical Vulns</CardTitle>
            <AlertTriangle className={`w-4 h-4 ${criticalVulns > 0 ? "text-destructive" : "text-muted-foreground"}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-4xl font-bold font-heading ${criticalVulns > 0 ? "text-destructive drop-shadow-[0_0_10px_rgba(255,76,76,0.5)]" : "text-foreground"}`}>
              {criticalVulns}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {criticalVulns > 0 ? "Immediate action required" : "No critical threats found"}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-background/40 backdrop-blur-md border-border/50 shadow-lg relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-info/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Scans</CardTitle>
            <Activity className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold font-heading text-foreground">{activeScans}</div>
            <p className="text-xs text-muted-foreground mt-2">
              {activeScans > 0 ? "Agents currently analyzing" : "All agents idle"}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-background/40 backdrop-blur-md border-border/50 shadow-lg relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-secondary/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Findings</CardTitle>
            <Target className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold font-heading text-foreground">{totalVulns}</div>
            <p className="text-xs text-muted-foreground mt-2">
              Across {scans.length} historical scans
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Recent Scans */}
        <Card className="bg-background/40 backdrop-blur-md border-border/50 shadow-lg col-span-1">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Scans</CardTitle>
              <CardDescription>Latest autonomous penetration tests.</CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/scans">View All <ArrowRight className="ml-2 w-4 h-4" /></Link>
            </Button>
          </CardHeader>
          <CardContent>
            {scans.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-border/50 rounded-lg">
                <p className="text-muted-foreground mb-4">No scans initiated yet.</p>
                <Button asChild><Link href="/scans?new=1">Start First Scan</Link></Button>
              </div>
            ) : (
              <div className="space-y-4">
                {scans.slice(0, 5).map((scan) => (
                  <Link
                    key={scan.id}
                    href={`/scans/${scan.id}`}
                    className="flex items-center justify-between p-4 rounded-lg bg-secondary/20 border border-border/30 hover:bg-secondary/40 transition-colors"
                  >
                    <div>
                      <p className="font-medium text-foreground truncate max-w-[200px] sm:max-w-[300px]">
                        {scan.target}
                      </p>
                      <div className="flex items-center gap-3 mt-1">
                        <Badge variant="outline" className="text-xs font-normal bg-background/50 text-muted-foreground">
                          {scan.scanMode}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{timeAgo(scan.startedAt)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {scan.vulnCount > 0 && (
                        <Badge variant="destructive" className="px-2 py-0.5 text-xs rounded-full">
                          {scan.vulnCount}
                        </Badge>
                      )}
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium uppercase text-muted-foreground hidden sm:inline-block">
                          {scan.status}
                        </span>
                        <div className={`w-2.5 h-2.5 rounded-full ${scan.status === 'running' ? 'bg-primary animate-pulse' : scan.status === 'failed' ? 'bg-destructive' : scan.status === 'completed' ? 'bg-blue-500' : 'bg-muted-foreground'}`} />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Vulns */}
        <Card className="bg-background/40 backdrop-blur-md border-border/50 shadow-lg col-span-1">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Findings</CardTitle>
              <CardDescription>Most critical vulnerabilities discovered.</CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/vulnerabilities">View All <ArrowRight className="ml-2 w-4 h-4" /></Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentVulns.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-border/50 rounded-lg">
                <p className="text-muted-foreground">No vulnerabilities found in recent scans.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {recentVulns.map((v, i) => (
                  <div key={`${v.scanId}-${v.id}-${i}`} className="flex items-start justify-between p-4 rounded-lg bg-secondary/20 border border-border/30 hover:bg-secondary/40 transition-colors">
                    <div className="flex-1 min-w-0 pr-4">
                      <p className="font-medium text-foreground truncate">{v.title}</p>
                      <p className="text-xs text-muted-foreground truncate mt-1">{v.endpoint}</p>
                    </div>
                    <Badge 
                      className={`shrink-0 capitalize ${
                        v.severity === 'critical' ? 'bg-destructive text-destructive-foreground hover:bg-destructive' : 
                        v.severity === 'high' ? 'bg-orange-500 text-white hover:bg-orange-600' : 
                        v.severity === 'medium' ? 'bg-blue-500 text-white hover:bg-blue-600' : 
                        'bg-primary text-primary-foreground hover:bg-primary'
                      }`}
                    >
                      {v.severity}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
