# Security Implementation Report — Project Strix

> **Scope:** Full codebase audit of `strix-dashboard` (Next.js API routes, middleware, auth, scheduler).  
> **Date:** 2026-08-12  
> **Note:** HTTPS/TLS is explicitly out of scope per operator decision.

---

## Executive Summary

The application has a solid foundational security posture: bcrypt password hashing, JWT session tokens, route-level RBAC middleware, IDOR checks on most endpoints, and basic rate limiting. However, **seven critical/high-severity vulnerabilities** were identified that must be remediated before enterprise deployment.

---

## CRITICAL Findings

### C-1 · Hardcoded Scheduler Secret — Privilege Escalation

**File:** `src/lib/schedulerDaemon.ts:50`, `scripts/scheduler.js:48`, `src/middleware.ts:72`

```ts
// schedulerDaemon.ts
"x-scheduler-secret": "internal_scheduler_secret"
```

**Risk:** The `x-scheduler-secret` header grants full **ADMIN-level access** to all API routes, bypassing session authentication entirely. This secret is hardcoded as `internal_scheduler_secret` in three separate files. Anyone who reads the source code (e.g., a developer, a contractor, a GitHub leak) can impersonate the scheduler and launch arbitrary scans under any user ID.

**Impact:** An attacker sends:
```http
POST /api/scans HTTP/1.1
x-scheduler-secret: internal_scheduler_secret
Content-Type: application/json

{"target": "...", "userId": "<any-admin-id>", "simulationMode": false}
```
This bypasses all auth and grants ADMIN privileges.

**Fix:**
1. Remove the hardcoded fallback from all three files.
2. Read the secret **only** from the environment variable `SCHEDULER_SECRET`.
3. Ensure `deploy.py` generates a cryptographically random secret at deploy time (it already does — just remove the fallback).

```ts
// BEFORE
const expectedSchedulerKey = process.env.SCHEDULER_SECRET || "internal_scheduler_secret";

// AFTER
const expectedSchedulerKey = process.env.SCHEDULER_SECRET;
if (!expectedSchedulerKey) throw new Error("SCHEDULER_SECRET env var is required");
```

---

### C-2 · Session Token Fallback Secret — Authentication Bypass

**File:** `src/middleware.ts:5`, `src/lib/session.ts:5`

```ts
const secretKey = process.env.SESSION_SECRET || "strix-fallback-secret-change-me";
```

**Risk:** If `SESSION_SECRET` is not set (e.g., `.env` is missing or misconfigured after a fresh server install), the application silently falls back to a well-known static secret `strix-fallback-secret-change-me`. An attacker knowing this secret can craft a valid JWT for any user with any role:

```js
// Attacker signs their own ADMIN token
new SignJWT({ userId: "any-id", role: "ADMIN", status: "APPROVED" })
  .sign(new TextEncoder().encode("strix-fallback-secret-change-me"))
```

This grants full ADMIN access without any account.

**Fix:** Remove the fallback. If the variable is missing, crash at startup.

```ts
// BEFORE
const secretKey = process.env.SESSION_SECRET || "strix-fallback-secret-change-me";

// AFTER
const secretKey = process.env.SESSION_SECRET;
if (!secretKey) throw new Error("SESSION_SECRET environment variable is required and must not be empty");
```

---

### C-3 · Path Traversal via `configFile` Parameter

**File:** `src/app/api/scans/route.ts:399`

```ts
if (configFile?.trim()) args.push("--config", configFile.trim());
```

**Risk:** The `configFile` field is passed directly to the `strix` CLI with no path sanitization or validation. A malicious authenticated user can pass an absolute path to any file on the server filesystem:

```json
{ "target": "x", "configFile": "/etc/passwd" }
```

Or worse, if the CLI interprets config files with execution capabilities, point to an attacker-controlled file. Since the app runs as `root` on the server, this is critical.

**Fix:** Validate that `configFile` is a relative path within the scan's run directory, or an absolute path inside an allowlisted directory.

```ts
// Allowlist: config must be under the scan directory or a safe prefix
const allowedBase = scanDir;
const resolved = path.resolve(scanDir, configFile.trim());
if (!resolved.startsWith(allowedBase)) {
  return NextResponse.json({ error: "Invalid configFile path" }, { status: 400 });
}
args.push("--config", resolved);
```

---

### C-4 · Path Traversal via `diffBase` Parameter

**File:** `src/app/api/scans/route.ts:398`

