# Security Notes

## Release Audit

PDF.js was upgraded to 6.2.108 after the audit identified [GHSA-hq66-cqwq-w95j](https://github.com/advisories/GHSA-hq66-cqwq-w95j). The application renders pages on canvases rather than exposing the interactive PDF scripting viewer. Do not enable scripting or embed unsanitized document HTML in future tools.

The package graph still reports the moderate [sprintf-js advisory GHSA-hp3w-g68c-fv3c](https://github.com/advisories/GHSA-hp3w-g68c-fv3c), with no patched version listed at the time of this release. It is pulled in by Mammoth's argparse CLI dependency. Inspection of `mammoth.browser.js` found no argparse/sprintf code, and only `mammoth/bin/mammoth` imports argparse. This app imports the separate browser build and never runs the CLI. This is a reachability assessment, not a claim that the dependency graph is advisory-free. Keep auditing; do not silently suppress the advisory or force an incompatible argparse override.

## File Boundaries

Files and signatures remain in browser memory. There is no upload endpoint. Markdown and DOCX HTML previews are sanitized with DOMPurify. Markdown does not automatically fetch external images. ZIP downloads sanitize filenames and disambiguate duplicates. Format parsers validate contents after extension and size checks.

Image and PDF limits reduce accidental memory exhaustion but do not make arbitrary untrusted documents harmless. Browser file parsers, HEIC decoding, ZIP inflation, and mobile memory pressure remain attack surfaces. The DOCX expansion limit checks ZIP-declared sizes, not a fully sandboxed streaming inflater. Run automated tests and audit dependencies after upgrades.

## Deployment Review

Use TLS, security headers, controlled caching, monitoring, and a static-only origin. Production CSP intentionally permits only same-origin scripts and WebAssembly compilation, with inline styles for canvas/crop/font layout. Advertising or analytics integration will require a separate consent/privacy/CSP review. Do not add wildcard script hosts.

Review third-party license obligations before commercial publication, particularly heic-to/libheif (LGPL-3.0) and third-party samples. Preserve notices and make required corresponding library sources available. This initial build is not a legal compliance certification or a high-traffic load test.

The test deployment adds a non-root, read-only static container with enforced memory/CPU/PID caps, rotating logs, private binding and GET/HEAD-only serving. Host-specific proxy limits do not protect the VM against a volumetric DDoS attack. CDN/origin protection and ongoing alerts remain launch tasks. See [capacity-and-security.md](docs/capacity-and-security.md) and [deployment.md](docs/deployment.md). Builds publish third-party notices and link the exact HEIC source/build instructions; reassess these when dependencies change.
