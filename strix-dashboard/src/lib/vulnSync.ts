// Ensures on-disk findings (vulnerabilities.json) have matching DB rows, so that
// triage actions keyed by the DB id (mark false-positive, report to Jira) work
// from the scan detail page — not only from the Vulnerabilities page.
//
// The DB row's `vulnId` mirrors the strix finding `id` from the JSON file; the
// row's own `id` (uuid) is what the triage APIs consume. We create rows lazily
// with a guarded findFirst+create (no (scanId, vulnId) unique constraint exists,
// so createMany/skipDuplicates cannot be relied on for de-duplication).
import { randomUUID } from "crypto";
import { prisma } from "./prisma";

export interface DbVulnMeta {
  id: string; // DB uuid — used by triage APIs
  status: string;
}

// Returns a map of strix finding id -> { dbId, status }.
export async function syncVulnsToDb(
  scanId: string,
  jsonVulns: any[],
): Promise<Record<string, DbVulnMeta>> {
  const map: Record<string, DbVulnMeta> = {};
  if (!Array.isArray(jsonVulns) || jsonVulns.length === 0) return map;

  // Load the rows that already exist for this scan in one query.
  const existing = await prisma.vulnerability.findMany({ where: { scanId } });
  const byVulnId = new Map<string, { id: string; status: string }>();
  for (const row of existing) byVulnId.set(row.vulnId, { id: row.id, status: row.status });

  for (const v of jsonVulns) {
    const vulnId = String(v.id ?? "").trim() || randomUUID();
    const found = byVulnId.get(vulnId);
    if (found) {
      map[vulnId] = { id: found.id, status: found.status };
      continue;
    }
    try {
      const created = await prisma.vulnerability.create({
        data: {
          scanId,
          vulnId,
          title: v.title || "Unknown",
          severity: v.severity || "info",
          endpoint: v.endpoint || "",
          method: v.method || "",
          description: v.description || "",
          poc: v.poc || v.poc_script_code || v.poc_description || "",
          cvss: typeof v.cvss === "number" ? v.cvss : 0.0,
          remediation: v.remediation || "",
        },
      });
      byVulnId.set(vulnId, { id: created.id, status: created.status });
      map[vulnId] = { id: created.id, status: created.status };
    } catch {
      // Best-effort: a concurrent writer may have created it — re-read.
      const row = await prisma.vulnerability.findFirst({ where: { scanId, vulnId } });
      if (row) map[vulnId] = { id: row.id, status: row.status };
    }
  }
  return map;
}