```ts
if (diffBase?.trim()) args.push("--diff-base", diffBase.trim());
```

Same class of issue as C-3. The `diffBase` value is passed unsanitized to the CLI. A malicious user can point this to any filesystem path (e.g., `/proc/self/environ` to leak environment variables via CLI parsing).

**Fix:** Apply the same allowlisting/sanitization as C-3. Only allow paths within the scan directory or explicitly approved directories.

---

## HIGH Findings

### H-1 · IDOR on Scan Resume — Scan Takeover

**File:** `src/app/api/scans/route.ts:209-218`

```ts
if (resumeRun) {
  const oldScan = await prisma.scan.findUnique({ where: { id: resumeRun } });
  if (oldScan) {
    target = oldScan.target;
    llmModel = overrideLlm && body.llmModel ? body.llmModel : oldScan.llmModel;
    scanMode = oldScan.scanMode;
    projectName = oldScan.projectName;
  }
```

**Risk:** When a user resumes a scan by providing `resumeRun` (a scan ID), the code **fetches the target scan from the DB with no ownership check**. Any authenticated user can resume any other user's scan, causing it to re-execute under their own billing/API key while inheriting the victim's scan data.

**Fix:** Add an ownership check immediately after the `findUnique`:

```ts
if (oldScan) {
  // Ownership check — must own the scan or be an admin
  if (session.role !== "ADMIN" && oldScan.userId !== session.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  // ... rest of resume logic
}
```

---

### H-2 · API Keys Returned in Plaintext — Credential Exposure

**File:** `src/app/api/user/keys/route.ts:12-19`

```ts
export async function GET() {
  // ...
  const keys = JSON.parse(user.apiKeys);
  return NextResponse.json(keys); // Returns OpenAI/Anthropic/etc. keys in plaintext
}
```

**Risk:** LLM API keys (OpenAI, Anthropic, DeepSeek, etc.) are stored in the database and returned **fully in the HTTP response body** on every `GET /api/user/keys` call. This means:
- The keys are visible in browser DevTools Network tab.
- Any XSS vulnerability would allow key exfiltration.
- Any server-side logging of response bodies would expose them.

**Fix:** Never return API keys to the client. Use a **write-only** model for secrets:

```ts
// GET - Only confirm which providers are configured (boolean flags)
return NextResponse.json({
  openai: !!keys.openai,
  anthropic: !!keys.anthropic,
  deepseek: !!keys.deepseek,
  // ...
});

// POST - Accept and store new keys (existing behavior is fine)
```

The frontend should display "✓ Configured" or "Not set" rather than the actual key value.

---

### H-3 · Weak Password Policy — Brute Force / Credential Stuffing

**File:** `src/app/api/auth/register/route.ts:16`

```ts
if (password.length < 6) {
  return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
}
```

**Risk:** A minimum of 6 characters is far below enterprise security standards. On an internal enterprise tool that processes security scan data (including found vulnerabilities and API keys), this is a significant risk. A 6-character password can be brute-forced offline in seconds if the DB is ever dumped.

**Additionally:** The rate limiter in middleware is **in-memory and resets on app restart**. Under PM2 restarts or crashes, an attacker gets unlimited fresh login attempts.

**Fix:**
1. Increase minimum password length to 12+ characters.
2. Add complexity requirements (uppercase, number, special character).
3. Add account lockout after N failed attempts (persist lockout state in DB, not memory).

```ts
// Stronger password validation
const strongPassword = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{12,}$/;
if (!strongPassword.test(password)) {
  return NextResponse.json({
    error: "Password must be at least 12 characters and include uppercase, lowercase, number, and special character"
  }, { status: 400 });
}
```

---

## MEDIUM Findings

### M-1 · No Security Headers (CSP, HSTS, X-Frame-Options, etc.)

**File:** `strix-dashboard/next.config.ts`

**Risk:** The application does not set any security headers in `next.config.ts`. This exposes the app to:
- **Clickjacking** — no `X-Frame-Options` or `frame-ancestors` CSP directive.
- **MIME sniffing attacks** — no `X-Content-Type-Options: nosniff`.
- **XSS via inline scripts** — no Content Security Policy.
- **Information leakage** — no `Referrer-Policy`.

**Fix:** Add security headers in `next.config.ts`:

```ts
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-XSS-Protection", value: "1; mode=block" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Content-Security-Policy",
    value: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'"
  }
];

// In nextConfig:
async headers() {
  return [{ source: "/(.*)", headers: securityHeaders }];
}
```

