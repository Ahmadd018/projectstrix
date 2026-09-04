import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { encryptSecret } from "@/lib/crypto";
import { isSuperAdmin, safeIntegration } from "@/lib/jiraIntegrations";
import { log } from "@/lib/logger";

// May the session edit/delete this integration? Owner of a private config, or the
// Super Admin for a shared preset.
function canManage(session: any, integration: any): boolean {
  if (integration.shared) return isSuperAdmin(session);
  return integration.ownerId === session.userId;
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const integration = await prisma.jiraIntegration.findUnique({ where: { id } });
  if (!integration) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canManage(session, integration)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const data: any = {};
  if (typeof body.name === "string") data.name = body.name.trim().slice(0, 100);
  if (typeof body.baseUrl === "string") data.baseUrl = body.baseUrl.trim().replace(/\/+$/, "").slice(0, 255);
  if (typeof body.authEmail === "string") data.authEmail = body.authEmail.trim().slice(0, 255);
  if (typeof body.projectId === "string") data.projectId = body.projectId.trim().slice(0, 50);
  if (typeof body.issueTypeId === "string") data.issueTypeId = body.issueTypeId.trim().slice(0, 50);
  if (body.config && typeof body.config === "object") data.config = body.config;
  // Blank secret = keep the existing one.
  if (typeof body.authSecret === "string" && body.authSecret.trim() !== "") {
    data.authSecret = encryptSecret(body.authSecret.trim().slice(0, 1024));
  }
  // Only the Super Admin may flip the shared flag.
  if (typeof body.shared === "boolean" && isSuperAdmin(session)) {
    data.shared = body.shared;
    data.ownerId = body.shared ? null : session.userId;
  }

  const updated = await prisma.jiraIntegration.update({ where: { id }, data });
  log.info("PATCH /api/jira/integrations", `Updated integration "${updated.name}"`);
  return NextResponse.json({
    integration: safeIntegration(updated, { mine: updated.ownerId === session.userId, enabled: true }),
  });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const integration = await prisma.jiraIntegration.findUnique({ where: { id } });
  if (!integration) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canManage(session, integration)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.jiraIntegration.delete({ where: { id } });
  log.info("DELETE /api/jira/integrations", `Deleted integration "${integration.name}"`);
  return NextResponse.json({ success: true });
}
