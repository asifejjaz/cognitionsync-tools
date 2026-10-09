# Capacity And Abuse Review

For this release, the VM serves static HTML/JavaScript/images. Visitors' browsers perform all conversions; files, signatures and DOCX contents are not uploaded. There is no paid AI API, server converter, URL fetcher, shared file store or database.

## One Million Visits

One million visits over 30 days averages 33,333/day or 0.386 visits/second. That average is not a sizing target: peak arrivals, requests per visit, download bytes, network throughput, the shared reverse proxy and existing applications matter. A 10-50x peak is about 4-19 visits/second before multiplying asset requests. These are planning scenarios, not a measured forecast.

A 12 GB / 6 vCPU VM is a reasonable starting point for this static, browser-first release, especially with a CDN. It is not a guarantee for one million visits or for future server-side OCR/Office/video jobs. Initial inspection found about 8.4 GiB available memory; that is a snapshot, not reserved capacity. At 2 MB delivered per visit, one million uncached visits is about 2 TB/month; at 5 MB, about 5 TB. Heavy HEIC/fonts are loaded on demand, and returning browser/CDN caches reduce origin transfers. Confirm the VM provider's traffic allowance and peak network rate.

## Implemented Origin Controls

- Non-root static Nginx container; read-only root filesystem, 32 MB temporary filesystem, no extra Linux capabilities or privilege escalation, no Docker socket, no host application/data mounts.
- 256 MB container memory including swap ceiling, one CPU quota, 64 PID ceiling, rotating container logs capped at three 10 MB files.
- Private host binding behind the existing TLS proxy; no new public converter port. Separate Compose network, not the existing application network.
- GET/HEAD only, 16 KB request-body ceiling, controlled timeouts. Unknown routes and assets return 404 instead of accepting arbitrary paths.
- New hostname-only request limiting (30 requests/second/IP with 120-request burst) and 40 active connections/IP. Limits are deliberately generous for asset downloads and shared NATs, not guaranteed anti-DDoS protection.
- Hashed asset caching, gzip, TLS, restrictive CSP, frame restrictions and content-type protection.
- Browser file/page/pixel quotas and sanitized document previews. Client quotas are not a server security boundary; they primarily protect visitors from accidental memory exhaustion.

## Remaining Risks

Bots can still consume bandwidth and shared-proxy resources. A read-only capped container does not stop a volumetric attack or an exploitable Nginx/kernel/dependency vulnerability. The test A record points directly at the VM, so CDN/DDoS protection is not yet enabled for this hostname. Client parsers can also crash a visitor's browser on malicious/huge files. Keep dependency and image updates current.

Next: proxy this hostname through a CDN/WAF, configure bot/rate protection without breaking legitimate downloads, and protect origin access. [Cloudflare's origin guide](https://developers.cloudflare.com/fundamentals/security/protect-your-origin-server/) explains why proxying DNS alone does not stop direct-origin requests. Because this VM hosts multiple websites, do not globally block non-CDN traffic until every site's routing has been reviewed. If using forwarded client IPs for limits, trust only verified CDN addresses; never accept an arbitrary X-Forwarded-For header.

Monitor uptime, real conversion failures, 429/5xx counts, CPU/RAM, disk/log growth, egress and peak latency. This release has no ongoing monitoring/alert automation configured. A high-concurrency benchmark has not been performed on the shared production VM.

Any future server upload service needs strict compressed/expanded limits, bounded workers/queues, per-client quotas, no network egress by default, explicit temporary-file cleanup, timeouts, read-only containers and resource caps. Browser-based protections do not carry over automatically.

## Domain And Monetization

Use aitools.cognitionsync.com for the test; no new domain purchase is necessary. For the generic file toolkit, tools.cognitionsync.com describes the product more accurately than AI tools. Keep AxiomSquarePK's existing regional/business products separate; SignalChecks is a better fit for checks/validators/monitoring. A separate short brand domain is optional after traction, not an SEO shortcut. No availability/trademark checks for a new brand have been performed.

No advertising scripts or AdSense approval are configured. Paid traffic does not guarantee profitable ad revenue or organic ranking. Add advertising only after approval, consent/privacy review and a deliberate CSP change; never put ads beside controls in a way that encourages accidental clicks. Revenue and traffic claims remain unverified.
