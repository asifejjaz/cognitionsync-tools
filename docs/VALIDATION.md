# Release 0.1 Validation

Validated locally on Windows with Node 24 and Playwright Chromium on October 9, 2026.

- TypeScript and Vite production build pass. Dedicated HTML shells are generated for all 12 tools and four information pages.
- 19 unit tests pass: range parsing, malformed inputs, page counts, rotations, explicit ordering, extraction, file quotas, filename sanitization, and isolated/idempotent shared-proxy configuration preparation.
- 13 browser tests pass: all 12 tools, actual downloads, byte limits, crop dimensions, HEIC decoding, WebP round trips, signature transparency, PDF page structure, rotated/cropped annotation coordinates, Word tables and image ZIPs, selectable Markdown PDF text, preview sanitization, navigation, and file clearing.
- Production smoke test passes for image compression, HEIC, PDF merging/signing, DOCX, and Markdown export under restrictive CSP, without CSP errors.
- The two production tests also pass against https://aitools.cognitionsync.com: all 12 direct tool routes/canonical links, sitemap, license notices, POST rejection, unknown-route 404, hashed-asset caching/gzip, worker MIME type, and real conversions. No POST/other upload requests were observed during these conversions.
- The new standalone checkout installs with the frozen lockfile and builds successfully. All 13 local browser tests were rerun there. Tests automatically start/reuse the development server after an initial rerun exposed a stopped local server.
- Docker execution and Nginx syntax are verified on the VM. The live container is non-root/read-only with enforced 256 MB memory, one CPU and 64 PID limits, and a private published binding. The shared proxy was gracefully reloaded, not restarted; the existing three main websites remained HTTP 200. Source/runtime backups are kept privately on the VM. Only the new hostname's block was added to the shared configuration.
- A separate TLS certificate was issued for the test hostname, expiring January 7, 2027. Its renewal dry-run succeeded. The existing Certbot renewal service and proxy certificate-reload schedule remain in place.
- Desktop and 390/320-pixel phone layouts were inspected and checked for horizontal overflow. Preview photographs and generated PDF canvases render.
- Audit no longer reports the high-severity PDF.js advisory. One unpatched moderate CLI-only transitive advisory remains documented in ../SECURITY.md.

Not verified: native Safari/Firefox/iOS/Android devices, high-concurrency traffic, volumetric DDoS resistance, full legal/license compliance, advertising approval, ranking, or revenue. Complex Word layouts, PDF form/bookmark fidelity, animated/multi-image conversions, and non-Latin PDF annotations are outside the first-release fidelity guarantees. Markdown external images become captions. CDN/WAF and ongoing alerts are not configured for the test hostname.

Build warnings: the HEIC decoder is a large lazy-loaded chunk; document PDF generation also downloads bundled font data on demand. No claim of a tiny total application download is made. Conversion bundles are loaded only when required rather than on the initial screen.
