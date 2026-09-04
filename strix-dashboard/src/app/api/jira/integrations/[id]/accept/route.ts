import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { log } from "@/lib/logger";

// Accept (enable) or drop a shared preset for the current user, and store their
// per-integration defaults (assignee / company). Toggling `enabled:false` removes
// the opt-in. Only shared presets are opt-in; a user's own configs are always on.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.userId as string;
  const { id } = await params;

  const integration = await prisma.jiraIntegration.findUnique({ where: { id } });
  if (!integration) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!integration.shared) {
    return NextResponse.json({ error: "Only shared integrations can be accepted" }, { status: 400 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const enabled = body?.enabled !== false; // default to accepting
  const defaultAssignee = String(body?.defaultAssignee || "").trim().slice(0, 200);
  const defaultCompany = String(body?.defaultCompany || "").trim().slice(0, 100);

  if (!enabled) {
    await prisma.userJiraIntegration
      .deleteMany({ where: { userId, integrationId: id } });
    log.info("POST /api/jira/integrations/accept", `User dropped integration "${integration.name}"`);
    return NextResponse.json({ success: true, enabled: false });
  }

  await prisma.userJiraIntegration.upsert({
    where: { userId_integrationId: { userId, integrationId: id } },
    create: { userId, integrationId: id, defaultAssignee, defaultCompany },
    update: { defaultAssignee, defaultCompany },
  });
  log.info("POST /api/jira/integrations/accept", `User accepted integration "${integration.name}"`);
  return NextResponse.json({ success: true, enabled: true });
}
