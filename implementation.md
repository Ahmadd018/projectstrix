# Project Strix — Security Assessment & Implementation Plan

**Assessment type:** White-box source code security review (static analysis)
**Scope:** `strix-dashboard/` (Next.js 15 App Router API + middleware + auth), `runner/deploy.py`
**Date:** 2026-08-12
**Reviewer:** Automated pentest pass

> This is a self-review of your own application (authorized). It focuses on the dashboard/orchestration layer — the code in this repo — **not** the Strix scanning engine itself. Findings are ranked by real-world risk with concrete, copy-pasteable fixes.

---

## 1. Executive Summary

The dashboard has clearly had a security pass already — there are `bcrypt` password hashing, a signed-JWT session, per-route ownership checks on most endpoints, a rate limiter, input length limits, SSRF-intent filtering, and path-traversal guards with `H-*`/`M-*`/`C-*` fix markers throughout. That is a good baseline.

However, several gaps remain, including one **broken-access-control (IDOR)** bug that leaks another user's scan output, hardcoded infrastructure credentials, and a session model that cannot revoke access. The table below prioritizes them.

### Findings at a glance

| ID | Severity | Title | Location |
|----|----------|-------|----------|
| **H-1** | **High** | Scan log/vuln SSE stream has no ownership check (IDOR) | `api/scans/[id]/stream/route.ts` |
| **H-2** | **High** | Hardcoded DB password + secrets in deploy script | `runner/deploy.py` |
| **H-3** | **High** | Stateless session cannot be revoked; role/status stale for 7 days | `lib/session.ts`, `middleware.ts` |
| **M-1** | **Medium** | SSRF filter misses cloud metadata IP & alternate encodings | `api/scans/route.ts` (`sendWebhookNotification`) |
| **M-2** | **Medium** | Rate limiter bypassable via spoofed `X-Forwarded-For` | `middleware.ts` |
| **M-3** | **Medium** | Session cookie not `Secure`; no CSRF token (SameSite-only) | `lib/session.ts` |
| **M-4** | **Medium** | Stored XSS in generated HTML report (unescaped fields) | `lib/reportGenerator.ts` |
| **M-5** | **Medium** | API keys & secrets stored in plaintext at rest | `api/user/keys/route.ts`, DB |
| **L-1** | Low | Fail-open middleware static-asset heuristic (`pathname.includes('.')`) | `middleware.ts` |
| **L-2** | Low | No validation/size cap on `/user/keys` & `/user/settings` bodies | `api/user/*` |
| **L-3** | Low | `configFile`/`diffBase` `..` check bypassable → absolute-path passthrough | `api/scans/route.ts` |
| **L-4** | Low | Username enumeration + info disclosure (IP, paths, error details) | multiple |
| **L-5** | Low | Missing Content-Security-Policy header | `next.config.ts` |

---

## 2. High severity

### H-1 — Any authenticated user can read any scan's live logs & findings (IDOR)

**Location:** `strix-dashboard/src/app/api/scans/[id]/stream/route.ts`

**What's wrong:** Every other scan endpoint validates ownership. For example `api/scans/[id]/route.ts`:

```ts
const dbScan = await prisma.scan.findUnique({ where: { id } });
if (!dbScan) return NextResponse.json({ error: "Scan not found" }, { status: 404 });
if (session.role !== "ADMIN" && dbScan.userId !== session.userId) {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });   // ownership check
}
```

The SSE stream route has **no `getSession()` call and no ownership check at all**. It only reads the `id` from the URL and streams the file:

```ts
export async function GET(_req, { params }) {
  const { id } = await params;
  const logFile = path.join(RUNS_DIR, id, "log.txt");   // no auth, no ownership
  // ... streams full log.txt + vulnerabilities.json to the caller
}
```

Middleware enforces that the caller is *authenticated and approved*, but not that they *own the scan*. So **any logged-in user can subscribe to any other user's scan** — including the full live agent transcript, target URLs, discovered vulnerabilities, and PoCs — simply by supplying that scan's ID.

