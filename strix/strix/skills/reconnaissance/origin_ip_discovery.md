---
name: origin-ip-discovery
description: Uncover the real origin server IP behind Cloudflare/CDN/WAF proxies and confirm direct-to-origin access, so protections fronting the app (WAF rules, rate limits, geo-blocks, bot filters) can be bypassed by talking to the origin directly
---

# Origin IP Discovery (CDN / WAF Bypass)

When a site sits behind Cloudflare (or Akamai, Fastly, CloudFront, Imperva, Sucuri, etc.), the public DNS resolves to the CDN edge, not the server. Every request is filtered by the edge: WAF rules, rate limiting, bot management, geo/IP restrictions, and TLS termination all live there. If the **origin server's real IP is reachable directly**, all of that front-line protection can be bypassed — you connect straight to the backend and send traffic the edge would have blocked. Finding and confirming the origin IP is therefore a high-leverage recon step, not a curiosity.

The goal is twofold: (1) recover one or more candidate origin IPs, and (2) **prove** a candidate actually serves the target application when addressed directly with the right `Host` header — a candidate is worthless until confirmed.

Only run this against in-scope hosts. Directly hammering a discovered origin can itself be higher-impact than edge traffic (no rate limit in front of it) — stay within the engagement's rate/DoS constraints.

## Why It Matters (Impact)

- Bypass the WAF entirely — payloads the edge blocks (SQLi, XSS, LFI, RCE) reach the app unfiltered at origin
- Bypass edge rate limiting and bot protection — brute force, credential stuffing, enumeration with no throttle
- Bypass IP allowlists / geo-blocks enforced only at the CDN
- Reach admin panels, staging, or `internal`-only vhosts that assume "only the CDN can reach us"
- Enable forwarded-header IP spoofing: once at origin you fully control `X-Forwarded-For`/`CF-Connecting-IP` (the edge normally overwrites these) — see `forwarded_header_ip_spoofing`

## Detect the Fronting Layer First

Confirm the host is actually proxied before hunting an origin.

- Resolve and map the IP to its ASN/org: `dig +short app.example.com`, then `whois -h whois.cymru.com " -v <IP>"`. Cloudflare = AS13335 / `104.16.0.0/12`, `172.64.0.0/13`, etc.; Akamai, Fastly, CloudFront, Incapsula/Imperva, Sucuri have their own ranges.
- Header/behaviour fingerprints: `server: cloudflare`, `cf-ray`, `cf-cache-status`, `x-served-by`/`fastly`, `x-amz-cf-id` (CloudFront), `x-iinfo`/`incap_ses` (Imperva), `x-sucuri-id`.
- `curl -sI https://app.example.com` and inspect. If the IP is CDN-owned, the real origin is hidden and worth hunting.

## Discovery Techniques (run several — corroborate)

### 1. Historical DNS

The origin IP was often exposed **before** the CDN was put in front. History leaks it.

- SecurityTrails, ViewDNS.info (`/iphistory`), DNSHistory, Netlas, Shodan/Censys historical views, `chaos`, VirusTotal passive DNS.
- Look for A records that predate the current CDN IP, or that point at non-CDN ASNs (the hosting provider / cloud tenant).
- Cross-check any historical IP with the confirmation step below.

### 2. Non-Proxied Subdomains (highest yield)

Orgs proxy the apex/www but forget siblings. Any subdomain resolving to a **non-CDN** IP is a likely origin or same-network host.

- Enumerate broadly (`subfinder -d example.com -all -silent`), resolve all, and flag every name whose IP ASN is **not** the CDN.
- High-signal names: `direct`, `origin`, `origin-www`, `backend`, `dev`, `staging`, `test`, `cpanel`, `whm`, `webmail`, `mail`, `mx`, `smtp`, `ftp`, `ns1`, `vpn`, `git`, `jenkins`, `api-internal`.
- **Mail is the classic leak**: `dig +short MX example.com` and `dig +short TXT example.com` (SPF `ip4:` entries) frequently reveal origin or same-subnet IPs, because mail rarely goes through the web CDN.

### 3. Certificate / Favicon / Content Pivots (Shodan · Censys · FOFA · Netlas)

Scan-engine indexes see the origin directly and let you pivot on artifacts the origin still serves.

- **TLS cert**: search by the site's cert — `ssl:"example.com"`, `ssl.cert.subject.cn:"example.com"`, or a specific `ssl.cert.fingerprint` / serial. Origins commonly serve the same real cert. Then **filter out** CDN ASNs from the results.
  - Censys: `services.tls.certificates.leaf_data.names: example.com and not autonomous_system.name: "CLOUDFLARENET"`
- **Favicon hash**: `http.favicon.hash:<hash>` (Shodan) clusters every host serving the same favicon — including the unproxied origin. Compute with the standard mmh3 method on `/favicon.ico`.
- **Response body / title / unique header**: pivot on a unique HTML string, `http.title`, or a custom header (`X-Powered-By`, app build id) to find the same app on a non-CDN IP.

