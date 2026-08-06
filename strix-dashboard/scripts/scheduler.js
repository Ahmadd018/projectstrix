const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

console.log(`[Scheduler] Starting Prisma DB scheduler loop. Checking every 10s`);

async function triggerScan(scan) {
  try {
    // Merge stored payload with DB fields — payload can be null for scans created without advanced options
    const storedPayload = (scan.payload && typeof scan.payload === 'object') ? scan.payload : {};
    
    // Build a complete payload. DB fields are the fallback for any missing keys.
    const payload = {
      target: storedPayload.target || scan.target,
      projectName: storedPayload.projectName || scan.projectName || '',
      llmModel: storedPayload.llmModel || scan.llmModel || 'openai/gpt-4o',
      scanMode: storedPayload.scanMode || scan.scanMode || 'standard',
      apiKey: storedPayload.apiKey || '',
      simulationMode: storedPayload.simulationMode || false,
      ...storedPayload, // override with any stored extras
    };
    
    // Ensure scheduledAt is NOT present (would re-schedule the scan)
    delete payload.scheduledAt;
    // Set preGeneratedScanId so the API reuses the existing scan record
    payload.preGeneratedScanId = scan.id;
    // Pass original user ID so API can preserve ownership
    payload.userId = scan.userId;
    
    if (!payload.target) {
      console.error(`[Scheduler] Scan ${scan.id} has no target — skipping`);
      return;
    }

    console.log(`[Scheduler] Triggering API for scan ${scan.id} (target: ${payload.target}, user: ${scan.userId})`);
    
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
    } else {
      console.log(`[Scheduler] Successfully triggered scan ${scan.id}`);
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
