// Server-side store for false-positive (FP) instructions.
//
// Layout: one parent folder, one sub-folder per target domain, one markdown file
// per finding — so each FP can be browsed and removed individually:
//
//   fp_instructions/
//     bastion.competo.io/
//       sql-injection-in-auth-session-1a2b3c4d.md
//       reflected-xss-in-search-9f8e7d6c.md
//     another.host.com/
//       ...
//
// Shared across all users (team model): any authenticated user's FP marks apply
// to any scan of that domain, and everyone sees the same folder tree.
import fs from "fs";
import path from "path";
import crypto from "crypto";
import {
  FpVulnInput,
  sanitizeDomain,
  hostFromTarget,
  buildFpEntry,
  fpEntryKey,
} from "./fpInstruction";

// Durable location for FP instruction files. Defaults to the app root so the
// files survive restarts; override with FP_INSTRUCTIONS_DIR in production.
export const FP_DIR =
  process.env.FP_INSTRUCTIONS_DIR || path.join(process.cwd(), "fp_instructions");

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// A safe folder name for a domain (already sanitized; guard traversal anyway).
function safeDomain(domainKey: string): string {
  return domainKey.replace(/[^a-z0-9._-]/gi, "_");
}

export function domainDir(domainKey: string): string {
  return path.join(FP_DIR, safeDomain(domainKey));
}

// A safe per-finding file name derived from the finding, stable for de-duping.
function slugify(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "finding";
}
function findingFileName(v: FpVulnInput): string {
  const hash = crypto.createHash("sha1").update(fpEntryKey(v)).digest("hex").slice(0, 8);
  return `${slugify(v.title)}-${hash}.md`;
}

function preamble(host: string): string {
  return (
    `# False-Positive Instructions — ${host}\n\n` +
    `> [KNOWN FALSE POSITIVES for ${host}] Findings listed below were manually reviewed and confirmed NOT to be real issues. ` +
    `During any scan of this target, do NOT flag, report, or re-test them. If you rediscover one, treat it as a confirmed false positive and ignore it. ` +
    `The root/orchestrator agent MUST exclude these from the final report. ` +
    `Only report a genuinely DIFFERENT vulnerability (different class, endpoint, or method) at the same location.\n`
  );
}

// Add a finding as a known FP for its domain: writes one markdown file into the
// domain's folder. Idempotent — a finding with the same title/method/endpoint
// (same file name) is not duplicated. Returns the domain + whether it was new.
export function addFpEntry(v: FpVulnInput): { domain: string; file: string; added: boolean } {
  const domain = sanitizeDomain(v.target);
  const dir = domainDir(domain);
  ensureDir(dir);

  const fileName = findingFileName(v);
  const file = path.join(dir, fileName);
  if (fs.existsSync(file)) return { domain, file, added: false };

  fs.writeFileSync(file, `${buildFpEntry(v)}\n`);
  return { domain, file, added: true };
}

export interface FpFinding {
  id: string; // file name (opaque, safe basename)
  title: string;
  content: string;
  updatedAt: string;
}

export interface FpDomainMeta {
  domain: string;
  host: string;
  entryCount: number;
  size: number;
  updatedAt: string;
}

function listFindingFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith(".md"));
}

export function listFpDomains(): FpDomainMeta[] {
  ensureDir(FP_DIR);
  const entries = fs.readdirSync(FP_DIR, { withFileTypes: true }).filter((d) => d.isDirectory());
  return entries
    .map((d) => {
      const dir = path.join(FP_DIR, d.name);
      const files = listFindingFiles(dir);
      let size = 0;
      let updatedAt = fs.statSync(dir).mtime;
      for (const f of files) {
        const st = fs.statSync(path.join(dir, f));
        size += st.size;
        if (st.mtime > updatedAt) updatedAt = st.mtime;
      }
      return {
        domain: d.name,
        host: d.name, // sanitized domain preserves the host (dots/hyphens kept)
        entryCount: files.length,
        size,
        updatedAt: updatedAt.toISOString(),
      };
    })
    .filter((d) => d.entryCount > 0)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function readFpFindings(domainKey: string): FpFinding[] {
  const dir = domainDir(domainKey);
  const files = listFindingFiles(dir);
  return files
    .map((f) => {
      const full = path.join(dir, f);
      const content = fs.readFileSync(full, "utf-8");
      const title = content.match(/^##\s+(.+)$/m)?.[1]?.trim() || f.replace(/\.md$/, "");
      return { id: f, title, content, updatedAt: fs.statSync(full).mtime.toISOString() };
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

// The full markdown for a domain (preamble + every finding), used for browsing
// and as the per-domain block of the sandbox registry.
export function domainRegistryMarkdown(domainKey: string): string | null {
  const findings = readFpFindings(domainKey);
  if (findings.length === 0) return null;
  const host = hostFromTarget(domainKey) || domainKey;
  return `${preamble(host)}\n${findings.map((f) => f.content.trim()).join("\n\n")}\n`;
}

export function deleteFpDomain(domainKey: string): boolean {
  const dir = domainDir(domainKey);
  if (!fs.existsSync(dir)) return false;
  fs.rmSync(dir, { recursive: true, force: true });
  return true;
}

export function deleteFpFinding(domainKey: string, fileId: string): boolean {
  // Only allow a plain basename — never a path.
  if (!fileId || fileId.includes("/") || fileId.includes("\\") || fileId.includes("..")) return false;
  const file = path.join(domainDir(domainKey), path.basename(fileId));
  if (!fs.existsSync(file)) return false;
  fs.rmSync(file);
  // Drop the now-empty domain folder so it doesn't linger in listings.
  const dir = domainDir(domainKey);
  if (listFindingFiles(dir).length === 0) fs.rmSync(dir, { recursive: true, force: true });
  return true;
}

// Gather the combined FP registry markdown for one or more scan targets. Returns
// "" when none of the targets have known false positives.
export function readFpForTargets(targets: string[]): string {
  ensureDir(FP_DIR);
  const seen = new Set<string>();
  const blocks: string[] = [];
  for (const t of targets) {
    if (!t || !t.trim()) continue;
    const domain = sanitizeDomain(t);
    if (seen.has(domain)) continue;
    seen.add(domain);
    const md = domainRegistryMarkdown(domain);
    if (md && md.trim().length) blocks.push(md.trim());
  }
  return blocks.join("\n\n---\n\n");
}
