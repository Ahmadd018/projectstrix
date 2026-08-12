import dns from "node:dns/promises";

// M-1: SSRF guard. Resolves the hostname and rejects the request if ANY resolved
// address falls in a private / loopback / link-local / reserved range. This closes
// the gaps in the old string-prefix regex: cloud metadata (169.254.169.254),
// alternate IP encodings (decimal/octal/hex are normalized by getaddrinfo), and
// DNS names that resolve to internal addresses.

function ipv4Blocked(ip: string): boolean {
  const parts = ip.split(".").map((p) => Number(p));
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) {
    return true; // malformed → block
  }
  const [a, b] = parts;
  if (a === 0) return true; // 0.0.0.0/8 "this network"
  if (a === 10) return true; // private
  if (a === 127) return true; // loopback
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64/10 CGNAT
  if (a === 169 && b === 254) return true; // link-local + cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 192 && b === 0) return true; // 192.0.0/24 IETF, 192.0.2/24 TEST-NET-1
  if (a === 192 && b === 168) return true; // private
  if (a === 198 && (b === 18 || b === 19)) return true; // 198.18/15 benchmarking
  if (a === 198 && b === 51) return true; // 198.51.100/24 TEST-NET-2
  if (a === 203 && b === 0) return true; // 203.0.113/24 TEST-NET-3
  if (a >= 224) return true; // 224/4 multicast, 240/4 reserved, 255.255.255.255
  return false;
}

function ipv6Blocked(ip: string): boolean {
  const s = ip.toLowerCase();
  if (s === "::1" || s === "::") return true; // loopback / unspecified
  if (s.startsWith("fe80")) return true; // link-local fe80::/10
  if (s.startsWith("fc") || s.startsWith("fd")) return true; // unique-local fc00::/7
  const mapped = s.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/); // IPv4-mapped
  if (mapped) return ipv4Blocked(mapped[1]);
  return false;
}

function addressBlocked(ip: string): boolean {
  return ip.includes(":") ? ipv6Blocked(ip) : ipv4Blocked(ip);
}

/**
 * Returns true only if `raw` is an http(s) URL whose every resolved address is public.
 * Fail-closed: any parse/DNS error or private address → false.
 */
export async function isSafePublicUrl(raw: string): Promise<boolean> {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;

  let addrs: { address: string }[];
  try {
    addrs = await dns.lookup(u.hostname, { all: true });
  } catch {
    return false;
  }
  if (!addrs.length) return false;
  return addrs.every(({ address }) => !addressBlocked(address));
}
