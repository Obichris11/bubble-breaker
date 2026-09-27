# 05 — CI/CD & Repo Governance

Inputs: [04-quality.md](04-quality.md) (gates), [06-deployment.md](06-deployment.md) (consumer of the image).

## Repository

| Setting | Value |
|---|---|
| Repo | `github.com/Obichris11/bubble-breaker` |
| Visibility | **Public** (currently private → switch at start of implementation; see prerequisites) |
| Default branch | `main` (created from `rewrite` once the skeleton passes CI). `master` is kept read-only until `main` is the default, then deleted; legacy lives on as tag `v0-legacy` |
| Merge strategy | **Squash only**; commit title = PR title (Conventional Commit); auto-delete head branches |
| Security features (free on public) | Secret scanning + push protection, Dependabot alerts + security updates, private vulnerability reporting, CodeQL |
| Files | `LICENSE` (MIT), `README.md` (play link, screenshots, dev setup), `SECURITY.md`, `CONTRIBUTING.md` (short: DoD from 04), `.github/pull_request_template.md` |

### Ruleset on `main`

- Pull request required (0 approvals: solo developer; PR = CI gate + changelog entry).
- Required status checks: `quality`, `build`, `e2e`, `lighthouse`, `pr-title`, `CodeQL`.
- Branch must be up to date before merge; linear history; no force push; no deletion.
- Repo admin may bypass only in emergencies (logged).

### Prerequisites before going public

1. Remove tracked `.claude/settings.local.json`; add `.claude/` to `.gitignore`.
2. **Decided:** existing history (author email) stays as is. Enable GitHub "Keep my email addresses private" and set `git config user.email` to the `…@users.noreply.github.com` address for all new commits. No history rewrite.
3. History scanned 2026-09-27: no secrets, tokens, keys or IPs found.

## Versioning

- SemVer. The rewrite's first release is **2.0.0** (legacy tags `v1.1.0`, `v1.1.1` exist).
- **release-please** (`googleapis/release-please-action`) maintains a "chore(main): release X.Y.Z" PR with a generated `CHANGELOG.md`. `feat` bumps minor, `fix` bumps patch, `feat!` or `BREAKING CHANGE` bumps major.
- **Merging the release PR = shipping.** It creates tag `vX.Y.Z` and a GitHub Release, which triggers the image build.
- The app version shown on the About screen is injected at build time from `package.json`.

## Workflows (`.github/workflows/`)

All workflows follow these rules:
- `permissions: {}` at the top level and minimal grants per job.
- Third-party actions pinned by commit SHA (Dependabot bumps them).
- `concurrency` cancels superseded runs.
- Node version comes from `.nvmrc`, with an npm cache and `npm ci`.

### `ci.yml` (on `pull_request`, `push: main`)

| Job | Needs | Steps | Artifacts |
|---|---|---|---|
| `quality` | – | lint · `prettier --check` · typecheck · unit+component tests with coverage thresholds | coverage report |
| `build` | – | `ng build` (production, budgets enforced) | `dist/` |
| `e2e` | build | Playwright (Chromium + WebKit, desktop + mobile) against static-served `dist/` built with test hooks · axe · visual snapshots | Playwright report + traces on failure |
| `lighthouse` | build | Lighthouse CI, mobile, assertions from 04 | LH report |
| `docker` | build | `docker build` smoke test: container starts, `/health` 200, `/` serves index, SW files send `no-cache` | – |

`pr-title.yml` (on `pull_request`: opened / edited / synchronize) checks the PR title with `amannn/action-semantic-pull-request`.

### `codeql.yml`

- Triggers: PRs, pushes to `main`, and a weekly schedule.
- Languages: `javascript-typescript` and `actions`.

### `release.yml` (on `push: main`)

1. Job `release-please` runs the action. When `release_created` is true, it outputs `tag` and `version`.
2. Job `image` runs if a release was created. Permissions: `contents: read`, `packages: write`, `id-token: write`, `attestations: write`.
   1. Log in to GHCR with `GITHUB_TOKEN`.
   2. Build with `docker/build-push-action` for `linux/amd64` only (DS224+ is x86-64), with OCI labels (source, version, revision). The Dockerfile builds the app itself (multi-stage, see 06).
   3. Tags: `ghcr.io/obichris11/bubble-breaker:X.Y.Z`, `:X.Y`, `:latest`, `:sha-<short>`.
   4. `provenance: true`, `sbom: true`, plus `actions/attest-build-provenance`.
   5. Trivy scans the pushed image. It fails on fixable `CRITICAL`/`HIGH` and uploads SARIF to code scanning.
3. The NAS picks up `:latest` (see 06).

**Token caveat:** PRs opened with `GITHUB_TOKEN` do not trigger other workflows. The release PR would therefore never get its required checks.
- Use a **fine-grained PAT** stored as secret `RELEASE_PLEASE_TOKEN`: scoped to this repo, with `contents` and `pull-requests` read/write, 1-year expiry and a calendar reminder.
- Alternative: a small GitHub App (more setup, no expiry).

### `dependabot.yml`

| Ecosystem | Schedule | Grouping |
|---|---|---|
| npm | weekly | `angular` (all `@angular/*`, `angular-eslint`), `test-tooling` (vitest, playwright, testing-library, fast-check, axe), `lint-format`, others individually |
| github-actions | weekly | all in one group |
| docker | weekly | base images |

Angular major upgrades are done manually with `ng update`, and Dependabot ignores `@angular/*` major versions.

## Secrets & tokens

| Name | Where | Scope |
|---|---|---|
| `GITHUB_TOKEN` | automatic | per-job minimal permissions |
| `RELEASE_PLEASE_TOKEN` | repo secret | fine-grained PAT, this repo, contents + PRs RW |

No other secrets are needed: the GHCR package is public, so the NAS pulls anonymously.

## One-time manual steps

1. Flip the repo to public (after the prerequisites).
2. Create `main`, set it as default, add the ruleset, delete `master`.
3. Create `RELEASE_PLEASE_TOKEN`.
4. After the first image push, set the GHCR package **visibility to public** and link it to the repo (package settings).
5. Enable secret scanning push protection and private vulnerability reporting.

## Flow summary

```
feature branch ──PR──▶ ci.yml + codeql + pr-title (required) ──squash──▶ main
main ──push──▶ release.yml: release-please updates "release X.Y.Z" PR
merge release PR ──▶ tag vX.Y.Z ──▶ image build → GHCR (X.Y.Z, X.Y, latest, sha) → Trivy
NAS (06) ──polls──▶ ghcr.io/obichris11/bubble-breaker:latest ──▶ redeploy
```
