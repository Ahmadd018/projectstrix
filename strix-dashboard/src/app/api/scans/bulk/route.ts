import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getProcess, removeProcess } from "@/lib/scanStore";
import { log } from "@/lib/logger";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import os from "os";

const RUNS_DIR = path.join(os.tmpdir(), "strix_runs");

function getScanDir(id: string) {
  return path.join(RUNS_DIR, id);
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { ids } = await req.json();
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "Invalid or empty IDs" }, { status: 400 });
    }

    log.info(`DELETE /api/scans/bulk`, `Bulk delete requested for ${ids.length} scans`);

    let deletedCount = 0;

    for (const id of ids) {
      const dbScan = await prisma.scan.findUnique({ where: { id } });
      if (!dbScan) continue;
      
      // Check permissions
      if (session.role !== "ADMIN" && dbScan.userId !== session.userId) {
        continue;
      }

      const scanDir = getScanDir(id);

      // Kill running process if any
      const proc = getProcess(id);
      if (proc) {
        log.info(`DELETE /api/scans/bulk`, `Killing process pid=${proc.pid} for scan ${id}`);
        try {
          proc.kill("SIGTERM");
        } catch (e) {}
        removeProcess(id);
      }

      // Delete from disk
      if (fs.existsSync(scanDir)) {
        fs.rmSync(scanDir, { recursive: true, force: true });
      }

      // Remove from scheduled.json if exists
      const scheduledFile = path.join(RUNS_DIR, "scheduled.json");
      if (fs.existsSync(scheduledFile)) {
        try {
          let schedules = JSON.parse(fs.readFileSync(scheduledFile, "utf-8"));
          const originalLength = schedules.length;
          schedules = schedules.filter((s: any) => s.scanId !== id);
          if (schedules.length !== originalLength) {
            fs.writeFileSync(scheduledFile, JSON.stringify(schedules, null, 2));
          }
        } catch (e) {}
      }

      // Delete from database
      await prisma.scan.delete({ where: { id } });
      deletedCount++;
    }

    log.info(`DELETE /api/scans/bulk`, `Successfully deleted ${deletedCount} scans`);
    return NextResponse.json({ success: true, deletedCount });

  } catch (error) {
    log.error("DELETE /api/scans/bulk", "Bulk delete error", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
