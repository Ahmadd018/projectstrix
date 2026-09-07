// Syncs a scan's on-disk ASM inventory (technologies.json, produced by the
// strix `report_technology` tool) into the Technology table. Each record is a
// third-party/vendor solution detected on a target, keyed by
// (userId, target, vendor, product) so re-detection updates the version in
// place rather than creating duplicates.
//
// When a re-detection reports a *different* non-empty version, the row is reset
// for re-checking (cveStatus -> unknown, nextCveCheckAt -> now) so the CVE
// lookup re-evaluates the new version promptly.
import { prisma } from "./prisma";
import { log } from "./logger";

export interface TechRecord {
  product?: string;
  target?: string;
  vendor?: string;
  version?: string;
  ecosystem?: string;
  category?: string;
  description?: string;
  evidence?: string;
}

const norm = (s: string) => (s || "").trim().toLowerCase().replace(/\s+/g, " ");

// Canonical origin (scheme://host, lowercased) so the same host reported as
// "x.az", "https://x.az", "https://x.az/path" all collapse to one asset key
// and re-scans update in place instead of inserting duplicates.
function canonicalTarget(raw: string): string {
  const t = (raw || "").trim();
  if (!t) return t;
  try {
    const u = new URL(t.includes("://") ? t : `https://${t}`);
    return `${u.protocol}//${u.host}`.toLowerCase();
  } catch {
    return t.toLowerCase().replace(/\/+$/, "");
  }
}

// Would these two product names refer to the same thing? Exact after
// normalization, or one is a whole substring of the other ("Apache" ⊂
// "Apache HTTP Server"). Used to collapse versionless duplicates that agents
// report under slightly different names.
function similarProduct(a: string, b: string): boolean {
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  return na.includes(nb) || nb.includes(na);
}

export async function syncTechToDb(
  scanId: string,
  userId: string,
  techs: TechRecord[],
): Promise<number> {
  if (!Array.isArray(techs) || techs.length === 0) return 0;

  let synced = 0;
  for (const t of techs) {
    const product = String(t.product ?? "").trim();
    const rawTarget = String(t.target ?? "").trim();
    if (!product || !rawTarget) continue;
    const target = canonicalTarget(rawTarget);

    const vendor = String(t.vendor ?? "").trim();
    const version = String(t.version ?? "").trim();
    const ecosystem = String(t.ecosystem ?? "").trim();
    const category = String(t.category ?? "").trim();
    const description = String(t.description ?? "").trim();
    const evidence = String(t.evidence ?? "").trim();

    try {
      // Look at everything already tracked on this host so we can dedupe against
      // near-matches, not just the exact (vendor, product) key. Compare by
      // canonical origin so legacy rows with a differently-formatted target
      // still match.
      const userRows = await prisma.technology.findMany({ where: { userId } });
      const onHost = userRows.filter((r) => canonicalTarget(r.target) === target);

      // Pick the best existing match:
      //  1. exact vendor+product (case-insensitive),
      //  2. same product regardless of vendor,
      //  3. a similar product name when either side has no version (collapses
      //     versionless noise like "Apache" vs "Apache HTTP Server").
      const existing =
        onHost.find((r) => norm(r.product) === norm(product) && norm(r.vendor) === norm(vendor)) ||
        onHost.find((r) => norm(r.product) === norm(product)) ||
        onHost.find((r) => (!r.version || !version) && similarProduct(r.product, product));

      if (!existing) {
        await prisma.technology.create({
          data: {
            userId,
            target,
            vendor,
            product,
            version,
            ecosystem,
            category,
            description,
            evidence,
            firstScanId: scanId,
            cveStatus: "unknown",
            // Due immediately so the scheduler's first sweep evaluates it.
            nextCveCheckAt: new Date(),
            lastSeenAt: new Date(),
          },
        });
        synced++;
        continue;
      }

      // Merge this sighting into the existing row.
      const finalVersion = version || existing.version;
      const versionChanged = !!finalVersion && finalVersion !== existing.version;
      const data: any = { lastSeenAt: new Date() };
      if (version) data.version = version;
      if (evidence) data.evidence = evidence;
      if (description) data.description = description;
      if (category) data.category = category;
      if (ecosystem) data.ecosystem = ecosystem;
      if (vendor && !existing.vendor) data.vendor = vendor;
      // Adopt the more specific product name when this sighting is at least as
      // authoritative (carries a version) and names the product more fully.
      if (version && !existing.version && product.length > existing.product.length) {
        data.product = product;
      }
      // New version → re-evaluate CVEs promptly. Skip while a lookup is already
      // in flight ("checking"): that run finalizes status/next-check on close,
      // and resetting here would make the asset eligible for a second sweep.
      if (versionChanged && existing.cveStatus !== "checking") {
        data.cveStatus = "unknown";
        data.nextCveCheckAt = new Date();
      }
      try {
        await prisma.technology.update({ where: { id: existing.id }, data });
      } catch (e: any) {
        // A product/vendor rename could collide with the unique key — retry
        // without the rename so we still refresh the rest.
        if (e?.code === "P2002") {
          delete data.product;
          delete data.vendor;
          await prisma.technology.update({ where: { id: existing.id }, data });
        } else {
          throw e;
        }
      }
      synced++;
    } catch (e) {
      log.warn("TECH_SYNC", `Failed to sync technology '${product}' on '${target}'`, {
        err: String(e),
      });
    }
  }

  if (synced > 0) {
    log.info("TECH_SYNC", `Synced ${synced} technology record(s) for scan ${scanId.slice(0, 8)}`);
  }
  return synced;
}
