"use client";

import { useState, useEffect, useCallback } from "react";
import { ShieldAlert, Search, Info, Terminal, Lightbulb, X, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface Vulnerability {
  id: string;
  title: string;
  severity: "critical" | "high" | "medium" | "low";
  endpoint: string;
  method?: string;
  description: string;
  poc?: string;
  cvss?: number;
  remediation?: string;
}

interface Scan {
  id: string;
  target: string;
  status: string;
  vulnerabilities: Vulnerability[];
}

interface VulnWithScan extends Vulnerability {
  scanId: string;
  scanTarget: string;
}

const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };
const SEVERITIES = ["all", "critical", "high", "medium", "low"] as const;

function SeverityBadge({ s, className }: { s: string, className?: string }) {
  const cls: Record<string, string> = {
    critical: "bg-destructive text-destructive-foreground border-destructive/20",
    high: "bg-orange-500 text-white border-orange-500/20",
    medium: "bg-blue-500 text-white border-blue-500/20",
    low: "bg-primary text-primary-foreground border-primary/20",
  };
  return <Badge variant="outline" className={`capitalize ${cls[s] ?? cls.low} ${className}`}>{s}</Badge>;
}

export default function VulnerabilitiesPage() {
  const [allVulns, setAllVulns] = useState<VulnWithScan[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<(typeof SEVERITIES)[number]>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<VulnWithScan | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const res = await fetch("/api/scans");
      const data = await res.json();
      const scans: Scan[] = data.scans ?? [];

      const vulns: VulnWithScan[] = [];
      for (const scan of scans) {
        const detail = await fetch(`/api/scans/${scan.id}`).then((r) => r.json());
        for (const v of detail.vulnerabilities ?? []) {
          vulns.push({ ...v, scanId: scan.id, scanTarget: scan.target });
        }
      }

      vulns.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
      setAllVulns(vulns);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 5000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  const filtered = allVulns.filter((v) => {
    if (filter !== "all" && v.severity !== filter) return false;
    if (
      search &&
      !v.title.toLowerCase().includes(search.toLowerCase()) &&
      !v.endpoint.toLowerCase().includes(search.toLowerCase()) &&
      !v.scanTarget.toLowerCase().includes(search.toLowerCase())
    )
      return false;
    return true;
  });

  const counts = {
    all: allVulns.length,
    critical: allVulns.filter((v) => v.severity === "critical").length,
    high: allVulns.filter((v) => v.severity === "high").length,
    medium: allVulns.filter((v) => v.severity === "medium").length,
    low: allVulns.filter((v) => v.severity === "low").length,
  };

  return (
    <div className="p-8 h-full flex flex-col space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading font-bold tracking-tight">Vulnerabilities</h1>
          <p className="text-muted-foreground">All findings across your security assessments.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {(["critical", "high", "medium", "low"] as const).map((s) => (
          <button
            key={s}
            className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
              filter === s 
                ? "bg-secondary/40 border-primary shadow-[0_0_15px_rgba(0,230,118,0.15)]" 
                : "bg-background/40 border-border/50 hover:bg-secondary/20"
            }`}
            onClick={() => setFilter(filter === s ? "all" : s)}
          >
            <div className="flex flex-col items-start">
              <span className="text-sm font-medium text-muted-foreground capitalize">{s} Severity</span>
              <span className={`text-2xl font-bold ${
                s === 'critical' ? 'text-destructive' : 
                s === 'high' ? 'text-orange-500' : 
                s === 'medium' ? 'text-blue-500' : 
                'text-primary'
              }`}>{counts[s]}</span>
            </div>
            <ShieldAlert className={`w-8 h-8 opacity-20 ${
                s === 'critical' ? 'text-destructive' : 
                s === 'high' ? 'text-orange-500' : 
                s === 'medium' ? 'text-blue-500' : 
                'text-primary'
              }`} />
          </button>
        ))}
      </div>

      <div className="flex-1 flex gap-6 min-h-0">
        <div className="w-1/2 flex flex-col bg-background/40 backdrop-blur-md border border-border/50 rounded-xl overflow-hidden shadow-lg">
          <div className="p-4 border-b border-border/50 space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                className="pl-9 bg-secondary/30 border-border/50" 
                placeholder="Search by title, endpoint, target..." 
                value={search} 
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              {SEVERITIES.map((s) => (
                <Badge
                  key={s}
                  variant={filter === s ? "default" : "outline"}
                  className={`cursor-pointer capitalize px-3 py-1 ${filter === s ? "bg-primary text-primary-foreground hover:bg-primary/90" : "hover:bg-secondary"}`}
                  onClick={() => setFilter(s)}
                >
                  {s} {s !== "all" ? `(${counts[s]})` : `(${counts.all})`}
                </Badge>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {loading ? (
              <div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <ShieldAlert className="w-12 h-12 mb-4 opacity-20" />
                <p className="text-lg font-medium">No vulnerabilities found</p>
                <p className="text-sm">Try changing the filter or search term.</p>
              </div>
            ) : (
              filtered.map((v) => (
                <div
                  key={`${v.scanId}-${v.id}`}
                  onClick={() => setSelected(selected?.id === v.id && selected.scanId === v.scanId ? null : v)}
                  className={`p-4 rounded-lg border transition-all cursor-pointer ${
                    selected?.id === v.id && selected.scanId === v.scanId 
                      ? "bg-secondary/40 border-primary/50 shadow-[0_0_10px_rgba(0,230,118,0.1)]" 
                      : "bg-background border-border/30 hover:bg-secondary/20"
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <SeverityBadge s={v.severity} />
                      {v.cvss && <span className="text-xs font-semibold text-muted-foreground bg-secondary/50 px-2 py-0.5 rounded">CVSS {v.cvss}</span>}
                    </div>
                  </div>
                  <h3 className="font-medium text-foreground mb-2 line-clamp-2">{v.title}</h3>
                  <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground bg-secondary/20 p-2 rounded">
                    <span className="font-bold text-primary">{v.method ?? "GET"}</span>
                    <span className="truncate">{v.endpoint}</span>
                  </div>
                  <div className="mt-3 text-xs text-muted-foreground">Target: <span className="font-medium text-foreground">{v.scanTarget}</span></div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className={`w-1/2 flex flex-col bg-background/40 backdrop-blur-md border border-border/50 rounded-xl overflow-hidden shadow-lg transition-opacity duration-300 ${selected ? "opacity-100" : "opacity-50 pointer-events-none"}`}>
          {selected ? (
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between p-6 border-b border-border/50 bg-secondary/10">
                <div className="flex items-center gap-3">
                  <SeverityBadge s={selected.severity} className="text-sm px-3 py-1" />
                  {selected.cvss && <span className="text-sm font-semibold text-muted-foreground">CVSS {selected.cvss}</span>}
                </div>
                <Button variant="ghost" size="icon" onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground rounded-full">
                  <X className="w-5 h-5" />
                </Button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-8">
                <div>
                  <h2 className="text-2xl font-bold text-foreground mb-4 leading-tight">{selected.title}</h2>
                  <div className="flex flex-col gap-3 p-4 rounded-lg bg-secondary/20 border border-border/30">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground w-16">Target:</span>
                      <a href={`/scans/${selected.scanId}`} className="text-primary hover:underline font-medium">{selected.scanTarget}</a>
                    </div>
                    <div className="flex items-center gap-2 text-sm font-mono">
                      <span className="text-muted-foreground w-16 font-sans">Endpoint:</span>
                      <span className="font-bold text-primary">{selected.method ?? "GET"}</span>
                      <span className="text-foreground break-all">{selected.endpoint}</span>
                    </div>
                  </div>
                </div>

                <section className="space-y-3">
                  <h3 className="text-lg font-semibold flex items-center gap-2 text-foreground">
                    <Info className="w-5 h-5 text-primary" /> Description
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">{selected.description}</p>
                </section>

                {selected.poc && (
                  <section className="space-y-3">
                    <h3 className="text-lg font-semibold flex items-center gap-2 text-foreground">
                      <Terminal className="w-5 h-5 text-primary" /> Proof of Concept
                    </h3>
                    <div className="p-4 rounded-lg bg-black border border-border/50 overflow-x-auto">
                      <pre className="text-sm font-mono text-green-400"><code>{selected.poc}</code></pre>
                    </div>
                  </section>
                )}

                {selected.remediation && (
                  <section className="space-y-3">
                    <h3 className="text-lg font-semibold flex items-center gap-2 text-foreground">
                      <Lightbulb className="w-5 h-5 text-primary" /> Remediation
                    </h3>
                    <div className="p-4 rounded-lg bg-primary/10 border border-primary/30 text-primary-foreground leading-relaxed">
                      {selected.remediation}
                    </div>
                  </section>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <ShieldAlert className="w-16 h-16 mb-6 opacity-10" />
              <p className="text-lg font-medium text-center max-w-[250px]">Select a vulnerability to view details & Proof of Concept</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
