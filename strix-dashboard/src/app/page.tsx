import styles from "./page.module.css";

export default function Dashboard() {
  return (
    <div className={styles.dashboard}>
      <div className={styles.metricsGrid}>
        <div className={`glass-panel ${styles.metricCard}`}>
          <div className={styles.cardGlow} />
          <div className={styles.metricHeader}>
            <span>Security Score</span>
            <span className={styles.icon}>🛡️</span>
          </div>
          <div className={styles.metricValue}>85/100</div>
          <div className={`${styles.metricChange} ${styles.changePositive}`}>
            <span>↑ 5 pts</span> this week
          </div>
        </div>

        <div className={`glass-panel ${styles.metricCard}`}>
          <div className={styles.cardGlow} />
          <div className={styles.metricHeader}>
            <span>Critical Vulns</span>
            <span className={styles.icon}>🚨</span>
          </div>
          <div className={styles.metricValue}>3</div>
          <div className={`${styles.metricChange} ${styles.changeNegative}`}>
            <span>↑ 2</span> since last scan
          </div>
        </div>

        <div className={`glass-panel ${styles.metricCard}`}>
          <div className={styles.cardGlow} />
          <div className={styles.metricHeader}>
            <span>Active Scans</span>
            <span className={styles.icon}>🎯</span>
          </div>
          <div className={styles.metricValue}>1</div>
          <div className={styles.metricChange}>
            <span>Running on api.target.com</span>
          </div>
        </div>

        <div className={`glass-panel ${styles.metricCard}`}>
          <div className={styles.cardGlow} />
          <div className={styles.metricHeader}>
            <span>Total Findings</span>
            <span className={styles.icon}>🔍</span>
          </div>
          <div className={styles.metricValue}>124</div>
          <div className={`${styles.metricChange} ${styles.changePositive}`}>
            <span>↓ 12</span> resolved
          </div>
        </div>
      </div>

      <div className={styles.chartsGrid}>
        <div className={`glass-panel ${styles.chartCard}`}>
          <div className={styles.chartHeader}>
            <h2 className={styles.chartTitle}>Vulnerability Trend</h2>
            <select className="btn btn-outline" style={{ padding: '4px 8px', fontSize: '0.8rem' }}>
              <option>Last 30 Days</option>
              <option>Last 7 Days</option>
            </select>
          </div>
          <div className={styles.chartMock}>
            [Line Chart Component Placeholder]
          </div>
        </div>

        <div className={`glass-panel ${styles.chartCard}`}>
          <div className={styles.chartHeader}>
            <h2 className={styles.chartTitle}>Recent Critical Findings</h2>
          </div>
          <div className={styles.vulnList}>
            {[1, 2, 3].map((i) => (
              <div key={i} className={styles.vulnItem}>
                <div className={styles.vulnName}>SQL Injection in /api/login</div>
                <div className={styles.vulnMeta}>
                  <span className="badge badge-critical">Critical</span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>2h ago</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
