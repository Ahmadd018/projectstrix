import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import os from "os";

const RUNS_DIR = path.join(os.tmpdir(), "strix_runs");
const RECURRING_FILE = path.join(RUNS_DIR, "recurring.json");

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { period, apiKey } = body; // period: "daily", "weekly", "monthly", "none"

    if (!fs.existsSync(RUNS_DIR)) fs.mkdirSync(RUNS_DIR, { recursive: true });

    let recurring: any[] = [];
    if (fs.existsSync(RECURRING_FILE)) {
      try {
        recurring = JSON.parse(fs.readFileSync(RECURRING_FILE, "utf-8"));
      } catch (e) {}
    }

    // Remove existing config for this scan ID if it exists
    recurring = recurring.filter((r) => r.originalScanId !== id);

    if (period && period !== "none") {
      // Need original run.json to get target, model, etc.
      const scanDir = path.join(RUNS_DIR, id);
      const runFile = path.join(scanDir, "run.json");
      
      if (!fs.existsSync(runFile)) {
        return NextResponse.json({ error: "Scan not found" }, { status: 404 });
      }

      const runMeta = JSON.parse(fs.readFileSync(runFile, "utf-8"));
      
      if (!apiKey && !runMeta.simulationMode) {
        return NextResponse.json({ error: "API Key is required to schedule this scan" }, { status: 400 });
      }

      // Calculate next run time
      const now = new Date();
      if (period === "daily") now.setDate(now.getDate() + 1);
      else if (period === "weekly") now.setDate(now.getDate() + 7);
      else if (period === "monthly") now.setMonth(now.getMonth() + 1);

      const recurringJob = {
        id: crypto.randomUUID(),
        originalScanId: id,
        period,
        nextRunAt: now.toISOString(),
        body: {
          target: runMeta.target,
          scanName: runMeta.scanName ? `${runMeta.scanName} (Recurring)` : undefined,
          projectName: runMeta.projectName,
          llmModel: runMeta.llmModel,
          scanMode: runMeta.scanMode,
          simulationMode: runMeta.simulationMode,
          apiKey: apiKey, // Save the provided key
          // if there were advanced options, they might be lost if we don't save the full original request
        }
      };

      recurring.push(recurringJob);
    }

    fs.writeFileSync(RECURRING_FILE, JSON.stringify(recurring, null, 2));

    return NextResponse.json({ success: true, period: period === "none" ? null : period });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
