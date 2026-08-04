"use client";

import { useEffect, useState } from "react";
import { Activity, BrainCircuit } from "lucide-react";
import styles from "./graph.module.css";

interface Scan {
  id: string;
  target: string;
  status: string;
  scanMode: string;
}

export default function Graph() {
  const [activeScan, setActiveScan] = useState<Scan | null>(null);
  const [nodes, setNodes] = useState([
    { id: "brain",   x: 400, y: 300, label: "AI Core",          active: false, icon: "🧠" },
    { id: "recon",   x: 150, y: 150, label: "Reconnaissance",   active: false, icon: "🔍" },
    { id: "exploit", x: 650, y: 150, label: "Exploitation",     active: false, icon: "⚡" },
    { id: "auth",    x: 150, y: 450, label: "Auth Bypass",      active: false, icon: "🔓" },
    { id: "analyze", x: 650, y: 450, label: "Code Analysis",    active: false, icon: "💻" },
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
        <p className="page-desc">Visualizing autonomous AI reasoning and attack vectors in real-time.</p>
      </div>

      <div className="card" style={{ flex: 1, position: "relative", overflow: "hidden", minHeight: 400 }}>
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
          <rect width="100%" height="100%" fill="url(#grid)" />

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
      </div>
    </div>
  );
}
