import { useEffect, useRef, useMemo } from "react";
import styles from "../detail.module.css";

export default function ScanTui({
  logs,
  status,
}: {
  logs: string[];
  status: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // Parse logs to simulate TUI data (Stats, Tree, and clean log stream)
  const parsedData = useMemo(() => {
    let toolsExecuted = 0;
    let activeAgents = new Set<string>();
    activeAgents.add("Orchestrator"); 
    
    const parsedLogs: { type: string; text: string; id: number }[] = [];
    
    logs.forEach((log, index) => {
      // Clean up any stray ANSI or messy characters if present
      let cleanLog = log.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
      cleanLog = cleanLog.replace(/[╭─╮│╰╯║═╔╗╚╝]/g, ''); // Remove stray box chars
      
      const lower = cleanLog.toLowerCase();
      if (!cleanLog.trim() || cleanLog.includes("MODEL QUALITY WARNING")) return; // Skip useless noise
      
      let type = "normal";
      if (lower.includes("tool:") || lower.includes("executing tool") || lower.includes("using tool") || lower.includes("proxy")) {
        type = "tool";
        toolsExecuted++;
      } else if (lower.includes("error") || lower.includes("failed") || lower.includes("traceback")) {
        type = "error";
      } else if (lower.includes("thought:") || lower.includes("thinking") || lower.includes("reasoning")) {
        type = "thinking";
      } else if (lower.includes("[+]") || lower.includes("found") || lower.includes("success") || lower.includes("initiated")) {
        type = "action";
      }
      
      if (lower.includes("recon") || lower.includes("scan")) activeAgents.add("Recon Agent");
      if (lower.includes("exploit") || lower.includes("payload") || lower.includes("poc")) activeAgents.add("Exploit Agent");
      if (lower.includes("crawl") || lower.includes("spider")) activeAgents.add("Crawler");
      
      parsedLogs.push({ type, text: cleanLog.trim(), id: index });
    });

    return {
      toolsExecuted,
      activeAgents: Array.from(activeAgents),
      parsedLogs
    };
  }, [logs]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [parsedData.parsedLogs, status]);

  return (
    <div className={styles.tuiContainer}>
      {/* HEADER: Live Statistics */}
      <div className={styles.tuiHeader}>
        <div className={styles.tuiStats}>
          <div className={styles.tuiStatBox}>
            <span className={styles.tuiStatLabel}>Status</span>
            <span className={`${styles.tuiStatValue} ${status === 'running' ? styles.tuiStatValueHighlight : ''}`}>
              {status.toUpperCase()}
            </span>
          </div>
          <div className={styles.tuiStatBox}>
            <span className={styles.tuiStatLabel}>Tools Executed</span>
            <span className={styles.tuiStatValue}>{parsedData.toolsExecuted}</span>
          </div>
          <div className={styles.tuiStatBox}>
            <span className={styles.tuiStatLabel}>Active Agents</span>
            <span className={styles.tuiStatValue}>{parsedData.activeAgents.length}</span>
          </div>
        </div>
        <div style={{ color: '#444', fontSize: '12px', marginTop: 'auto' }}>
          Strix AI TUI Simulator v3.0
        </div>
      </div>

      {/* LEFT PANE: Agent Tree View */}
      <div className={styles.tuiSidebar}>
        <div className={styles.tuiPaneTitle}>Agent Tree</div>
        <div className={styles.tuiAgentTree}>
          {parsedData.activeAgents.map((agent, i) => (
            <div key={agent} className={styles.tuiAgentNode} style={{ marginLeft: i === 0 ? 0 : 16 }}>
              {i > 0 && <div className={styles.tuiAgentLine} />}
              <span className={styles.tuiAgentIcon}>■</span>
              <span style={{ color: i === parsedData.activeAgents.length - 1 && status === 'running' ? '#fff' : '#aaa' }}>
                {agent}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* MAIN PANE: Interactive Tool Stream (React DOM) */}
      <div className={styles.tuiMain}>
        <div className={styles.tuiPaneTitle} style={{ paddingLeft: '8px', paddingBottom: '8px', borderBottom: '1px solid #222', marginBottom: '8px' }}>
          Live Execution Stream
        </div>
        <div 
          className={styles.tuiLogStream} 
          ref={scrollRef}
          style={{ padding: '0 8px 8px 8px', overflowY: 'auto', flex: 1, position: 'relative', background: '#050505', borderRadius: '4px' }}
        >
          {parsedData.parsedLogs.length === 0 && (
            <div className={styles.emptyState} style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 10 }}>
              <div className={styles.spinner} />
              <span>Waiting for agent output...</span>
            </div>
          )}
          
          {parsedData.parsedLogs.map((log) => {
            let colorClass = "";
            switch (log.type) {
              case "tool": colorClass = styles.tuiLogTool; break;
              case "action": colorClass = styles.tuiLogAction; break;
              case "error": colorClass = styles.tuiLogError; break;
              case "thinking": colorClass = styles.tuiLogThinking; break;
            }
            return (
              <div key={log.id} className={`${styles.tuiLogLine} ${colorClass}`} style={{ marginBottom: '4px' }}>
                <span className={styles.tuiTerminalCaret}>❯</span>
                {log.text}
              </div>
            );
          })}
          
          {status === "running" && (
            <div className={styles.tuiLogLine} style={{ opacity: 0.7, marginTop: '8px' }}>
              <span className={styles.tuiTerminalCaret}>❯</span>
              <span className={styles.spinner} style={{ width: '12px', height: '12px', display: 'inline-block', borderTopColor: '#dc2626', marginRight: '8px', verticalAlign: 'middle' }} />
              <span>Waiting for agent response...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
