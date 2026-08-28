// Shared, dependency-free helpers for building false-positive (FP) instructions.
// Safe to import from both client components and server routes (pure TS, no node-only APIs).

export interface FpVulnInput {
  title: string;
  severity: string;
  endpoint?: string | null;
  method?: string | null;
  description?: string | null;
  poc?: string | null;
  poc_description?: string | null;
  poc_script_code?: string | null;
  cvss?: number | null;
  // The scan target / host this finding belongs to (URL or bare host).
  target: string;
}

// Extract a bare host from a target that may be a full URL, a host, or host+path.
export function hostFromTarget(target: string): string {
  const t = (target || "").trim();
  if (!t) return "";
  try {
    const withScheme = /^https?:\/\//i.test(t) ? t : `https://${t}`;
    return new URL(withScheme).host;
  } catch {
    // Fallback: strip scheme + path manually.
    return t.replace(/^https?:\/\//i, "").split("/")[0];
  }
}

// Best-effort absolute URL from the target (host/subdomain) + endpoint path.
export function fullUrl(target: string, endpoint?: string | null): string {
  if (!endpoint) return target || "";
  if (/^https?:\/\//i.test(endpoint)) return endpoint;
  try {
    const base = /^https?:\/\//i.test(target) ? target : `https://${target}`;
    return new URL(endpoint, base).toString();
  } catch {
    return `${target}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;
  }
}

// A filesystem-safe key for a domain, used to name per-domain FP instruction files.
export function sanitizeDomain(target: string): string {
  const host = hostFromTarget(target).toLowerCase();
  const cleaned = host.replace(/[^a-z0-9._-]/g, "_").replace(/^_+|_+$/g, "");
  return cleaned || "unknown_target";
}

function normalizePoc(v: FpVulnInput): string {
  return (v.poc || v.poc_script_code || v.poc_description || "").trim().replace(/\s+/g, " ");
}

// A ready-to-paste, fully-detailed instruction telling the agent to skip this
// finding. Carries enough detail (host, method, path, payload) for the agent to
// re-identify the exact issue and ignore it.
export function buildFpInstruction(v: FpVulnInput): string {
  const host = hostFromTarget(v.target) || v.target;
  const method = v.method || "GET";
  const desc = (v.description || "").trim().replace(/\s+/g, " ");
  const poc = normalizePoc(v);
  const cvss = typeof v.cvss === "number" && v.cvss > 0 ? ` (CVSS ${v.cvss})` : "";

  const header =
    "[KNOWN FALSE POSITIVE — DO NOT REPORT]\n" +
    "The finding below was manually reviewed and confirmed as a FALSE POSITIVE. During this scan, do NOT flag, report, or spend time re-testing it. If you rediscover this exact issue, treat it as a known false positive and ignore it. Only report it if you find a genuinely DIFFERENT vulnerability at the same location.";

  const bullets = [
    `- Title: ${v.title}`,
    `- Severity: ${v.severity}${cvss}`,
    `- Target host: ${host}`,
    `- Endpoint: ${method} ${v.endpoint || "(unspecified)"}`,
    `- Full URL: ${fullUrl(v.target, v.endpoint || "")}`,
    poc ? `- Reproduction / payload: ${poc}` : "",
    desc ? `- Original description: ${desc}` : "",
  ].filter(Boolean);

  return `${header}\n\n${bullets.join("\n")}`;
}

// A single per-domain markdown entry (no big header — the file carries one shared
// preamble at the top and stacks entries beneath it).
export function buildFpEntry(v: FpVulnInput, markedAt: Date = new Date()): string {
  const host = hostFromTarget(v.target) || v.target;
  const method = v.method || "GET";
  const desc = (v.description || "").trim().replace(/\s+/g, " ");
  const poc = normalizePoc(v);
  const cvss = typeof v.cvss === "number" && v.cvss > 0 ? ` (CVSS ${v.cvss})` : "";

  const bullets = [
    `- Severity: ${v.severity}${cvss}`,
    `- Target host: ${host}`,
    `- Endpoint: ${method} ${v.endpoint || "(unspecified)"}`,
    `- Full URL: ${fullUrl(v.target, v.endpoint || "")}`,
    poc ? `- Reproduction / payload: ${poc}` : "",
    desc ? `- Original description: ${desc}` : "",
    `- Marked false positive: ${markedAt.toISOString()}`,
  ].filter(Boolean);

  return `## ${v.title}\n${bullets.join("\n")}`;
}

// A stable identity for a finding, used to de-duplicate entries in a domain file.
export function fpEntryKey(v: FpVulnInput): string {
  return [
    (v.title || "").trim().toLowerCase(),
    (v.method || "GET").trim().toUpperCase(),
    (v.endpoint || "").trim().toLowerCase(),
  ].join("|");
}
