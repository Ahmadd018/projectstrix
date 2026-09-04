import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { readApiKeys, serializeApiKeys, sanitizeApiKeyInput } from "@/lib/apiKeys";
import { isSuperAdmin } from "@/lib/jiraIntegrations";
import { APP_SETTINGS_ID } from "@/lib/sharedKeys";

// Super Admin management of the shared LLM API keys. GET returns masked presence
// + the global enabled flag; POST updates the keys and/or the flag.
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSuperAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const app = await prisma.appSettings.findUnique({ where: { id: APP_SETTINGS_ID } });
  const keys = readApiKeys(app?.sharedApiKeys);
  const masked: Record<string, boolean> = {};
  for (const [p, k] of Object.entries(keys)) masked[p] = typeof k === "string" && k.length > 0;
  return NextResponse.json({ enabled: !!app?.sharedKeysEnabled, keys: masked });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSuperAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const data: any = {};
  if (typeof body.enabled === "boolean") data.sharedKeysEnabled = body.enabled;

  // Merge submitted keys into the existing set; blank values clear a provider.
  if (body.keys && typeof body.keys === "object") {
    const result = sanitizeApiKeyInput(body.keys);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    const app = await prisma.appSettings.findUnique({ where: { id: APP_SETTINGS_ID } });
    const merged = { ...readApiKeys(app?.sharedApiKeys) };
    for (const [p, v] of Object.entries(body.keys as Record<string, unknown>)) {
      if (typeof v !== "string") continue;
      if (v.trim() === "") delete merged[p]; // explicit clear
      else if (result.keys[p]) merged[p] = result.keys[p];
    }
    data.sharedApiKeys = serializeApiKeys(merged);
  }

  await prisma.appSettings.upsert({
    where: { id: APP_SETTINGS_ID },
    create: { id: APP_SETTINGS_ID, ...data },
    update: data,
  });
  return NextResponse.json({ success: true });
}
