import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getDatacenterConfig, jiraWhoAmI, jiraErrorMessage } from "@/lib/jira";
import { getCloudConfig, cloudWhoAmI } from "@/lib/jiraCloud";
import { isSuperAdmin } from "@/lib/jiraIntegrations";

// Verify an integration's stored credentials by calling /myself on the right API.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.userId as string;
  const { id } = await params;

  const integration = await prisma.jiraIntegration.findUnique({ where: { id } });
  if (!integration) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let allowed = isSuperAdmin(session) || integration.ownerId === userId;
  if (!allowed && integration.shared) {
    const optIn = await prisma.userJiraIntegration.findUnique({
      where: { userId_integrationId: { userId, integrationId: id } },
    });
    allowed = !!optIn;
  }
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    if (integration.deployment === "CLOUD") {
      const cfg = getCloudConfig(integration);
      if (!cfg) return NextResponse.json({ error: "Missing credentials or project settings." }, { status: 400 });
      const result = await cloudWhoAmI(cfg);
      if (!result.ok) return NextResponse.json({ error: jiraErrorMessage(result.data, result.status), status: result.status }, { status: 502 });
      return NextResponse.json({ success: true, displayName: result.data?.displayName, emailAddress: result.data?.emailAddress });
    }
    const cfg = getDatacenterConfig(integration);
    if (!cfg) return NextResponse.json({ error: "Missing credentials or project settings." }, { status: 400 });
    const result = await jiraWhoAmI(cfg);
    if (!result.ok) return NextResponse.json({ error: jiraErrorMessage(result.data, result.status), status: result.status }, { status: 502 });
    return NextResponse.json({ success: true, name: result.data?.name, displayName: result.data?.displayName, emailAddress: result.data?.emailAddress });
  } catch (e: any) {
    return NextResponse.json({ error: `Could not reach Jira: ${e?.message || "network error"}` }, { status: 502 });
  }
}
