import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session || !session.user || typeof (session.user as any).id !== "string") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  const userId = (session.user as any).id;

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");

  if (!q || q.trim().length < 2) {
    return NextResponse.json({ scans: [], vulnerabilities: [] });
  }

  const query = q.trim();

  // Search scans (by target)
  const scans = await prisma.scan.findMany({
    where: {
      userId: userId,
      target: { contains: query, mode: "insensitive" }
    },
    select: {
      id: true,
      target: true,
      status: true,
      startedAt: true
    },
    take: 5,
    orderBy: { startedAt: "desc" }
  });

  // Search vulnerabilities (by title or endpoint)
  const vulns = await prisma.vulnerability.findMany({
    where: {
      scan: { userId: userId },
      OR: [
        { title: { contains: query, mode: "insensitive" } },
        { endpoint: { contains: query, mode: "insensitive" } }
      ]
    },
    select: {
      id: true,
      title: true,
      severity: true,
      scanId: true,
      scan: {
        select: { target: true }
      }
    },
    take: 5,
    orderBy: { createdAt: "desc" }
  });

  return NextResponse.json({ scans, vulnerabilities: vulns });
}
