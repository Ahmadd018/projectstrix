import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getCloudConfig, cloudUserSearch } from "@/lib/jiraCloud";
import { isSuperAdmin } from "@/lib/jiraIntegrations";

// Assignable-user search for a CLOUD integration (accountId pickers). Requires
// the caller to have access to the integration (own / accepted / Super Admin).
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.userId as string;
  const { id } = await params;

  const integration = await prisma.jiraIntegration.findUnique({ where: { id } });
  if (!integration) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (integration.deployment !== "CLOUD") {
    return NextResponse.json({ error: "User search is only for Cloud integrations" }, { status: 400 });
  }

  let allowed = isSuperAdmin(session) || integration.ownerId === userId;
  if (!allowed && integration.shared) {
    const optIn = await prisma.userJiraIntegration.findUnique({
      where: { userId_integrationId: { userId, integrationId: id } },
    });
    allowed = !!optIn;
  }
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const cfg = getCloudConfig(integration);
  if (!cfg) return NextResponse.json({ error: "Integration is missing credentials" }, { status: 400 });

  const q = new URL(req.url).searchParams.get("q") || "";
  try {
    const result = await cloudUserSearch(cfg, q);
    if (!result.ok) return NextResponse.json({ error: `Jira returned HTTP ${result.status}` }, { status: 502 });
    return NextResponse.json({ users: result.users });
  } catch (e: any) {
    return NextResponse.json({ error: `Could not reach Jira: ${e?.message || "network error"}` }, { status: 502 });
  }
}
