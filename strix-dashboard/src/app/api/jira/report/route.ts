import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { log } from "@/lib/logger";
import {
  getJiraConfig,
  getDatacenterConfig,
  createJiraIssue,
  datacenterResolveUsername,
  buildIssueDescription,
  jiraErrorMessage,
  SEVERITY_LEVEL_FIELD,
  SEVERITY_LEVEL_MAP,
  PRIORITY_MAP,
  JiraConfig,
} from "@/lib/jira";
import { getCloudConfig, createCloudIssue, textToADF } from "@/lib/jiraCloud";
import { isSuperAdmin } from "@/lib/jiraIntegrations";

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

  const { integrationId, vulnId, summary, labels, description } = body || {};
  if (!vulnId) return NextResponse.json({ error: "vulnId is required" }, { status: 400 });

  const vuln = await prisma.vulnerability.findUnique({
    where: { id: vulnId },
    include: { scan: { select: { target: true, userId: true } } },
  });
  if (!vuln) return NextResponse.json({ error: "Vulnerability not found" }, { status: 404 });
  if (session.role !== "ADMIN" && vuln.scan.userId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const scanTarget = vuln.target || vuln.scan.target;
  const cleanLabels = (Array.isArray(labels) ? labels : String(labels || "").split(","))
    .map((l) => String(l).trim().replace(/\s+/g, "_")) // Jira labels can't contain spaces
    .filter(Boolean)
    .slice(0, 50);
  const descText =
    typeof description === "string" && description.trim()
      ? description.trim()
      : buildIssueDescription({ ...vuln, scanTarget });

  // Resolve which integration to report through.
  let integration: any = null;
  if (integrationId) {
    integration = await prisma.jiraIntegration.findUnique({ where: { id: integrationId } });
    if (!integration) return NextResponse.json({ error: "Integration not found" }, { status: 404 });
    // Access: Super Admin, owner of a private config, or an accepted shared preset.
    let allowed = isSuperAdmin(session) || integration.ownerId === userId;
    if (!allowed && integration.shared) {
      const optIn = await prisma.userJiraIntegration.findUnique({
        where: { userId_integrationId: { userId, integrationId } },
      });
      allowed = !!optIn;
    }
    if (!allowed) return NextResponse.json({ error: "You have not enabled this Jira integration" }, { status: 403 });
  }

  // ---- CLOUD (REST v3 / Basic / ADF) ----
  if (integration && integration.deployment === "CLOUD") {
    const cfg = getCloudConfig(integration);
    if (!cfg) {
      return NextResponse.json(
        { error: `Cloud integration "${integration.name}" is missing credentials or project settings.` },
        { status: 400 },
      );
    }
    const fieldCfg = (integration.config || {}) as any;
    const fields: Record<string, any> = {
      project: { id: cfg.projectId },
      issuetype: { id: cfg.issueTypeId },
      summary: (typeof summary === "string" && summary.trim()) || vuln.title,
      description: textToADF(descText),
    };
    // Priority — Cloud uses the numeric option id directly (1=Highest … 5=Lowest).
    if (body.priorityId) fields.priority = { id: String(body.priorityId) };
    // Company — required by process. config.companyFieldId + selected option id.
    if (fieldCfg.companyFieldId && body.company) {
      fields[fieldCfg.companyFieldId] = { id: String(body.company) };
    }
    // Assignee + Participants are Cloud accountIds.
    if (body.assigneeAccountId) fields.assignee = { id: String(body.assigneeAccountId) };
    if (Array.isArray(body.participants) && body.participants.length && fieldCfg.participantsFieldId) {
      fields[fieldCfg.participantsFieldId] = body.participants
        .filter(Boolean)
        .slice(0, 20)
        .map((a: string) => ({ id: String(a) }));
    }
    if (typeof body.duedate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.duedate)) {
      fields.duedate = body.duedate;
    }
    if (cleanLabels.length) fields.labels = cleanLabels;

    let result;
    try {
      result = await createCloudIssue(cfg, fields);
    } catch (e: any) {
      log.warn("POST /api/jira/report", `Could not reach Jira Cloud: ${e?.message}`);
      return NextResponse.json({ error: `Could not reach Jira at ${cfg.baseUrl}. [${e?.cause?.code || e?.message || "network error"}]` }, { status: 502 });
    }
    if (!result.ok) {
      const msg = jiraErrorMessage(result.data, result.status);
      log.warn("POST /api/jira/report", `Jira Cloud create failed: ${msg}`);
      return NextResponse.json({ error: msg, status: result.status }, { status: 502 });
    }
    const key = result.data.key;
    log.info("POST /api/jira/report", `Created Cloud issue ${key} for vuln ${vulnId.slice(0, 8)}`);
    return NextResponse.json({ success: true, key, url: `${cfg.baseUrl}/browse/${key}` });
  }

  // ---- DATA CENTER (REST v2 / Bearer / wiki markup) ----
  // From an integration if given, else the legacy per-user Settings config.
  let cfg: JiraConfig | null = null;
  if (integration) {
    cfg = getDatacenterConfig(integration);
  } else {
    const settings = await prisma.userSettings.findUnique({ where: { userId } });
    cfg = getJiraConfig(settings);
  }
  if (!cfg) {
    return NextResponse.json(
      { error: "Jira is not fully configured. Set Base URL, PAT, Project ID and Issue Type ID for this integration." },
      { status: 400 },
    );
  }

  const fields: Record<string, any> = {
    project: { id: cfg.projectId },
    issuetype: { id: cfg.issueTypeId },
    summary: (typeof summary === "string" && summary.trim()) || vuln.title,
    description: descText,
  };
  const pid = PRIORITY_MAP[String(body.priority || "").toLowerCase()];
  if (pid) fields.priority = { id: pid };
  const sid = SEVERITY_LEVEL_MAP[String(body.severityLevel || "").toLowerCase()];
  if (sid) fields[SEVERITY_LEVEL_FIELD] = { id: sid };
  if (cleanLabels.length) fields.labels = cleanLabels;
  if (typeof body.assignee === "string" && body.assignee.trim()) {
    fields.assignee = { name: body.assignee.trim() };
  }

  // Reporter from the reporting user's Taipan profile — only when this integration
  // opts in (Data Center supports it; Bir Ecosystem/Cloud cannot set reporter).
  // Falls back to the token's default reporter if the profile is unset/unresolved.
  let reporterNote: string | undefined;
  if (integration && (integration.config as any)?.setReporterFromProfile) {
    const me = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, jiraUsername: true },
    });
    const explicit = (me?.jiraUsername || "").trim();
    const name = explicit || (me?.email ? await datacenterResolveUsername(cfg, me.email) : null);
    if (name) {
      fields.reporter = { name };
    } else {
      reporterNote = me?.email || explicit
        ? "Could not match your profile to a Jira user — reported as the service account."
        : "Set your email in Settings → Profile to be recorded as the reporter.";
    }
  }

  let result;
  try {
    result = await createJiraIssue(cfg, fields);
  } catch (e: any) {
    const host = (() => { try { return new URL(cfg!.baseUrl).host; } catch { return cfg!.baseUrl; } })();
    log.warn("POST /api/jira/report", `Could not reach Jira: ${e?.message}`);
    return NextResponse.json(
      { error: `Could not reach Jira at ${host}. Check the Base URL and that this machine can reach it (corporate network / VPN). [${e?.cause?.code || e?.message || "network error"}]` },
      { status: 502 },
    );
  }
  if (!result.ok) {
    const msg = jiraErrorMessage(result.data, result.status);
    log.warn("POST /api/jira/report", `Jira create failed: ${msg}`);
    return NextResponse.json({ error: msg, status: result.status }, { status: 502 });
  }

  const key = result.data.key;
  log.info("POST /api/jira/report", `Created Jira issue ${key} for vuln ${vulnId.slice(0, 8)}`);
  return NextResponse.json({ success: true, key, url: `${cfg.baseUrl}/browse/${key}`, note: reporterNote });
}
