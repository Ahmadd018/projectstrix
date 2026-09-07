import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { log } from "@/lib/logger";

// GET /api/technologies — list the ASM inventory (third-party/vendor solutions
// detected across scans, with the version we currently track and CVE status).
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const where = session.role === "ADMIN" ? {} : { userId: session.userId as string };
    const rows = await prisma.technology.findMany({
      where,
      orderBy: [{ cveStatus: "asc" }, { updatedAt: "desc" }],
    });
    const settings = await prisma.appSettings.upsert({
      where: { id: "singleton" },
      update: {},
      create: { id: "singleton" },
    });
    return NextResponse.json({
      technologies: rows,
      settings: {
        cveLookupEnabled: settings.cveLookupEnabled,
        cveLookupIntervalHours: settings.cveLookupIntervalHours,
      },
      isAdmin: session.role === "ADMIN",
    });
  } catch (err) {
    log.error("GET /api/technologies", "Failed to list technologies", err);
    return NextResponse.json({ technologies: [], error: "Failed to list technologies" }, { status: 200 });
  }
}

// PATCH /api/technologies?id=<id> — queue an immediate re-check (the scheduler
// picks it up on its next CVE sweep, when automation is enabled).
export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  try {
    const row = await prisma.technology.findUnique({ where: { id } });
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (session.role !== "ADMIN" && row.userId !== session.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    await prisma.technology.update({
      where: { id },
      data: { nextCveCheckAt: new Date(), cveStatus: row.cveStatus === "checking" ? "unknown" : row.cveStatus },
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    log.error("PATCH /api/technologies", "Failed to queue re-check", err);
    return NextResponse.json({ error: "Failed to queue re-check" }, { status: 500 });
  }
}

// DELETE /api/technologies?id=<id> — remove one inventory entry.
export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  try {
    const row = await prisma.technology.findUnique({ where: { id } });
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (session.role !== "ADMIN" && row.userId !== session.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    await prisma.technology.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    log.error("DELETE /api/technologies", "Failed to delete technology", err);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
