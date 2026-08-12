import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { readApiKeys, serializeApiKeys, sanitizeApiKeyInput } from "@/lib/apiKeys";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { id: session.userId as string } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // M-5: decrypt at rest. H-2: never expose raw keys — return masked indicators.
  const keys = readApiKeys(user.apiKeys);
  const masked: Record<string, boolean> = {};
  for (const [provider, key] of Object.entries(keys)) {
    masked[provider] = typeof key === "string" && key.length > 0;
  }

  return NextResponse.json(masked);
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // L-2: validate/whitelist providers and cap key length. M-5: encrypt at rest.
  const result = sanitizeApiKeyInput(body);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: session.userId as string },
    data: { apiKeys: serializeApiKeys(result.keys) },
  });

  return NextResponse.json({ success: true });
}