---

### M-2 · Webhook URL Injection — SSRF (Server-Side Request Forgery)

**File:** `src/app/api/scans/route.ts:85`

```ts
const res = await fetch(config.webhookUrl, {
  method: "POST",
  // ...
});
```

**Risk:** The webhook URL is user-supplied and the application makes outbound HTTP requests to it from the server. This is a textbook **SSRF vulnerability**. An attacker can set the webhook URL to:
- `http://127.0.0.1:5432` — probe PostgreSQL port.
- `http://169.254.169.254/` — AWS metadata endpoint (cloud credential theft).
- `http://127.0.0.1:80/api/scans` — trigger internal API calls as the server itself.
- Any internal network resource unreachable from outside.

**Fix:** Validate the webhook URL before making requests:

```ts
function isAllowedWebhookUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    // Only allow http/https
    if (!["http:", "https:"].includes(parsed.protocol)) return false;
    const host = parsed.hostname;
    // Block private/loopback IP ranges
    if (/^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|localhost)/.test(host)) return false;
    if (host === "::1" || host === "0.0.0.0") return false;
    return true;
  } catch {
    return false;
  }
}
```

---

### M-3 · JWT Token Contains Live Role/Status — Privilege Persistence

**File:** `src/lib/session.ts:11`

```ts
const session = await new SignJWT({ userId, username, role, status })
  .setExpirationTime("7d")
  .sign(encodedKey);
```

**Risk:** The user's `role` and `status` are embedded in the JWT token at login time and are **not re-validated against the database on each request**. The middleware only verifies the JWT signature — it does not check if the user's role or status has changed in the DB.

**Scenario:** An ADMIN demotes user A to USER role. User A's existing JWT (valid for up to 7 days) still contains `role: "ADMIN"`. The middleware will continue granting them ADMIN privileges for the remaining token lifetime.

Similarly: If an admin rejects a pending user after they've already logged in, the user keeps their session active.

**Fix (Option A — Simple):** Reduce JWT expiry to 1 hour and use refresh tokens.

**Fix (Option B — Recommended):** Add a DB lookup for sensitive ADMIN operations in the API routes (most already do this via `getSession()` + `findUnique`). Additionally, add a `tokenVersion` field to the User model and increment it on any role/status change. Embed this version in the JWT and verify it against the DB on each request.

---

### M-4 · No Input Length Limits — Potential DoS

**File:** Multiple API routes

**Risk:** Fields like `instruction`, `targetList`, `diffBase`, `configFile`, `maxBudget`, and `maxTurns` accept arbitrary-length strings with no server-side length validation. A malicious or misconfigured client can send:
- A `targetList` with 100,000 targets, overwhelming the scanner process.
- An `instruction` of 50MB, causing memory exhaustion parsing the JSON.
- A malicious `maxBudget` of `"; rm -rf /"` (though CLI arg injection via `spawn` array is generally safe, belt-and-suspenders validation is recommended).

**Fix:** Add length limits in the POST `/api/scans` handler:

```ts
if (instruction && instruction.length > 5000) {
  return NextResponse.json({ error: "Instruction too long (max 5000 chars)" }, { status: 400 });
}
if (targetList && targetList.length > 50000) {
  return NextResponse.json({ error: "Target list too large" }, { status: 400 });
}
```

---

### M-5 · `admin` Username Bypass in Registration

**File:** `src/lib/authStore.ts:27`

```ts
if (username.toLowerCase() === "admin" && username !== "admin") {
  throw new Error("Variations of 'admin' are not allowed");
}
```

**Risk:** This condition is logically broken. It only throws an error if `username.toLowerCase() === "admin"` **AND** `username !== "admin"`. Since both conditions require the lowercase to be "admin" but the original to be something else (e.g., `"Admin"`, `"ADMIN"`), this means:
- Registering as `"admin"` (exact lowercase) is **allowed** and gets ADMIN role.
- But `"Admin"`, `"ADMIN"` etc. are also blocked.

The real problem: anyone can register as `"admin"` if the first user isn't already `"admin"`. The auto-ADMIN promotion logic based on `username === "admin"` combined with `totalUsers === 0` check is fragile.

**Fix:** Remove username-based role promotion entirely. Only the first ever registered user should be ADMIN, regardless of username.

```ts
const isFirstUser = totalUsers === 0;
const role = isFirstUser ? "ADMIN" : "USER";
const status = isFirstUser ? "APPROVED" : "PENDING";
```

