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
import { getProcess, removeProcess } from "./scanStore";

// Scan statuses that mean "still running" (a lookup we can stop).
const ACTIVE_STATUSES = ["running", "crawling", "scanning", "analyzing"];

// Host of a target URL/string, for grouping ASM scans by domain on the Scans page.
function hostOf(target: string): string {
  const t = (target || "").trim();
  if (!t) return "unknown";
  try {
    return new URL(t.includes("://") ? t : `https://${t}`).host || t;
  } catch {
    return t.replace(/^[a-z]+:\/\//i, "").split("/")[0] || t;
  }
}
// All ASM-spawned scans use this project name so the Scans page groups them by
// domain; the scanName still says which kind of run it is.
const asmProject = (target: string) => `ASM: ${hostOf(target)}`;

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
// asset owner). Mirrors schedulerDaemon.triggerScan. Returns the spawned scan
// id, or an { error } carrying the real reason so callers can surface it.
async function triggerInternalScan(
  payload: Record<string, any>,
): Promise<{ scanId?: string; error?: string }> {
  const secret = process.env.SCHEDULER_SECRET;
  if (!secret) {
    const error = "SCHEDULER_SECRET is not set on the server — cannot spawn scans";
    log.error("CVE_LOOKUP", error);
    return { error };
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
      let detail = "";
      try {
        const body = await res.json();
        detail = body?.error || JSON.stringify(body);
      } catch {
        detail = (await res.text().catch(() => "")) || "";
      }
      const error = `scan API returned ${res.status}${detail ? `: ${detail}` : ""}`;
      log.error("CVE_LOOKUP", `Internal scan spawn failed — ${error}`);
      return { error };
    }
    const data = await res.json();
    return { scanId: data.scanId || payload.preGeneratedScanId };
  } catch (e: any) {
    const error = `could not reach the scan API at ${url} (${e?.message || e})`;
    log.error("CVE_LOOKUP", "Internal scan spawn failed", e);
    return { error };
  }
}

// Resolve the model for an automated run. Precedence:
//   1. an explicit model passed by the caller (manual action picker),
//   2. the admin-configured cveLookupModel (AppSettings),
//   3. the asset owner's default model,
//   4. openai/gpt-4o.
async function resolveModel(userId: string, explicit?: string): Promise<string> {
  if (explicit && explicit.trim()) return explicit.trim();
  try {
    const settings = await getAppSettings();
    if (settings?.cveLookupModel) return settings.cveLookupModel;
  } catch {}
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

// Version-recon instruction for an asset with no known version. Prefers a
// user-authored instruction titled "tech_stack" (context prepended); otherwise
// a built-in fingerprint-only prompt. NEVER searches CVEs — its only job is to
// determine the exact running version and record it via report_technology.
async function buildTechStackInstruction(tech: {
  vendor: string;
  product: string;
  target: string;
  ecosystem: string;
  description: string;
}): Promise<string> {
  const name = [tech.vendor, tech.product].filter(Boolean).join(" ") || tech.product;
  const context = [
    `TECH-STACK RECON — non-exploitative fingerprinting only. DO NOT exploit, fuzz, or intrusively test.`,
    ``,
    `On ${tech.target}, precisely determine the EXACT version of this component:`,
    `- Product: ${name}`,
    tech.ecosystem ? `- Ecosystem: ${tech.ecosystem}` : ``,
    tech.description ? `- Notes: ${tech.description}` : ``,
  ]
    .filter((l) => l !== "")
    .join("\n");

  const override = await getInstructionContent("tech_stack");
  if (override) {
    return `${context}\n\n${override}`;
  }
  return [
    context,
    ``,
    `Use every passive/light signal: HTTP headers (Server, X-Powered-By, Set-Cookie), banners, static asset paths & hashes, version/build endpoints, meta tags, changelogs, JS globals, favicon hashes, error pages.`,
    `When you identify the exact version, record the confirmed product + vendor + version by calling report_technology (this updates the ASM inventory in place). Also record any other third-party/vendor components you fingerprint, with their versions.`,
    `Do NOT search for or file CVEs — that happens in a later step. If you genuinely cannot determine the version, report what you can and finish; do NOT guess a version.`,
  ].join("\n");
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
    await spawnForTech(tech, next);
    await new Promise((r) => setTimeout(r, 1000));
  }
}

