const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { SignJWT } = require('jose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const secretKey = process.env.JWT_SECRET || "strix-super-secret-key-change-in-prod";
const encodedKey = new TextEncoder().encode(secretKey);

console.log(`[Scheduler] Starting Prisma DB scheduler loop. Checking every 10s`);

async function triggerScan(scan) {
  try {
    const payload = scan.payload || {};
    // Ensure we remove scheduledAt so it doesn't get stuck in a loop
    delete payload.scheduledAt;
    payload.preGeneratedScanId = scan.id; // Tell API to use the existing scan ID
    payload.userId = scan.userId; // Pass original user ID so API can preserve ownership
    
    console.log(`[Scheduler] Triggering API for scan ${scan.id} (User: ${scan.userId})`);
    
    const res = await fetch('http://127.0.0.1:80/api/scans', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-scheduler-secret': 'internal_scheduler_secret'
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`[Scheduler] API returned ${res.status}: ${text}`);
    }
  } catch (err) {
    console.error(`[Scheduler] Failed to trigger API:`, err.message);
  }
}

async function checkScheduledScans() {
  try {
    const now = new Date();
    
    // 1. Check one-off scheduled scans
    const scheduledScans = await prisma.scan.findMany({
      where: {
        status: "scheduled",
        startedAt: { lte: now }
      }
    });

    for (const scan of scheduledScans) {
      console.log(`[Scheduler] Executing scheduled scan ${scan.id} for ${scan.target}`);
      await triggerScan(scan);
      // Wait a moment between triggers to avoid overwhelming the server
      await new Promise(r => setTimeout(r, 1000)); 
    }

    // 2. Check recurring scans (status might be anything, we check nextRunAt)
    const recurringScans = await prisma.scan.findMany({
      where: {
        period: { not: "none" },
        nextRunAt: { lte: now }
      }
    });

    for (const scan of recurringScans) {
      console.log(`[Scheduler] Executing recurring scan for ${scan.target}`);
      
      // Calculate NEXT run time based on period
      const nextDate = new Date(now);
      if (scan.period === "daily") nextDate.setDate(nextDate.getDate() + 1);
      else if (scan.period === "weekly") nextDate.setDate(nextDate.getDate() + 7);
      else if (scan.period === "monthly") nextDate.setMonth(nextDate.getMonth() + 1);
      
      const newScanId = require('crypto').randomUUID();

      // Trigger the run with a new ID
      const fakeScan = { ...scan, id: newScanId };
      await triggerScan(fakeScan);

      // Update the original scan's nextRunAt in the DB
      await prisma.scan.update({
        where: { id: scan.id },
        data: { nextRunAt: nextDate }
      });

      await new Promise(r => setTimeout(r, 1000));
    }
  } catch (err) {
    console.error("[Scheduler] DB Check Error:");
    console.error(err);
  }
}

// Run immediately on start
checkScheduledScans();
// Then run every 10 seconds
setInterval(checkScheduledScans, 10000);
