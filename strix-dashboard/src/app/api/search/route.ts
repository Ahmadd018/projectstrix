import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.userId as string;
  const isAdmin = session.role === "ADMIN";

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");

  if (!q || q.trim().length < 2) {
    return NextResponse.json({ scans: [], vulnerabilities: [] });
  }

  const query = q.trim();

  // Search scans (by target OR projectName)
  const scans = await prisma.scan.findMany({
    where: {
      ...(isAdmin ? {} : { userId }),
      OR: [
        { target: { contains: query, mode: "insensitive" } },
        { projectName: { contains: query, mode: "insensitive" } },
      ]
    },
    select: {
      id: true,
      target: true,
      projectName: true,
      status: true,
      scanMode: true,
      llmModel: true,
      startedAt: true,
      vulnCount: true,
    },
    take: 8,
    orderBy: { startedAt: "desc" }
  });

  // Search vulnerabilities (by title, endpoint, or payload content)
  const vulns = await prisma.vulnerability.findMany({
    where: {
      ...(isAdmin ? {} : { scan: { userId } }),
      OR: [
        { title: { contains: query, mode: "insensitive" } },
        { endpoint: { contains: query, mode: "insensitive" } },
      ]
    },
    select: {
      id: true,
      title: true,
      severity: true,
      endpoint: true,
      scanId: true,
      scan: {
        select: { target: true, projectName: true }
      }
    },
    take: 8,
    orderBy: { createdAt: "desc" }
  });

  return NextResponse.json({ scans, vulnerabilities: vulns });
}
