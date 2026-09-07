import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        role: true,
        status: true,
        createdAt: true,
        resetRequests: {
          where: { status: "PENDING" },
          select: { id: true },
          take: 1,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Flatten the pending-reset relation into a simple boolean for the UI.
    const shaped = users.map(({ resetRequests, ...u }) => ({
      ...u,
      resetRequested: resetRequests.length > 0,
    }));

    return NextResponse.json({ users: shaped });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
