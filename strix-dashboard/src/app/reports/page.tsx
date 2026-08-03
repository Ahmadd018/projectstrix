"use client";

import { useEffect, useState } from "react";
import { Download, FileText, CheckCircle2, XCircle, AlertCircle, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

interface Scan {
  id: string;
  target: string;
  status: string;
  vulnCount: number;
  startedAt: string;
  projectName?: string;
}

export default function Reports() {
  const [scans, setScans] = useState<Scan[]>([]);
  const [selectedScan, setSelectedScan] = useState<Scan | null>(null);

  useEffect(() => {
    fetch("/api/scans")
      .then(r => r.json())
      .then(d => {
        if (d.scans) {
          const completed = d.scans.filter((s: Scan) => ["completed", "stopped"].includes(s.status));
          setScans(completed);
        }
      });
  }, []);

  const handleDownload = () => {
    if (!selectedScan) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(selectedScan, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `report-${selectedScan.id}.json`);
    dlAnchorElem.click();
  };

  return (
    <div className="p-8 h-full flex flex-col space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading font-bold tracking-tight">Scan Reports</h1>
          <p className="text-muted-foreground">
            Generate and download executive summaries for completed scans.
          </p>
        </div>
      </div>

      <Card className="flex-1 overflow-hidden bg-background/40 backdrop-blur-md border-border/50 shadow-xl flex flex-col min-h-0">
        <div className="flex-1 overflow-y-auto">
          {scans.length > 0 ? (
            <div className="w-full text-sm">
              <div className="grid grid-cols-12 gap-4 p-4 border-b border-border/50 text-muted-foreground font-medium uppercase text-xs tracking-wider sticky top-0 bg-background/95 backdrop-blur z-10">
                <div className="col-span-3">Project</div>
                <div className="col-span-4">Target</div>
                <div className="col-span-2">Date</div>
                <div className="col-span-1">Issues</div>
                <div className="col-span-2 text-right">Action</div>
              </div>
              
              <div className="divide-y divide-border/20">
                {scans.map(scan => (
                  <div key={scan.id} className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-secondary/20 transition-colors">
                    <div className="col-span-3 font-medium text-foreground truncate">{scan.projectName || "Default"}</div>
                    <div className="col-span-4 text-muted-foreground truncate font-mono text-xs">{scan.target}</div>
                    <div className="col-span-2 text-muted-foreground flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(scan.startedAt).toLocaleDateString()}
                    </div>
                    <div className="col-span-1">
                      {scan.vulnCount > 0 ? (
                        <Badge variant="destructive" className="rounded-full px-2">{scan.vulnCount}</Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground border-border/50">0</Badge>
                      )}
                    </div>
                    <div className="col-span-2 flex justify-end">
                      <Button variant="outline" size="sm" className="gap-2 border-primary/20 text-primary hover:bg-primary hover:text-primary-foreground" onClick={() => setSelectedScan(scan)}>
                        <FileText className="w-4 h-4" /> Report
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-20">
              <FileText className="w-12 h-12 mb-4 opacity-20" />
              <h3 className="text-lg font-medium text-foreground">No Completed Scans Found</h3>
              <p className="text-sm">Run a scan to completion to generate a report.</p>
            </div>
          )}
        </div>
      </Card>

      <Dialog open={!!selectedScan} onOpenChange={(open) => !open && setSelectedScan(null)}>
        <DialogContent className="sm:max-w-[700px] bg-background/90 backdrop-blur-xl border-border/50">
          <DialogHeader>
            <DialogTitle className="text-2xl font-heading flex items-center gap-2">
              <FileText className="w-6 h-6 text-primary" /> Executive Summary
            </DialogTitle>
          </DialogHeader>
          
          {selectedScan && (
            <div className="space-y-6 mt-4">
              <div className="grid grid-cols-3 gap-4">
                <Card className="bg-secondary/20 border-border/30 shadow-none">
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-sm text-muted-foreground font-medium flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" /> Total Issues
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <div className={`text-3xl font-bold font-heading ${selectedScan.vulnCount > 0 ? 'text-destructive' : 'text-primary'}`}>
                      {selectedScan.vulnCount}
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-secondary/20 border-border/30 shadow-none">
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-sm text-muted-foreground font-medium">Target</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 flex items-center h-12">
                    <div className="text-sm font-medium text-foreground truncate" title={selectedScan.target}>
                      {selectedScan.target}
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-secondary/20 border-border/30 shadow-none">
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-sm text-muted-foreground font-medium">Status</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 flex items-center h-12">
                    {selectedScan.status === 'completed' ? (
                      <div className="flex items-center gap-2 text-primary font-semibold capitalize">
                        <CheckCircle2 className="w-5 h-5" /> {selectedScan.status}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-muted-foreground font-semibold capitalize">
                        <XCircle className="w-5 h-5" /> {selectedScan.status}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <div className="bg-secondary/10 border border-border/30 rounded-lg p-5">
                <h3 className="text-lg font-semibold text-foreground mb-3">AI Analysis Summary</h3>
                <p className="text-muted-foreground leading-relaxed text-sm">
                  Strix Autonomous AI has successfully completed the penetration testing phase for the target environment. 
                  During the execution, the agent explored the exposed attack surface and identified <strong className="text-foreground">{selectedScan.vulnCount}</strong> potential security vulnerabilities. 
                  It is recommended to review the individual findings in the Vulnerabilities tab for detailed reproduction steps and mitigation strategies.
                </p>
              </div>
            </div>
          )}

          <DialogFooter className="mt-6 border-t border-border/30 pt-4">
            <Button variant="outline" onClick={handleDownload} className="gap-2">
              <Download className="w-4 h-4" /> Download JSON
            </Button>
            <Button onClick={() => alert("PDF Export is a mock feature.")} className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2">
              Export PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
