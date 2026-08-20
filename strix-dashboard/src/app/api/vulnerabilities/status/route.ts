import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

const ALLOWED = ["OPEN", "FALSE_POSITIVE"];

// Set a vulnerability's triage status (e.g. mark/unmark false positive).
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { vulnId?: string; status?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { vulnId, status } = body || {};
  if (!vulnId || !status || !ALLOWED.includes(status)) {
    return NextResponse.json({ error: "vulnId and a valid status are required" }, { status: 400 });
  }

  const vuln = await prisma.vulnerability.findUnique({
    where: { id: vulnId },
    include: { scan: { select: { userId: true } } },
  });
  if (!vuln) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (session.role !== "ADMIN" && vuln.scan.userId !== session.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.vulnerability.update({ where: { id: vulnId }, data: { status } });
  return NextResponse.json({ success: true, status });
}
