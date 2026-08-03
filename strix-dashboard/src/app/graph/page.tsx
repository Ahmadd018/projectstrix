"use client";

import { useEffect, useState } from "react";
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
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Live Graph</h1>
        <p className={styles.subtitle}>
          Visualizing autonomous AI reasoning and attack vectors in real-time.
        </p>
      </div>

      <div className={styles.graphArea}>
        {/* Status Overlay */}
        <div className={styles.statusOverlay}>
          <h3>Agent Status</h3>
          {activeScan ? (
            <>
              <div className={styles.statusBadge}>
                <div className={styles.pulseDot}></div>
                SCAN ACTIVE
              </div>
              <div className={styles.scanTarget}>{activeScan.target}</div>
            </>
          ) : (
            <div className={`${styles.statusBadge} ${styles.idle}`}>
              IDLE — WAITING FOR SCAN
            </div>
          )}
        </div>

        {/* SVG Graph */}
        <svg viewBox="0 0 800 600" className={styles.svgGraph} preserveAspectRatio="xMidYMid meet">
          
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
              <text y={node.id === "brain" ? 65 : 55} className={styles.nodeLabel}>
                {node.label}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}