### 4. Server-Side Callback / SSRF Leak

If any app feature makes the **server** connect outbound (webhooks, URL preview/unfurl, PDF/screenshot generator, image proxy, "import from URL", avatar-by-URL, XML/SVG fetch, SSRF), point it at a listener you control and read the source IP of the inbound connection — that is the origin's egress IP (often the same box or same /24).

- Stand up a collaborator/listener (interactsh, a `nc -lvnp` on a box you own, or an HTTP logger) and capture the connecting IP.
- Verbose error pages, stack traces, `phpinfo()`, `/server-status`, debug endpoints, and email `Received:` headers (send an email the app processes, then read full headers) also leak internal/origin IPs.

### 5. Direct Range Sweep (when the provider is known)

If history/certs point at a hosting provider or a cloud tenant, sweep that netblock for the app.

- `whois`/BGP the candidate IP → the announced prefix(es). `naabu`/`masscan` 80,443 across the range, then `httpx` each live host **with the target Host header** and compare content.

## Confirming a Candidate (mandatory — do not report unconfirmed)

A candidate IP means nothing until it demonstrably serves the target app when addressed directly.

1. Request the site by IP but with the real `Host` header, so the origin's vhost routing selects the target app:
   - `curl -sk --resolve app.example.com:443:<CANDIDATE_IP> https://app.example.com/ -o /tmp/origin.html`
   - Compare against the edge response: `curl -sk https://app.example.com/ -o /tmp/edge.html` then `diff <(sha256sum </tmp/origin.html) <(sha256sum </tmp/edge.html)` or compare unique markers (CSRF field, build hash, title, a known authenticated redirect).
2. **Rule out another CDN edge**: `whois -h whois.cymru.com " -v <CANDIDATE_IP>"` — the ASN must be the hosting/cloud provider, **not** the CDN's ASN. A "match" on a Cloudflare IP is just a different edge, not the origin.
3. Confirm the protection is actually bypassed: send a request the edge blocks (a WAF-tripping payload, or beyond the edge rate limit) directly to the origin and show it is **not** filtered.
4. Check for Authenticated Origin Pull / allowlisting: some origins only accept the CDN's IPs or require a shared `cf-` secret header. If direct requests are refused, the origin is correctly locked down — report that as *good posture*, not a finding.

## Recommended Tooling

- `dig` / `nslookup` — A/MX/TXT/PTR/CNAME and SPF parsing
- `whois` / `whois -h whois.cymru.com` — ASN & netblock attribution (to include/exclude CDN)
- `subfinder`, `httpx` (`-tls-grab`, `-favicon`, `-title`) — enumerate + probe + pivot
- `naabu` / `masscan` — sweep a provider range for the app
- `curl --resolve` / `openssl s_client -servername` — direct-to-origin confirmation with the right Host/SNI
- Shodan · Censys · FOFA · Netlas · SecurityTrails · ViewDNS — historical DNS, cert, favicon, and body pivots (use API keys when present)
- interactsh / a controlled listener — capture origin egress IP via SSRF/webhook callbacks
- Purpose-built helpers when available (`cloudflair`, `cf-hero`) automate the cert/Shodan pivot — still confirm every hit manually

## False Positives

- A "matching" IP that is just another CDN edge (same fronting ASN) — always ASN-check
- Shared-hosting neighbours: an IP that answers for the Host header but is a co-tenant reverse proxy, not the true origin — confirm with unique authenticated content, not just a 200
- Historical IPs that have since been reassigned to an unrelated tenant
- Staging/dev on a different box than prod — real, but scope it as its own asset

## Pro Tips

1. Mail and forgotten subdomains leak origins more often than any clever pivot — do MX/SPF and full subdomain-ASN triage first.
2. Always ASN-filter results to *exclude* the CDN; most "found it!" mistakes are a second edge node.
3. Confirm with the `Host` header, not a bare IP request — a bare hit often returns a default vhost / 404, hiding a real match.
4. Once confirmed, immediately retest the blocked payloads and rate limits directly at origin to prove the bypass, and hand the origin IP + range to `forwarded_header_ip_spoofing`.
5. Respect rate/DoS limits — the origin has no CDN shield in front of it, so your traffic hits it raw.

## Summary

Fingerprint the fronting CDN/WAF, then recover origin IP candidates via historical DNS, non-proxied subdomains (especially mail/SPF), cert/favicon/body pivots in scan engines, and SSRF/webhook callbacks. Confirm each candidate by requesting the site directly (`curl --resolve`) with the real Host header and matching unique content, ASN-check to exclude other CDN edges, and prove the edge protections are bypassed at origin. A confirmed origin IP unlocks WAF/rate-limit/geo bypass and full control of client-IP headers.
