import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { addFpEntry, listFpDomains } from "@/lib/fpStore";
import { FpVulnInput } from "@/lib/fpInstruction";
import { log } from "@/lib/logger";

// GET /api/fp-instructions — list the per-domain FP instruction files.
// Shared across all users (team model).
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json({ domains: listFpDomains() });
  } catch (e) {
    log.error("GET /api/fp-instructions", "Failed to list FP domains", e);
    return NextResponse.json({ domains: [], error: "Failed to list" }, { status: 200 });
  }
}

// POST /api/fp-instructions — record a finding as a known false positive for its
// target domain, appending it to that domain's markdown file. Body: { vulnId }.
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { vulnId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { vulnId } = body || {};
  if (!vulnId) return NextResponse.json({ error: "vulnId is required" }, { status: 400 });

  const vuln = await prisma.vulnerability.findUnique({
    where: { id: vulnId },
    include: { scan: { select: { target: true } } },
  });
  if (!vuln) return NextResponse.json({ error: "Vulnerability not found" }, { status: 404 });

  const input: FpVulnInput = {
    title: vuln.title,
    severity: vuln.severity,
    endpoint: vuln.endpoint,
    method: vuln.method,
    description: vuln.description,
    poc: vuln.poc,
    cvss: vuln.cvss,
    target: vuln.scan.target,
  };

  try {
    const { domain, added } = addFpEntry(input);
    log.info("POST /api/fp-instructions", `FP recorded for ${domain} (added=${added})`, {
      vulnId: vulnId.slice(0, 8),
    });
    return NextResponse.json({ success: true, domain, added });
  } catch (e) {
    log.error("POST /api/fp-instructions", "Failed to write FP entry", e);
    return NextResponse.json({ error: "Failed to write FP instruction" }, { status: 500 });
  }
}
