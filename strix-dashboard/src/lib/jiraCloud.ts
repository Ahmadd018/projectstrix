// Jira CLOUD integration (e.g. Bir Ecosystem / *.atlassian.net).
// Differs from the Data Center path (src/lib/jira.ts) on three axes:
//   - REST API v3 (not v2)
//   - Basic auth with email:apiToken (not a Bearer PAT)
//   - descriptions must be ADF (Atlassian Document Format), not wiki markup
import { decryptSecret } from "@/lib/crypto";

export interface JiraCloudConfig {
  baseUrl: string;
  email: string;
  apiToken: string;
  projectId: string;
  issueTypeId: string;
}

// The deployment-specific `config` blob we persist on a CLOUD JiraIntegration.
// Captured from the m10payments "Vulnerability" project discovery.
export interface CloudFieldConfig {
  companyFieldId?: string; // e.g. "customfield_11630"
  companyOptions?: { id: string; label: string }[];
  participantsFieldId?: string; // e.g. "customfield_10797"
}

// Resolve usable creds from a JiraIntegration row, or null if incomplete.
export function getCloudConfig(integration: any): JiraCloudConfig | null {
  if (!integration) return null;
  const baseUrl = String(integration.baseUrl || "").trim().replace(/\/+$/, "");
  const email = String(integration.authEmail || "").trim();
  const apiToken = integration.authSecret ? decryptSecret(integration.authSecret) : "";
  const projectId = String(integration.projectId || "").trim();
  const issueTypeId = String(integration.issueTypeId || "").trim();
  if (!baseUrl || !email || !apiToken || !projectId || !issueTypeId) return null;
  return { baseUrl, email, apiToken, projectId, issueTypeId };
}

function basicAuth(cfg: JiraCloudConfig): string {
  return "Basic " + Buffer.from(`${cfg.email}:${cfg.apiToken}`).toString("base64");
}

// Convert plain multi-paragraph text into a minimal ADF document. Blank lines
// separate paragraphs; everything else is emitted as plain text runs.
export function textToADF(text: string): any {
  const paragraphs = String(text || "")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  const content = (paragraphs.length ? paragraphs : [""]).map((p) => ({
    type: "paragraph",
    content: p ? [{ type: "text", text: p }] : [],
  }));
  return { version: 1, type: "doc", content };
}

// Create an issue via the Cloud REST API v3.
export async function createCloudIssue(cfg: JiraCloudConfig, fields: Record<string, any>) {
  const res = await fetch(`${cfg.baseUrl}/rest/api/3/issue`, {
    method: "POST",
    headers: {
      Authorization: basicAuth(cfg),
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ fields }),
  });
  const text = await res.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  return { ok: res.ok, status: res.status, data };
}

// Validate the token/connection via /myself.
export async function cloudWhoAmI(cfg: JiraCloudConfig) {
  const res = await fetch(`${cfg.baseUrl}/rest/api/3/myself`, {
    headers: { Authorization: basicAuth(cfg), Accept: "application/json" },
  });
  const text = await res.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  return { ok: res.ok, status: res.status, data };
}

// Search assignable users for the modal's assignee/participants pickers.
// Cloud identifies users by accountId, not username.
export async function cloudUserSearch(cfg: JiraCloudConfig, query: string) {
  const url = new URL(`${cfg.baseUrl}/rest/api/3/user/assignable/search`);
  url.searchParams.set("project", cfg.projectId);
  if (query) url.searchParams.set("query", query);
  url.searchParams.set("maxResults", "20");
  const res = await fetch(url, {
    headers: { Authorization: basicAuth(cfg), Accept: "application/json" },
  });
  const text = await res.text();
  let data: any = [];
  try {
    data = text ? JSON.parse(text) : [];
  } catch {
    data = [];
  }
  const users = Array.isArray(data)
    ? data.map((u: any) => ({ accountId: u.accountId, displayName: u.displayName, email: u.emailAddress }))
    : [];
  return { ok: res.ok, status: res.status, users };
}