// Dispatch the right run for one asset:
//   • has a version → cve_lookup (verify version + search CVEs),
//   • no version    → tech_stack recon (find the version only; no CVE search).
// Marks the row "checking" (with its next scheduled check) *before* spawning to
// avoid double-fire, and rolls that back if the spawn fails.
async function spawnForTech(
  tech: any,
  next: Date,
  model?: string,
): Promise<{ ok: boolean; error?: string; scanId?: string; kind?: string }> {
  const hasVersion = !!(tech.version && String(tech.version).trim());
  const kind = hasVersion ? "cve_lookup" : "tech_stack";
  const prevStatus = tech.cveStatus;

  try {
    await prisma.technology.update({
      where: { id: tech.id },
      data: { cveStatus: "checking", nextCveCheckAt: next },
    });
  } catch (e) {
    log.warn("CVE_LOOKUP", `Failed to mark tech ${tech.id} as checking`, { err: String(e) });
    return { ok: false, error: "database error marking asset for check" };
  }

  const llmModel = await resolveModel(tech.userId, model);
  const label = [tech.vendor, tech.product].filter(Boolean).join(" ") || tech.product;
  const instruction = hasVersion
    ? buildLookupInstruction(tech)
    : await buildTechStackInstruction(tech);

  const res = await triggerInternalScan({
    preGeneratedScanId: randomUUID(),
    userId: tech.userId,
    target: tech.target,
    projectName: asmProject(tech.target),
    scanName: `${hasVersion ? "CVE lookup" : "Version recon"} — ${label}`,
    llmModel,
    scanMode: "quick",
    instruction,
    kind,
    techId: tech.id,
  });

  if (!res.scanId) {
    // Roll back the "checking" state so it's retried later.
    await prisma.technology
      .update({ where: { id: tech.id }, data: { cveStatus: prevStatus } })
      .catch(() => {});
    return { ok: false, error: res.error || "failed to start the scan", kind };
  }
  return { ok: true, scanId: res.scanId, kind };
}

// Kill a running scan process (same-process scanStore) and mark it stopped.
async function stopScanId(scanId: string): Promise<void> {
  const proc = getProcess(scanId);
  if (proc) {
    try {
      proc.kill("SIGTERM");
    } catch (e) {
      log.warn("CVE_LOOKUP", `Failed to SIGTERM scan ${scanId}`, { err: String(e) });
    }
    removeProcess(scanId);
  }
  await prisma.scan.update({ where: { id: scanId }, data: { status: "stopped" } }).catch(() => {});
}

// Stop the in-progress cve_lookup(s) for one asset and clear its "checking" state.
export async function stopCveLookupForTech(
  techId: string,
): Promise<{ ok: boolean; stopped: number }> {
  let scans;
  try {
    scans = await prisma.scan.findMany({
      where: { techId, kind: { in: ["cve_lookup", "tech_stack"] }, status: { in: ACTIVE_STATUSES } },
    });
  } catch {
    return { ok: false, stopped: 0 };
  }
  for (const s of scans) await stopScanId(s.id);
  await prisma.technology
    .update({
      where: { id: techId },
      data: { cveStatus: "unknown" },
    })
    .catch(() => {});
  log.info("CVE_LOOKUP", `Stopped ${scans.length} lookup(s) for tech ${techId}`);
  return { ok: true, stopped: scans.length };
}

// Stop ALL in-progress cve_lookup scans in scope and clear their assets' state.
export async function stopAllCveLookups(opts: {
  userId: string;
  isAdmin: boolean;
}): Promise<{ ok: boolean; stopped: number }> {
  let scans;
  try {
    scans = await prisma.scan.findMany({
      where: {
        kind: { in: ["cve_lookup", "tech_stack"] },
        status: { in: ACTIVE_STATUSES },
        ...(opts.isAdmin ? {} : { userId: opts.userId }),
      },
    });
  } catch {
    return { ok: false, stopped: 0 };
  }
  const techIds = new Set<string>();
  for (const s of scans) {
    await stopScanId(s.id);
    if (s.techId) techIds.add(s.techId);
  }
  // Also clear any tech stuck on "checking" in scope (covers scans already gone).
  await prisma.technology
    .updateMany({
      where: { cveStatus: "checking", ...(opts.isAdmin ? {} : { userId: opts.userId }) },
      data: { cveStatus: "unknown" },
    })
    .catch(() => {});
  log.info("CVE_LOOKUP", `Stopped ${scans.length} lookup(s) across ${techIds.size} asset(s)`);
  return { ok: true, stopped: scans.length };
}

