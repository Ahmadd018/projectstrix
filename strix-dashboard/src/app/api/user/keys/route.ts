import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  let keys = {};
  if (user.apiKeys) {
    try {
      keys = JSON.parse(user.apiKeys);
    } catch (e) {}
  }

  return NextResponse.json(keys);
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  await prisma.user.update({
    where: { id: session.userId },
    data: { apiKeys: JSON.stringify(body) },
  });

  return NextResponse.json({ success: true });
}
