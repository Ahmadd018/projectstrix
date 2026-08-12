// M-2: Per-identity (username / userId) failure throttle for credential endpoints.
// Unlike the IP-based limiter in middleware, this cannot be bypassed by spoofing
// X-Forwarded-For, because it keys on the account being attacked.
//
// NOTE: in-memory — resets on restart and is per-process. For a multi-worker /
// multi-instance deployment, back this with Redis or Postgres.

interface Bucket {
  fails: number;
  resetAt: number;
  lockedUntil: number;
}

const buckets = new Map<string, Bucket>();

const WINDOW_MS = 15 * 60 * 1000; // count failures within a 15-minute window
const MAX_FAILS = 8; // lock after this many failures
const LOCK_MS = 15 * 60 * 1000; // lockout duration

// Returns remaining lockout in seconds (0 if not locked).
export function isLocked(key: string): number {
  const b = buckets.get(key);
  if (!b) return 0;
  const now = Date.now();
  if (b.lockedUntil > now) return Math.ceil((b.lockedUntil - now) / 1000);
  return 0;
}

export function recordFailure(key: string): void {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || now > b.resetAt) {
    b = { fails: 0, resetAt: now + WINDOW_MS, lockedUntil: 0 };
    buckets.set(key, b);
  }
  b.fails += 1;
  if (b.fails >= MAX_FAILS) {
    b.lockedUntil = now + LOCK_MS;
  }
}

export function recordSuccess(key: string): void {
  buckets.delete(key);
}
