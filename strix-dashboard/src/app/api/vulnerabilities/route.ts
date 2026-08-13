import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let where = {};
  if (session.role !== "ADMIN") {
    where = { scan: { userId: session.userId } };
  }

  try {
    const vulns = await prisma.vulnerability.findMany({
      where,
      include: {
        scan: {
          select: { target: true, id: true }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    return NextResponse.json(vulns);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch vulnerabilities" }, { status: 500 });
  }
}
