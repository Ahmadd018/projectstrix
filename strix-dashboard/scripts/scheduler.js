const fs = require('fs');
const path = require('path');

const RUNS_DIR = path.join(__dirname, "..", "strix_runs");
const SCHEDULED_FILE = path.join(RUNS_DIR, "scheduled.json");

console.log(`[Scheduler] Starting cron loop. Checking ${SCHEDULED_FILE} every 60s`);

setInterval(() => {
  if (!fs.existsSync(SCHEDULED_FILE)) return;
  
  try {
    const scheduledScans = JSON.parse(fs.readFileSync(SCHEDULED_FILE, "utf-8"));
    const now = Date.now();
    const remaining = [];
    let modified = false;
    
    for (const scan of scheduledScans) {
      const scheduledTime = new Date(scan.body.scheduledAt).getTime();
      if (scheduledTime <= now) {
        console.log(`[Scheduler] Triggering scheduled scan ${scan.scanId} for ${scan.body.target}`);
        
        // Remove scheduledAt so it runs immediately when posted back
        delete scan.body.scheduledAt;
        // Inject the pre-generated scanId
        scan.body.preGeneratedScanId = scan.scanId;
        
        fetch('http://localhost:3000/api/scans', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(scan.body)
        }).then(res => {
          if (!res.ok) console.error(`[Scheduler] API returned ${res.status}`);
        }).catch(err => {
          console.error(`[Scheduler] Failed to trigger API:`, err.message);
        });
        
        modified = true;
      } else {
        remaining.push(scan);
      }
    }
    
    if (modified) {
      fs.writeFileSync(SCHEDULED_FILE, JSON.stringify(remaining, null, 2));
    }
  } catch (err) {
    console.error("[Scheduler] Error parsing scheduled.json:", err.message);
  }
}, 60000);