---

## LOW Findings

### L-1 · Scan Payload Stored in Plaintext — API Key in DB

**File:** `src/app/api/scans/route.ts:294`

```ts
payload: body as any, // Always save the payload to maintain config for future schedules
```

**Risk:** The entire request body — including the resolved API key — is stored as-is in the `payload` JSON column of the `Scan` table. This means every scan record in PostgreSQL contains the user's LLM API key in plaintext. A DB dump, a misconfigured Prisma query selecting `payload`, or a future bug returning `payload` to a non-owner could leak these keys.

**Fix:** Strip sensitive keys before storing the payload:

```ts
const { apiKey: _stripped, password: _pw, ...safePayload } = body;
await prisma.scan.create({ data: { ..., payload: safePayload } });
```

---

### L-2 · Generic 500 Error Message — Internal Error Information Leak

**File:** Multiple routes (e.g., `src/app/api/users/[id]/route.ts:39`)

```ts
} catch (error) {
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
```

**Risk:** While generic errors are returned (good), the actual error `error` object may contain stack traces, file paths, or DB error details in the **server logs**, which are accessible via `/api/logs` (ADMIN-only). This is acceptable for ADMIN logs but ensure non-admin users cannot trigger log entries that contain their own sensitive data.

**Note:** This is low risk given logs are ADMIN-only. Keep the generic responses for clients, but consider structured logging with redaction.

---

### L-3 · Race Condition in Scheduler — Duplicate Scan Execution

**File:** `src/lib/schedulerDaemon.ts:66-120`

**Risk:** The scheduler polls every 10 seconds and triggers scans. Under high load or after a PM2 restart that spawns multiple instances, two scheduler instances could simultaneously query the DB and both find the same `nextRunAt <= now` scan, triggering it twice (double billing, duplicate results).

**Fix:** Use a DB-level lock — update `nextRunAt` to a future time **before** triggering the scan, not after:

```ts
// Optimistic lock: update nextRunAt first to prevent double-fire
await prisma.scan.update({
  where: { id: scan.id, nextRunAt: { lte: now } }, // where condition acts as a lock
  data: { nextRunAt: nextDate }
});
// Then trigger
await triggerScan(scan);
```

---

## Remediation Priority Matrix

| ID  | Title                                   | Severity | Effort | Priority |
|-----|-----------------------------------------|----------|--------|----------|
| C-1 | Hardcoded scheduler secret              | Critical | Low    | **P0**   |
| C-2 | Fallback session secret                 | Critical | Low    | **P0**   |
| C-3 | Path traversal via `configFile`         | Critical | Low    | **P0**   |
| C-4 | Path traversal via `diffBase`           | Critical | Low    | **P0**   |
| H-1 | IDOR on scan resume                     | High     | Low    | **P1**   |
| H-2 | API keys returned in plaintext          | High     | Medium | **P1**   |
| H-3 | Weak password policy                    | High     | Low    | **P1**   |
| M-1 | Missing security headers                | Medium   | Low    | P2       |
| M-2 | SSRF via webhook URL                    | Medium   | Low    | P2       |
| M-3 | Stale role/status in JWT                | Medium   | Medium | P2       |
| M-4 | No input length limits                  | Medium   | Low    | P2       |
| M-5 | Admin username promotion bypass         | Medium   | Low    | P2       |
| L-1 | API key stored in scan payload          | Low      | Low    | P3       |
| L-2 | Error information in logs               | Low      | Low    | P3       |
| L-3 | Scheduler race condition                | Low      | Medium | P3       |

---

## What Is Already Done Well ✓

- **bcrypt** password hashing with cost factor 10.
- **httpOnly** session cookies (not accessible via JavaScript).
- **SameSite: Strict** cookie attribute prevents CSRF.
- **JWT signature verification** using `jose` library with HS256.
- **IDOR checks** properly implemented on scan GET, DELETE, schedule, and bulk operations.
- **RBAC middleware** guards all `/api/*` routes, with specific ADMIN gates for `/api/logs` and `/api/users`.
- **PENDING approval flow** for new user registrations.
- **Parameterized DB queries** via Prisma (no raw SQL injection risk).
- **Rate limiting** on login/register endpoints (though in-memory — see H-3).
- **Process spawning via array args** (no shell injection from `spawn` with array arguments).
- **Last-admin protection** prevents locking yourself out.