// Run a CVE lookup across the whole inventory at once (one button). Scoped to
// the caller's own assets unless admin. Skips assets already "checking".
// Ignores the automation toggle. Spawns sequentially with a small delay so we
// don't hammer the scan API / LLM all at once.
export async function runAllCveLookups(opts: {
  userId: string;
  isAdmin: boolean;
  model?: string;
}): Promise<{ started: number; skipped: number; failed: number; error?: string }> {
  let techs;
  try {
    techs = await prisma.technology.findMany({
      where: opts.isAdmin ? {} : { userId: opts.userId },
    });
  } catch (e) {
    log.error("CVE_LOOKUP", "runAllCveLookups query failed", e);
    return { started: 0, skipped: 0, failed: 0, error: "failed to load inventory" };
  }

  const settings = await getAppSettings();
  const intervalHours = settings?.cveLookupIntervalHours || 24;
  const next = new Date(Date.now() + intervalHours * 3600_000);

  let started = 0;
  let skipped = 0;
  let failed = 0;
  let firstError: string | undefined;

  for (const tech of techs) {
    if (tech.cveStatus === "checking") {
      skipped++;
      continue;
    }
    const res = await spawnForTech(tech, next, opts.model);
    if (res.ok) {
      started++;
    } else {
      failed++;
      if (!firstError) firstError = res.error;
    }
    await new Promise((r) => setTimeout(r, 300));
  }

  log.info(
    "CVE_LOOKUP",
    `Bulk lookup: started=${started} skipped=${skipped} failed=${failed} (total=${techs.length})`,
  );
  return { started, skipped, failed, error: failed > 0 ? firstError : undefined };
}

// Manual, on-demand lookup for one asset — ignores the global automation toggle
// so a user can check a chosen target immediately. On a CVE hit the lookup's
// completion still auto-spawns the cve_scan (see maybeSpawnCveScanForScan).
export async function runCveLookupNow(
  techId: string,
  model?: string,
): Promise<{ ok: boolean; error?: string }> {
  let tech;
  try {
    tech = await prisma.technology.findUnique({ where: { id: techId } });
  } catch {
    return { ok: false, error: "lookup failed" };
  }
  if (!tech) return { ok: false, error: "asset not found" };
  if (tech.cveStatus === "checking") {
    return { ok: false, error: "a lookup is already in progress for this asset" };
  }

  const settings = await getAppSettings();
  const intervalHours = settings?.cveLookupIntervalHours || 24;
  const next = new Date(Date.now() + intervalHours * 3600_000);

  const res = await spawnForTech(tech, next, model);
  if (!res.ok) return { ok: false, error: res.error };
  log.info(
    "CVE_LOOKUP",
    `Manual ${res.kind === "tech_stack" ? "version recon" : "lookup"} started for tech ${techId} (${String(res.scanId).slice(0, 8)})`,
  );
  return { ok: true };
}

// Launch a normal, full pentest (kind="standard") against an ASM asset's target
// — the same thing the New Scan page does, started straight from the inventory.
// This is NOT part of the CVE pipeline: it does full recon + tests every vuln
// class, and does not auto-spawn anything on completion. Ignores the automation
// toggle. Its own tech detection still feeds the ASM inventory.
export async function runFullScanForTech(
  techId: string,
  instruction?: string,
  model?: string,
): Promise<{ ok: boolean; error?: string; scanId?: string }> {
  let tech;
  try {
    tech = await prisma.technology.findUnique({ where: { id: techId } });
  } catch {
    return { ok: false, error: "lookup failed" };
  }
  if (!tech) return { ok: false, error: "asset not found" };

  const llmModel = await resolveModel(tech.userId, model);
  const label = [tech.vendor, tech.product].filter(Boolean).join(" ") || tech.product;
  const scanId = randomUUID();
  const trimmed = (instruction || "").trim();

  const res = await triggerInternalScan({
    preGeneratedScanId: scanId,
    userId: tech.userId,
    target: tech.target,
    projectName: asmProject(tech.target),
    scanName: `Full scan — ${label} (${tech.target})`,
    llmModel,
    scanMode: "standard",
    kind: "standard",
    ...(trimmed ? { instruction: trimmed } : {}),
  });

  if (!res.scanId) return { ok: false, error: res.error || "failed to start the scan" };
  log.info("CVE_LOOKUP", `Manual full scan started for tech ${techId} (${res.scanId.slice(0, 8)})`);
  return { ok: true, scanId: res.scanId };
}

