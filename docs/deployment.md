# Test Deployment Runbook

The authorized test hostname is https://aitools.cognitionsync.com. It runs as the dedicated `cognitionsync-tools` Compose project behind the VM's existing TLS reverse proxy. Other application containers and their routes are not part of this deployment. Source must be pushed only to https://github.com/asifejjaz/cognitionsync-tools; do not reuse the old research project's Git history or remotes.

## Build And Start

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm test
SITE_URL=https://aitools.cognitionsync.com pnpm build
docker build --pull -f deploy/Dockerfile.prebuilt -t cognitionsync-tools:RELEASE .
FILEWORK_IMAGE=cognitionsync-tools:RELEASE BIND_IP=VERIFIED_PRIVATE_HOST_GATEWAY \
  docker compose -f deploy/compose.yaml up -d
```

Use a unique release tag and retain the prior image. The prebuilt Dockerfile includes only generated static assets and Nginx configuration; no Node runtime, credentials or document processing service is shipped. Build on the development machine to avoid package installation/build contention on the shared VM. Transfer the build archive via trusted SSH with strict host-key checking. No PAT or private key belongs in the repository, browser bundle or chat.

## Shared Proxy

Inventory the running proxy, network, current canonical source and certificate mounts before any change. Preserve every existing server block. The proxy's live config must match its canonical source hash before applying this release. `scripts/prepare-edge.mjs` adds/replaces only the explicitly marked Filework host block; it does not regenerate unrelated configuration.

1. Save the full source/runtime configuration in a private operations directory, never Git.
2. Prepare the HTTP ACME-only host from deploy/edge-http.conf, validate the full candidate in a temporary container on the existing proxy network with the existing certificate volume, then apply it and gracefully reload. Do not restart/recreate the shared proxy.
3. Issue a separate certificate for aitools.cognitionsync.com using the existing Certbot webroot and account. Do not expand or reissue other websites' certificates.
4. Prepare the HTTPS host with an explicit verified private upstream. Validate again. Use deploy/apply-edge.sh with the expected current source/runtime hash to preserve backups and reject concurrent edits.
5. Test container health and public HTTPS, then check existing canonical websites and the proxy health. Hash the final source/runtime files and retain the original backup.

The shared proxy has an image-baked configuration, not a source bind mount. This deployment updates both the source and live container file. A later rebuild from the canonical source retains the new host. Recreating the old image without rebuilding discards runtime edits; use the canonical source to build first during a separately approved maintenance window.

Certificate renewal uses the existing renewal container and mounted webroot/certificate volumes. The existing shared proxy certificate reload schedule remains unchanged. The initial test hostname's renewal dry-run succeeded on October 9, 2026. Monitor renewal failures; the certificate is not a substitute for monitoring. For a manual renewal test, add --no-random-sleep-on-renew to avoid Certbot's intentional renewal delay.

## Verify And Roll Back

```sh
docker compose -f deploy/compose.yaml ps
curl -I https://aitools.cognitionsync.com/all-tools
FILEWORK_PRODUCTION_URL=https://aitools.cognitionsync.com pnpm exec playwright test production.spec.ts
```

Check all tool routes, canonical links, sitemap, CSP, JavaScript worker MIME types, gzip/cache headers, GET/HEAD success, POST rejection and unknown-route 404. Inspect actual Docker limits, user, mounts, security options and private port binding, not just the Compose declaration. Real conversions must succeed in browser tests. Do not run an unbounded stress test against a multi-tenant VM.

For an application rollback, start only this Compose service with its prior tested image tag. For first-release removal, restore the saved proxy source/runtime config, validate and reload before stopping only the Filework container. Keep certificates and all shared Docker volumes. Never use compose down -v, globally prune volumes/images, reset another repository or restart unrelated applications.

## Before Advertising Scale

The test DNS record is direct-origin, not CDN-proxied. Configure edge caching/DDoS protection and carefully scoped origin restrictions before paid traffic. Review every other hosted website before any shared firewall change. Set up uptime/error/resource/egress alerts and test native mobile browsers. Advertising, consent, AdSense verification and CSP integration are not configured in this release.
