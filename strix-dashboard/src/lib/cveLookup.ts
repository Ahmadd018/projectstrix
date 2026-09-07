// ASM CVE-lookup automation.
//
// Two entry points:
//   • sweepCveLookups()          — called by the scheduler daemon on an interval.
//     Finds Technology assets due for a check and spawns a lightweight Taipan
//     "cve_lookup" run per asset that re-verifies the live version (via
//     report_technology) and searches published advisories for that exact
//     version (filing any hit via create_dependency_report).
//   • maybeSpawnCveScanForScan() — called when any scan finishes. For a
//     cve_lookup run, it records the verified version + found CVEs on the linked
//     Technology and, when a CVE was found, immediately spawns a full "cve_scan"
//     that auto-loads the instruction titled "cve_scan".
//
// A cve_scan never triggers further automation, so the loop terminates.
import { randomUUID } from "crypto";
import { prisma } from "./prisma";
import { log } from "./logger";

// How many assets to kick per sweep, to bound LLM cost / concurrent runs.
const MAX_LOOKUPS_PER_SWEEP = 5;

async function getAppSettings() {
  try {
    return await prisma.appSettings.upsert({
      where: { id: "singleton" },
      update: {},
      create: { id: "singleton" },
    });
  } catch (e) {
    log.error("CVE_LOOKUP", "Failed to read AppSettings", e);
    return null;
  }
}

// POST the internal /api/scans endpoint as the scheduler (impersonating the
// asset owner). Mirrors schedulerDaemon.triggerScan.
async function triggerInternalScan(payload: Record<string, any>): Promise<string | null> {
  const secret = process.env.SCHEDULER_SECRET;
  if (!secret) {
    log.error("CVE_LOOKUP", "SCHEDULER_SECRET not set — cannot spawn lookup/cve scans");
    return null;
  }
  const port = process.env.PORT || "48080";
  const url = `http://127.0.0.1:${port}/api/scans`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-scheduler-secret": secret },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      log.error("CVE_LOOKUP", `Internal scan spawn returned ${res.status}: ${await res.text()}`);
      return null;
    }
    const data = await res.json();
    return data.scanId || payload.preGeneratedScanId || null;
  } catch (e) {
    log.error("CVE_LOOKUP", "Internal scan spawn failed", e);
    return null;
  }
}

async function defaultModelForUser(userId: string): Promise<string> {
  try {
    const s = await prisma.userSettings.findUnique({ where: { userId } });
    if (s?.defaultModel) return s.defaultModel;
  } catch {}
  return "openai/gpt-4o";
}

function buildLookupInstruction(tech: {
  vendor: string;
  product: string;
  version: string;
  target: string;
  ecosystem: string;
  description: string;
}): string {
  const name = [tech.vendor, tech.product].filter(Boolean).join(" ") || tech.product;
  return [
    `ASM CVE LOOKUP — scoped, non-exploitative reconnaissance only. DO NOT attempt any exploitation, fuzzing, or intrusive testing.`,
    ``,
    `Tracked third-party component on ${tech.target}:`,
    `- Product: ${name}`,
    tech.version ? `- Last known version: ${tech.version}` : `- Last known version: (unknown)`,
    tech.ecosystem ? `- Ecosystem: ${tech.ecosystem}` : ``,
    tech.description ? `- Notes: ${tech.description}` : ``,
    ``,
    `Do exactly two things:`,
    `1. Re-verify the EXACT version of ${name} currently running on ${tech.target} (banners, headers, static asset hashes, version endpoints, etc.). Record the confirmed product + version by calling report_technology (this updates the tracked inventory in place).`,
    `2. Determine whether any PUBLISHED CVE affects that exact version. Search ExploitDB, NVD, GitHub Security Advisories, and the web (use web_search). For each CVE that applies to the confirmed version, file it with create_dependency_report (include the real published advisory CVSS). Do NOT file speculative or version-mismatched CVEs.`,
    ``,
    `If no CVE affects the confirmed version, file nothing and finish — a clean result is a valid outcome.`,
  ]
    .filter((l) => l !== "")
    .join("\n");
}

// Look up the shared instruction titled "cve_scan" (case-insensitive). Returns
// its content, or null if none exists.
async function getInstructionContent(title: string): Promise<string | null> {
  try {
    const rows = await prisma.instruction.findMany();
    const match = rows.find((r) => r.title.trim().toLowerCase() === title.toLowerCase());
    return match ? match.content : null;
  } catch (e) {
    log.error("CVE_LOOKUP", `Failed to load instruction '${title}'`, e);
    return null;
  }
}

