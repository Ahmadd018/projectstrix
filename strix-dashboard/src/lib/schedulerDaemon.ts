/**
 * Embedded Scheduler Daemon
 * 
 * This module runs inside the Next.js process itself — no PM2 or external process needed.
 * It polls the PostgreSQL database every 10 seconds to:
 *   1. Fire one-off scheduled scans whose time has arrived
 *   2. Fire recurring scans (daily/weekly/monthly) and update their nextRunAt
 */

import { prisma } from "./prisma";
import { log } from "./logger";

let schedulerStarted = false;

async function triggerScan(scan: any) {
  try {
    // Build a complete payload — fallback to DB columns if payload is null/incomplete
    const stored = (scan.payload && typeof scan.payload === "object") ? scan.payload as any : {};

    const payload: any = {
      ...stored,
      target: stored.target !== undefined ? stored.target : scan.target,
      projectName: stored.projectName || scan.projectName || "",
      llmModel: stored.llmModel || scan.llmModel || "openai/gpt-4o",
      scanMode: stored.scanMode || scan.scanMode || "standard",
      apiKey: stored.apiKey || "",
      simulationMode: stored.simulationMode || false,
      // These must always be set correctly:
      preGeneratedScanId: scan.id,
      userId: scan.userId,
    };

    // Must not re-schedule this trigger
    delete payload.scheduledAt;

    if (!payload.target && !payload.targetList && !payload.configFile) {
      log.warn("SCHEDULER", `Scan ${scan.id} has no target, targetList, or config — skipping`);
      return;
    }

    const port = process.env.PORT || "80";
    const url = `http://127.0.0.1:${port}/api/scans`;

    log.info("SCHEDULER", `Triggering scan ${scan.id} for target: ${payload.target}`);

    const schedulerSecret = process.env.SCHEDULER_SECRET;
    if (!schedulerSecret) {
      log.error("SCHEDULER", "SCHEDULER_SECRET env var is not set — cannot trigger scans");
      return;
    }

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-scheduler-secret": schedulerSecret,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text();
      log.error("SCHEDULER", `API returned ${res.status}: ${text}`);
    } else {
      log.info("SCHEDULER", `Successfully triggered scan ${scan.id}`);
    }
  } catch (err: any) {
    log.error("SCHEDULER", `Failed to trigger scan ${scan.id}`, err);
  }
}

async function checkScheduledScans() {
  try {
    const now = new Date();

    // ── 1. One-off scheduled scans ──────────────────────────────────────────
    const scheduledScans = await prisma.scan.findMany({
      where: {
        status: "scheduled",
        startedAt: { lte: now },
      },
    });

    if (scheduledScans.length > 0) {
      log.info("SCHEDULER", `Found ${scheduledScans.length} scheduled scan(s) to run`);
    }

    for (const scan of scheduledScans) {
      log.info("SCHEDULER", `Executing scheduled scan ${scan.id} for ${scan.target}`);
      await triggerScan(scan);
      await new Promise((r) => setTimeout(r, 1000));
    }

    // ── 2. Recurring scans ──────────────────────────────────────────────────
    const recurringScans = await prisma.scan.findMany({
      where: {
        period: { not: "none" },
        nextRunAt: { lte: now },
      },
    });

    if (recurringScans.length > 0) {
      log.info("SCHEDULER", `Found ${recurringScans.length} recurring scan(s) to run`);
    }

    for (const scan of recurringScans) {
      log.info("SCHEDULER", `Executing recurring scan ${scan.id} (period: ${scan.period}) for ${scan.target}`);

      // Calculate NEXT run time
      const nextDate = new Date(now);
      if (scan.period === "daily") nextDate.setDate(nextDate.getDate() + 1);
      else if (scan.period === "weekly") nextDate.setDate(nextDate.getDate() + 7);
      else if (scan.period === "monthly") nextDate.setMonth(nextDate.getMonth() + 1);
      else if (scan.period === "3_minutes") nextDate.setMinutes(nextDate.getMinutes() + 3);

      // L-3: Update nextRunAt BEFORE triggering to prevent double-fire on concurrent scheduler instances
      await prisma.scan.update({
        where: { id: scan.id },
        data: { nextRunAt: nextDate },
      });

      // Now trigger the scan
      await triggerScan(scan);

      await new Promise((r) => setTimeout(r, 1000));
    }
  } catch (err: any) {
    log.error("SCHEDULER", "DB poll error", err);
  }
}

export function startScheduler() {
  if (schedulerStarted) {
    log.debug("SCHEDULER", "Scheduler already running — skipping duplicate start");
    return;
  }
  schedulerStarted = true;

  log.info("SCHEDULER", "Embedded scheduler daemon started (polling every 10s)");

  // Run immediately on startup, then every 10 seconds
  checkScheduledScans();
  setInterval(checkScheduledScans, 10_000);
}
