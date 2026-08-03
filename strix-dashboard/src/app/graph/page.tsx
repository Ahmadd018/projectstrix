"use client";

import { useEffect, useState } from "react";
import { Activity, BrainCircuit } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import styles from "./graph.module.css"; // We keep graph.module.css for the SVG animations only, since SVG specific animations are complex in raw tailwind

interface Scan {
  id: string;
  target: string;
  status: string;
  scanMode: string;
}

export default function Graph() {
  const [activeScan, setActiveScan] = useState<Scan | null>(null);
  const [nodes, setNodes] = useState([
    { id: "brain", x: 400, y: 300, label: "AI Core", active: false, icon: "🧠" },
    { id: "recon", x: 150, y: 150, label: "Reconnaissance", active: false, icon: "🔍" },
    { id: "exploit", x: 650, y: 150, label: "Exploitation", active: false, icon: "⚡" },
    { id: "auth", x: 150, y: 450, label: "Auth Bypass", active: false, icon: "🔓" },
    { id: "analyze", x: 650, y: 450, label: "Code Analysis", active: false, icon: "💻" },
  ]);

  const fetchActiveScan = async () => {
    try {
      const res = await fetch("/api/scans");
      const data = await res.json();
      const running = data.scans?.find((s: Scan) => ["running", "scanning", "analyzing", "crawling"].includes(s.status));
      setActiveScan(running || null);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchActiveScan();
    const interval = setInterval(fetchActiveScan, 3000);
    return () => clearInterval(interval);
  }, []);

  // Simulate agent thinking randomly if a scan is active
  useEffect(() => {
    if (!activeScan) {
      setNodes(n => n.map(node => ({ ...node, active: false })));
      return;
    }

    const brainActiveInterval = setInterval(() => {
      setNodes(n => n.map(node => node.id === "brain" ? { ...node, active: true } : node));
      setTimeout(() => {
        setNodes(n => n.map(node => node.id === "brain" ? { ...node, active: false } : node));
      }, 800);
    }, 2000);

    const moduleActiveInterval = setInterval(() => {
      const peripheralIds = ["recon", "exploit", "auth", "analyze"];
      const randomId = peripheralIds[Math.floor(Math.random() * peripheralIds.length)];
      setNodes(n => n.map(node => node.id === randomId ? { ...node, active: true } : node));
      setTimeout(() => {
        setNodes(n => n.map(node => node.id === randomId ? { ...node, active: false } : node));
      }, 1200);
    }, 3500);

    return () => {
      clearInterval(brainActiveInterval);
      clearInterval(moduleActiveInterval);
    };
  }, [activeScan]);

  const brainNode = nodes.find(n => n.id === "brain")!;

  return (
    <div className="p-8 h-full flex flex-col space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading font-bold tracking-tight">Live Graph</h1>
          <p className="text-muted-foreground">
            Visualizing autonomous AI reasoning and attack vectors in real-time.
          </p>
        </div>
      </div>

      <Card className="flex-1 relative overflow-hidden bg-background/40 backdrop-blur-md border-border/50 shadow-xl min-h-[500px]">
        {/* Status Overlay */}
        <div className="absolute top-6 left-6 z-10 flex flex-col gap-2 p-4 rounded-xl bg-background/80 backdrop-blur border border-border/50 shadow-lg min-w-[250px]">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <BrainCircuit className="w-4 h-4" /> Agent Status
          </h3>
          {activeScan ? (
            <div className="space-y-2 mt-2">
              <Badge variant="outline" className="border-primary text-primary bg-primary/10 flex items-center gap-2 w-fit">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" /> SCAN ACTIVE
              </Badge>
              <div className="text-sm font-medium text-foreground truncate" title={activeScan.target}>
                {activeScan.target}
              </div>
            </div>
          ) : (
            <div className="mt-2 text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Activity className="w-4 h-4 opacity-50" /> IDLE — WAITING FOR SCAN
            </div>
          )}
        </div>

        {/* SVG Graph */}
        <CardContent className="p-0 w-full h-full">
          <svg viewBox="0 0 800 600" className="w-full h-full absolute inset-0" preserveAspectRatio="xMidYMid meet">
            {/* Background Grid */}
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.02)" strokeWidth="1"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />

            {/* Edges */}
            {nodes.filter(n => n.id !== "brain").map((node) => {
              const isActive = activeScan && (node.active || brainNode.active);
              return (
                <g key={`edge-${node.id}`}>
                  <line
                    x1={brainNode.x}
                    y1={brainNode.y}
                    x2={node.x}
                    y2={node.y}
                    className={`${styles.edgePath} ${isActive ? styles.edgePathActive : ""}`}
                  />
                  {isActive && (
                    <circle r="4" className={styles.dataParticle}>
                      <animateMotion
                        dur="1s"
                        repeatCount="indefinite"
                        path={`M ${brainNode.x},${brainNode.y} L ${node.x},${node.y}`}
                      />
                    </circle>
                  )}
                </g>
              );
            })}

            {/* Nodes */}
            {nodes.map((node) => (
              <g key={node.id} className={styles.nodeGroup} transform={`translate(${node.x}, ${node.y})`}>
                <circle
                  r={node.id === "brain" ? 45 : 35}
                  className={`${styles.nodeCircle} ${node.active ? styles.nodeCircleActive : ""}`}
                />
                <text className={styles.nodeIcon}>{node.icon}</text>
                <text y={node.id === "brain" ? 70 : 60} className={styles.nodeLabel}>
                  {node.label}
                </text>
              </g>
            ))}
          </svg>
        </CardContent>
      </Card>
    </div>
  );
}
