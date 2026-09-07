import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { readFpFindings, deleteFpDomain, deleteFpFinding, writeFpFinding } from "@/lib/fpStore";
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

// PUT /api/fp-instructions/[domain]?file=X — overwrite one finding's markdown
// content (manual edit). Body: { content }. Edits in place; the file id is stable.
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ domain: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { domain } = await params;
  const file = new URL(req.url).searchParams.get("file");
  if (!file) return NextResponse.json({ error: "file query param is required" }, { status: 400 });

  let body: { content?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { content } = body || {};
  if (typeof content !== "string" || !content.trim()) {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }
  if (content.length > 20000) {
    return NextResponse.json({ error: "content is too large" }, { status: 400 });
  }

  const ok = writeFpFinding(domain, file, content);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  log.info("PUT /api/fp-instructions", `Edited FP finding ${file} for ${domain}`);
  return NextResponse.json({ success: true });
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