// ── Post-scan hook: process a finished cve_lookup and spawn cve_scan on a hit ──
export async function maybeSpawnCveScanForScan(
  scanId: string,
  vulns: any[],
  finalStatus?: string,
): Promise<void> {
  let scan;
  try {
    scan = await prisma.scan.findUnique({ where: { id: scanId } });
  } catch {
    return;
  }
  // Only cve_lookup / tech_stack runs drive ASM automation. A cve_scan (or any
  // normal scan) never spawns further scans, so the loop terminates.
  if (!scan || !scan.techId) return;
  if (scan.kind !== "cve_lookup" && scan.kind !== "tech_stack") return;

  const settings = await getAppSettings();
  const intervalHours = settings?.cveLookupIntervalHours || 24;

  // A run that was stopped/failed must NOT be treated as a clean result —
  // just release the "checking" state so the asset isn't stuck.
  if (finalStatus && finalStatus !== "completed") {
    await prisma.technology
      .update({ where: { id: scan.techId }, data: { cveStatus: "unknown" } })
      .catch(() => {});
    return;
  }

  // tech_stack recon: only job was to find the version (techSync already applied
  // any report_technology update). Release "checking"; if a version is now known
  // make it due for a real CVE lookup soon, else back off by the interval.
  if (scan.kind === "tech_stack") {
    const tech = await prisma.technology.findUnique({ where: { id: scan.techId } });
    const hasVersion = !!(tech?.version && tech.version.trim());
    await prisma.technology
      .update({
        where: { id: scan.techId },
        data: {
          cveStatus: "unknown",
          versionCheckedAt: new Date(),
          nextCveCheckAt: hasVersion ? new Date() : new Date(Date.now() + intervalHours * 3600_000),
        },
      })
      .catch(() => {});
    log.info(
      "CVE_LOOKUP",
      `Version recon ${scanId.slice(0, 8)} finished — ${hasVersion ? "version found, queued for CVE lookup" : "no version found"}`,
    );
    return;
  }

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

  // CVE found → auto-spawn a cve_scan immediately.
  const tech = await prisma.technology.findUnique({ where: { id: scan.techId } });
  if (!tech) return;
  const res = await spawnCveScan(tech, foundCves);
  if (!res.ok) {
    log.warn("CVE_LOOKUP", `Auto cve_scan for tech ${tech.id} not started: ${res.error}`);
  } else {
    log.info("CVE_LOOKUP", `Auto-spawned cve_scan for tech ${tech.id}`);
  }
}

// Spawn a cve_scan (kind="cve_scan") for one asset, loading the "cve_scan"
// instruction and pinning the concrete component/version/CVE context so the run
// is self-contained. Shared by the automatic path and the manual button.
// `foundCves` may be empty (a manual run before any lookup) — the scan then
// validates whatever known CVEs apply to the component/version.
async function spawnCveScan(
  tech: any,
  foundCves: Array<{ cve: string }>,
  model?: string,
): Promise<{ ok: boolean; error?: string; scanId?: string }> {
  const cveScanInstruction = await getInstructionContent("cve_scan");
  if (!cveScanInstruction) {
    return {
      ok: false,
      error: "no instruction titled 'cve_scan' exists — create one to enable CVE scans",
    };
  }

  // One CVE scan per asset at a time: if one is already running for this tech,
  // don't spawn another — a single scan validates ALL of the version's CVEs.
  try {
    const active = await prisma.scan.findFirst({
      where: { techId: tech.id, kind: "cve_scan", status: { in: ACTIVE_STATUSES } },
    });
    if (active) {
      return { ok: false, error: "a CVE scan is already running for this asset" };
    }
  } catch {}

  const llmModel = await resolveModel(tech.userId, model);
  const label = [tech.vendor, tech.product].filter(Boolean).join(" ") || tech.product;
  // De-dup + stable order so all of the version's CVEs go into one run.
  const cveList = Array.from(new Set(foundCves.map((c) => c.cve))).sort().join(", ");
  const scanName = `CVE scan — ${label}${cveList ? ` (${cveList})` : ""}`;

  const res = await triggerInternalScan({
    preGeneratedScanId: randomUUID(),
    userId: tech.userId,
    target: tech.target,
    projectName: asmProject(tech.target),
    scanName,
    llmModel,
    scanMode: "standard",
    instruction:
      `Target component: ${label} version ${tech.version || "(unknown)"} on ${tech.target}.\n` +
      (cveList
        ? `Confirmed CVEs to validate/exploit: ${cveList}.\n\n`
        : `Search for and validate/exploit any published CVE affecting this exact version.\n\n`) +
      cveScanInstruction,
    kind: "cve_scan",
    techId: tech.id,
  });

  if (!res.scanId) return { ok: false, error: res.error || "failed to start the cve_scan" };
  return { ok: true, scanId: res.scanId };
}

// Manual, on-demand cve_scan for one asset — ignores the automation toggle.
// Uses CVEs already recorded on the asset (from a prior lookup) if present.
export async function runCveScanNow(
  techId: string,
  model?: string,
): Promise<{ ok: boolean; error?: string; scanId?: string }> {
  let tech;
  try {
    tech = await prisma.technology.findUnique({ where: { id: techId } });
  } catch {
    return { ok: false, error: "lookup failed" };
  }
  if (!tech) return { ok: false, error: "asset not found" };
  const foundCves = Array.isArray(tech.foundCves) ? (tech.foundCves as any[]) : [];
  const res = await spawnCveScan(tech, foundCves, model);
  if (res.ok) {
    log.info("CVE_LOOKUP", `Manual cve_scan started for tech ${techId} (${String(res.scanId).slice(0, 8)})`);
  }
  return res;
}
