import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { readFpFindings, deleteFpDomain, deleteFpFinding } from "@/lib/fpStore";
import { log } from "@/lib/logger";

// GET /api/fp-instructions/[domain] — list the individual FP findings for a domain.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ domain: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { domain } = await params;
  const findings = readFpFindings(domain);
  return NextResponse.json({ domain, host: domain, findings });
}

// DELETE /api/fp-instructions/[domain]        — remove the whole domain folder.
// DELETE /api/fp-instructions/[domain]?file=X — remove a single finding file.
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ domain: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { domain } = await params;
  const file = new URL(req.url).searchParams.get("file");

  if (file) {
    const ok = deleteFpFinding(domain, file);
    if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
    log.info("DELETE /api/fp-instructions", `Removed FP finding ${file} for ${domain}`);
    return NextResponse.json({ success: true });
  }

  const ok = deleteFpDomain(domain);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  log.info("DELETE /api/fp-instructions", `Removed all FP instructions for ${domain}`);
  return NextResponse.json({ success: true });
}
