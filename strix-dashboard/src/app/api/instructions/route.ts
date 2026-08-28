import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Shared library: every user sees all instructions. Ownership (userId) is
    // still returned so the client can keep edit/delete restricted to the author.
    const instructions = await prisma.instruction.findMany({
      orderBy: { updatedAt: "desc" },
      include: { user: { select: { username: true } } },
    });

    const shaped = instructions.map((i) => ({
      id: i.id,
      userId: i.userId,
      title: i.title,
      content: i.content,
      createdAt: i.createdAt,
      updatedAt: i.updatedAt,
      authorName: i.user?.username || "Unknown",
    }));

    return NextResponse.json(shaped);
  } catch (error) {
    console.error("GET /api/instructions error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { title, content } = body;

    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }
    if (!content || typeof content !== "string" || content.trim().length === 0) {
      return NextResponse.json({ error: "Content is required" }, { status: 400 });
    }

    const instruction = await prisma.instruction.create({
      data: {
        userId: session.userId as string,
        title: title.trim(),
        content: content,
      },
    });

    return NextResponse.json(instruction, { status: 201 });
  } catch (error) {
    console.error("POST /api/instructions error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
