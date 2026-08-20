import { decryptSecret } from "@/lib/crypto";

// Maps for this instance's SEC project (provided by the user).
// Severity → the "Security Level" custom field (customfield_23202) option ids.
export const SEVERITY_LEVEL_FIELD = "customfield_23202";
export const SEVERITY_LEVEL_MAP: Record<string, string> = {
  critical: "26108",
  high: "26109",
  medium: "26110",
  low: "26111",
  informational: "26112",
  info: "26112",
  none: "-1",
};
// Jira priority ids.
export const PRIORITY_MAP: Record<string, string> = {
  highest: "1",
  high: "2",
  medium: "3",
  low: "4",
};

// Dropdown options for the report modal.
export const SEVERITY_LEVEL_OPTIONS = [
  { key: "critical", label: "Critical" },
  { key: "high", label: "High" },
  { key: "medium", label: "Medium" },
  { key: "low", label: "Low" },
  { key: "informational", label: "Informational" },
  { key: "none", label: "None" },
];
export const PRIORITY_OPTIONS = [
  { key: "highest", label: "Highest" },
  { key: "high", label: "High" },
  { key: "medium", label: "Medium" },
  { key: "low", label: "Low" },
];

export interface JiraConfig {
  baseUrl: string;
  pat: string;
  projectId: string;
  issueTypeId: string;
}

// Resolve a usable Jira config from a UserSettings row, or null if incomplete.
export function getJiraConfig(settings: any): JiraConfig | null {
  if (!settings) return null;
  const baseUrl = (settings.jiraBaseUrl || "").trim().replace(/\/+$/, "");
  const pat = settings.jiraPat ? decryptSecret(settings.jiraPat) : "";
  const projectId = (settings.jiraProjectId || "").trim();
  const issueTypeId = (settings.jiraIssueTypeId || "").trim();
  if (!baseUrl || !pat || !projectId || !issueTypeId) return null;
  return { baseUrl, pat, projectId, issueTypeId };
}

// Reduce a target/URL to a bare host (e.g. "x.com") for the report sentence.
function hostOf(target?: string): string {
  if (!target) return "the target";
  try {
    const t = /^https?:\/\//i.test(target) ? target : `https://${target}`;
    return new URL(t).host;
  } catch {
    return target;
  }
}

// Build a finding-writeup description in Jira wiki markup:
//   The {METHOD} {ENDPOINT} API of {host} is vulnerable to {title}. {description}
//   {Proof of Concept}
//   {screenshot placeholder}
//   To mitigate this issue, {remediation}
export function buildIssueDescription(v: {
  scanTarget?: string;
  method?: string | null;
  endpoint?: string | null;
  severity?: string;
  cvss?: number | null;
  title?: string;
  description?: string | null;
  poc?: string | null;
  remediation?: string | null;
}): string {
  const host = hostOf(v.scanTarget || undefined);
  const api = `${v.method || "GET"} ${v.endpoint || ""}`.trim();
  const title = (v.title || "a security issue").trim();
  const description = (v.description || "").trim();
  const remediation = (v.remediation || "").trim();

  const parts: string[] = [];

  // Paragraph 1 — narrative: "The {api} API of {host} is vulnerable to {title}, {impact}."
  let opener = api
    ? `The ${api} API of ${host} is vulnerable to ${title}`
    : `${host} is vulnerable to ${title}`;
  if (description) {
    opener += `, ${description.charAt(0).toLowerCase()}${description.slice(1)}`;
  } else {
    opener += ".";
  }
  parts.push(opener);

  // Paragraph 2 — mitigation.
  if (remediation) {
    parts.push(
      /^to mitigate/i.test(remediation)
        ? remediation
        : `To mitigate this issue, ${remediation.charAt(0).toLowerCase()}${remediation.slice(1)}`
    );
  }

  return parts.join("\n\n");
}

// Create an issue via the Data Center REST API v2 using the PAT (Bearer).
export async function createJiraIssue(cfg: JiraConfig, fields: Record<string, any>) {
  const res = await fetch(`${cfg.baseUrl}/rest/api/2/issue`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.pat}`,
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

// Validate the token / connection via /myself.
export async function jiraWhoAmI(cfg: JiraConfig) {
  const res = await fetch(`${cfg.baseUrl}/rest/api/2/myself?expand=groups`, {
    headers: { Authorization: `Bearer ${cfg.pat}`, Accept: "application/json" },
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

// Extract a human-readable error from a Jira error response body.
export function jiraErrorMessage(data: any, status: number): string {
  if (data?.errorMessages?.length) return data.errorMessages.join("; ");
  if (data?.errors && Object.keys(data.errors).length) {
    return Object.entries(data.errors)
      .map(([k, v]) => `${k}: ${v}`)
      .join("; ");
  }
  return `Jira returned HTTP ${status}`;
}
