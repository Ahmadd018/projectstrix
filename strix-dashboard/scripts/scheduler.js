const fs = require('fs');
const path = require('path');
const os = require('os');

const RUNS_DIR = path.join(os.tmpdir(), "strix_runs");
const SCHEDULED_FILE = path.join(RUNS_DIR, "scheduled.json");
const RECURRING_FILE = path.join(RUNS_DIR, "recurring.json");

console.log(`[Scheduler] Starting cron loop. Checking ${SCHEDULED_FILE} and ${RECURRING_FILE} every 10s`);

function triggerScan(body, scanId) {
  // Remove scheduledAt so it runs immediately when posted back
  delete body.scheduledAt;
  // Inject the pre-generated scanId
  body.preGeneratedScanId = scanId;
  
  fetch('http://127.0.0.1:80/api/scans', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }).then(res => {
    if (!res.ok) console.error(`[Scheduler] API returned ${res.status}`);
  }).catch(err => {
    console.error(`[Scheduler] Failed to trigger API:`, err.message);
  });
}

function checkScheduledScans() {
  if (fs.existsSync(SCHEDULED_FILE)) {
    try {
      const scheduledScans = JSON.parse(fs.readFileSync(SCHEDULED_FILE, "utf-8"));
      const now = Date.now();
      const remaining = [];
      let modified = false;
      
      for (const scan of scheduledScans) {
        const scheduledTime = new Date(scan.body.scheduledAt).getTime();
        if (scheduledTime <= now) {
          console.log(`[Scheduler] Triggering scheduled scan ${scan.scanId} for ${scan.body.target}`);
          triggerScan(scan.body, scan.scanId);
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
  }

  // Handle recurring scans
  if (fs.existsSync(RECURRING_FILE)) {
    try {
      const recurringScans = JSON.parse(fs.readFileSync(RECURRING_FILE, "utf-8"));
      const now = Date.now();
      let modified = false;

      for (const scan of recurringScans) {
        const nextRunAt = new Date(scan.nextRunAt).getTime();
        if (nextRunAt <= now) {
          console.log(`[Scheduler] Triggering recurring scan for ${scan.body.target}`);
          triggerScan(scan.body, scan.id); // It uses its own id or generates a new one. Wait, preGeneratedScanId should be new each time for recurring!
          // We can just omit preGeneratedScanId and let the API generate it!
          
          // Calculate NEXT run time
          const nextDate = new Date(now);
          if (scan.period === "daily") nextDate.setDate(nextDate.getDate() + 1);
          else if (scan.period === "weekly") nextDate.setDate(nextDate.getDate() + 7);
          else if (scan.period === "monthly") nextDate.setMonth(nextDate.getMonth() + 1);
          
          scan.nextRunAt = nextDate.toISOString();
          scan.id = require('crypto').randomUUID(); // Generate a new ID for the next run
          modified = true;
        }
      }

      if (modified) {
        fs.writeFileSync(RECURRING_FILE, JSON.stringify(recurringScans, null, 2));
      }
    } catch (err) {
      console.error("[Scheduler] Error parsing recurring.json:", err.message);
    }
  }
}

// Run immediately on start
checkScheduledScans();
// Then run every 10 seconds
setInterval(checkScheduledScans, 10000);
