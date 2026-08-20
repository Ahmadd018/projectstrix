import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { log } from "@/lib/logger";
import {
  getJiraConfig,
  createJiraIssue,
  buildIssueDescription,
  jiraErrorMessage,
  SEVERITY_LEVEL_FIELD,
  SEVERITY_LEVEL_MAP,
  PRIORITY_MAP,
} from "@/lib/jira";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { vulnId, summary, assignee, labels, severityLevel, priority, description } = body || {};
  if (!vulnId) return NextResponse.json({ error: "vulnId is required" }, { status: 400 });

  const vuln = await prisma.vulnerability.findUnique({
    where: { id: vulnId },
    include: { scan: { select: { target: true, userId: true } } },
  });
  if (!vuln) return NextResponse.json({ error: "Vulnerability not found" }, { status: 404 });
  if (session.role !== "ADMIN" && vuln.scan.userId !== session.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const settings = await prisma.userSettings.findUnique({ where: { userId: session.userId as string } });
  const cfg = getJiraConfig(settings);
  if (!cfg) {
    return NextResponse.json(
      { error: "Jira is not fully configured. Set Base URL, PAT, Project ID and Issue Type ID in Settings → Jira." },
      { status: 400 }
    );
  }

  // Assemble the Jira fields.
  const fields: Record<string, any> = {
    project: { id: cfg.projectId },
    issuetype: { id: cfg.issueTypeId },
    summary: (typeof summary === "string" && summary.trim()) || vuln.title,
    // Use the (AI-generated, possibly edited) description from the client;
    // fall back to the deterministic template if none was supplied.
    description:
      typeof description === "string" && description.trim()
        ? description.trim()
        : buildIssueDescription({ ...vuln, scanTarget: vuln.scan.target }),
  };

  const pid = PRIORITY_MAP[String(priority || "").toLowerCase()];
  if (pid) fields.priority = { id: pid };

  const sid = SEVERITY_LEVEL_MAP[String(severityLevel || "").toLowerCase()];
  if (sid) fields[SEVERITY_LEVEL_FIELD] = { id: sid };

  const rawLabels = Array.isArray(labels) ? labels : String(labels || "").split(",");
  const cleanLabels = rawLabels
    .map((l) => String(l).trim().replace(/\s+/g, "_")) // Jira labels can't contain spaces
    .filter(Boolean)
    .slice(0, 50);
  if (cleanLabels.length) fields.labels = cleanLabels;

  if (typeof assignee === "string" && assignee.trim()) {
    fields.assignee = { name: assignee.trim() };
  }

  let result;
  try {
    result = await createJiraIssue(cfg, fields);
  } catch (e: any) {
    const host = (() => { try { return new URL(cfg.baseUrl).host; } catch { return cfg.baseUrl; } })();
    log.warn("POST /api/jira/report", `Could not reach Jira: ${e?.message}`);
    return NextResponse.json(
      { error: `Could not reach Jira at ${host}. Check the Base URL and that this machine can reach it (corporate network / VPN). [${e?.cause?.code || e?.message || "network error"}]` },
      { status: 502 }
    );
  }
  if (!result.ok) {
    const msg = jiraErrorMessage(result.data, result.status);
    log.warn("POST /api/jira/report", `Jira create failed: ${msg}`);
    return NextResponse.json({ error: msg, status: result.status }, { status: 502 });
  }

  const key = result.data.key;
  const url = `${cfg.baseUrl}/browse/${key}`;
  log.info("POST /api/jira/report", `Created Jira issue ${key} for vuln ${vulnId.slice(0, 8)}`);
  return NextResponse.json({ success: true, key, url });
}
