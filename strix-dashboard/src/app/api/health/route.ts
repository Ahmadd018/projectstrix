import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { log } from "@/lib/logger";

import os from "os";

const RUNS_DIR = path.join(os.tmpdir(), "strix_runs");
const START_TIME = Date.now();

export async function GET() {
  log.debug("GET /api/health", "Health check requested");

  const strixPaths = [
    "/usr/local/bin/strix",
    path.join(process.env.HOME || "/root", ".local/bin/strix"),
    path.join(process.cwd(), "../strix-venv/bin/strix"),
  ];
  const strixInstalled = strixPaths.some((p) => fs.existsSync(p));
  const strixPath = strixPaths.find((p) => fs.existsSync(p)) ?? null;

  const runsDirExists = fs.existsSync(RUNS_DIR);
  let scanCount = 0;
  let runningScanCount = 0;
  if (runsDirExists) {
    try {
      const entries = fs.readdirSync(RUNS_DIR, { withFileTypes: true });
      for (const e of entries) {
        if (!e.isDirectory()) continue;
        scanCount++;
        const runFile = path.join(RUNS_DIR, e.name, "run.json");
        if (fs.existsSync(runFile)) {
          try {
            const run = JSON.parse(fs.readFileSync(runFile, "utf-8"));
            if (run.status === "running") runningScanCount++;
          } catch {}
        }
      }
    } catch {}
  }

  const uptimeSeconds = Math.floor((Date.now() - START_TIME) / 1000);

  const health = {
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime_seconds: uptimeSeconds,
    version: "1.0.0",
    components: {
      api: {
        status: "ok",
        message: "Next.js API is running",
      },
      strix_cli: {
        status: strixInstalled ? "ok" : "not_installed",
        path: strixPath,
        message: strixInstalled
          ? `strix found at ${strixPath}`
          : "strix CLI not found — demo mode will be used for scans",
      },
      storage: {
        status: "ok",
        runs_dir: RUNS_DIR,
        runs_dir_exists: runsDirExists,
        total_scans: scanCount,
        running_scans: runningScanCount,
      },
    },
  };

  const httpStatus = health.status === "ok" ? 200 : 503;
  log.info("GET /api/health", `Health check → ${health.status}`, {
    strix: health.components.strix_cli.status,
    scans: scanCount,
    running: runningScanCount,
  });

  return NextResponse.json(health, { status: httpStatus });
}
