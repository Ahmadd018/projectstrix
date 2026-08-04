"use client";

import { useEffect, useState } from "react";
import { Activity, BrainCircuit, Info, X } from "lucide-react";
import styles from "./graph.module.css";

interface Scan {
  id: string;
  target: string;
  status: string;
  scanMode: string;
}

interface NodeData {
  id: string;
  x: number;
  y: number;
  label: string;
  active: boolean;
  icon: string;
  desc: string;
}

export default function Graph() {
  const [activeScan, setActiveScan] = useState<Scan | null>(null);
  const [selectedNode, setSelectedNode] = useState<NodeData | null>(null);
  const [nodes, setNodes] = useState<NodeData[]>([
    { id: "brain",   x: 400, y: 300, label: "AI Core",          active: false, icon: "🧠", desc: "Central reasoning engine orchestrating all tasks." },
    { id: "recon",   x: 150, y: 150, label: "Reconnaissance",   active: false, icon: "🔍", desc: "Crawls endpoints, maps directories, and discovers assets." },
    { id: "exploit", x: 650, y: 150, label: "Exploitation",     active: false, icon: "⚡", desc: "Attempts safe exploitation of discovered vulnerabilities." },
    { id: "auth",    x: 150, y: 450, label: "Auth Bypass",      active: false, icon: "🔓", desc: "Tests authentication flows and session management." },
    { id: "analyze", x: 650, y: 450, label: "Code Analysis",    active: false, icon: "💻", desc: "Analyzes client-side code and API responses for leaks." },
  ]);

  const fetchActiveScan = async () => {
    try {
      const res = await fetch("/api/scans");
      const data = await res.json();
      const running = data.scans?.find((s: Scan) =>
        ["running", "scanning", "analyzing", "crawling"].includes(s.status)
      );
      setActiveScan(running || null);
    } catch {}
  };

  useEffect(() => {
    fetchActiveScan();
    const interval = setInterval(fetchActiveScan, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!activeScan) {
      setNodes((n) => n.map((node) => ({ ...node, active: false })));
      return;
    }
    const brainIv = setInterval(() => {
      setNodes((n) => n.map((node) => (node.id === "brain" ? { ...node, active: true } : node)));
      setTimeout(() => setNodes((n) => n.map((node) => (node.id === "brain" ? { ...node, active: false } : node))), 800);
    }, 2000);
    const modIv = setInterval(() => {
      const ids = ["recon", "exploit", "auth", "analyze"];
      const rid = ids[Math.floor(Math.random() * ids.length)];
      setNodes((n) => n.map((node) => (node.id === rid ? { ...node, active: true } : node)));
      setTimeout(() => setNodes((n) => n.map((node) => (node.id === rid ? { ...node, active: false } : node))), 1200);
    }, 3500);
    return () => { clearInterval(brainIv); clearInterval(modIv); };
  }, [activeScan]);

  const brainNode = nodes.find((n) => n.id === "brain")!;

  return (
    <div className="page" style={{ maxWidth: "none", height: "100%" }}>
      <div className="page-intro">
        <h1 className="page-heading">Live Graph</h1>
        <p className="page-desc">Visualizing autonomous AI reasoning and attack vectors in real-time. Click nodes for details.</p>
      </div>

      <div className="card" style={{ flex: 1, position: "relative", overflow: "hidden", minHeight: 400, display: "flex" }}>
        
        {/* Main Graph Area */}
        <div style={{ flex: 1, position: "relative" }}>
          {/* Status overlay */}
          <div style={{
            position: "absolute", top: 20, left: 20, zIndex: 10,
            background: "rgba(15,15,15,0.90)", border: "1px solid var(--border-md)",
            borderRadius: "var(--r-lg)", padding: "14px 16px", minWidth: 220,
            backdropFilter: "blur(8px)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--fg-3)", marginBottom: 10 }}>
              <BrainCircuit size={13} /> Agent Status
            </div>
            {activeScan ? (
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                  <span className="status-led running" />
                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--sev-low)", letterSpacing: "0.5px" }}>SCAN ACTIVE</span>
                </div>
                <div style={{ fontSize: 12, color: "var(--fg-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {activeScan.target}
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--fg-3)" }}>
                <Activity size={13} style={{ opacity: 0.5 }} /> IDLE — WAITING FOR SCAN
              </div>
            )}
          </div>

          {/* SVG Graph */}
          <svg
            viewBox="0 0 800 600"
            style={{ width: "100%", height: "100%", position: "absolute", inset: 0 }}
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.025)" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" onClick={() => setSelectedNode(null)} />

            {/* Edges */}
            {nodes.filter((n) => n.id !== "brain").map((node) => {
              const isActive = activeScan && (node.active || brainNode.active);
              return (
                <g key={`edge-${node.id}`}>
                  <line
                    x1={brainNode.x} y1={brainNode.y}
                    x2={node.x} y2={node.y}
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
            {nodes.map((node) => {
              const isSelected = selectedNode?.id === node.id;
              return (
                <g 
                  key={node.id} 
                  className={styles.nodeGroup} 
                  transform={`translate(${node.x}, ${node.y})`}
                  onClick={() => setSelectedNode(node)}
                  style={{ cursor: "pointer" }}
                >
                  <circle
                    r={node.id === "brain" ? 45 : 35}
                    className={`${styles.nodeCircle} ${node.active ? styles.nodeCircleActive : ""} ${isSelected ? styles.nodeCircleSelected : ""}`}
                  />
                  <text className={styles.nodeIcon} style={{ pointerEvents: "none" }}>{node.icon}</text>
                  <text y={node.id === "brain" ? 70 : 60} className={styles.nodeLabel} style={{ pointerEvents: "none" }}>
                    {node.label}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Selected Node Details Panel */}
        {selectedNode && (
          <div style={{
            width: 300, borderLeft: "1px solid var(--border)", background: "var(--bg-2)",
            display: "flex", flexDirection: "column", animation: "slideInRight 0.3s ease"
          }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 15, fontWeight: 600, color: "var(--fg)" }}>
                <span>{selectedNode.icon}</span> {selectedNode.label}
              </div>
              <button onClick={() => setSelectedNode(null)} style={{ background: "none", border: "none", color: "var(--fg-3)", cursor: "pointer", padding: 4 }}>
                <X size={16} />
              </button>
            </div>
            
            <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 20 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--fg-3)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>Description</div>
                <div style={{ fontSize: 13, color: "var(--fg-2)", lineHeight: 1.6 }}>
                  {selectedNode.desc}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--fg-3)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>Module Status</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--fg)" }}>
                  {activeScan ? (
                    selectedNode.active ? (
                      <><span className="status-led running" /> Processing Tasks...</>
                    ) : (
                      <><span className="status-led" style={{ background: "var(--sev-low)" }} /> Standby</>
                    )
                  ) : (
                    <><span className="status-led" style={{ background: "var(--fg-3)" }} /> Offline (No Active Scan)</>
                  )}
                </div>
              </div>
              
              {activeScan && selectedNode.id !== "brain" && (
                <div style={{ padding: 12, background: "var(--bg-1)", border: "1px solid var(--border-md)", borderRadius: "var(--r)", fontSize: 12, color: "var(--fg-3)", display: "flex", gap: 8 }}>
                  <Info size={14} style={{ flexShrink: 0, marginTop: 2, color: "var(--fg-2)" }} />
                  <div>
                    This module is currently loaded into the AI agent's context and is listening for task delegations from the AI Core.
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}} />
    </div>
  );
}
