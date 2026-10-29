---
aliases:
  - "Plan 07: Container, release & deploy"
tags:
  - bubble-breaker/plan
status: in-progress
created: 2026-10-29
---
# Plan 07 — Container, Release & Deploy Implementation Plan

> **For agentic workers:** run **one implementer subagent per task**, in order, and review each task's diff and test output before starting the next (the superpowers plugin does not load in cloud sessions; see the roadmap's working agreement). Steps use checkbox (`- [ ]`) syntax for tracking. Tasks 1–10 land in **one PR**; Task 8 is a **dry run** (browser check through the container, Trivy, release rehearsal) whose scripts are not committed. Part 2 lists the **user steps** (GitHub admin, NAS/DSM, first release) that no agent can do. Open the PR and poll its checks with the **GitHub connector** (`gh` has no token in cloud sessions). **Do not merge**: the user merges.

**Goal:** Ship the game as a container and release it automatically. A multi-stage `Dockerfile` (Node build → `nginx-unprivileged` alpine-slim on port 8080, health check, digest-pinned bases); `nginx/default.conf` with the 06-deployment cache rules, SPA fallback with real 404s and the security headers, including a CSP that works with the service worker; `deploy/compose.yml` (read-only, localhost-bound) and `deploy/update.sh` (health-gated, emails on failure); a CI `docker` job that lints workflows and shell, tests the updater, builds the image, starts it with the real compose file and checks it over HTTP; release-please (first release **2.0.0**, bumps `package.json` and `src/app/version.ts`) and a release workflow that pushes to GHCR only what Trivy passed. Part 2 covers the user steps up to 2.0.0 live on the NAS. Playwright e2e, axe, visual baselines and Lighthouse are Plan 08.

