"use client";

import React, { useState, useEffect, useCallback, Suspense, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { 
  Play, 
  Trash2, 
  Square, 
  Folder, 
  FolderOpen, 
  Search, 
  Plus, 
  Loader2, 
  Settings2,
  ChevronDown,
  ChevronRight
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";

interface Scan {
  id: string;
  target: string;
  projectName?: string;
  llmModel: string;
  scanMode: string;
  status: "running" | "completed" | "failed" | "stopped" | "crawling" | "scanning" | "analyzing";
  startedAt: string;
  finishedAt: string | null;
  vulnCount: number;
}

const LLM_MODELS = [
  { value: "openai/gpt-4o", label: "OpenAI GPT-4o" },
  { value: "openai/gpt-4o-mini", label: "OpenAI GPT-4o Mini" },
  { value: "openai/o1-preview", label: "OpenAI o1-Preview" },
  { value: "anthropic/claude-3-5-sonnet-latest", label: "Anthropic Claude 3.5 Sonnet" },
  { value: "google/gemini-2.5-pro", label: "Google Gemini 2.5 Pro" },
  { value: "deepseek/deepseek-coder", label: "DeepSeek Coder" },
];

const SCAN_MODES = [
  { value: "quick", label: "Quick - Fast scan" },
  { value: "standard", label: "Standard - Full assessment" },
  { value: "deep", label: "Deep - Exhaustive pentest" },
];

function timeAgo(iso: string) {
  if (!iso) return "Unknown";
  const time = new Date(iso).getTime();
  if (isNaN(time)) return "Unknown";
  const diff = Date.now() - time;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function StatusBadge({ status }: { status: Scan["status"] | string }) {
  const isRunning = ["crawling", "scanning", "analyzing", "running"].includes(status);
  if (isRunning) return <Badge variant="outline" className="border-primary text-primary bg-primary/10 animate-pulse capitalize">{status}</Badge>;
  if (status === "completed") return <Badge variant="outline" className="border-blue-500 text-blue-500 bg-blue-500/10 capitalize">{status}</Badge>;
  if (status === "failed") return <Badge variant="destructive" className="capitalize">{status}</Badge>;
  return <Badge variant="secondary" className="capitalize">{status}</Badge>;
}

function ScansContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [scans, setScans] = useState<Scan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "finished">("all");
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const [form, setForm] = useState({
    target: "",
    projectName: "",
    targetList: "",
    llmModel: "openai/gpt-4o",
    apiKey: "",
    scanMode: "standard",
    instruction: "",
    simulationMode: false,
    scopeMode: "auto",
    diffBase: "",
    configFile: "",
    maxBudget: "",
    maxTurns: "",
    resumeRun: "",
    scheduledAt: "",
  });

  const fetchScans = useCallback(async () => {
    try {
      const res = await fetch("/api/scans");
      const data = await res.json();
      setScans(data.scans ?? []);
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchScans();
    const interval = setInterval(fetchScans, 3000);
    return () => clearInterval(interval);
  }, [fetchScans]);

  useEffect(() => {
    if (searchParams.get("new") === "1") setShowModal(true);
  }, [searchParams]);

  const filteredScans = scans.filter((scan) => {
    if (filter === "all") return true;
    const isFinished = ["completed", "failed", "stopped"].includes(scan.status);
    return filter === "active" ? !isFinished : isFinished;
  });

  const groupedScans = useMemo(() => {
    const groups: Record<string, Scan[]> = {};
    for (const scan of filteredScans) {
      let group = scan.projectName;
      if (!group) {
        try {
          group = new URL(scan.target.startsWith("http") ? scan.target : `http://${scan.target}`).hostname;
        } catch {
          group = "Other";
        }
      }
      if (!group) group = "Other";
      if (!groups[group]) groups[group] = [];
      groups[group].push(scan);
    }
    return groups;
  }, [filteredScans]);

  const toggleGroup = (groupName: string) => {
    setCollapsedGroups(prev => ({ ...prev, [groupName]: !prev[groupName] }));
  };

  async function handleLaunch(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.target.trim() && !form.targetList.trim()) return setError("Target is required");
    if (!form.apiKey.trim() && !form.simulationMode) return setError("LLM API Key is required");
    
    setLaunching(true);
    try {
      const res = await fetch("/api/scans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to start scan");
      
      setShowModal(false);
      router.push(`/scans/${data.scanId}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLaunching(false);
    }
  }

  async function handleStop(id: string, e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    await fetch(`/api/scans/${id}`, { method: "DELETE" });
    fetchScans();
  }

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    if (confirm("Permanently delete this scan?")) {
      await fetch(`/api/scans/${id}?purge=true`, { method: "DELETE" });
      fetchScans();
    }
  }

  return (
    <div className="p-8 h-full flex flex-col space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading font-bold tracking-tight">Scans</h1>
          <p className="text-muted-foreground">Launch and monitor your security assessments.</p>
        </div>
        <Dialog open={showModal} onOpenChange={setShowModal}>
          <DialogTrigger render={<Button className="gap-2 shadow-[0_0_20px_rgba(0,230,118,0.2)] hover:shadow-[0_0_30px_rgba(0,230,118,0.4)] transition-all" />}>
            <Plus className="w-4 h-4" /> New Scan
          </DialogTrigger>
          <DialogContent className="sm:max-w-[700px] bg-background/90 backdrop-blur-xl border-border/50 max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl font-heading">Launch New Scan</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleLaunch} className="space-y-6 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Target URL / Path</Label>
                  <Input 
                    placeholder="https://app.example.com" 
                    value={form.target} onChange={e => setForm({...form, target: e.target.value})}
                    disabled={launching}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Project Group</Label>
                  <Input 
                    list="groups" placeholder="Auto-detected if empty"
                    value={form.projectName} onChange={e => setForm({...form, projectName: e.target.value})}
                    disabled={launching}
                  />
                  <datalist id="groups">{Object.keys(groupedScans).map(g => <option key={g} value={g}/>)}</datalist>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>LLM Model</Label>
                  <Select value={form.llmModel} onValueChange={v => setForm({...form, llmModel: v})} disabled={launching}>
                    <SelectTrigger><SelectValue placeholder="Select model" /></SelectTrigger>
                    <SelectContent>
                      {LLM_MODELS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Scan Mode</Label>
                  <Select value={form.scanMode} onValueChange={v => setForm({...form, scanMode: v})} disabled={launching}>
                    <SelectTrigger><SelectValue placeholder="Select mode" /></SelectTrigger>
                    <SelectContent>
                      {SCAN_MODES.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>API Key {!form.simulationMode && <span className="text-destructive">*</span>}</Label>
                <Input 
                  type="password" placeholder="sk-..." 
                  value={form.apiKey} onChange={e => setForm({...form, apiKey: e.target.value})}
                  disabled={launching || form.simulationMode}
                />
              </div>

              <label className="flex items-center gap-3 cursor-pointer p-3 border border-border/50 rounded-lg hover:bg-secondary/20 transition-colors">
                <input 
                  type="checkbox" className="w-5 h-5 accent-primary"
                  checked={form.simulationMode} onChange={e => setForm({...form, simulationMode: e.target.checked})}
                  disabled={launching}
                />
                <div>
                  <p className="font-medium text-sm">Simulation Mode</p>
                  <p className="text-xs text-muted-foreground">Inject mock vulnerabilities for UI demonstration.</p>
                </div>
              </label>

              <Button type="button" variant="ghost" className="w-full flex justify-between" onClick={() => setShowAdvanced(!showAdvanced)}>
                <span className="flex items-center gap-2"><Settings2 className="w-4 h-4"/> Advanced Configuration</span>
                {showAdvanced ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </Button>

              {showAdvanced && (
                <div className="space-y-4 border-l-2 border-border/50 pl-4">
                  <div className="space-y-2">
                    <Label>Scheduled Time</Label>
                    <Input 
                      type="datetime-local" 
                      value={form.scheduledAt} onChange={e => setForm({...form, scheduledAt: e.target.value})}
                    />
                  </div>
                </div>
              )}

              {error && <div className="p-3 rounded bg-destructive/20 text-destructive text-sm font-medium border border-destructive/50">{error}</div>}

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowModal(false)} disabled={launching}>Cancel</Button>
                <Button type="submit" disabled={launching} className="bg-primary text-primary-foreground hover:bg-primary/90">
                  {launching ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Launching...</> : <><Play className="w-4 h-4 mr-2"/> Launch Scan</>}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="flex-1 flex flex-col min-h-0 bg-background/40 backdrop-blur-md border-border/50 shadow-xl overflow-hidden">
        <div className="p-4 border-b border-border/50 bg-secondary/10">
          <Tabs value={filter} onValueChange={(v: any) => setFilter(v)} className="w-[400px]">
            <TabsList className="grid w-full grid-cols-3 bg-background/50">
              <TabsTrigger value="all">All Scans</TabsTrigger>
              <TabsTrigger value="active">Active</TabsTrigger>
              <TabsTrigger value="finished">Finished</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="flex-1 overflow-y-auto p-0">
          {loading ? (
            <div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
          ) : filteredScans.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <Search className="w-12 h-12 mb-4 opacity-20" />
              <p className="text-lg font-medium">No scans found</p>
              <p className="text-sm">Start a new scan to see results here.</p>
            </div>
          ) : (
            <div className="w-full text-sm">
              <div className="grid grid-cols-12 gap-4 p-4 border-b border-border/50 text-muted-foreground font-medium uppercase text-xs tracking-wider sticky top-0 bg-background/95 backdrop-blur z-10">
                <div className="col-span-3">Target</div>
                <div className="col-span-2">Mode</div>
                <div className="col-span-2">Model</div>
                <div className="col-span-2">Status</div>
                <div className="col-span-1">Vulns</div>
                <div className="col-span-2 text-right">Actions</div>
              </div>
              
              {Object.entries(groupedScans).map(([group, groupScans]) => {
                const isCollapsed = collapsedGroups[group];
                return (
                  <div key={group} className="border-b border-border/20 last:border-0">
                    <div 
                      className="flex items-center gap-3 p-3 bg-secondary/5 hover:bg-secondary/10 cursor-pointer transition-colors border-y border-border/30"
                      onClick={() => toggleGroup(group)}
                    >
                      {isCollapsed ? <Folder className="w-4 h-4 text-primary" /> : <FolderOpen className="w-4 h-4 text-primary" />}
                      <span className="font-semibold text-foreground tracking-wide">{group}</span>
                      <Badge variant="secondary" className="ml-auto bg-background/50">{groupScans.length}</Badge>
                    </div>

                    {!isCollapsed && (
                      <div className="divide-y divide-border/20">
                        {groupScans.map(scan => (
                          <div 
                            key={scan.id} 
                            onClick={() => router.push(`/scans/${scan.id}`)}
                            className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-secondary/20 cursor-pointer transition-colors group"
                          >
                            <div className="col-span-3 font-medium text-foreground truncate pr-4">{scan.target}</div>
                            <div className="col-span-2 text-muted-foreground capitalize">{scan.scanMode}</div>
                            <div className="col-span-2 text-muted-foreground text-xs truncate">{scan.llmModel}</div>
                            <div className="col-span-2"><StatusBadge status={scan.status} /></div>
                            <div className="col-span-1">
                              {scan.vulnCount > 0 ? (
                                <Badge variant="destructive" className="rounded-full px-2">{scan.vulnCount}</Badge>
                              ) : <span className="text-muted-foreground opacity-50">—</span>}
                            </div>
                            <div className="col-span-2 flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                              {scan.status === "running" ? (
                                <Button size="icon" variant="outline" className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={(e) => handleStop(scan.id, e)} title="Stop">
                                  <Square className="w-4 h-4" />
                                </Button>
                              ) : (
                                <Button size="icon" variant="outline" className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" onClick={(e) => handleDelete(scan.id, e)} title="Delete">
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

export default function ScansPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>}>
      <ScansContent />
    </Suspense>
  );
}
