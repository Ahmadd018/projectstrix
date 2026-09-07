import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { log } from "@/lib/logger";
import { runCveLookupNow, runCveScanNow, runFullScanForTech, runAllCveLookups } from "@/lib/cveLookup";

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
        cveLookupModel: settings.cveLookupModel,
      },
      isAdmin: session.role === "ADMIN",
    });
  } catch (err) {
    log.error("GET /api/technologies", "Failed to list technologies", err);
    return NextResponse.json({ technologies: [], error: "Failed to list technologies" }, { status: 200 });
  }
}

// PATCH /api/technologies?id=<id>&action=<lookup|cvescan|fullscan> — start a scan
// for this asset RIGHT NOW, independent of the global automation toggle.
//   action=lookup  (default): a quick cve_lookup (re-verify version + find CVEs;
//                   on a hit its completion auto-spawns the cve_scan).
//   action=cvescan: a cve_scan (loads the "cve_scan" instruction) against the
//                   target, using CVEs already recorded on the asset.
//   action=fullscan: a normal full pentest of the target (all vuln classes).
export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  const action = (req.nextUrl.searchParams.get("action") || "lookup").toLowerCase();

  // Optional body: { instruction } for a full scan, { model } to pick the LLM.
  const body = await req.json().catch(() => ({}));
  const instruction = typeof body?.instruction === "string" ? body.instruction : undefined;
  const model = typeof body?.model === "string" && body.model.trim() ? body.model.trim() : undefined;
  if (instruction && instruction.length > 8000) {
    return NextResponse.json({ error: "Instruction too long (max 8000 chars)" }, { status: 400 });
  }

  try {
    const row = await prisma.technology.findUnique({ where: { id } });
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (session.role !== "ADMIN" && row.userId !== session.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const result =
      action === "fullscan"
        ? await runFullScanForTech(id, instruction, model)
        : action === "cvescan"
          ? await runCveScanNow(id, model)
          : await runCveLookupNow(id, model);
    if (!result.ok) {
      return NextResponse.json({ error: result.error || "Failed to start scan" }, { status: 409 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    log.error("PATCH /api/technologies", "Failed to start scan", err);
    return NextResponse.json({ error: "Failed to start scan" }, { status: 500 });
  }
}

// POST /api/technologies — bulk action. Body: { action: "lookup-all", model? }.
// Starts a CVE lookup for every inventory entry the caller can see.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const action = String(body?.action || "");
  const model = typeof body?.model === "string" && body.model.trim() ? body.model.trim() : undefined;

  if (action !== "lookup-all") {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  const result = await runAllCveLookups({
    userId: session.userId as string,
    isAdmin: session.role === "ADMIN",
    model,
  });
  return NextResponse.json(result);
}

// PUT /api/technologies?id=<id> — edit an inventory entry's fields.
// Body may include: product, vendor, version, ecosystem, category, description.
// If the version changes, the asset is re-queued for a CVE re-check.
const EDITABLE_FIELDS = ["product", "vendor", "version", "ecosystem", "category", "description"] as const;
export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const body = await req.json().catch(() => ({}));

  try {
    const row = await prisma.technology.findUnique({ where: { id } });
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (session.role !== "ADMIN" && row.userId !== session.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const data: any = {};
    for (const f of EDITABLE_FIELDS) {
      if (typeof body[f] === "string") data[f] = body[f].trim();
    }
    if ("product" in data && !data.product) {
      return NextResponse.json({ error: "Product cannot be empty" }, { status: 400 });
    }
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No editable fields provided" }, { status: 400 });
    }

    // A corrected version should trigger a fresh CVE evaluation.
    if ("version" in data && data.version !== row.version) {
      data.cveStatus = "unknown";
      data.foundCves = undefined;
      data.nextCveCheckAt = new Date();
    }

    const updated = await prisma.technology.update({ where: { id }, data });
    return NextResponse.json({ technology: updated });
  } catch (err: any) {
    if (err?.code === "P2002") {
      return NextResponse.json(
        { error: "Another entry with the same target, vendor and product already exists" },
        { status: 409 },
      );
    }
    log.error("PUT /api/technologies", "Failed to update technology", err);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
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