// ── Scheduler sweep: kick lookups for assets that are due ────────────────────
export async function sweepCveLookups(): Promise<void> {
  const settings = await getAppSettings();
  if (!settings || !settings.cveLookupEnabled) return;

  const intervalHours = settings.cveLookupIntervalHours || 24;
  const now = new Date();

  let due;
  try {
    due = await prisma.technology.findMany({
      where: {
        OR: [{ nextCveCheckAt: { lte: now } }, { nextCveCheckAt: null }],
        cveStatus: { not: "checking" },
      },
      orderBy: { nextCveCheckAt: "asc" },
      take: MAX_LOOKUPS_PER_SWEEP,
    });
  } catch (e) {
    log.error("CVE_LOOKUP", "Failed to query due technologies", e);
    return;
  }

  if (due.length === 0) return;
  log.info("CVE_LOOKUP", `Sweeping ${due.length} technology asset(s) for CVE lookup`);

  const next = new Date(now.getTime() + intervalHours * 3600_000);

  for (const tech of due) {
    // Mark before spawning to avoid double-fire across ticks/instances.
    try {
      await prisma.technology.update({
        where: { id: tech.id },
        data: { cveStatus: "checking", nextCveCheckAt: next },
      });
    } catch (e) {
      log.warn("CVE_LOOKUP", `Failed to mark tech ${tech.id} as checking`, { err: String(e) });
      continue;
    }

    const llmModel = await defaultModelForUser(tech.userId);
    const lookupScanId = randomUUID();
    const instruction = buildLookupInstruction(tech as any);

    const spawned = await triggerInternalScan({
      preGeneratedScanId: lookupScanId,
      userId: tech.userId,
      target: tech.target,
      projectName: "ASM CVE Lookup",
      scanName: `CVE lookup — ${[tech.vendor, tech.product].filter(Boolean).join(" ")}`,
      llmModel,
      scanMode: "quick",
      instruction,
      kind: "cve_lookup",
      techId: tech.id,
    });

    if (!spawned) {
      // Roll back the "checking" state so it's retried next sweep.
      await prisma.technology
        .update({ where: { id: tech.id }, data: { cveStatus: tech.cveStatus } })
        .catch(() => {});
    }

    await new Promise((r) => setTimeout(r, 1000));
  }
}

// ── Post-scan hook: process a finished cve_lookup and spawn cve_scan on a hit ──
export async function maybeSpawnCveScanForScan(scanId: string, vulns: any[]): Promise<void> {
  let scan;
  try {
    scan = await prisma.scan.findUnique({ where: { id: scanId } });
  } catch {
    return;
  }
  // Only a completed cve_lookup drives the automation. A cve_scan (or any normal
  // scan) never spawns further scans, so the loop terminates.
  if (!scan || scan.kind !== "cve_lookup" || !scan.techId) return;

  const settings = await getAppSettings();
  const intervalHours = settings?.cveLookupIntervalHours || 24;

  // Extract CVE findings (dependency_cve findings carry a `cve` field).
  const cveFindings = (Array.isArray(vulns) ? vulns : []).filter(
    (v) => v && typeof v.cve === "string" && /CVE-\d{4}-\d+/i.test(v.cve),
  );
  const foundCves = cveFindings.map((v) => ({
    cve: v.cve,
    cvss: typeof v.cvss === "number" ? v.cvss : null,
    severity: v.severity || null,
    summary: v.title || "",
    fixedVersion: v.dependency_metadata?.fixed_version || null,
  }));

  const now = new Date();
  const nextCheck = new Date(now.getTime() + intervalHours * 3600_000);

  try {
    await prisma.technology.update({
      where: { id: scan.techId },
      data: {
        cveStatus: foundCves.length > 0 ? "vulnerable" : "clean",
        foundCves: foundCves as any,
        cveCheckedAt: now,
        versionCheckedAt: now,
        nextCveCheckAt: nextCheck,
      },
    });
  } catch (e) {
    log.warn("CVE_LOOKUP", `Failed to update tech ${scan.techId} after lookup`, { err: String(e) });
  }

  if (foundCves.length === 0) {
    log.info("CVE_LOOKUP", `Lookup ${scanId.slice(0, 8)} found no CVEs — asset marked clean`);
    return;
  }

  // CVE found → auto-spawn a full cve_scan immediately, loading the "cve_scan"
  // instruction. Skip (with a clear warning) if that instruction is missing.
  const cveScanInstruction = await getInstructionContent("cve_scan");
  if (!cveScanInstruction) {
    log.warn(
      "CVE_LOOKUP",
      `CVE(s) found for tech ${scan.techId} but no instruction titled 'cve_scan' exists — ` +
        `create one to enable automatic CVE scans. Skipping auto-scan.`,
    );
    return;
  }

  const tech = await prisma.technology.findUnique({ where: { id: scan.techId } });
  if (!tech) return;

  const llmModel = await defaultModelForUser(tech.userId);
  const cveList = foundCves.map((c) => c.cve).join(", ");
  const scanName = `CVE scan — ${[tech.vendor, tech.product].filter(Boolean).join(" ")} (${cveList})`;

  const spawned = await triggerInternalScan({
    preGeneratedScanId: randomUUID(),
    userId: tech.userId,
    target: tech.target,
    projectName: "ASM CVE Scan",
    scanName,
    llmModel,
    scanMode: "standard",
    // The cve_scan instruction drives the behavior; we prepend the concrete
    // context (which component/version/CVEs) so the run is fully self-contained.
    instruction:
      `Target component: ${[tech.vendor, tech.product].filter(Boolean).join(" ")} ` +
      `version ${tech.version || "(unknown)"} on ${tech.target}.\n` +
      `Confirmed CVEs to validate/exploit: ${cveList}.\n\n` +
      cveScanInstruction,
    kind: "cve_scan",
    techId: tech.id,
  });

  if (spawned) {
    log.info(
      "CVE_LOOKUP",
      `Auto-spawned cve_scan ${String(spawned).slice(0, 8)} for tech ${tech.id} (${cveList})`,
    );
  }
}
