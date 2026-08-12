import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: session.userId as string },
    select: {
      id: true,
      username: true,
      role: true,
      status: true,
      createdAt: true,
      apiKeys: true,
      _count: {
        select: { scans: true }
      }
    }
  });

  if (!dbUser) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  let configuredKeysCount = 0;
  if (dbUser.apiKeys) {
    try {
      const keys = JSON.parse(dbUser.apiKeys);
      configuredKeysCount = Object.values(keys).filter(k => typeof k === 'string' && k.trim().length > 0).length;
    } catch (e) {}
  }

  return NextResponse.json({ 
    authenticated: true, 
    user: { 
      id: dbUser.id, 
      username: dbUser.username, 
      role: dbUser.role,
      status: dbUser.status,
      createdAt: dbUser.createdAt,
      scanCount: dbUser._count.scans,
      configuredKeysCount
    } 
  });
}
