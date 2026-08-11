import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { log } from "@/lib/logger";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { period } = body; // period: "daily", "weekly", "monthly", "none"

    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Verify scan exists and user owns it
    const scan = await prisma.scan.findUnique({ where: { id } });
    if (!scan) return NextResponse.json({ error: "Scan not found" }, { status: 404 });
    if (session.role !== "ADMIN" && scan.userId !== session.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!period || period === "none") {
      // Clear the recurring period
      await prisma.scan.update({
        where: { id },
        data: { period: "none", nextRunAt: null }
      });
      log.info(`POST /api/scans/${id}/schedule`, "Cleared recurring period");
      return NextResponse.json({ success: true, period: null });
    }

    // Validate period value
    const validPeriods = ["daily", "weekly", "monthly", "3_minutes"];
    if (!validPeriods.includes(period)) {
      return NextResponse.json({ error: "Invalid period. Must be daily, weekly, monthly, or 3_minutes." }, { status: 400 });
    }

    const existingPayload = scan.payload as any;

    // Calculate next run time
    const nextRunAt = new Date();
    if (period === "daily") nextRunAt.setDate(nextRunAt.getDate() + 1);
    else if (period === "weekly") nextRunAt.setDate(nextRunAt.getDate() + 7);
    else if (period === "monthly") nextRunAt.setMonth(nextRunAt.getMonth() + 1);
    else if (period === "3_minutes") nextRunAt.setMinutes(nextRunAt.getMinutes() + 3);

    // Store updated payload for future recurring runs
    const updatedPayload = {
      ...(existingPayload || {}),
      target: existingPayload?.target || scan.target,
      llmModel: existingPayload?.llmModel || scan.llmModel,
      scanMode: existingPayload?.scanMode || scan.scanMode,
      projectName: existingPayload?.projectName || scan.projectName,
    };

    await prisma.scan.update({
      where: { id },
      data: {
        period,
        nextRunAt,
        payload: updatedPayload as any
      }
    });

    log.info(`POST /api/scans/${id}/schedule`, `Set recurring period to ${period}, next run at ${nextRunAt.toISOString()}`);
    return NextResponse.json({ success: true, period, nextRunAt: nextRunAt.toISOString() });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
