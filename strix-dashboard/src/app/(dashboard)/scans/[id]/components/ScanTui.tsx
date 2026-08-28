import { useEffect, useRef, useMemo } from "react";
import styles from "../detail.module.css";
import ReactMarkdown from 'react-markdown';

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
    
    const allLines = logs.join('').split('\n');
    let currentMarkdownBlock: string[] = [];
    
    const flushMarkdownBlock = () => {
      if (currentMarkdownBlock.length > 0) {
        parsedLogs.push({ type: "markdown", text: currentMarkdownBlock.join('\n'), id: parsedLogs.length });
        currentMarkdownBlock = [];
      }
    };
    
    allLines.forEach((log) => {
      let cleanLog = log.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
      cleanLog = cleanLog.replace(/[╭─╮│╰╯║═╔╗╚╝]/g, ''); 
      
      const lower = cleanLog.toLowerCase();
      if (!cleanLog.trim()) return;
      if (cleanLog.includes("MODEL QUALITY WARNING")) return; 
      
      let type = "normal";
      if (lower.includes("tool:") || lower.includes("executing tool") || lower.includes("using tool") || lower.includes("proxy")) {
        type = "tool";
        toolsExecuted++;
      } else if (lower.includes("error") || lower.includes("failed") || lower.includes("traceback") || lower.includes("exception")) {
        type = "error";
      } else if (lower.includes("thought:") || lower.includes("thinking") || lower.includes("reasoning")) {
        type = "thinking";
      } else if (lower.includes("[+]") || lower.includes("found") || lower.includes("success") || lower.includes("initiated")) {
        type = "action";
      }
      
      if (lower.includes("recon") || lower.includes("scan")) activeAgents.add("Recon Agent");
      if (lower.includes("exploit") || lower.includes("payload") || lower.includes("poc")) activeAgents.add("Exploit Agent");
      if (lower.includes("crawl") || lower.includes("spider")) activeAgents.add("Crawler");
      
      if (type === "normal") {
        currentMarkdownBlock.push(cleanLog);
      } else {
        flushMarkdownBlock();
        parsedLogs.push({ type, text: cleanLog, id: parsedLogs.length });
      }
    });
    flushMarkdownBlock();

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
          Taipan AI TUI Simulator v4.0 (Markdown)
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

      {/* MAIN PANE: Interactive Tool Stream (Markdown Rendered) */}
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
            if (log.type === "markdown") {
              return (
                <div key={log.id} className={styles.tuiLogLine} style={{ marginBottom: '16px', color: '#c9d1d9' }}>
                  <ReactMarkdown 
                    components={{
                      code({node, inline, className, children, ...props}: any) {
                        return (
                          <code className={className} style={{ background: 'rgba(255,255,255,0.1)', padding: inline ? '2px 4px' : '12px', borderRadius: '4px', fontFamily: 'monospace', display: inline ? 'inline' : 'block', overflowX: 'auto' }} {...props}>
                            {children}
                          </code>
                        )
                      },
                      h1({children}) { return <h1 style={{ fontSize: '1.2rem', margin: '8px 0', color: '#fff' }}>{children}</h1> },
                      h2({children}) { return <h2 style={{ fontSize: '1.1rem', margin: '8px 0', color: '#fff' }}>{children}</h2> },
                      h3({children}) { return <h3 style={{ fontSize: '1rem', margin: '8px 0', color: '#fff' }}>{children}</h3> },
                      p({children}) { return <p style={{ margin: '4px 0', lineHeight: 1.5 }}>{children}</p> },
                      ul({children}) { return <ul style={{ margin: '4px 0', paddingLeft: '20px' }}>{children}</ul> },
                    }}
                  >
                    {log.text}
                  </ReactMarkdown>
                </div>
              );
            }

            let colorClass = "";
            switch (log.type) {
              case "tool": colorClass = styles.tuiLogTool; break;
              case "action": colorClass = styles.tuiLogAction; break;
              case "error": colorClass = styles.tuiLogError; break;
              case "thinking": colorClass = styles.tuiLogThinking; break;
            }
            return (
              <div key={log.id} className={`${styles.tuiLogLine} ${colorClass}`} style={{ marginBottom: '6px', display: 'flex', alignItems: 'flex-start' }}>
                <span className={styles.tuiTerminalCaret} style={{ marginTop: '2px', marginRight: '10px' }}>❯</span>
                <div style={{ flex: 1 }}>{log.text}</div>
              </div>
            );
          })}
          
          {status === "running" && (
            <div className={styles.tuiLogLine} style={{ opacity: 0.7, marginTop: '8px', display: 'flex', alignItems: 'center' }}>
              <span className={styles.tuiTerminalCaret} style={{ marginRight: '10px' }}>❯</span>
              <span className={styles.spinner} style={{ width: '12px', height: '12px', display: 'inline-block', borderTopColor: '#dc2626', marginRight: '8px' }} />
              <span>Waiting for agent response...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
