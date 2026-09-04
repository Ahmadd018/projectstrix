import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { encryptSecret } from "@/lib/crypto";
import { isSuperAdmin, safeIntegration } from "@/lib/jiraIntegrations";
import { log } from "@/lib/logger";

// List the integrations available to the current user: their own configs plus
// every shared preset (with `enabled` marking the ones they've accepted).
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.userId as string;

  const [rows, optIns] = await Promise.all([
    prisma.jiraIntegration.findMany({
      where: { OR: [{ ownerId: userId }, { shared: true }] },
      orderBy: [{ shared: "desc" }, { createdAt: "asc" }],
    }),
    prisma.userJiraIntegration.findMany({ where: { userId } }),
  ]);
  const enabledIds = new Set(optIns.map((o) => o.integrationId));

  const list = rows.map((r) =>
    safeIntegration(r, {
      mine: r.ownerId === userId,
      // Own configs are always "enabled"; shared presets require an opt-in.
      enabled: r.ownerId === userId || enabledIds.has(r.id),
    }),
  );
  return NextResponse.json({ integrations: list, isSuperAdmin: isSuperAdmin(session) });
}

// Create a new integration. Any user may create a private config for themselves;
// only the Super Admin may create a shared preset (streamed to everyone).
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

  const name = String(body?.name || "").trim().slice(0, 100);
  const deployment = body?.deployment === "CLOUD" ? "CLOUD" : "DATACENTER";
  const baseUrl = String(body?.baseUrl || "").trim().replace(/\/+$/, "").slice(0, 255);
  const authEmail = String(body?.authEmail || "").trim().slice(0, 255);
  const projectId = String(body?.projectId || "").trim().slice(0, 50);
  const issueTypeId = String(body?.issueTypeId || "").trim().slice(0, 50);
  const secret = typeof body?.authSecret === "string" ? body.authSecret.trim().slice(0, 1024) : "";
  const config = body?.config && typeof body.config === "object" ? body.config : undefined;
  const wantShared = body?.shared === true;

  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  if (!baseUrl) return NextResponse.json({ error: "Base URL is required" }, { status: 400 });
  if (deployment === "CLOUD" && !authEmail) {
    return NextResponse.json({ error: "Cloud integrations require an account email" }, { status: 400 });
  }
  if (wantShared && !isSuperAdmin(session)) {
    return NextResponse.json({ error: "Only the Super Admin can share an integration" }, { status: 403 });
  }

  const created = await prisma.jiraIntegration.create({
    data: {
      name,
      deployment,
      baseUrl,
      authEmail,
      authSecret: secret ? encryptSecret(secret) : "",
      projectId,
      issueTypeId,
      config,
      shared: wantShared,
      // A shared preset is owned by no one; a private config is owned by its creator.
      ownerId: wantShared ? null : userId,
    },
  });

  log.info("POST /api/jira/integrations", `Created ${deployment} integration "${name}" (shared=${wantShared})`);
  return NextResponse.json({ integration: safeIntegration(created, { mine: !wantShared, enabled: true }) });
}