**Architecture:** Nothing under `src/app/` changes; the layer rule (ADR-0002) is untouched.
- Build side: `angular.json` turns off critical-CSS inlining (its inline `<script>` would break under `script-src 'self'`); `scripts/check-pwa.mjs` accepts the resulting `/>` tags.
- Image: `Dockerfile` + `.dockerignore` + `nginx/default.conf` (copied to `/etc/nginx/conf.d/default.conf`; the base image's `nginx.conf` already keeps pid and temp files in `/tmp`).
- Checks: `scripts/check-container.mjs` (plain Node, no dependencies, like `check-pwa.mjs`) asserts health, caching, routing, headers and a CSP-safe `index.html` against any base URL: the CI container, a local one, or the live site (`--public` adds HSTS).
- NAS: `deploy/compose.yml`, `deploy/update.sh` and its stub-docker test `deploy/update.test.sh`.
- Pipeline: `ci.yml` gains job `docker`; `release.yml` (release-please → image → Trivy → tags → attestation); `release-please-config.json`, `.release-please-manifest.json`; `dependabot.yml` gains the docker ecosystem.

**Tech Stack:** Docker (BuildKit, buildx, compose v2), `node:24-alpine` and `nginxinc/nginx-unprivileged:stable-alpine-slim` (nginx 1.30.6, Alpine 3.24), bash + `flock`, release-please 17 via `googleapis/release-please-action` v5, `docker/*` actions, `aquasecurity/trivy-action` v0.36.0 (Trivy 0.70.0), `actions/attest-build-provenance` v4, actionlint 1.7.12 (with shellcheck 0.11.0) from its Docker image, Node 24 `fetch` for the container check, Playwright (pre-installed Chromium) for the dry-run browser check.

**Spec:** [2026-09-27-bubble-breaker-rewrite-design.md](../specs/2026-09-27-bubble-breaker-rewrite-design.md) (milestones 7 and 8, "Verify during implementation") · pipeline in [05-cicd.md](../../05-cicd.md) · image, nginx, runtime, DSM and updater in [06-deployment.md](../../06-deployment.md) · gates in [04-quality.md](../../04-quality.md#gates) · [ADR-0007](../../adr/0007-pwa-ngsw.md) (no-cache worker files) · what Plan 06 left open: [Plan 06 "Not checked in CI"](2026-10-29-06-pwa.md#not-checked-in-ci-until-plan-08)

> [!NOTE]
> **Cloud session:** `.claude/hooks/cloud-setup.sh` provides Node ≥ 24.15. `gh` has no valid token: open the PR and poll its checks with the GitHub connector (Task 10). Docker is installed, but its daemon is not running, and the network differs from a laptop or a GitHub runner. What worked in the dry run:
> - Start the daemon with a Docker Hub mirror (Docker Hub answers `429 Too Many Requests`): `mkdir -p /etc/docker && echo '{"registry-mirrors":["https://mirror.gcr.io"]}' > /etc/docker/daemon.json && (nohup dockerd > <scratchpad>/dockerd.log 2>&1 &)`, then wait until `docker info` answers.
> - `npm ci` inside `docker build` needs the session proxy and its CA. Build from a **scratch copy** of the Dockerfile that adds two lines after `ENV HUSKY=0` (never commit them): `COPY sandbox-ca.crt /tmp/ca.crt` and `ENV NODE_EXTRA_CA_CERTS=/tmp/ca.crt`, with `cp /root/.ccr/ca-bundle.crt sandbox-ca.crt` (delete it afterwards) and `docker build --network host --build-arg HTTPS_PROXY=$HTTPS_PROXY -f <scratchpad>/Dockerfile.sandbox …`. The runtime stage is identical.
> - Trivy runs as a container: `docker run --rm --network host -e HTTPS_PROXY=$HTTPS_PROXY -e SSL_CERT_FILE=/ca.crt -v /root/.ccr/ca-bundle.crt:/ca.crt:ro -v /var/run/docker.sock:/var/run/docker.sock aquasec/trivy:0.70.0 image …` (its database comes from `mirror.gcr.io/aquasec/trivy-db`).
> - The Alpine package CDN (`dl-cdn.alpinelinux.org`) is blocked, so `apk add/upgrade` cannot be tried in the session.
> - Chromium and Playwright are pre-installed (`require('playwright')` works from any directory; do not run `playwright install`).

## Global Constraints

- Plans 01–06 are merged. The real files this plan builds on:
  - `angular.json`: builder `@angular/build:application`, `defaultConfiguration: production`; `configurations.production` has the budgets (initial 350 kB warn / 450 kB error, component styles 4/8 kB), `outputHashing: all` and `serviceWorker: ngsw-config.json`. The build lands in `dist/bubble-breaker/browser/`: `index.html`, `main-<HASH>.js`, `styles-<HASH>.css` (8-character upper-case hashes), `ngsw.json`, `ngsw-worker.js`, `safety-worker.js`, `worker-basic.min.js`, `manifest.webmanifest`, `favicon.ico`, `fonts/noto-sans-latin-{400,700}-normal.woff2` (copied as assets, **not** content-hashed; `base.css` references them as `/fonts/…`) and `icons/*.png`. There is no `media/` folder today.
  - The production `index.html` of `main` contains `<script>document.querySelectorAll('link[data-beasties-media]')…</script>` (critical-CSS inlining) and loads `styles-*.css` with `media="print"` until that script runs.
  - `scripts/check-pwa.mjs` (`npm run check:pwa`, run by CI `build`) checks `index.html` with the exact strings `<link rel="manifest" href="manifest.webmanifest">` and `<meta name="theme-color" content="#0A246A">`. `scripts/*.mjs` are plain Node ESM with no dependencies; Prettier checks them; ESLint parses them with no rules.
  - `src/app/version.ts`: `export const VERSION = '0.0.0'; // x-release-please-version`; the About screen shows it. `package.json` and `package-lock.json` have version `0.0.0`; `prepare` runs `husky`.
  - `.github/workflows/ci.yml` (`quality`, `build`), `codeql.yml` (`javascript-typescript`, `actions`), `pr-title.yml`: `permissions: {}` at the top, minimal grants per job, actions pinned by commit SHA with a `# vX.Y.Z` comment (`actions/checkout@3d3c42e5… # v7.0.1`, `actions/setup-node@949feb24… # v7.1.0`, `github/codeql-action/*@9b325408… # v4.39.1`). `ci.yml` has `concurrency: ci-${{ github.ref }}` with cancel.
  - `.github/dependabot.yml`: npm (groups `angular`, `test-tooling`, `lint-format`) and github-actions (group `actions`); **no docker ecosystem yet**.
  - `.prettierignore`: `dist/`, `coverage/`, `.angular/`, `docs/`, `package-lock.json`, `src/styles/tokens.css`. `.gitignore` ignores `/dist`.
  - Repo state on 2026-10-29: tags `v0-legacy` (`f16fc4d`, the last legacy commit), `v1.1.0`, `v1.1.1`, all ancestors of `main`; **no GitHub Releases**; only branch `main` (protected by the ruleset with required checks `quality`, `build`, `pr-title`, CodeQL).
- Base images (resolved 2026-10-29; Dependabot moves the digests):
  - `node:24-alpine@sha256:8a32c8cf649a49915a66e81e7a609223c708d0adabf288ee3f4077d765542f85` (Node 24.22.2, npm 11.19.1, Alpine 3.24.3).
  - `nginxinc/nginx-unprivileged:stable-alpine-slim@sha256:5d8bb9437d74a600ec5dbf90c035451c724dc33eac8d3a71078f6f8612c345f6` (nginx 1.30.6, Alpine 3.24.2, 21 packages, uid 101, port 8080). Its `nginx.conf`: `pid /tmp/nginx.pid`, all `*_temp_path` under `/tmp`, `include /etc/nginx/conf.d/*.conf`, access log to stdout. Its `mime.types` has no `webmanifest` entry.
  - `rhysd/actionlint:1.7.12@sha256:b1934ee5f1c509618f2508e6eb47ee0d3520686341fec936f3b79331f9315667` (also contains shellcheck 0.11.0).
- Actions (tag → dereferenced commit, resolved 2026-10-29 with `git ls-remote … refs/tags/<tag>^{}`): `googleapis/release-please-action@45996ed1f6d02564a971a2fa1b5860e934307cf7 # v5.0.0`, `docker/setup-buildx-action@f87e5991a6d7451dcb8d9637bfbc97413f497069 # v4.4.1`, `docker/login-action@81c6f93d4bc991e510b342a00b419b3bb4efc5c6 # v4.7.0`, `docker/metadata-action@dc802804100637a589fabce1cb79ff13a1411302 # v6.2.0`, `docker/build-push-action@c3c9e263c25d99ce0380d002d59b67737d91b0dc # v7.4.0`, `aquasecurity/trivy-action@ed142fd0673e97e23eac54620cfb913e5ce36c25 # v0.36.0` (default Trivy v0.70.0), `actions/attest-build-provenance@4d101475d8b20a2381f78447822ac1eab6504dd8 # v4.2.2`. Never use a tag; re-resolve a SHA only from the action's own repository.
- Names that must match everywhere: image `ghcr.io/obichris11/bubble-breaker` (lower case), container and compose project `bubble-breaker`, host port `127.0.0.1:18080`, OCI source label `https://github.com/Obichris11/bubble-breaker` (as metadata-action writes it), check name `docker`.
- Do not edit `src/app/**`, `src/styles/tokens.css`, `ngsw-config.json` or the coverage thresholds. `npm run check` (49 files, 364 tests) and `npm run build && npm run check:pwa` must stay green after every task.

## Decisions this plan makes

The docs leave these points open or disagree. Task 9 writes them back into `03-architecture.md`, `04-quality.md`, `05-cicd.md`, `06-deployment.md` and the spec.

| Topic | Decision | Why |
|---|---|---|
| CSP vs. critical CSS | Production `optimization: { scripts: true, styles: { minify: true, inlineCritical: false }, fonts: true }`. `index.html` then has no inline script; `styles-*.css` (6.77 kB raw, 1.75 kB transfer) loads as a normal stylesheet | Measured: with the CSP, main's inline media-swap script is blocked 3× and the stylesheet stays `media="print"`, so the global chrome styles never apply. `security.autoCsp` adds two inline loader scripts and a `<meta>` CSP, which the header's `script-src 'self'` still blocks. The spec names this fallback |
| `check-pwa.mjs` | Match the manifest link with `/<link rel="manifest" href="manifest\.webmanifest"\/?>/` and the theme colour without the closing `>` | Without critical-CSS inlining the build keeps `/>` on void tags; the exact strings would fail CI `build` |
| nginx file | `nginx/default.conf`, a `server` block copied to `/etc/nginx/conf.d/default.conf`; the image's `nginx.conf` stays | 06 calls it `nginx.conf`; keeping the image's main file keeps its `/tmp` pid and temp paths, which the read-only root needs |
| Header inheritance | Security headers at `server` level with `always`; `add_header_inherit merge;` (nginx ≥ 1.29.3) so locations that add `Cache-Control` keep them. `Cache-Control` without `always` | Plain `add_header` in a location drops every inherited header. Without `always`, 404s and 5xx carry no `Cache-Control`, so a missing file is never cached for a year |
| Fonts | `public, max-age=604800` (one week) like icons and favicon, not `immutable` | 06 lists fonts as immutable, but the build copies them unhashed (`/fonts/noto-sans-latin-400-normal.woff2`); a changed font under the same name would stay stale for a year without a service worker |
| Missing files | Any path whose last segment has a dot (`location ~ \.[^/]*$`) is a file: `try_files $uri =404`. Everything else falls back to `/index.html`, which gets `no-cache` from its own location | 06 "Routing"; the same rule Plan 06's scratch server used |
| Manifest type | `location = /manifest.webmanifest { types { } default_type application/manifest+json; }` | `mime.types` in the image has no `webmanifest`; a `types` block at server level would replace the whole map |
| Runtime base | `nginxinc/nginx-unprivileged:stable-alpine-slim`, not `stable-alpine` | Trivy on 2026-10-29: `stable-alpine` has 3 fixable findings (brotli-libs CVE-2026-111497 CRITICAL, curl/libcurl CVE-2026-92392 HIGH) and would fail the release gate; slim (no curl, no freetype) is clean. Image 30.1 MB on disk / 8.5 MB compressed instead of 91 MB / 25.9 MB. An `apk upgrade` layer could not be tried (Alpine CDN blocked in the session) and makes builds less reproducible |
| Base pins | Channel tag plus digest: `node:24-alpine@sha256:…`, `…:stable-alpine-slim@sha256:…`; Dependabot `docker` (weekly, one group) bumps the digests | Stays on Node 24 LTS and the nginx stable line without version-number PRs for every patch |
| Health check | `HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --start-interval=2s CMD wget -qO- http://127.0.0.1:8080/health \|\| exit 1` | `--start-interval` (Docker ≥ 25) makes a fresh container healthy within seconds (measured 3 s); older engines ignore it and do the first check after 30 s, inside `update.sh`'s 60 s budget |
| `docker` job | No `needs: build` (05 says "Needs build"): the Dockerfile builds the app from source. It runs actionlint and shellcheck (one digest-pinned image), `npm run test:deploy`, `docker build --pull`, then starts the image **with `deploy/compose.yml` itself** (tagged as `ghcr.io/obichris11/bubble-breaker:latest`, `up --pull never --wait`) and runs `npm run check:container` | The multi-stage build is the legacy fix ("Docker ships prebuilt dist"). Running the real compose file proves read-only root, tmpfs, dropped capabilities and the 64 MB limit. Workflow linting matters because `release.yml` only runs after merge |
| Container check | `scripts/check-container.mjs <base-url> [--public]`: 85 checks (86 with `--public`): `/health`, `no-cache` on `index.html`, SPA routes and the five worker/manifest files, `immutable` + gzip on hashed bundles, one week on fonts/icons/favicon, real 404s without `Cache-Control` and with the security headers, exact header values, `Server: nginx`, no inline `<script>` or `on*=` in `index.html` | One script serves CI, local runs and the live site; the inline-script check guards the CSP at build level until Plan 08's e2e CSP test |
| Release order | Push only `:sha-<short>` (provenance `mode=max`, SBOM) → Trivy scans that digest (fixable CRITICAL/HIGH fail, SARIF to code scanning, category `trivy-image`) → only then `docker buildx imagetools create` adds `X.Y.Z`, `X.Y`, `latest` → `actions/attest-build-provenance` | 05 scans after tagging; the NAS polls `:latest` every 15 min, so a failed scan would already be deploying. A failed scan leaves the GitHub Release but `:latest` unchanged; fix forward with a patch release |
| Image job permissions | `contents: read`, `packages: write`, `id-token: write`, `attestations: write`, **`security-events: write`** | SARIF upload needs it; 05 does not list it |
| First version | `release-please-config.json`: `release-type: node`, `include-component-in-tag: false` (tags `vX.Y.Z`), `initial-version: 2.0.0`, `bootstrap-sha: f16fc4d4add06b8ac854243b11985fd3d61941b3` (`v0-legacy`), `extra-files: ["src/app/version.ts"]`; `.release-please-manifest.json` is `{}` | From release-please 17.11.2's source: with an empty manifest it backfills no legacy tag and uses `initial-version`; the commit walk stops at `bootstrap-sha`. So the first release is 2.0.0, its changelog lists the rewrite only, and there is no `release-as` to remove afterwards. With `{".": "1.1.1"}` it would find tag `v1.1.1` and release 1.2.0 |
| Version shown on About | release-please's generic updater rewrites the `x-release-please-version` line in `src/app/version.ts`; the node updater bumps `package.json` and `package-lock.json` | 05 says "injected at build time from `package.json`"; Plans 01 and 03 already built `version.ts`. Checked by running release-please's updaters on the real files: all three become 2.0.0 |
| Changelog | `CHANGELOG.md` is generated and added to `.prettierignore` | release-please writes `*` bullets that `prettier --check` (CI `quality`) would reject on the release PR |
| Release token | Fine-grained PAT `RELEASE_PLEASE_TOKEN`: this repo only, **Contents, Issues, Pull requests: read and write**, 1 year | 05 lists contents + PRs; release-please also creates and sets its `autorelease: pending/tagged` labels (its README asks for `issues: write`) |
| Release concurrency | `release.yml`: `concurrency: { group: release, cancel-in-progress: false }` | A half-pushed release must finish; the next push to `main` waits |
| Updater compare | Redeploy when the running container's image ID (`docker inspect -f '{{.Image}}' bubble-breaker`) differs from the ID of the configured tag after `compose pull` | 06 compares "before and after the pull", which misses the first run (no container) and a rollback to a tag that is already local |
| Updater failures | Exit 1 (DSM emails) when the pull fails, when the new container is not healthy within 60 s, and on every later run **while the deployed container is `unhealthy`**; `starting` is not a failure. stderr gets the reason and `docker logs --tail 50`. No automatic rollback | Without the last rule a broken release emails once and then reads as "unchanged" every 15 min. A NAS reboot shows `starting` for a moment and must not email |
| Updater tooling | `compose()` uses `docker compose`, else `docker-compose`; `PATH` gets `/usr/local/bin:/usr/bin:/bin` **appended**; `flock -n` on `.update.lock`; `pull -q` output shown only on failure | The spec's DSM unknowns. Prepending would bypass the test stubs (seen in the dry run); compose v2 prints progress even with `-q` |
| Updater tests | `deploy/update.test.sh`: 10 scenarios, 31 checks against a stub `docker` on `PATH` (no daemon), ~6 s; CI runs it in `docker` | Plain bash, no new dev dependency |
| Compose | Top-level `name: bubble-breaker`; otherwise 06's file (port quoted for Prettier) | The Container Manager project and `update.sh` must manage the same project whatever the folder or file name |
| Check name | The new job is `docker`; the user adds it to the ruleset **after** this PR merged (Part 2, B2) | A required check that has never reported blocks every PR |

## File Structure

```text
angular.json                      production optimization: inlineCritical false
scripts/
  check-container.mjs             checks a running container or the live site (new)
  check-pwa.mjs                   manifest link / theme colour accept "/>"
package.json                      scripts check:container, test:deploy
Dockerfile                        build (node:24-alpine) → runtime (nginx-unprivileged alpine-slim)
.dockerignore
nginx/
  default.conf                    caching, routing, health, security headers
deploy/
  compose.yml                     the NAS runtime (also used by CI)
  update.sh                       the NAS updater (DSM Task Scheduler)
  update.test.sh                  updater tests with a stub docker
release-please-config.json
.release-please-manifest.json     {} until the first release
.prettierignore                   + CHANGELOG.md
.github/
  dependabot.yml                  + docker ecosystem (base-images group)
  workflows/ci.yml                + job docker
  workflows/release.yml           release-please → image → Trivy → tags → attestation (new)
docs/                             03, 04, 05, 06, spec (Task 9); roadmap (Task 10)
```

Order (each task leaves `main`-quality state): container check (fails) → CSP-safe `index.html` → image (check passes) → compose → updater → CI job → release pipeline → dry run → docs → PR.

## Branch

```bash
git checkout main && git pull
git checkout -b feat/container-release-deploy
```

Baseline: `npm run check` → 49 files, 364 tests pass; `npm run build` → initial total 307.61 kB raw (main 300.84 kB, styles 6.77 kB; transfer 82.39 kB); `npm run check:pwa` passes. Start the Docker daemon first in a cloud session (see the note above).

---

## Part 1 — In the PR

### Task 1: Container check script (fails against a stock nginx)

**Files:**
- Create: `scripts/check-container.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces: `node scripts/check-container.mjs <base-url> [--public]` (default `http://127.0.0.1:18080`) → exit 0 with `Container check passed for <url> (85 checks)`, or exit 1 with `Container check failed for <url> (<n> of 85 checks):` and one `- ` line per problem. `npm run check:container` runs it against `http://127.0.0.1:18080`.

- [ ] **Step 1: Write the check**

`scripts/check-container.mjs`:

```js
// Checks a running container (or the live site) against 06-deployment "nginx": health,
// caching, routing, security headers, and an index.html that the CSP can run. CI's `docker`
// job runs it against the container started from deploy/compose.yml:
//   node scripts/check-container.mjs http://127.0.0.1:18080
// Add --public to also require HSTS (set by the DSM reverse proxy, not by the container).
const base = (process.argv[2] ?? 'http://127.0.0.1:18080').replace(/\/$/, '');
const isPublic = process.argv.includes('--public');

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "base-uri 'self'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ');
const SECURITY = {
  'content-security-policy': CSP,
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'cross-origin-opener-policy': 'same-origin',
};
const NO_CACHE = 'no-cache';
const IMMUTABLE = 'public, max-age=31536000, immutable';
const WEEK = 'public, max-age=604800';

const errors = [];
let checks = 0;
const check = (ok, message) => {
  checks++;
  if (!ok) {
    errors.push(message);
  }
};

async function get(path) {
  const response = await fetch(base + path, { redirect: 'manual' });
  return { path, status: response.status, headers: response.headers, body: await response.text() };
}

function expectHeader(res, name, value) {
  const actual = res.headers.get(name);
  check(actual === value, `${res.path}: ${name} is ${String(actual)}, not ${value}`);
}

function expectSecurityHeaders(res) {
  for (const [name, value] of Object.entries(SECURITY)) {
    expectHeader(res, name, value);
  }
}

function expectFile(res, cacheControl, type) {
  check(res.status === 200, `${res.path}: status ${String(res.status)}, not 200`);
  expectHeader(res, 'cache-control', cacheControl);
  if (type !== undefined) {
    const actual = res.headers.get('content-type') ?? '';
    check(actual.startsWith(type), `${res.path}: content-type is ${actual}, not ${type}`);
  }
}

function expectMissing(res) {
  check(res.status === 404, `${res.path}: status ${String(res.status)}, not 404`);
  check(!res.body.includes('<bb-root'), `${res.path}: a missing file must not serve index.html`);
  check(!res.headers.has('cache-control'), `${res.path}: a 404 must not be cacheable`);
  expectSecurityHeaders(res);
}

const health = await get('/health');
check(health.status === 200, `/health: status ${String(health.status)}, not 200`);
check(health.body.trim() === 'ok', `/health: body is ${JSON.stringify(health.body)}, not "ok"`);
check(
  (health.headers.get('content-type') ?? '').startsWith('text/plain'),
  '/health: content-type is not text/plain',
);

const root = await get('/');
expectFile(root, NO_CACHE, 'text/html');
expectSecurityHeaders(root);
check(root.body.includes('<bb-root'), '/: does not serve index.html');
check(
  root.headers.get('server') === 'nginx',
  `/: server header is ${String(root.headers.get('server'))}, not nginx (server_tokens off)`,
);
if (isPublic) {
  check(
    (root.headers.get('strict-transport-security') ?? '').includes('max-age='),
    '/: no Strict-Transport-Security header (enable HSTS on the DSM reverse proxy)',
  );
}

// script-src 'self' blocks inline scripts and event-handler attributes in index.html.
const inline = [...root.body.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>/g)].map((m) => m[0]);
check(inline.length === 0, `index.html has inline scripts the CSP blocks: ${inline.join(' ')}`);
check(!/<[^>]+\son[a-z]+=/i.test(root.body), 'index.html has event-handler attributes');

for (const route of ['/about', '/options', '/statistics']) {
  const res = await get(route);
  expectFile(res, NO_CACHE, 'text/html');
  check(res.body === root.body, `${route}: does not serve index.html`);
}

for (const file of [
  '/index.html',
  '/ngsw.json',
  '/ngsw-worker.js',
  '/safety-worker.js',
  '/worker-basic.min.js',
]) {
  expectFile(await get(file), NO_CACHE);
}
expectFile(await get('/manifest.webmanifest'), NO_CACHE, 'application/manifest+json');

const hashed = root.body.matchAll(/(?:src|href)="([\w-]+-[A-Z0-9]{8}\.(?:js|css))"/g);
const bundles = [...new Set([...hashed].map((m) => `/${m[1]}`))];
check(
  bundles.some((b) => b.endsWith('.js')) && bundles.some((b) => b.endsWith('.css')),
  'no hashed bundles in index.html',
);
for (const bundle of bundles) {
  const res = await get(bundle);
  expectFile(res, IMMUTABLE);
  check(res.headers.get('content-encoding') === 'gzip', `${bundle}: not gzipped`);
}

for (const file of [
  '/fonts/noto-sans-latin-400-normal.woff2',
  '/icons/icon-192.png',
  '/favicon.ico',
]) {
  expectFile(await get(file), WEEK);
}

for (const missing of ['/missing.js', '/main-AAAAAAAA.js', '/icons/missing.png', '/about.txt']) {
  expectMissing(await get(missing));
}

if (errors.length > 0) {
  console.error(
    `Container check failed for ${base} (${String(errors.length)} of ${String(checks)} checks):\n- ${errors.join('\n- ')}`,
  );
  process.exit(1);
}
console.log(`Container check passed for ${base} (${String(checks)} checks)`);
```

In `package.json`, add after the `"check:pwa"` script:

```json
    "check:container": "node scripts/check-container.mjs http://127.0.0.1:18080",
```

- [ ] **Step 2: Run it against the stock image to verify it fails**

```bash
npm run build
docker run -d --name bb-stock -p 127.0.0.1:18080:8080 \
  -v "$PWD/dist/bubble-breaker/browser:/usr/share/nginx/html:ro" \
  nginxinc/nginx-unprivileged:stable-alpine-slim@sha256:5d8bb9437d74a600ec5dbf90c035451c724dc33eac8d3a71078f6f8612c345f6
npm run check:container
docker rm -f bb-stock
```

Expected: FAIL (exit 1), starting with:

```text
Container check failed for http://127.0.0.1:18080 (54 of 85 checks):
- /health: status 404, not 200
- /health: body is "<html>\r\n<head><title>404 Not Found</title></head>…<center>nginx/1.30.6</center>…", not "ok"
- /health: content-type is not text/plain
```

and further down every cache rule, every security header, `server header is nginx/1.30.6`, `index.html has inline scripts the CSP blocks: <script>`, the SPA routes (`/about: status 404`) and the manifest type (`application/octet-stream`).

- [ ] **Step 3: Format and commit**

```bash
npx prettier --check scripts/check-container.mjs package.json
git add scripts/check-container.mjs package.json
git commit -m "test(deploy): container check for health, caching, routing and headers"
```

---

### Task 2: An index.html the CSP can run

**Files:**
- Modify: `angular.json`, `scripts/check-pwa.mjs`

- [ ] **Step 1: Turn off critical-CSS inlining**

In `angular.json`, `configurations.production`, change

```json
              "outputHashing": "all",
              "serviceWorker": "ngsw-config.json"
```

to

```json
              "outputHashing": "all",
              "optimization": {
                "scripts": true,
                "styles": { "minify": true, "inlineCritical": false },
                "fonts": true
              },
              "serviceWorker": "ngsw-config.json"
```

- [ ] **Step 2: Build and verify the PWA check now fails**

Run: `npm run build && npm run check:pwa`
Expected: the build succeeds with the same sizes (initial 307.61 kB raw); the check FAILS:

```text
PWA check failed for dist/bubble-breaker/browser:
- no manifest link
- no theme-color
```

`dist/bubble-breaker/browser/index.html` now ends its head with `<link rel="stylesheet" href="styles-BTTEXMZV.css"></head>` (no inline `<style>`, no `media="print"`, no inline script) and writes void tags as `<link rel="manifest" href="manifest.webmanifest"/>`.

- [ ] **Step 3: Accept both tag forms**

In `scripts/check-pwa.mjs`, replace

```js
  check(index.includes('<link rel="manifest" href="manifest.webmanifest">'), 'no manifest link');
  check(
    index.includes(`<meta name="theme-color" content="${expected.theme_color}">`),
    'no theme-color',
  );
```

with

```js
  // The build writes void tags as `<link …>` or `<link …/>`, depending on its HTML optimizer.
  check(/<link rel="manifest" href="manifest\.webmanifest"\/?>/.test(index), 'no manifest link');
  check(
    index.includes(`<meta name="theme-color" content="${expected.theme_color}"`),
    'no theme-color',
  );
```

- [ ] **Step 4: Verify**

Run: `npm run build && npm run check:pwa && grep -o '<script[^>]*>' dist/bubble-breaker/browser/index.html`
Expected: `PWA check passed for dist/bubble-breaker/browser`, then exactly one line, `<script src="main-GWKBTC7B.js" type="module">` (the hash of the reference build).

- [ ] **Step 5: Commit**

```bash
npm run check
git add angular.json scripts/check-pwa.mjs
git commit -m "build: no inline script in index.html, so script-src 'self' holds"
```

---

### Task 3: Image and nginx config

**Files:**
- Create: `nginx/default.conf`, `Dockerfile`, `.dockerignore`

**Interfaces:**
- Produces: an image that serves the build on port 8080 as uid 101, healthy when `GET /health` answers `ok`.

- [ ] **Step 1: nginx config**

`nginx/default.conf`:

```nginx
# Bubble Breaker static site (06-deployment "nginx"). Copied to /etc/nginx/conf.d/default.conf
# in nginxinc/nginx-unprivileged, whose nginx.conf keeps the pid and temp files under /tmp and
# logs to stdout/stderr. CI checks the result with scripts/check-container.mjs.
server {
    listen 8080;
    server_name _;
    root /usr/share/nginx/html;

    server_tokens off;
    # Behind the DSM reverse proxy: redirects must not name the container's host and port.
    absolute_redirect off;

    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/css application/javascript application/json application/manifest+json
               image/svg+xml image/x-icon text/plain;

    # Locations below add Cache-Control; merge keeps these headers there too (nginx >= 1.29.3).
    add_header_inherit merge;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; worker-src 'self'; manifest-src 'self'; base-uri 'self'; form-action 'none'; frame-ancestors 'none'" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=(), usb=()" always;
    add_header Cross-Origin-Opener-Policy "same-origin" always;

    location = /health {
        access_log off;
        default_type text/plain;
        return 200 "ok\n";
    }

    # The app shell and the service-worker files are revalidated on every load, so a new
    # release reaches returning visitors (ADR-0007). Cache-Control without `always`: errors
    # are never cacheable.
    location = /index.html {
        add_header Cache-Control "no-cache";
    }
    location ~ ^/(?:ngsw\.json|ngsw-worker\.js|safety-worker\.js|worker-basic\.min\.js)$ {
        add_header Cache-Control "no-cache";
    }
    location = /manifest.webmanifest {
        # mime.types has no webmanifest entry.
        types { }
        default_type application/manifest+json;
        add_header Cache-Control "no-cache";
    }

    # Content-hashed build output (outputHashing: all): main-ABCD1234.js, styles-ABCD1234.css.
    location ~ "^/[\w-]+-[A-Z0-9]{8}\.(?:js|css)$" {
        add_header Cache-Control "public, max-age=31536000, immutable";
    }
    location ^~ /media/ {
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    # Same name in every release: fonts, icons, favicon.
    location ~ ^/(?:fonts/|icons/|favicon\.ico$) {
        add_header Cache-Control "public, max-age=604800";
    }

    # Any other path with a file extension is a file: a real 404 when it is missing.
    location ~ \.[^/]*$ {
        try_files $uri =404;
    }

    # Everything else is an app route: serve index.html (which then gets no-cache).
    location / {
        try_files $uri /index.html;
    }
}
```

Run (config test in the runtime base):

```bash
docker run --rm -v "$PWD/nginx/default.conf:/etc/nginx/conf.d/default.conf:ro" \
  nginxinc/nginx-unprivileged:stable-alpine-slim@sha256:5d8bb9437d74a600ec5dbf90c035451c724dc33eac8d3a71078f6f8612c345f6 nginx -t
```

Expected (after the entrypoint lines): `nginx: the configuration file /etc/nginx/nginx.conf syntax is ok` and `nginx: configuration file /etc/nginx/nginx.conf test is successful`. (`add_header_inherit` is unknown before nginx 1.29.3; a base that old fails here, loudly.)

- [ ] **Step 2: Dockerfile and .dockerignore**

`Dockerfile`:

```dockerfile
# syntax=docker/dockerfile:1
# Bubble Breaker image (06-deployment "Image"): builds the app from source, then serves it with
# unprivileged nginx on port 8080. Base images are pinned by digest; Dependabot bumps them.

FROM node:24-alpine@sha256:8a32c8cf649a49915a66e81e7a609223c708d0adabf288ee3f4077d765542f85 AS build
WORKDIR /app
# No git hooks inside the image.
ENV HUSKY=0
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM nginxinc/nginx-unprivileged:stable-alpine-slim@sha256:5d8bb9437d74a600ec5dbf90c035451c724dc33eac8d3a71078f6f8612c345f6 AS runtime
USER root
RUN rm -rf /usr/share/nginx/html/*
USER 101
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/bubble-breaker/browser /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --start-interval=2s \
  CMD wget -qO- http://127.0.0.1:8080/health || exit 1
```

`.dockerignore`:

```text
# Only what `npm ci` and `ng build` need goes into the build context (06-deployment).
.git
.github
.angular
.claude
.husky
.vscode
coverage
deploy
dist
docs
e2e
node_modules
*.md
Dockerfile
.dockerignore
```

- [ ] **Step 3: Build, run read-only and check**

```bash
docker build --pull -t ghcr.io/obichris11/bubble-breaker:latest .
docker run -d --name bb-test -p 127.0.0.1:18080:8080 --read-only --tmpfs /tmp \
  --cap-drop ALL --security-opt no-new-privileges:true ghcr.io/obichris11/bubble-breaker:latest
sleep 3 && docker inspect -f '{{.State.Health.Status}}' bb-test
npm run check:container
docker image ls ghcr.io/obichris11/bubble-breaker
docker rm -f bb-test
```

Expected: the build runs `npm ci` (476 packages; `> husky` prints nothing else) and the Angular build with the same sizes; health `healthy`; `Container check passed for http://127.0.0.1:18080 (85 checks)`; the image is **30.1 MB** on disk, **8.5 MB** content size. (Reference: about 30 s with a warm npm cache in the session.)

- [ ] **Step 4: Commit**

```bash
git add nginx Dockerfile .dockerignore
git commit -m "feat(deploy): container image with nginx caching, routing and security headers"
```

---

### Task 4: Compose file for the NAS

**Files:**
- Create: `deploy/compose.yml`

- [ ] **Step 1: Write it**

`deploy/compose.yml`:

```yaml
# Bubble Breaker on the NAS (06-deployment "Runtime"). Lives in /volume1/docker/bubble-breaker/
# next to update.sh. To roll back, pin `image:` to a released X.Y.Z instead of latest.
name: bubble-breaker
services:
  bubble-breaker:
    image: ghcr.io/obichris11/bubble-breaker:latest
    container_name: bubble-breaker
    restart: unless-stopped
    ports:
      - '127.0.0.1:18080:8080' # only the DSM reverse proxy can reach it
    read_only: true
    tmpfs:
      - /tmp
    cap_drop: [ALL]
    security_opt: [no-new-privileges:true]
    mem_limit: 64m
    pids_limit: 64
    logging:
      driver: json-file
      options: { max-size: '1m', max-file: '3' }
```

- [ ] **Step 2: Start the Task 3 image with it and check**

```bash
npx prettier --check deploy/compose.yml
docker compose -f deploy/compose.yml config -q
docker compose -f deploy/compose.yml up -d --pull never --wait --wait-timeout 90
npm run check:container
docker stats --no-stream --format '{{.MemUsage}} pids {{.PIDs}}' bubble-breaker
docker compose -f deploy/compose.yml down
```

Expected: Prettier and `config -q` are silent; `up` ends with `Container bubble-breaker Healthy` (about 3 s); `Container check passed … (85 checks)`; about `5.2MiB / 64MiB pids 5`. The read-only root with only `/tmp` writable is enough: the entrypoint scripts skip their edits and nginx writes its pid and temp files to `/tmp`.

- [ ] **Step 3: Commit**

```bash
git add deploy/compose.yml
git commit -m "feat(deploy): compose file for the nas"
```

---

### Task 5: NAS updater (TDD with a stub docker)

**Files:**
- Create: `deploy/update.test.sh`, `deploy/update.sh`
- Modify: `package.json`

**Interfaces:**
- Produces: `bash deploy/update.sh` (env `HEALTH_TIMEOUT`, default 60, and `POLL_SECONDS`, default 2), writing `update.log` and `.update.lock` next to itself; `npm run test:deploy`.

- [ ] **Step 1: Write the failing tests**

`deploy/update.test.sh`:

```bash
#!/usr/bin/env bash
# Tests for deploy/update.sh against a stub `docker` (no daemon needed). CI's `docker` job runs:
#   bash deploy/update.test.sh
# Image ids in the stub are `sha256:<version>`, so the log line shows which version ran.
set -euo pipefail

HERE=$(cd "$(dirname "$0")" && pwd)
failures=0
passed=0

# A fresh folder with a copy of update.sh, a stub docker and its state:
#   remote = id the registry has, local = id after the last pull,
#   running = id of the container's image (absent: no container),
#   health = what the health check reports, no-plugin = no `docker compose`.
setup() {
  WORK=$(mktemp -d)
  mkdir -p "$WORK/bin" "$WORK/state"
  cp "$HERE/update.sh" "$WORK/update.sh"
  cat >"$WORK/bin/docker" <<'STUB'
#!/usr/bin/env bash
S="$STUB_STATE"
echo "docker $*" >>"$S/calls"
case "$*" in
  'compose version') [ ! -f "$S/no-plugin" ] || exit 1 ;;
  'compose config --images') echo ghcr.io/obichris11/bubble-breaker:latest ;;
  'compose pull -q')
    echo ' Image ghcr.io/obichris11/bubble-breaker:latest Pulled' >&2
    [ ! -f "$S/offline" ] || { echo 'Error response from daemon: Get "https://ghcr.io/v2/": dial tcp: i/o timeout' >&2; exit 18; }
    cp "$S/remote" "$S/local" ;;
  'compose up -d --remove-orphans') cp "$S/local" "$S/running" ;;
  'image inspect -f {{.Id}} ghcr.io/obichris11/bubble-breaker:latest') cat "$S/local" ;;
  'inspect -f {{.Image}} bubble-breaker') cat "$S/running" 2>/dev/null || exit 1 ;;
  'inspect -f {{.State.Health.Status}} bubble-breaker') cat "$S/health" ;;
  'image inspect -f {{index .Config.Labels "org.opencontainers.image.version"}} sha256:'*)
    id=${!#}
    echo "${id#sha256:}" ;;
  'image prune -f --filter label=org.opencontainers.image.source=https://github.com/Obichris11/bubble-breaker') ;;
  'logs --tail 50 bubble-breaker') echo 'nginx: [emerg] example' ;;
  *) echo "unexpected: docker $*" >&2; exit 99 ;;
esac
STUB
  cat >"$WORK/bin/docker-compose" <<'STUB'
#!/usr/bin/env bash
echo "docker-compose $*" >>"$STUB_STATE/calls"
exec docker compose "$@"
STUB
  chmod +x "$WORK/bin/docker" "$WORK/bin/docker-compose"
  export STUB_STATE="$WORK/state"
  echo healthy >"$WORK/state/health"
}

run_update() {
  set +e
  PATH="$WORK/bin:$PATH" HEALTH_TIMEOUT=2 POLL_SECONDS=1 bash "$WORK/update.sh" \
    >"$WORK/stdout" 2>"$WORK/stderr"
  status=$?
  set -e
}

check() {
  local name=$1
  shift
  if "$@"; then
    passed=$((passed + 1))
  else
    failures=$((failures + 1))
    echo "FAIL: $name" >&2
    echo "  calls: $(tr '\n' ';' <"$WORK/state/calls" 2>/dev/null)" >&2
    echo "  log: $(tail -n 2 "$WORK/update.log" 2>/dev/null | tr '\n' ';')" >&2
  fi
}

called() { grep -qxF "$1" "$WORK/state/calls" 2>/dev/null; }
not_called() { ! grep -qF "$1" "$WORK/state/calls" 2>/dev/null; }
logged() { tail -n 1 "$WORK/update.log" | grep -qE "^[0-9TZ:-]+ $1\$"; }
exited() { [ "$status" -eq "$1" ]; }
no_log() { [ ! -e "$WORK/update.log" ]; }

# 1. Nothing new: no redeploy, no log line, no output.
setup
echo sha256:2.0.0 >"$WORK/state/remote"
echo sha256:2.0.0 >"$WORK/state/running"
run_update
check 'unchanged exits 0' exited 0
check 'unchanged pulls' called 'docker compose pull -q'
check 'unchanged does not redeploy' not_called 'compose up'
check 'unchanged writes no log' no_log
check 'unchanged is silent' test ! -s "$WORK/stdout" -a ! -s "$WORK/stderr"

# 2. Nothing new, but the running container is unhealthy: keep failing until it is fixed.
setup
echo sha256:2.0.1 >"$WORK/state/remote"
echo sha256:2.0.1 >"$WORK/state/running"
echo unhealthy >"$WORK/state/health"
run_update
check 'unhealthy and unchanged exits 1' exited 1
check 'unhealthy and unchanged says so' grep -q 'bubble-breaker 2.0.1 is unhealthy' "$WORK/stderr"
check 'unhealthy and unchanged does not redeploy' not_called 'compose up'

# 3. A new release: redeploy, wait for healthy, prune this repo's images, log the versions.
setup
echo sha256:2.0.1 >"$WORK/state/remote"
echo sha256:2.0.0 >"$WORK/state/running"
run_update
check 'update exits 0' exited 0
check 'update redeploys' called 'docker compose up -d --remove-orphans'
check 'update prunes by source label' called \
  'docker image prune -f --filter label=org.opencontainers.image.source=https://github.com/Obichris11/bubble-breaker'
check 'update logs old -> new' logged '2.0.0 -> 2.0.1'

# 4. The new container never becomes healthy: exit 1 for the DSM email, keep old images.
setup
echo sha256:2.0.1 >"$WORK/state/remote"
echo sha256:2.0.0 >"$WORK/state/running"
echo starting >"$WORK/state/health"
run_update
check 'unhealthy exits 1' exited 1
check 'unhealthy logs the failure' logged 'FAILED 2.0.0 -> 2.0.1: not healthy after 2s'
check 'unhealthy explains on stderr' grep -q 'did not become healthy within 2s' "$WORK/stderr"
check 'unhealthy shows container logs' grep -q 'nginx: \[emerg\] example' "$WORK/stderr"
check 'unhealthy does not prune' not_called 'image prune'

# 5. First run on the NAS: no container yet.
setup
echo sha256:2.0.0 >"$WORK/state/remote"
run_update
check 'first run exits 0' exited 0
check 'first run deploys' called 'docker compose up -d --remove-orphans'
check 'first run logs none -> version' logged 'none -> 2.0.0'

# 6. Rollback: compose.yml pins an older tag, which differs from the running image.
setup
echo sha256:2.0.0 >"$WORK/state/remote"
echo sha256:2.0.1 >"$WORK/state/running"
run_update
check 'rollback redeploys' called 'docker compose up -d --remove-orphans'
check 'rollback logs new -> old' logged '2.0.1 -> 2.0.0'

# 7. A run that is still busy holds the lock: the next one exits 0 without pulling.
setup
echo sha256:2.0.1 >"$WORK/state/remote"
: >"$WORK/.update.lock"
flock "$WORK/.update.lock" sleep 3 &
holder=$!
sleep 0.5
run_update
wait "$holder"
check 'locked exits 0' exited 0
check 'locked does not pull' not_called 'pull'

# 8. Without the compose plugin, the standalone docker-compose binary is used.
setup
echo sha256:2.0.1 >"$WORK/state/remote"
echo sha256:2.0.0 >"$WORK/state/running"
touch "$WORK/state/no-plugin"
run_update
check 'fallback exits 0' exited 0
check 'fallback uses docker-compose' called 'docker-compose pull -q'

# 9. The registry cannot be reached: exit 1 with docker's error, nothing else runs.
setup
echo sha256:2.0.1 >"$WORK/state/remote"
echo sha256:2.0.0 >"$WORK/state/running"
touch "$WORK/state/offline"
run_update
check 'offline exits 1' exited 1
check 'offline shows the pull error' grep -q 'i/o timeout' "$WORK/stderr"
check 'offline does not redeploy' not_called 'compose up'

# 10. The log keeps its last 500 lines.
setup
echo sha256:2.0.1 >"$WORK/state/remote"
echo sha256:2.0.0 >"$WORK/state/running"
for i in $(seq 1 600); do echo "old line $i"; done >"$WORK/update.log"
run_update
check 'log is trimmed to 500 lines' test "$(wc -l <"$WORK/update.log")" -eq 500
check 'log keeps the newest line' logged '2.0.0 -> 2.0.1'

if [ "$failures" -gt 0 ]; then
  echo "update.sh: $failures failed, $passed passed" >&2
  exit 1
fi
echo "update.sh: $passed checks passed"
```

In `package.json`, add after `"check:container"`:

```json
    "test:deploy": "bash deploy/update.test.sh",
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm run test:deploy`
Expected: FAIL (exit 1) with `cp: cannot stat '…/deploy/update.sh': No such file or directory`.

- [ ] **Step 3: Implement**

`deploy/update.sh`:

```bash
#!/usr/bin/env bash
# Redeploys Bubble Breaker when the configured image changed (06-deployment "Updater").
# DSM Task Scheduler runs it as root every 15 minutes:
#   bash /volume1/docker/bubble-breaker/update.sh
# Silent when nothing changed; exits 1 (so DSM sends an email) when a deploy fails.
set -euo pipefail

cd "$(dirname "$0")"
# DSM tasks run with a minimal PATH; docker lives in /usr/local/bin there.
export PATH="${PATH}:/usr/local/bin:/usr/bin:/bin"

CONTAINER=bubble-breaker
SOURCE_LABEL=org.opencontainers.image.source=https://github.com/Obichris11/bubble-breaker
HEALTH_TIMEOUT=${HEALTH_TIMEOUT:-60}
POLL_SECONDS=${POLL_SECONDS:-2}
LOG=update.log

# One run at a time: a slow pull must not overlap the next scheduled run.
exec 9>.update.lock
flock -n 9 || exit 0

if docker compose version >/dev/null 2>&1; then
  compose() { docker compose "$@"; }
else
  compose() { docker-compose "$@"; }
fi

log() {
  printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" >>"$LOG"
  tail -n 500 "$LOG" >"$LOG.tmp" && mv "$LOG.tmp" "$LOG"
}

version_of() {
  local version
  version=$(docker image inspect \
    -f '{{index .Config.Labels "org.opencontainers.image.version"}}' "$1" 2>/dev/null || true)
  echo "${version:-unknown}"
}

health() {
  docker inspect -f '{{.State.Health.Status}}' "$CONTAINER" 2>/dev/null || true
}

image=$(compose config --images | head -n 1)
# `pull -q` still reports progress on stderr; show it only when the pull fails.
if ! pulled=$(compose pull -q 2>&1); then
  echo "$pulled" >&2
  exit 1
fi
wanted=$(docker image inspect -f '{{.Id}}' "$image")
running=$(docker inspect -f '{{.Image}}' "$CONTAINER" 2>/dev/null || true)
if [ "$wanted" = "$running" ]; then
  # Keep failing (one email per run) while a deployed container is unhealthy.
  if [ "$(health)" = unhealthy ]; then
    echo "bubble-breaker $(version_of "$running") is unhealthy" >&2
    docker logs --tail 50 "$CONTAINER" >&2 || true
    exit 1
  fi
  exit 0
fi

from=none
if [ -n "$running" ]; then
  from=$(version_of "$running")
fi
to=$(version_of "$wanted")

compose up -d --remove-orphans
waited=0
until [ "$(health)" = healthy ]; do
  if [ "$waited" -ge "$HEALTH_TIMEOUT" ]; then
    log "FAILED ${from} -> ${to}: not healthy after ${HEALTH_TIMEOUT}s"
    echo "bubble-breaker ${to} did not become healthy within ${HEALTH_TIMEOUT}s" >&2
    docker logs --tail 50 "$CONTAINER" >&2 || true
    exit 1
  fi
  sleep "$POLL_SECONDS"
  waited=$((waited + POLL_SECONDS))
done

# Only dangling images of this repo: a pinned rollback tag stays.
docker image prune -f --filter "label=${SOURCE_LABEL}" >/dev/null
log "${from} -> ${to}"
```

```bash
chmod +x deploy/update.sh deploy/update.test.sh
```

- [ ] **Step 4: Run tests and shellcheck**

```bash
npm run test:deploy
docker run --rm -v "$PWD:/repo" -w /repo --entrypoint shellcheck \
  rhysd/actionlint:1.7.12@sha256:b1934ee5f1c509618f2508e6eb47ee0d3520686341fec936f3b79331f9315667 deploy/update.sh deploy/update.test.sh
```

Expected: `update.sh: 31 checks passed` (about 6 s: two scenarios wait for the 2 s health timeout, one for the 3 s lock); shellcheck prints nothing and exits 0.

- [ ] **Step 5: Commit**

```bash
git add deploy/update.sh deploy/update.test.sh package.json
git commit -m "feat(deploy): nas updater with health gate, lock and failure email"
```

---

### Task 6: CI `docker` job and Dependabot for base images

**Files:**
- Modify: `.github/workflows/ci.yml`, `.github/dependabot.yml`

- [ ] **Step 1: Add the job**

Append to `.github/workflows/ci.yml` (after job `build`):

```yaml

  docker:
    name: docker
    runs-on: ubuntu-latest
    permissions:
      contents: read
    env:
      ACTIONLINT: rhysd/actionlint:1.7.12@sha256:b1934ee5f1c509618f2508e6eb47ee0d3520686341fec936f3b79331f9315667
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
      - uses: actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1 # v7.1.0
        with:
          node-version-file: .nvmrc
      - name: Lint workflows
        run: docker run --rm -v "$PWD:/repo" -w /repo "$ACTIONLINT" -color
      - name: Lint and test the NAS updater
        run: |
          docker run --rm -v "$PWD:/repo" -w /repo --entrypoint shellcheck "$ACTIONLINT" deploy/*.sh
          npm run test:deploy
      - name: Build the image
        run: docker build --pull -t ghcr.io/obichris11/bubble-breaker:latest .
      - name: Start it with deploy/compose.yml
        run: docker compose -f deploy/compose.yml up -d --pull never --wait --wait-timeout 90
      - name: Check health, caching, routing and headers
        run: npm run check:container
      - name: Container logs
        if: failure()
        run: docker compose -f deploy/compose.yml logs
```

(The job needs no `npm ci`: the two npm scripts have no dependencies.)

Append to `.github/dependabot.yml`:

```yaml

  - package-ecosystem: docker
    directory: /
    schedule:
      interval: weekly
    commit-message:
      prefix: chore
      include: scope
    groups:
      base-images:
        patterns: ['*']
```

- [ ] **Step 2: Lint and run the job's steps locally**

```bash
npx prettier --check .github
docker run --rm -v "$PWD:/repo" -w /repo rhysd/actionlint:1.7.12@sha256:b1934ee5f1c509618f2508e6eb47ee0d3520686341fec936f3b79331f9315667 -color
npm run test:deploy
docker build --pull -t ghcr.io/obichris11/bubble-breaker:latest .
docker compose -f deploy/compose.yml up -d --pull never --wait --wait-timeout 90
npm run check:container
docker compose -f deploy/compose.yml down
```

Expected: Prettier passes; actionlint prints nothing (exit 0); `update.sh: 31 checks passed`; `Container bubble-breaker Healthy`; `Container check passed … (85 checks)`. To see actionlint work, rename `id: build` in Task 7's `release.yml` for a moment: it reports `property "build" is not defined in object type {…}` at every `steps.build.outputs.digest`.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml .github/dependabot.yml
git commit -m "ci: docker job builds, runs and checks the image; dependabot for base images"
```

---

### Task 7: release-please and the release workflow

**Files:**
- Create: `release-please-config.json`, `.release-please-manifest.json`, `.github/workflows/release.yml`
- Modify: `.prettierignore`

- [ ] **Step 1: release-please config**

`release-please-config.json`:

```json
{
  "$schema": "https://raw.githubusercontent.com/googleapis/release-please/main/schemas/config.json",
  "release-type": "node",
  "include-component-in-tag": false,
  "initial-version": "2.0.0",
  "bootstrap-sha": "f16fc4d4add06b8ac854243b11985fd3d61941b3",
  "packages": {
    ".": {
      "package-name": "bubble-breaker",
      "changelog-path": "CHANGELOG.md",
      "extra-files": ["src/app/version.ts"]
    }
  }
}
```

`.release-please-manifest.json`:

```json
{}
```

Append `CHANGELOG.md` to `.prettierignore`.

- [ ] **Step 2: Verify the config and the version bumps (scratch, not committed)**

In a scratch folder outside the repo: `npm init -y && npm i release-please@17.11.2 ajv@8`, then save as `check-release.cjs` and run `node check-release.cjs <repo>`:

```js
// Plan 07 scratch check (not committed): the config matches release-please's schema, and its
// updaters turn version.ts, package.json and package-lock.json into 2.0.0.
const fs = require('node:fs');
const Ajv = require('ajv');
const { Generic } = require('release-please/build/src/updaters/generic');
const { PackageJson } = require('release-please/build/src/updaters/node/package-json');
const { PackageLockJson } = require('release-please/build/src/updaters/node/package-lock-json');
const { Version } = require('release-please/build/src/version');

const repo = process.argv[2];
const read = (file) => fs.readFileSync(`${repo}/${file}`, 'utf8');
const ajv = new Ajv({ strict: false, allErrors: true, logger: false });
const valid = ajv.validate(require('release-please/schemas/config.json'), JSON.parse(read('release-please-config.json')));
console.log('schema valid', valid, valid ? '' : JSON.stringify(ajv.errors));
const version = Version.parse('2.0.0');
process.stdout.write(new Generic({ version }).updateContent(read('src/app/version.ts')));
const pkg = JSON.parse(new PackageJson({ version }).updateContent(read('package.json')));
const lock = JSON.parse(new PackageLockJson({ version }).updateContent(read('package-lock.json')));
console.log('package.json', pkg.version, 'lock', lock.version, lock.packages[''].version);
```

Expected:

```text
schema valid true
/** Shown on the About screen. release-please bumps it together with package.json (Plan 07). */
export const VERSION = '2.0.0'; // x-release-please-version
✔ updating from 0.0.0 to 2.0.0
✔ updating from 0.0.0 to 2.0.0
package.json 2.0.0 lock 2.0.0 2.0.0
```

The choice of 2.0.0 itself (empty manifest → no backfill from tags → `initial-version`; commit walk stops at `bootstrap-sha`) was read from release-please 17.11.2's `strategies/base.js` (`buildNewVersion`) and `manifest.js` (`backfillReleasesFromTags`, `bootstrapSha`). It needs the GitHub API to run for real; the first release PR proves it (Part 2, D1).

- [ ] **Step 3: The workflow**

`.github/workflows/release.yml`:

```yaml
name: Release

on:
  push:
    branches: [main]

permissions: {}

# A release that has started always finishes; the next push waits.
concurrency:
  group: release
  cancel-in-progress: false

jobs:
  release-please:
    name: release-please
    runs-on: ubuntu-latest
    permissions:
      contents: read
    outputs:
      created: ${{ steps.release.outputs.release_created }}
      version: ${{ steps.release.outputs.version }}
    steps:
      # The PAT (not GITHUB_TOKEN) opens the release PR, so the PR's required checks run (05-cicd).
      - uses: googleapis/release-please-action@45996ed1f6d02564a971a2fa1b5860e934307cf7 # v5.0.0
        id: release
        with:
          token: ${{ secrets.RELEASE_PLEASE_TOKEN }}
          config-file: release-please-config.json
          manifest-file: .release-please-manifest.json

  image:
    name: image
    needs: release-please
    if: needs.release-please.outputs.created == 'true'
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
      id-token: write
      attestations: write
      security-events: write
    env:
      IMAGE: ghcr.io/obichris11/bubble-breaker
      VERSION: ${{ needs.release-please.outputs.version }}
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
      - uses: docker/setup-buildx-action@f87e5991a6d7451dcb8d9637bfbc97413f497069 # v4.4.1
      - uses: docker/login-action@81c6f93d4bc991e510b342a00b419b3bb4efc5c6 # v4.7.0
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/metadata-action@dc802804100637a589fabce1cb79ff13a1411302 # v6.2.0
        id: meta
        with:
          images: ${{ env.IMAGE }}
          tags: |
            type=semver,pattern={{version}},value=v${{ env.VERSION }}
            type=semver,pattern={{major}}.{{minor}},value=v${{ env.VERSION }}
            type=raw,value=latest
            type=sha
      - name: Short commit sha (as metadata-action's type=sha)
        id: sha
        run: echo "short=${GITHUB_SHA::7}" >>"$GITHUB_OUTPUT"
      # Push only the sha tag first: the release tags and :latest move after the scan.
      - uses: docker/build-push-action@c3c9e263c25d99ce0380d002d59b67737d91b0dc # v7.4.0
        id: build
        with:
          context: .
          platforms: linux/amd64
          push: true
          tags: ${{ env.IMAGE }}:sha-${{ steps.sha.outputs.short }}
          labels: ${{ steps.meta.outputs.labels }}
          provenance: mode=max
          sbom: true
      - name: Scan for fixable CRITICAL and HIGH vulnerabilities
        uses: aquasecurity/trivy-action@ed142fd0673e97e23eac54620cfb913e5ce36c25 # v0.36.0
        with:
          image-ref: ${{ env.IMAGE }}@${{ steps.build.outputs.digest }}
          severity: CRITICAL,HIGH
          ignore-unfixed: true
          exit-code: '1'
          format: sarif
          output: trivy.sarif
        env:
          TRIVY_USERNAME: ${{ github.actor }}
          TRIVY_PASSWORD: ${{ secrets.GITHUB_TOKEN }}
      - uses: github/codeql-action/upload-sarif@9b3254085494b55a0f7c4c2b3d2d52cc712ce370 # v4.39.1
        if: always() && hashFiles('trivy.sarif') != ''
        with:
          sarif_file: trivy.sarif
          category: trivy-image
      - name: Tag the scanned image as X.Y.Z, X.Y, latest and sha-<short>
        env:
          TAGS: ${{ steps.meta.outputs.tags }}
          DIGEST: ${{ steps.build.outputs.digest }}
        run: |
          args=()
          while read -r tag; do
            [ -n "$tag" ] && args+=(--tag "$tag")
          done <<<"$TAGS"
          docker buildx imagetools create "${args[@]}" "${IMAGE}@${DIGEST}"
      - uses: actions/attest-build-provenance@4d101475d8b20a2381f78447822ac1eab6504dd8 # v4.2.2
        with:
          subject-name: ${{ env.IMAGE }}
          subject-digest: ${{ steps.build.outputs.digest }}
          push-to-registry: true
```

- [ ] **Step 4: Lint**

```bash
npx prettier --check release-please-config.json .release-please-manifest.json .github
docker run --rm -v "$PWD:/repo" -w /repo rhysd/actionlint:1.7.12@sha256:b1934ee5f1c509618f2508e6eb47ee0d3520686341fec936f3b79331f9315667 -color
npm run check
```

Expected: Prettier passes, actionlint prints nothing, `npm run check` exits 0 (49 files, 364 tests).

- [ ] **Step 5: Commit**

```bash
git add release-please-config.json .release-please-manifest.json .prettierignore .github/workflows/release.yml
git commit -m "ci: release-please and an image workflow that tags only what trivy passed"
```

---

### Task 8: Dry run (browser through the container, Trivy, release rehearsal)

**Files:** none committed. Scripts live in the session scratchpad; the registry and containers are removed at the end.

- [ ] **Step 1: Start the container**

```bash
docker build --pull -t ghcr.io/obichris11/bubble-breaker:latest .
docker compose -f deploy/compose.yml up -d --pull never --wait --wait-timeout 90
curl -sI http://127.0.0.1:18080/
```

Expected headers (reference run):

```text
HTTP/1.1 200 OK
Server: nginx
Content-Type: text/html
Cache-Control: no-cache
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; worker-src 'self'; manifest-src 'self'; base-uri 'self'; form-action 'none'; frame-ancestors 'none'
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()
Cross-Origin-Opener-Policy: same-origin
```

- [ ] **Step 2: Browser check with the service worker**

Save as `browser-check.cjs` in the scratchpad and run `node <scratchpad>/browser-check.cjs http://localhost:18080` (`localhost`, so the worker registers over plain HTTP):

```js
// Plan 07 browser check (scratch file, not committed): the container from deploy/compose.yml on
// port 18080, with its real headers. Reports CSP violations with the service worker active,
// offline reload and deep link through the worker, and Chromium's installability errors.
const { chromium } = require('playwright');

const BASE = process.argv[2] ?? 'http://localhost:18080';

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 360, height: 640 },
    isMobile: true,
    hasTouch: true,
  });
  const violations = [];
  const errors = [];
  await context.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (e) => {
      (window.__csp ??= []).push(`${e.effectiveDirective} ${e.blockedURI}`);
    });
  });
  context.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(BASE);
  await page.waitForSelector('[role=application]');
  const styles = await page.$eval('link[rel=stylesheet]', (l) => l.media || 'all');
  const font = await page.evaluate(async () => {
    await document.fonts.ready;
    return document.fonts.check('13px "Noto Sans"');
  });
  await page.getByText('Ready to play offline.').waitFor({ timeout: 90_000 });
  const controlled = await page.evaluate(() => navigator.serviceWorker.controller !== null);
  violations.push(...(await page.evaluate(() => window.__csp ?? [])));
  console.log('online: stylesheet media', styles, 'font loaded', font, 'worker controls page', controlled);

  await context.setOffline(true);
  await page.reload();
  await page.waitForSelector('[role=application]');
  violations.push(...(await page.evaluate(() => window.__csp ?? [])));
  const board = await page.$eval('[role=application]', (el) => {
    const r = el.getBoundingClientRect();
    return `${Math.round(r.width)}x${Math.round(r.height)}`;
  });
  await page.goto(`${BASE}/about`);
  const heading = await page.getByRole('heading', { level: 1 }).textContent();
  violations.push(...(await page.evaluate(() => window.__csp ?? [])));
  console.log('offline: reload board', board, '/about heading', heading);
  await context.setOffline(false);

  const cdp = await context.newCDPSession(page);
  const { installabilityErrors } = await cdp.send('Page.getInstallabilityErrors');
  console.log('installability errors', JSON.stringify(installabilityErrors));
  console.log('CSP violations', JSON.stringify(violations));
  console.log('console errors', JSON.stringify(errors));
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

Expected (reference run, about 10 s):

```text
online: stylesheet media all font loaded true worker controls page true
offline: reload board 352x384 /about heading About
installability errors []
CSP violations []
console errors []
```

For comparison, the same check against an image built from `main` before Task 2 printed `stylesheet media print` and `CSP violations ["script-src-elem inline","script-src-elem inline","script-src-elem inline"]`, with three console errors `Executing inline script violates the following Content Security Policy directive 'script-src 'self''…`. What it proves: under the real headers the app, its fonts, the manifest and the worker load with no CSP violation; the worker caches the app ("Ready to play offline."), and the reload and the `/about` deep link work offline through the container.

- [ ] **Step 3: Trivy on the image**

```bash
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock aquasec/trivy:0.70.0 \
  image -q --severity CRITICAL,HIGH --ignore-unfixed --exit-code 1 ghcr.io/obichris11/bubble-breaker:latest
```

(In a cloud session add the proxy flags from the note at the top.) Expected: exit 0 and the summary row `ghcr.io/obichris11/bubble-breaker:latest (alpine 3.24.2) │ alpine │ 0`. The same scan on an image built from `nginxinc/nginx-unprivileged:stable-alpine` (2026-10-29 digest `f5116ed4…`) exits 1 with `Total: 3 (HIGH: 2, CRITICAL: 1)`: brotli-libs 1.2.0-r1 → 1.2.1-r0, curl and libcurl 8.22.0-r0 → 8.23.0-r0. If a new finding appears in the slim base by the time you run this, bump the digest (`docker pull nginxinc/nginx-unprivileged:stable-alpine-slim` and take its RepoDigest) before going on.

- [ ] **Step 4: Release rehearsal against a local registry**

```bash
docker compose -f deploy/compose.yml down
docker run -d --name reg -p 127.0.0.1:5000:5000 registry:2
R=localhost:5000/obichris11/bubble-breaker
docker buildx build --platform linux/amd64 --provenance=mode=max --sbom=true \
  --label org.opencontainers.image.version=2.0.0 \
  --label org.opencontainers.image.source=https://github.com/Obichris11/bubble-breaker \
  --push -t "$R:sha-1bc7cb5" --metadata-file /tmp/meta.json .
DIGEST=$(jq -r '."containerimage.digest"' /tmp/meta.json)
docker run --rm --network host aquasec/trivy:0.70.0 image -q --insecure --severity CRITICAL,HIGH \
  --ignore-unfixed --exit-code 1 "$R@$DIGEST"
IMAGE=$R TAGS="$R:2.0.0
$R:2.0
$R:latest
$R:sha-1bc7cb5"
args=(); while read -r tag; do [ -n "$tag" ] && args+=(--tag "$tag"); done <<<"$TAGS"
docker buildx imagetools create "${args[@]}" "${IMAGE}@${DIGEST}"
for t in 2.0.0 2.0 latest sha-1bc7cb5; do docker buildx imagetools inspect "$R:$t" --format "$t {{json .Manifest.Digest}}"; done
```

(Pushing attestations needs the containerd image store, as in the cloud session, or a `docker-container` builder: `docker buildx create --use` first.) Expected: the push succeeds; Trivy exits 0; all four tags print the same digest; `imagetools inspect "$R:latest"` shows an OCI index with the `linux/amd64` image and an `unknown/unknown` attestation manifest (provenance + SBOM). This is the `image` job's shell logic; the GitHub-only parts (metadata-action's exact tags and labels, GHCR login, SARIF upload, the attestation) run for the first time in Part 2, D2.

- [ ] **Step 5: Updater against real Docker (optional, same registry)**

Push two labelled images (`2.0.0`, `2.0.1`) to `localhost:5000/bb`, copy `update.sh` and a `compose.yml` whose `image:` is `localhost:5000/bb:latest` to a scratch folder, and run `bash update.sh` after each change of `:latest`. Reference run: first run logs `none -> 2.0.0`, a second run is silent (exit 0), after moving `:latest` to 2.0.1 it logs `2.0.0 -> 2.0.1` and prunes the old image; an image with `HEALTHCHECK CMD false` exits 1 with `did not become healthy within 10s` (with `HEALTH_TIMEOUT=10`) and the next run exits 1 with `is unhealthy`; pinning `image:` to `:2.0.1` rolls back (`2.0.2 -> 2.0.1`, healthy). Then `docker compose -f <scratch>/compose.yml down && docker rm -f reg`.

---

### Task 9: Docs sync

**Files:**
- Modify: `docs/03-architecture.md`, `docs/04-quality.md`, `docs/05-cicd.md`, `docs/06-deployment.md`, `docs/superpowers/specs/2026-09-27-bubble-breaker-rewrite-design.md`

- [ ] **Step 1: `docs/03-architecture.md`**

In "Folder layout", replace the paragraph below the code block with: "Outside `src/`: `ngsw-config.json` (service-worker asset groups), `public/manifest.webmanifest` and `public/icons/` (drawn by `scripts/make-icons.mjs`), `scripts/check-pwa.mjs` and `scripts/check-container.mjs` (CI checks of the build and of the running image), `Dockerfile` + `nginx/default.conf` (the image), `deploy/` (`compose.yml`, `update.sh` + `update.test.sh` for the NAS), and `release-please-config.json` (releases)."

- [ ] **Step 2: `docs/04-quality.md`**

In "Gates", add after the PWA build check row:

```markdown
| Container check | `npm run check:container` against the image started with `deploy/compose.yml`: `/health`, cache rules, SPA fallback and real 404s, security headers, no inline script in `index.html` | CI (`docker`) |
| Workflows and NAS updater | actionlint + shellcheck (pinned `rhysd/actionlint` image); `npm run test:deploy` (updater against a stub docker) | CI (`docker`) |
| Image vulnerabilities | Trivy: no fixable CRITICAL/HIGH, before any release tag moves | `release.yml` (`image`) |
```

- [ ] **Step 3: `docs/05-cicd.md`**

1. "Versioning": replace "The app version shown on the About screen is injected at build time from `package.json`." with:

```markdown
- release-please bumps `package.json`, `package-lock.json` and `src/app/version.ts` (the line marked `x-release-please-version`); the About screen shows `VERSION`.
- Config: `release-please-config.json` (`release-type: node`, tags `vX.Y.Z`, `initial-version: 2.0.0`, `bootstrap-sha` = `v0-legacy`) and `.release-please-manifest.json` (`{}` until the first release). The legacy tags `v1.1.x` have no GitHub Releases and are not in the manifest, so the first release is 2.0.0 and its changelog starts after the legacy code. `CHANGELOG.md` is generated; Prettier ignores it.
```

2. `ci.yml` table, row `docker`: Needs "–"; Steps "actionlint + shellcheck · `npm run test:deploy` · `docker build` · `docker compose -f deploy/compose.yml up --wait` (the NAS settings) · `npm run check:container` (health, cache rules, SPA fallback and 404s, headers, no inline script)". Add below the table: "`docker` builds the app inside the image (multi-stage), so it does not wait for `build`."
3. `release.yml`: replace step 2's permissions with "`contents: read`, `packages: write`, `id-token: write`, `attestations: write`, `security-events: write`" and its sub-steps 3–5 with:

```markdown
   3. Push only `:sha-<short>`, with `provenance: mode=max` and `sbom: true`.
   4. Trivy (`aquasecurity/trivy-action`, Trivy 0.70) scans that digest. It fails on fixable `CRITICAL`/`HIGH`; the SARIF goes to code scanning (category `trivy-image`).
   5. Only a clean digest gets `X.Y.Z`, `X.Y` and `latest` (`docker buildx imagetools create`), then `actions/attest-build-provenance`. A failed scan leaves the GitHub Release but not `:latest`; fix forward with a patch release.
```

   and add "`concurrency: release`, never cancelled." after step 3 ("The NAS picks up `:latest`").
4. Token caveat and "Secrets & tokens": the PAT's permissions are "`contents`, `issues` and `pull-requests` read/write" (release-please manages its `autorelease:` labels).
5. `dependabot.yml` table, docker row: "weekly | one group `base-images` (digests of `node:24-alpine` and `nginx-unprivileged:stable-alpine-slim`)".
6. "One-time manual steps": add "6. After the Plan 07 PR merged and `docker` reported on `main`, add `docker` to the ruleset's required checks (Plan 07, Part 2, B2)."

- [ ] **Step 4: `docs/06-deployment.md`**

1. "Image" table, runtime row: base "`nginxinc/nginx-unprivileged:stable-alpine-slim` (digest-pinned)"; does "Copies `dist/bubble-breaker/browser` and `nginx/default.conf` (as `/etc/nginx/conf.d/default.conf`; the image's `nginx.conf` keeps pid and temp files in `/tmp`); runs as uid 101 on port **8080**". Below the table:
   - replace the `HEALTHCHECK` bullet with "`HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --start-interval=2s CMD wget -qO- http://127.0.0.1:8080/health || exit 1` (`--start-interval` needs Docker ≥ 25; older engines run the first check after 30 s).";
   - add "The slim variant (21 Alpine packages, no curl) keeps Trivy clean: on 2026-10-29 `stable-alpine` had fixable CRITICAL/HIGH findings in brotli-libs and curl. The image is 30 MB on disk, 8.5 MB compressed.";
   - `.dockerignore` bullet: "excludes `.git`, `.github`, `.angular`, `.claude`, `.husky`, `.vscode`, `coverage`, `deploy`, `dist`, `docs`, `e2e`, `node_modules`, `*.md`";
   - local check: "`docker build -t ghcr.io/obichris11/bubble-breaker:latest . && docker compose -f deploy/compose.yml up -d --pull never --wait && npm run check:container`".
2. Heading "## nginx (`nginx.conf`)" → "## nginx (`nginx/default.conf`)". In **Caching**, change the second row to "Hashed bundles `*-<HASH>.js/css`, `/media/*`" and the third to "Fonts, icons, favicon (`/fonts/*`, `/icons/*`, `/favicon.ico`; same names in every release) | `public, max-age=604800`". Add below the table: "`Cache-Control` is sent on successful responses only, so errors are never cached. The manifest is served as `application/manifest+json`."
3. **Routing**: "A missing file with an extension (any last path segment with a dot, e.g. `/x.js`, `/about.txt`) → real **404**, never index.html."
4. **Security headers**: replace the "`script-src 'self'` needs no inline scripts…" bullet with "`script-src 'self'` allows no inline script, so production builds set `optimization.styles.inlineCritical: false`: critical-CSS inlining adds an inline `<script>` that swaps the stylesheet's `media`, and under this CSP the stylesheet would stay `media="print"`. `security.autoCsp` does not help: its inline loader scripts are still blocked by the header. `check:container` fails on any inline script or `on*=` attribute in `index.html`; Plan 07's browser check found no CSP violation with the service worker active." Add: "The headers are sent on every response (`always`); `add_header_inherit merge` (nginx ≥ 1.29.3) keeps them in the locations that add `Cache-Control`." Change the last bullet to "CI `docker` job asserts these headers and the cache rules (`scripts/check-container.mjs`, see 05)."
5. **Runtime**: replace the YAML block with the content of `deploy/compose.yml` and the first bullet below it with "Verified in Plan 07: with `read_only` and a tmpfs on `/tmp` the container starts healthy in about 3 s and uses about 5 MiB of RAM and 5 PIDs. `name: bubble-breaker` makes Container Manager and `update.sh` manage the same project."
6. **DSM configuration** and **Updater**: replace both sections' steps with the content of this plan's Part 2, C1–C7 (keep the headings), and replace the `deploy/update.sh` behaviour list with:

```markdown
1. `cd` to its folder, `set -euo pipefail`, append `/usr/local/bin:/usr/bin:/bin` to `PATH`, take `flock -n .update.lock` (a busy run makes the next one exit 0).
2. Use `docker compose`, or `docker-compose` when the plugin is missing.
3. `compose pull -q` (its output is shown only when the pull fails, which exits 1).
4. Compare the running container's image ID with the configured tag's ID. Equal: exit 0 silently, unless the container is `unhealthy`, which exits 1 on every run until it is fixed.
5. Different (new release, rollback pin or first run): `compose up -d --remove-orphans`, then wait up to 60 s for `healthy`. Not healthy: log `FAILED <old> -> <new>`, print the last 50 container log lines, **exit 1** (DSM emails). Healthy: prune dangling images with this repo's source label and log `<old> -> <new>` (`none` on the first run).
6. `update.log` keeps the last 500 lines.
```

7. **Monitoring**: "The updater emails on a failed pull, on a failed deploy, and on every run while the container is unhealthy."
8. **Release checklist**: item 2 becomes "The `image` job is green: Trivy clean (code scanning, category `trivy-image`), tags `X.Y.Z`, `X.Y`, `latest` on one digest." Add after item 3: "`node scripts/check-container.mjs https://<game-domain> --public` passes (86 checks)."

- [ ] **Step 5: The spec**

In "Key decisions", row **Runtime**: "`nginx-unprivileged` alpine-slim, read-only, localhost-bound, behind DSM reverse proxy". In "Verify during implementation", append to the fallbacks:
- `security.autoCsp` row: "— Plan 07: autoCsp adds inline scripts the header blocks; `inlineCritical` is off";
- writable paths row: "— Plan 07: a tmpfs on `/tmp` is enough";
- DSM docker row: "— `update.sh` falls back by itself; confirm on the NAS (Plan 07 C1)".

- [ ] **Step 6: Check and commit**

```bash
npm run check
git add docs/03-architecture.md docs/04-quality.md docs/05-cicd.md docs/06-deployment.md docs/superpowers/specs/2026-09-27-bubble-breaker-rewrite-design.md
git commit -m "docs: sync architecture, quality, ci/cd, deployment and spec with the container and release"
```

---

### Task 10: Pull request (do not merge)

**Files:**
- Modify: `docs/superpowers/plans/2026-09-27-00-roadmap.md`, this plan (frontmatter)

- [ ] **Step 1: Roadmap**

In the roadmap table set Plan 07's status to `merged — release 2.0.0 pending (Part 2)` and set `status: in-progress` in this plan's frontmatter (Part 2, D3 marks both done).

```bash
git add docs/superpowers/plans
git commit -m "docs: plan 07 code complete, release pending"
```

- [ ] **Step 2: Push and open the PR with the GitHub connector**

```bash
git push -u origin feat/container-release-deploy
```

Open the PR against `main` with the GitHub connector, following `.github/pull_request_template.md`.
- Title: `feat(deploy): container image, release pipeline and nas updater`
- Body:

```markdown
## What
Container, release and deploy (Plan 07). Multi-stage `Dockerfile` (Node build → `nginx-unprivileged` alpine-slim on 8080, health check, digest-pinned bases) and `nginx/default.conf`: no-cache app shell and worker files, immutable hashed bundles, SPA fallback with real 404s, CSP and security headers. `deploy/compose.yml` and `deploy/update.sh` (+ stub-docker tests) for the NAS. CI job `docker`: actionlint, shellcheck, updater tests, image build, start with the real compose file, `scripts/check-container.mjs`. `release.yml`: release-please (first release 2.0.0, bumps `version.ts`) → push `:sha-<short>` → Trivy → `X.Y.Z`/`X.Y`/`latest` → provenance attestation. Production builds no longer inline critical CSS, whose inline script the CSP blocks.

## Why
Plan 07 of the rewrite (docs/superpowers/plans/2026-10-29-07-container-release-deploy.md), spec milestones 7 + 8; 05-cicd and 06-deployment. The plan settles what the docs leave open or contradict: `inlineCritical` off (measured: the inline script left the stylesheet on `media="print"`), alpine-slim base (`stable-alpine` failed Trivy), fonts cached for a week (unhashed), Trivy before tagging, `initial-version` + `bootstrap-sha` for 2.0.0, PAT with issues, updater compares the running image. 03, 04, 05, 06 and the spec are updated.

## Checklist
- [x] Behavior matches docs/01-rules and docs/02-ux (or docs updated / ADR added)
- [x] Tests at the lowest level that proves the behavior
- [x] Keyboard + screen-reader path checked for UI changes (no UI change)
- [x] No new runtime dependency without an ADR (none)

## After merge (user steps)
Part 2 of the plan: B2 add `docker` to the required checks, merge the release PR, B3 make the GHCR package public, C1–C7 on the NAS, D3 mark the plan done.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

- [ ] **Step 3: Poll the checks until they are green**

Poll the PR's check runs with the GitHub connector until all have finished.
Expected: `quality`, `build`, `docker` (new), `pr-title` and both CodeQL analyses pass. `release.yml` does not run on PRs. If one fails, read its log through the connector, fix the cause on the branch (rerun the task's checks before pushing), push, and poll again.

- [ ] **Step 4: Hand over**

Do **not** merge. Report the PR URL, the check results and the Task 8 output; the user does B1 **before** merging (the merge push runs `release.yml`).

---

## Part 2 — User steps (GitHub admin, NAS, first release)

Each step is marked **user step**. Run them in this order; the gh commands run on your machine (`gh auth status` must show admin on the repo).

### B — GitHub (before and after the merge)

- [ ] **B1 (user step, before merging the Plan 07 PR): release token**
  1. github.com → your avatar → Settings → Developer settings → Personal access tokens → **Fine-grained tokens** → Generate new token.
  2. Name `release-please bubble-breaker`; Expiration: custom, one year from today; Resource owner `Obichris11`; Repository access: **Only select repositories** → `Obichris11/bubble-breaker`.
  3. Repository permissions: **Contents** Read and write, **Issues** Read and write, **Pull requests** Read and write (Metadata read-only is added by itself). Generate and copy the token.
  4. Store it and check:

```bash
gh secret set RELEASE_PLEASE_TOKEN --repo Obichris11/bubble-breaker
```

```bash
gh secret list --repo Obichris11/bubble-breaker
```

```bash
gh api repos/Obichris11/bubble-breaker/actions/permissions
```

  Expected: `RELEASE_PLEASE_TOKEN` listed; actions permissions `"enabled":true` and `"allowed_actions":"all"` (if it says `selected`, allow `googleapis/release-please-action`, `docker/*`, `aquasecurity/trivy-action` and `actions/attest-build-provenance`). Put a calendar reminder 2 weeks before the token expires.

- [ ] **B1b (user step): merge the Plan 07 PR** (squash, as usual). The push to `main` runs CI and `release.yml`: job `release-please` opens **"chore(main): release 2.0.0"**; job `image` is skipped.

- [ ] **B2 (user step): require `docker` on `main`** (after `docker` reported on `main` or a PR)

```bash
gh api repos/Obichris11/bubble-breaker/rulesets --jq '.[] | "\(.id) \(.name) \(.target)"'
```

```bash
RULESET_ID=<id of the main branch ruleset from the line above>
```

```bash
gh api repos/Obichris11/bubble-breaker/rulesets/$RULESET_ID > ruleset.json
```

```bash
jq '{name, target, enforcement, conditions, bypass_actors, rules: [.rules[] | if .type == "required_status_checks" then .parameters.required_status_checks |= (. + [((map(select(.context == "build"))[0] // {}) | del(.context)) + {context: "docker"}] | unique_by(.context)) else . end]}' ruleset.json > ruleset-new.json
```

```bash
gh api -X PUT repos/Obichris11/bubble-breaker/rulesets/$RULESET_ID --input ruleset-new.json --jq '.rules[] | select(.type == "required_status_checks") | .parameters.required_status_checks[].context'
```

  Expected: the contexts now include `docker` next to `quality`, `build`, `pr-title` and the CodeQL ones (it copies `build`'s `integration_id`, so only GitHub Actions can satisfy it). Delete `ruleset.json` and `ruleset-new.json`.

- [ ] **B2b (user step): merge the release PR.** Check it first: it changes `CHANGELOG.md` (sections Features / Bug Fixes since the rewrite began), `package.json` and `package-lock.json` to `2.0.0`, `src/app/version.ts` to `'2.0.0'`, and `.release-please-manifest.json` to `{".": "2.0.0"}`; all required checks are green. Merge it (squash). This creates tag `v2.0.0` and the GitHub Release, and runs the `image` job.

- [ ] **B3 (user step, after the `image` job is green): public package and verification**
  1. github.com/Obichris11/bubble-breaker → Packages → `bubble-breaker` → Package settings → Danger Zone → **Change visibility** → Public (type the name to confirm). On the same page check "Connected to repository: Obichris11/bubble-breaker" (from the source label).
  2. Verify anonymously and check the attestation and the scan:

```bash
docker logout ghcr.io; docker pull ghcr.io/obichris11/bubble-breaker:2.0.0
```

```bash
docker buildx imagetools inspect ghcr.io/obichris11/bubble-breaker:latest --format '{{json .Manifest.Digest}}'
```

```bash
gh attestation verify oci://ghcr.io/obichris11/bubble-breaker:2.0.0 --repo Obichris11/bubble-breaker
```

```bash
gh api 'repos/Obichris11/bubble-breaker/code-scanning/alerts?state=open&tool_name=Trivy' --jq length
```

  Expected: the pull works without login; `latest`, `2.0`, `2.0.0` and `sha-<short>` share one digest; the attestation verifies; `0` open Trivy alerts.

### C — NAS (Synology DS224+, DSM 7.2, as of the docs; labels may differ slightly)

`<nas>` is the NAS's LAN name or IP, `<admin>` an administrator account, `<game-domain>` your hostname (never in the repo).

- [ ] **C1 (user step): check the tools.** Control Panel → Terminal & SNMP → enable SSH. Then from your machine:

```bash
ssh -t <admin>@<nas> 'sudo -i sh -c "command -v docker flock; docker version --format {{.Server.Version}}; docker compose version || docker-compose version"'
```

  Expected: `/usr/local/bin/docker` and a `flock` path; a server version (Docker ≥ 25 gets the fast health start, older works with the 30 s first check); a compose v2 version. If `flock` is missing, stop and report: `update.sh` needs it.

- [ ] **C2 (user step): retire the legacy container first** (its name is probably `bubble-breaker` too, which would block the new one). Container Manager → Container → old `bubble-breaker` → Action → Stop, then Delete; Image → delete the old image. Keep its reverse-proxy entry for C6. The site is down from here until C4.

- [ ] **C3 (user step): folder and files.** File Station → shared folder `docker` → Create folder `bubble-breaker`. Copy the two files from your clone of `main`:

```bash
ssh <admin>@<nas> 'cat > /volume1/docker/bubble-breaker/compose.yml' < deploy/compose.yml
```

```bash
ssh <admin>@<nas> 'cat > /volume1/docker/bubble-breaker/update.sh' < deploy/update.sh
```

- [ ] **C4 (user step): Container Manager project.** Container Manager → Project → Create. Project name `bubble-breaker`; Path `/docker/bubble-breaker`; Source: use the existing compose file. If Container Manager only offers to create a `docker-compose.yml`, paste the content of `compose.yml` there and delete `compose.yml` (compose and `update.sh` read either name). Skip the Web Station portal. Next → Done: it pulls `ghcr.io/obichris11/bubble-breaker:latest` (public since B3) and starts it. Check:

```bash
ssh -t <admin>@<nas> 'curl -s http://127.0.0.1:18080/health; sudo docker inspect -f "{{.State.Health.Status}}" bubble-breaker'
```

  Expected: `ok` and `healthy`.

- [ ] **C5 (user step): updater task.** Control Panel → Task Scheduler → Create → Scheduled Task → User-defined script.
  - General: Task `bubble-breaker update`, User `root`, Enabled.
  - Schedule: Run on the following days → Daily; First run time 00:00; Frequency every 15 minutes; Last run time 23:45.
  - Task Settings: ✓ Send run details by email, ✓ only when the script terminates abnormally (needs Control Panel → Notification → Email set up); Run command `bash /volume1/docker/bubble-breaker/update.sh`.
  - OK, select the task → **Run**. Expected: no email; `/volume1/docker/bubble-breaker/update.log` stays empty because the running image already is `:latest`.

- [ ] **C6 (user step): certificate and reverse proxy.**
  1. Control Panel → Security → Certificate → Add → Add a new certificate → Get a certificate from Let's Encrypt: domain `<game-domain>`, your email. Port 80 must reach the NAS for the challenge (or use DNS-01 if DSM supports your provider).
  2. Control Panel → Login Portal → Advanced → Reverse Proxy: edit the legacy entry (or Create): Source `HTTPS`, hostname `<game-domain>`, port 443, ✓ **Enable HSTS**; Destination `HTTP`, `localhost`, port **18080**. No custom headers. Save. Enable HTTP/2 where your DSM offers it (DSM 7.2: Control Panel → Network → Connectivity → Enable HTTP/2).
  3. Control Panel → Security → Certificate → Settings: assign the new certificate to `<game-domain>`.

- [ ] **C7 (user step): verify from outside.** On mobile data or from another network, and from your clone:

```bash
curl -sI https://<game-domain>/health
```

```bash
node scripts/check-container.mjs https://<game-domain> --public
```

  Expected: `HTTP/2 200` (or `HTTP/1.1 200`) with `strict-transport-security`; `Container check passed for https://<game-domain> (86 checks)`. If the headers differ, the DSM proxy changed them; fix the proxy entry, not the container.

### D — First release live

- [ ] **D1 (user step): release checklist** (06-deployment): About shows **2.0.0**; on a phone the legacy app updates by itself (its worker fetches the new `ngsw.json`), or a fresh install works; offline reload works; the "New version" toast appears on the next release.
- [ ] **D2 (user step): next release path.** The next `feat`/`fix` merge makes release-please open "chore(main): release 2.0.1/2.1.0"; merging it moves `:latest`, and within 15 min `update.log` shows `2.0.0 -> 2.0.x`.
- [ ] **D3 (user step or agent): mark done.** A PR `docs: mark plan 07 done` sets roadmap row 07 to `done` and row 08 to `next — write plan`, and this plan's `status: done`. Refresh the Obsidian copy (planning README).

---

## Not checked in CI

- `release.yml` itself: it runs only on pushes to `main`. actionlint checks its syntax and expressions on every PR; Task 8 rehearsed its shell logic against a local registry; the first real run is B2b/B3 (metadata-action's tags and labels, GHCR login, Trivy with registry auth, SARIF upload, attestation).
- release-please's choice of 2.0.0 and the changelog range: read from its source, not run (it needs the GitHub API with a token). The first release PR shows it; if it says 1.2.0, close it and check that `.release-please-manifest.json` is `{}`.
- Trivy on PRs: the `docker` job does not scan, so a CVE published after a merge shows up only at release time. Fix: bump the base digest (Dependabot does this weekly).
- The CSP with a live service worker, offline reload through the container and installability: Task 8 by hand; Plan 08's e2e automates them.
- Everything on the NAS: DSM's Docker and compose versions, `flock`, Container Manager's project import, Task Scheduler emails, the reverse proxy, HSTS, TLS and HTTP/2 (C1–C7; `check-container.mjs --public` covers the headers end to end).
- Dependabot's docker digest bumps for channel tags (`24-alpine`, `stable-alpine-slim`): expected from Dependabot's docker support, seen only once its first PR arrives.

## Done when

- `Dockerfile`, `.dockerignore`, `nginx/default.conf`, `deploy/compose.yml`, `deploy/update.sh`, `deploy/update.test.sh`, `scripts/check-container.mjs`, `release-please-config.json`, `.release-please-manifest.json` and `.github/workflows/release.yml` exist; `ci.yml` has job `docker`; Dependabot covers docker.
- Production `index.html` has no inline script; `npm run check:pwa`, `npm run check:container` (85 checks), `npm run test:deploy` (31 checks), actionlint and shellcheck pass locally and in CI.
- Task 8 printed the reference output: no CSP violations with the worker, offline reload and deep link work, Trivy clean, all release tags on the scanned digest.
- CI green on the PR (`quality`, `build`, `docker`, `pr-title`, CodeQL); the PR is left open for the user.
- After Part 2: `docker` is a required check, `v2.0.0` is released, `ghcr.io/obichris11/bubble-breaker:2.0.0` is public and attested, and `https://<game-domain>/` serves 2.0.0 through the DSM proxy with the updater task running.
