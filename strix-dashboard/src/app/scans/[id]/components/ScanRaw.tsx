import { ScanDetail } from "../types";
import styles from "../detail.module.css";

export default function ScanRaw({ scan }: { scan: ScanDetail }) {
  const jsonStr = JSON.stringify(scan, null, 2);

  const handleDownload = () => {
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `strix-scan-${scan.id}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className={styles.rawContainer}>
      <div className={styles.rawHeader}>
        <h3>Raw Scan Data</h3>
        <button className="btn btn-primary" onClick={handleDownload}>
          Download JSON
        </button>
      </div>
      <div className={`glass-panel ${styles.rawCodeBlock}`}>
        <pre>{jsonStr}</pre>
      </div>
    </div>
  );
}
