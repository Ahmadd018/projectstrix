import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { id: session.userId as string } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  let keys: Record<string, string> = {};
  if (user.apiKeys) {
    try {
      keys = JSON.parse(user.apiKeys);
    } catch (e) {}
  }

  // H-2: Never expose raw API keys to the client. Return masked indicators only.
  const masked: Record<string, boolean> = {};
  for (const [provider, key] of Object.entries(keys)) {
    masked[provider] = typeof key === "string" && key.length > 0;
  }

  return NextResponse.json(masked);
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  await prisma.user.update({
    where: { id: session.userId as string },
    data: { apiKeys: JSON.stringify(body) },
  });

  return NextResponse.json({ success: true });
}
