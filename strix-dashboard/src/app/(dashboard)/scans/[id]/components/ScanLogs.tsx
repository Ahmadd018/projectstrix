import { useEffect, useRef } from "react";
import styles from "../detail.module.css";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import "xterm/css/xterm.css";

export default function ScanLogs({
  logs,
  status,
}: {
  logs: string[];
  status: string;
}) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const termInstance = useRef<Terminal | null>(null);
  const renderedLines = useRef(0);

  useEffect(() => {
    if (!terminalRef.current) return;
    
    const term = new Terminal({
      theme: {
        background: '#0a0a0a',
        foreground: '#e5e5e5',
        cursor: 'transparent',
        selectionBackground: 'rgba(255, 255, 255, 0.3)'
      },
      fontFamily: 'var(--font-mono)',
      fontSize: 12,
      disableStdin: true,
      convertEol: true, // Converts \n to \r\n automatically
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    
    term.open(terminalRef.current);
    
    // Slight delay to allow DOM to compute dimensions before fitting
    setTimeout(() => {
      try { fitAddon.fit(); } catch(e) {}
    }, 10);
    
    termInstance.current = term;

    const handleResize = () => {
      try { fitAddon.fit(); } catch(e) {}
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      term.dispose();
      termInstance.current = null;
    };
  }, []);

  useEffect(() => {
    if (!termInstance.current) return;
    // Write new log chunks that haven't been written yet
    for (let i = renderedLines.current; i < logs.length; i++) {
      termInstance.current.write(logs[i]);
    }
    renderedLines.current = logs.length;
  }, [logs]);

  return (
    <div className={`glass-panel ${styles.terminalContainer}`} style={{ display: 'flex', flexDirection: 'column' }}>
      <div className={styles.terminalHeader} style={{ flexShrink: 0 }}>
        <span className={styles.terminalTitle}>Agent Execution Logs</span>
        {status === "running" && (
          <span className={styles.liveIndicator}>Live</span>
        )}
      </div>
      <div 
        className={styles.terminalBody} 
        style={{ padding: '8px', overflow: 'hidden', flex: 1, position: 'relative' }}
      >
        {logs.length === 0 && (
          <div className={styles.emptyState} style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 10 }}>
            <div className={styles.spinner} />
            <span>Waiting for agent output...</span>
          </div>
        )}
        <div ref={terminalRef} style={{ width: '100%', height: '100%', minHeight: '400px', display: logs.length === 0 ? 'none' : 'block' }} />
      </div>
    </div>
  );
}
