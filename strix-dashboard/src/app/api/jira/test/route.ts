import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getJiraConfig, jiraWhoAmI, jiraErrorMessage } from "@/lib/jira";

// Verify the stored Jira credentials by calling /myself.
export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const settings = await prisma.userSettings.findUnique({ where: { userId: session.userId as string } });
  const cfg = getJiraConfig(settings);
  if (!cfg) {
    return NextResponse.json(
      { error: "Jira is not fully configured. Save Base URL, PAT, Project ID and Issue Type ID first." },
      { status: 400 }
    );
  }

  let result;
  try {
    result = await jiraWhoAmI(cfg);
  } catch (e: any) {
    return NextResponse.json({ error: `Could not reach Jira: ${e?.message || "network error"}` }, { status: 502 });
  }

  if (!result.ok) {
    return NextResponse.json({ error: jiraErrorMessage(result.data, result.status), status: result.status }, { status: 502 });
  }

  return NextResponse.json({
    success: true,
    name: result.data?.name,
    displayName: result.data?.displayName,
    emailAddress: result.data?.emailAddress,
    groups: result.data?.groups?.items?.map((g: any) => g.name) || [],
  });
}
