import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { log } from "@/lib/logger";

// POST /api/technologies/settings — update ASM CVE-lookup automation (admin only).
// Body: { cveLookupEnabled?: boolean, cveLookupIntervalHours?: number }
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const data: any = {};
  if (typeof body.cveLookupEnabled === "boolean") data.cveLookupEnabled = body.cveLookupEnabled;
  if (typeof body.cveLookupIntervalHours === "number") {
    // Clamp to a sane range (1h – 30d).
    data.cveLookupIntervalHours = Math.max(1, Math.min(720, Math.round(body.cveLookupIntervalHours)));
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No valid fields" }, { status: 400 });
  }

  try {
    const updated = await prisma.appSettings.upsert({
      where: { id: "singleton" },
      update: data,
      create: { id: "singleton", ...data },
    });
    return NextResponse.json({
      cveLookupEnabled: updated.cveLookupEnabled,
      cveLookupIntervalHours: updated.cveLookupIntervalHours,
    });
  } catch (err) {
    log.error("POST /api/technologies/settings", "Failed to update settings", err);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
