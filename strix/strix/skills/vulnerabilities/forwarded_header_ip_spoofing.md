---
name: forwarded-header-ip-spoofing
description: Bypass IP-based access control, rate limiting, WAF/geo blocks, and audit trails by spoofing client-IP headers (X-Forwarded-For, X-Real-IP, CF-Connecting-IP, True-Client-IP, Forwarded, etc.), including forging source IPs from the origin server's own trusted range
---

# Forwarded-Header Client-IP Spoofing

Many apps decide *who you are by network location* using a client-IP value they read from an HTTP header rather than the real TCP peer. When a reverse proxy / CDN sits in front, the backend trusts a header like `X-Forwarded-For` to know the true client. If the app trusts that header without validating which hop set it — or trusts a *specific* IP/range (loopback, RFC1918, the office, the origin's own subnet) — an attacker who controls the header can **impersonate a trusted source IP** and bypass:

- IP allowlists on admin/internal/debug endpoints ("only 10.x / 127.0.0.1 / office IP allowed")
- Per-IP rate limiting and brute-force lockouts (rotate the spoofed IP → unlimited attempts)
- WAF/bot reputation and geo-blocking keyed on client IP
- Audit logs and fraud/risk scoring (log poisoning, attribution evasion)
- "Internal traffic" trust that unlocks extra features or skips auth

The strongest variant forges a source IP **from the range the server itself uses** — loopback, private ranges, or the confirmed **origin netblock** (see `origin_ip_discovery`) — because allowlists most often trust exactly those. Knowing the real origin IP/range turns a blind guess into a targeted forgery.

## Where the Peer Overwrite Matters

Behind Cloudflare/most CDNs, the edge **overwrites** `X-Forwarded-For` and sets `CF-Connecting-IP`/`True-Client-IP`, so spoofing those *through the edge* is usually stripped. Two ways to still win:

1. **Reach the origin directly** (`origin_ip_discovery`), then you fully control every header the app reads — the edge is out of the path.
2. **Header confusion at the edge/app boundary** — send the header the backend trusts but the edge doesn't normalize (`X-Real-IP`, `True-Client-IP`, a duplicated `X-Forwarded-For`, or a vendor header the stack forgot to strip).

## Headers To Test (individually, combined, and duplicated)

Spray the full family — different frameworks/proxies read different ones:

- `X-Forwarded-For` (leftmost vs rightmost trust matters — see below)
- `X-Real-IP`, `X-Client-IP`, `Client-IP`, `X-Remote-IP`, `X-Remote-Addr`
- `X-Originating-IP`, `X-Forwarded`, `Forwarded-For`, `Forwarded` (RFC 7239: `Forwarded: for=1.2.3.4`)
- `X-Cluster-Client-IP`, `Fastly-Client-IP`, `True-Client-IP`, `CF-Connecting-IP`, `X-Azure-ClientIP`, `X-Azure-SocketIP`
- `Via`, `X-ProxyUser-Ip`, `X-Forwarded-Host` (for host-trust variants)

Also vary: header **casing**, **duplicate** headers with different values, **comma-chained** lists, and setting several headers at once.

## Values To Forge

- Loopback: `127.0.0.1`, `::1`, `127.0.0.2`
- Private/internal: `10.0.0.1`, `172.16.0.1`, `192.168.0.1`, `169.254.169.254` (also probes cloud-metadata trust)
- **Origin's own IP and /24** from `origin_ip_discovery` — allowlists frequently trust the server's own subnet or the load-balancer/health-check range
- Known office/VPN egress IPs if disclosed anywhere (docs, SPF, error pages)
- For rate-limit bypass: a **rotating** set of random public IPs, a fresh one per request

## XFF Chain Semantics (get this right)

`X-Forwarded-For` is a comma list appended by each proxy: `client, proxy1, proxy2`. Which entry the app trusts depends on how many hops it expects:

- Apps that read the **leftmost** value → put your spoofed IP first: `X-Forwarded-For: 127.0.0.1`
- Apps that read the **rightmost / Nth-from-right** (correct designs count trusted proxies) → you must match the hop count: `X-Forwarded-For: <spoof>, <realproxy>` or pad the chain.
- Test both ends and chained forms; a single value often satisfies naive `getFirstIp()`/`split(',')[0]` logic.

## Testing Methodology

1. **Find IP-sensitive behaviour**: endpoints that 403/redirect for you but imply internal access (`/admin`, `/actuator`, `/debug`, `/internal`, `/metrics`, `/_status`), rate-limited actions (login, OTP, password reset, promo redeem), geo-gated content, and any "trusted network" feature.
2. **Baseline**: capture the exact response (status, length, body markers) with no spoof header.
3. **Spray**: replay the request adding one candidate header+value at a time, then combinations. Automate across the full header list × value list in Python (`aiohttp`) or via Caido/Burp intruder-style iteration.
4. **Target the origin** when the edge strips headers — repeat the spray directly against the confirmed origin IP (`curl --resolve host:443:<ORIGIN_IP> ... -H '...'`).
5. **Rate-limit test**: fire N+1 requests past the known limit, rotating a spoofed IP per request; success = the limit never trips.
6. **Diff & confirm**: a spoofed header flipping 403→200, unlocking internal content, resetting the rate counter, or changing the logged IP is the signal.

## Confirming (2× reproducible, least-invasive PoC)

- **Access bypass**: show the same request returning **403/redirect without** the header and **200 + protected content with** it. Capture both full exchanges.
- **Rate-limit bypass**: show the counter resetting per spoofed IP (e.g. 100 login attempts with 100 distinct forged IPs, none throttled), without actually compromising an account unless in scope.
- **Log/attribution spoofing**: if you can read logs (white-box) or a reflected "your IP is X", show the forged value landing.
- Reproduce twice. Distinguish a genuine authz bypass from a coincidental cache hit or an unrelated redirect.

## False Positives

- The app reflects/echoes your header but makes **no security decision** on it (informational, not a vuln) — prove an actual trust boundary moved.
- A load balancer that *appends* your value into XFF but the app correctly reads the trusted rightmost hop → no bypass.
- WAF returning identical 403 regardless of header (it isn't IP-gated).
- Response differences caused by caching/geo-CDN variance, not by your spoof — control for it.

## Impact

- Unauthorized reach into admin/internal/debug surfaces gated only by client IP → often chains to privilege escalation or RCE
- Defeated rate limiting → credential stuffing, OTP/2FA brute force, promo/voucher over-redemption
- WAF/geo bypass and audit-log poisoning (attribution evasion, framing another IP)
- Combined with `origin_ip_discovery`: full control of the client-IP the backend believes, straight past the CDN

## Pro Tips

1. Always test `X-Forwarded-For: 127.0.0.1` and the **origin's own subnet** first — those are the values allowlists trust most.
2. If the edge strips your header, that's a cue to go direct-to-origin, not to give up — the origin usually trusts the header blindly.
3. Try one header at a time to attribute the bypass, then combine to defeat stacks that require several.
4. For rate limits, rotate a fresh IP per request; for access control, hit the exact trusted value.
5. `169.254.169.254` in a spoofed IP header occasionally unlocks cloud-metadata-trusting logic — cheap high-value probe.
6. Header casing and duplicates defeat naive single-case stripping — include them in the spray.

## Summary

Apps that read the client IP from a request header can be tricked into trusting a forged source. Spray the full family of client-IP headers (individually, combined, duplicated, chained) with loopback, private, metadata, and — most powerfully — the server's own origin-range IPs from `origin_ip_discovery`, against IP-gated endpoints and rate limits. When the CDN strips the headers, repeat directly against the origin. Confirm with a reproducible 403→200 flip or a defeated rate limit, and rule out echo-only reflections that move no trust boundary.
