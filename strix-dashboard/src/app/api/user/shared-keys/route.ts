import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { KNOWN_PROVIDERS } from "@/lib/apiKeys";
import { getSharedKeyAvailability, parseOptIn } from "@/lib/sharedKeys";

// The current user's shared-key opt-in. GET returns whether shared keys are on,
// which providers have one, and the user's current opt-in list. POST sets the list.
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { enabled, available } = await getSharedKeyAvailability();
  const settings = await prisma.userSettings.findUnique({ where: { userId: session.userId as string } });
  return NextResponse.json({ enabled, available, optIn: parseOptIn(settings?.sharedKeyProviders) });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.userId as string;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const requested = Array.isArray(body?.providers) ? body.providers : [];
  // Only keep known providers that actually have a shared key available.
  const { available } = await getSharedKeyAvailability();
  const clean = requested
    .filter((p: unknown) => typeof p === "string")
    .filter((p: string) => (KNOWN_PROVIDERS as readonly string[]).includes(p))
    .filter((p: string) => available.includes(p));

  await prisma.userSettings.upsert({
    where: { userId },
    create: { userId, sharedKeyProviders: JSON.stringify(clean) },
    update: { sharedKeyProviders: JSON.stringify(clean) },
  });
  return NextResponse.json({ success: true, optIn: clean });
}
