import { useEffect, useRef } from "react";
import styles from "../detail.module.css";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import "xterm/css/xterm.css";

export default function ScanTui({
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
        background: '#111111',
        foreground: '#f8f8f2',
        cursor: '#ff0000',
        selectionBackground: 'rgba(220, 38, 38, 0.3)' // Strix red selection
      },
      fontFamily: 'var(--font-mono)',
      fontSize: 14,
      disableStdin: true,
      convertEol: true,
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    
    term.open(terminalRef.current);
    
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
    for (let i = renderedLines.current; i < logs.length; i++) {
      termInstance.current.write(logs[i]);
    }
    renderedLines.current = logs.length;
  }, [logs]);

  return (
    <div className={`glass-panel ${styles.terminalContainer}`} style={{ display: 'flex', flexDirection: 'column' }}>
      <div className={styles.terminalHeader} style={{ flexShrink: 0 }}>
        <span className={styles.terminalTitle}>Strix Live TUI</span>
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
            <span>Waiting for TUI render...</span>
          </div>
        )}
        <div ref={terminalRef} style={{ width: '100%', height: '100%', minHeight: '500px', display: logs.length === 0 ? 'none' : 'block' }} />
      </div>
    </div>
  );
}