**Impact:** Cross-tenant disclosure of the most sensitive data in the product (live pentest output of other users' targets). Scan IDs are UUIDv4 (not trivially guessable), but IDs routinely leak via shared links, the `Referer` header, exported reports, and browser history — so this is a real horizontal privilege-escalation path, not a theoretical one.

**PoC:**
```bash
# As user B (valid, approved session cookie), stream user A's scan:
curl -N 'https://host/api/scans/<USER_A_SCAN_UUID>/stream' \
  -H 'Cookie: strix_session=<USER_B_JWT>'
# -> replays USER_A's full log.txt and every vulnerability event
```

**Fix:** Add the same session + ownership gate the sibling routes use, and stop building file paths from the raw `id`.

```ts
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const dbScan = await prisma.scan.findUnique({ where: { id } });
  if (!dbScan) return new Response("Not found", { status: 404 });
  if (session.role !== "ADMIN" && dbScan.userId !== session.userId) {
    return new Response("Forbidden", { status: 403 });
  }
  // ... existing stream logic, using the DB-validated id
}
```

> The DB `findUnique({ where: { id } })` also incidentally hardens against path traversal on `id`, since only a real, existing scan UUID reaches the filesystem path.

---

### H-2 — Hardcoded database credentials and predictable secrets in the deployer

**Location:** `runner/deploy.py` (lines ~101-108)

```python
db_name = "strix"
db_user = "strix_user"
db_pass = "strix_password_123"          # <-- static, public, in a public repo
```

This password is committed to a public GitHub repo, so it is effectively public knowledge for every Strix deployment. It is used verbatim in the `DATABASE_URL` written to `.env`.

**Impact:** Postgres is bound to `127.0.0.1` (good), so remote exploitation needs a foothold on the host first. But the moment anything gives an attacker localhost access — a separate SSRF-to-Postgres, an RCE, a compromised co-tenant, or a misconfigured `listen_addresses`/firewall — the DB is opened with a known password. Given the DB holds every user's password hashes and plaintext LLM API keys (see M-5), this is a high-value single point of failure.

**Fix:** Generate the DB password randomly at deploy time, exactly as the script already does for `SESSION_SECRET`:

```python
import secrets
db_pass = secrets.token_urlsafe(24)   # unique per deployment
# reuse db_pass in the CREATE USER command AND the DATABASE_URL written to .env
```

Also consider: `scram-sha-256` instead of `md5` in `pg_hba.conf`, and never printing DB connection details to stdout.

---

### H-3 — Sessions cannot be revoked; role/status is trusted from a 7-day token

**Location:** `strix-dashboard/src/lib/session.ts`, `strix-dashboard/src/middleware.ts`

The JWT bakes `role` and `status` at login and lives for **7 days**, and both the middleware and the API routes trust those claims without re-checking the database:

```ts
// session.ts
await new SignJWT({ userId, username, role, status }).setExpirationTime("7d") ...

// middleware.ts — role/status come from the token, never the DB
userRole   = verified.payload.role   as string
userStatus = verified.payload.status as string
```

Consequences:
- **Demotion doesn't take effect.** An admin you demote to `USER` keeps `ADMIN` in their existing token — and therefore full admin API access — for up to 7 days.
- **Rejection/suspension doesn't take effect.** A user you set to `REJECTED` keeps `APPROVED` access until the token expires.
- **Password change doesn't invalidate other sessions.** `change-password` updates the hash but there is no way to log out stolen/other sessions. There is no server-side session store, so `logout` only clears the caller's own cookie.

**Impact:** Broken access control / broken session management. Offboarding and incident response ("revoke this user now") are impossible without rotating `SESSION_SECRET` (which logs *everyone* out).

**Fix (pick per your appetite):**
1. **Minimal:** shorten token lifetime (e.g. 30–60 min) and issue a long-lived refresh cookie; re-read `status`/`role` from the DB on refresh.
2. **Better:** re-validate `status` (and `role` for admin-only routes) against the DB inside privileged handlers. The admin routes already hit the DB — add a live `status !== 'APPROVED'` / `role !== 'ADMIN'` check there instead of trusting the claim.
3. **Robust:** add a `tokenVersion` (int) column to `User`; include it in the JWT; reject tokens whose version ≠ the DB value. Bump it on password change, demotion, or forced logout. This gives true revocation with one integer compare.

---

## 3. Medium severity

### M-1 — SSRF filter misses the cloud metadata endpoint and alternate encodings

**Location:** `strix-dashboard/src/app/api/scans/route.ts` → `sendWebhookNotification()`

The webhook URL (user-controlled, from Settings) is fetched server-side. The guard blocks common private ranges but has gaps:

```ts
if (/^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|localhost|::1|0\.0\.0\.0)/i.test(host)) { return; }
```

Not blocked:
- **`169.254.169.254`** — the AWS/GCP/Azure **instance metadata** endpoint (the deploy README targets AWS). This is the single most important SSRF target and it's wide open.
- **`169.254.0.0/16`** link-local generally.
- **Alternate IP encodings** — decimal (`http://2130706433/` = 127.0.0.1), octal, hex, IPv4-mapped IPv6 (`[::ffff:169.254.169.254]`), IPv6 ULAs (`fc00::/7`).
- **DNS names that resolve to internal IPs** (DNS rebinding) — the check is on the literal hostname string, never on the resolved address.

**Impact:** This is *blind* SSRF (the response body isn't returned to the user, only `res.ok` is logged), and it's a `POST` of a fixed JSON body. That limits read-based metadata theft on IMDSv1 (which is GET). But it still lets a user pivot the server into POSTing to arbitrary internal services (internal admin panels, webhooks, unauthenticated `POST` APIs on the VPC) and probe reachability. Combined with any GET-based internal endpoint it becomes serious.

**Fix:** Resolve the host and validate **every** resolved IP against a blocklist of private/reserved/link-local ranges; require an explicit `http(s)` allowlist; disable redirects. Sketch:

```ts
import dns from "node:dns/promises";
import ipaddr from "ipaddr.js"; // handles v4/v6, ranges, mapped addrs

async function isSafeWebhookUrl(raw: string): Promise<boolean> {
  let u: URL;
  try { u = new URL(raw); } catch { return false; }
  if (!["http:", "https:"].includes(u.protocol)) return false;

  const { address } = await dns.lookup(u.hostname); // resolve first
  const addr = ipaddr.process(address);
  const range = addr.range(); // 'private' | 'loopback' | 'linkLocal' | 'uniqueLocal' | 'reserved' | ...
  if (["private","loopback","linkLocal","uniqueLocal","reserved","unspecified","broadcast","carrierGradeNat"].includes(range)) return false;
  return true;
}
// use { redirect: "manual" } on fetch and re-validate any Location header
```

---

### M-2 — Rate limiter is bypassable and only covers auth

**Location:** `strix-dashboard/src/middleware.ts`

```ts
const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
if (!checkRateLimit(ip)) { ... 429 ... }
```

The deployer runs Next.js directly on `0.0.0.0:48080/80` with **no trusted reverse proxy**, so `X-Forwarded-For` is entirely attacker-supplied. An attacker rotates the header on each request and never hits the limit:

```bash
for i in $(seq 1 100000); do
  curl -s host/api/auth/login -H "X-Forwarded-For: 1.2.3.$((RANDOM%255))" \
    -d '{"username":"admin","password":"guess'"$i"'"}' -H 'Content-Type: application/json'
done
```

Also: the limiter is in-memory (resets on restart, not shared across PM2 cluster workers), and it only guards `login`/`register` — not `change-password`, which is an online password-guessing surface for a logged-in session.

**Impact:** The brute-force protection the app advertises can be trivially defeated, re-enabling credential stuffing / password spraying against the auth endpoints.

**Fix:**
- Derive the client IP from the socket (the platform's trusted connection info), or only trust `X-Forwarded-For` when a known proxy is in front and you strip/replace it there.
- Add a **per-username** failure counter with backoff/lockout in addition to per-IP, so header rotation doesn't help.
- Move counters to a shared store (Redis/Postgres) so they survive restarts and work across workers.

---

### M-3 — Session cookie isn't `Secure` by default; CSRF defense is SameSite-only

**Location:** `strix-dashboard/src/lib/session.ts`

```ts
secure: process.env.HTTPS_ENABLED === "true", // Must be false for HTTP access (localhost/IP)
```

The documented default deployment is **plain HTTP** on a public IP (`http://<server-ip>`, port 48080/80). With `secure:false`, the 7-day session JWT is transmitted in cleartext on every request and is trivially captured by anyone on-path (same LAN, upstream network, malicious Wi-Fi). A captured token = full account takeover for 7 days (and cannot be revoked — see H-3).

Separately, CSRF protection relies **entirely** on `sameSite: "strict"`. That's a reasonable primary control, but it's the only one; there are no CSRF tokens and no `Origin`/`Referer` validation on state-changing routes, so any future relaxation of SameSite (or a browser quirk) removes all defense.

**Impact:** Session hijacking over HTTP; brittle CSRF posture.

**Fix:**
- Ship HTTPS by default (terminate TLS at a reverse proxy — nginx/Caddy — in the deployer) and set `secure: true`. Do **not** gate `secure` on an env flag that defaults off; gate it on `NODE_ENV === 'production'`.
- Add `Origin`/`Referer` allowlist validation on all mutating API routes as CSRF defense-in-depth.

---

### M-4 — Stored XSS in the generated HTML report

**Location:** `strix-dashboard/src/lib/reportGenerator.ts` → `generateHTML()`

Most finding fields are interpolated into HTML with only a newline replacement and **no HTML escaping**:

```ts
<p>${v.description.replace(/\\n/g, '<br>')}</p>
${v.impact ? `<h4>Impact</h4><p>${v.impact.replace(/\\n/g, '<br>')}</p>` : ''}
${v.technical_analysis ? `...<p>${v.technical_analysis.replace(/\\n/g, '<br>')}</p>` : ''}
// poc_description, remediation_steps, assumptions — all unescaped too
```

(Note: `poc_script_code` and `evidence` *are* escaped — so the author knew to do it, but missed the prose fields.)

Vulnerability content originates from the LLM agent parsing a **target the attacker may control**. A malicious target can steer the agent into emitting a finding whose `description` contains `<img src=x onerror=...>` or `<script>`. When an operator opens the downloaded `.html` report (a trusted local file, `file://`, no CSP), the payload executes with access to local files and any same-origin context the report is viewed in.

**Impact:** Stored/exported XSS against the operator viewing reports; content-injection into a "trusted" deliverable that may be forwarded to clients.

**Fix:** HTML-escape *every* interpolated field, then convert newlines:

```ts
const esc = (s = "") => s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
const nl  = (s = "") => esc(s).replace(/\n/g, "<br>");
// <p>${nl(v.description)}</p>  etc. Apply esc() to title, endpoint, method, cwe, projectName, target too.
```

The React dashboard views (`ScanFindings.tsx`, etc.) are safe because React auto-escapes — this is specifically the string-built HTML/PDF export path.

---

### M-5 — API keys and secrets stored in plaintext at rest

**Location:** `strix-dashboard/src/app/api/user/keys/route.ts`, `User.apiKeys` column

```ts
await prisma.user.update({ where: { id }, data: { apiKeys: JSON.stringify(body) } }); // plaintext
```

The GET endpoint correctly masks keys to the client (good, `H-2` marker), and the API-docs even claim keys are "stored encrypted" — but they are stored as **plaintext JSON** in Postgres. Combined with H-2 (known DB password), anyone who reaches the database reads every user's OpenAI/Anthropic/etc. keys, which are directly billable/abusable.

**Impact:** Mass disclosure of third-party provider credentials on any DB compromise; the docs' "encrypted" claim is inaccurate.

**Fix:** Encrypt secrets at rest with an app-managed key (AES-256-GCM, key from env/KMS, per-value IV). Store `{iv, tag, ciphertext}`; decrypt only in-process at scan-launch time. At minimum, correct the API docs to stop claiming encryption until it's implemented.

---

## 4. Low severity / hardening

### L-1 — Fail-open static-asset heuristic in middleware
`middleware.ts` short-circuits auth for any path containing a dot:
```ts
pathname.includes('.') // like .css, .js files  -> NextResponse.next()  (skips ALL auth)
```
No current route is exploitable through it (the real API/UI paths have no dots and Next won't route `/api/users.json` to the `/api/users` handler), but it's a fail-open pattern: any future route or rewrite that includes a dot silently loses auth. Prefer matching known asset extensions explicitly (`/\.(css|js|svg|png|ico|woff2?)$/`) or rely on the `matcher` config to exclude `_next` and let everything else fall through to the auth check.

### L-2 — No validation or size cap on settings/keys bodies
`/api/user/keys` and `/api/user/settings` (`customModels`) persist arbitrary client JSON with no schema or length limit. A user can store multi-MB blobs (storage DoS) or unexpected shapes. `aggressiveness`/`maxThreads` aren't range-checked server-side and flow toward the scanner. Validate with a schema (e.g. `zod`), clamp numeric ranges, cap total payload size, and whitelist provider key names.

### L-3 — `configFile`/`diffBase` traversal check is bypassable
```ts
const resolvedConfig = path.resolve(configFile.trim());
if (resolvedConfig.includes("..")) { /* reject */ }   // path.resolve already collapsed '..'
```
`path.resolve()` normalizes `..` away, so the `includes("..")` test never fires for inputs like `/etc/passwd`. An authenticated user can therefore pass an arbitrary **absolute** path to the strix CLI via `--config` / `--diff-base`. Impact depends on how strix treats those paths (potential local file read/inclusion). Fix: validate that the resolved path is *inside an allowed base dir* (`resolved.startsWith(ALLOWED_BASE + path.sep)`), don't just look for `..`.

### L-4 — Information disclosure
- `next.config.ts` hardcodes a public server IP (`13.60.36.215`) and `*.amazonaws.com` in `allowedDevOrigins` — leaks infra and is a dev-only setting shipped to the repo.
- `/api/logs` returns `details: String(err)` on error (stack/paths to the admin — low, admin-only).
- Register returns `409 "Username already exists"`, enabling username enumeration. Consider a neutral response, or accept it as a UX tradeoff.
- `/api/health` exposes internal filesystem paths and scan counts unauthenticated (by design, but consider gating behind auth or trimming paths).

### L-5 — Missing Content-Security-Policy
`next.config.ts` sets HSTS, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy` (good), but no `Content-Security-Policy`. Add a strict CSP (e.g. `default-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'`) as defense-in-depth against injected script. Note the Swagger `api-docs` page loads from `unpkg.com` — either self-host those assets so you can keep CSP strict, or scope a looser policy to that one route.

---

## 5. What's already done well (keep it)

- Passwords hashed with `bcrypt` (cost 10); comparison via `bcrypt.compare`.
- JWT verified with an **explicit `algorithms: ["HS256"]`** allowlist (blocks `alg:none` / algorithm-confusion), and `SESSION_SECRET` fails loudly if unset.
- Ownership checks on `scans/[id]` GET/DELETE, `scans/bulk`, `vulnerabilities/bulk`, `scans/[id]/schedule`, and `resumeRun` (`H-1` IDOR marker).
- Admin-only routes (`users`, `users/[id]`, `pending-count`, `logs`) check `role` server-side, with last-admin and Super-Admin protections.
- Child process uses `spawn(cmd, argsArray)` (no shell) so target/instruction are **not** shell-injectable, and args are bound to flags (no argument injection).
- Scanner API keys are stripped before persisting to the scan `payload` (`L-1` marker) and fetched fresh from the DB per run.
- First-user-only admin bootstrap (removes the "register as `admin`" takeover trick), password complexity, and input length caps.
- `.env` is git-ignored; secrets are randomly generated by the deployer.

---

## 6. Suggested remediation order

1. **H-1** — add the ownership check to the SSE stream route (small, high impact, ship today).
2. **H-3** — add live status/role revalidation (or `tokenVersion`) so you can actually offboard users.
3. **H-2 / M-5** — randomize the DB password in `deploy.py`; encrypt provider keys at rest; fix the "encrypted" doc claim.
4. **M-3** — HTTPS-by-default + `secure` cookies; `Origin` checks on mutating routes.
5. **M-1** — replace the SSRF regex with resolve-and-range-check (`ipaddr.js`), block redirects.
6. **M-2** — trustworthy client-IP + per-account lockout for auth and change-password.
7. **M-4** — escape all report fields.
8. **L-1…L-5** — middleware allowlist, input schemas, path-base validation, CSP, trim info leaks.

---

### Appendix — Methodology

Static white-box review of the App Router API handlers, `middleware.ts`, the session/auth libraries, the Prisma schema, the process-spawning scan orchestrator, the report generator, and the deploy script. Traced each finding to concrete source lines and validated exploitability against the middleware's auth model. No dynamic testing was run against a live instance; PoCs above are constructed from the code paths and should be confirmed in a staging environment before/after applying fixes.
