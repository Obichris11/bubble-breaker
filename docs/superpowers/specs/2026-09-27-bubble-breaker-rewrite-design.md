# Bubble Breaker Rewrite — Design Spec

Date: 2026-09-27 · Status: awaiting user review · Branch: `rewrite`

This spec consolidates the phase documents. The phase docs remain the detailed source; this file is the single entry point, the scope contract, and the traceability record.

| # | Document | Covers |
|---|---|---|
| 00 | [00-legacy-inventory.md](../../00-legacy-inventory.md) | What existed, what was broken, salvage list |
| 01 | [01-rules.md](../../01-rules.md) | Game rules R1–R21, engine defaults, invariants |
| 02 | [02-ux.md](../../02-ux.md) + [design/](../../design/) | Screens, layout math, interaction, motion, a11y, tokens |
| 03 | [03-architecture.md](../../03-architecture.md) + [adr/](../../adr/) | Layers, engine API, stores, persistence, routing, ports |
| 04 | [04-quality.md](../../04-quality.md) | Toolchain, test pyramid, gates, Definition of Done |
| 05 | [05-cicd.md](../../05-cicd.md) | Repo governance, workflows, versioning, release |
| 06 | [06-deployment.md](../../06-deployment.md) | Image, nginx, Synology runtime, updater, rollback |

## Purpose

Rebuild Bubble Breaker from scratch as:
1. a faithful, polished tribute to the Windows Mobile game (Jawbreaker / Bubble Breaker);
2. a portfolio-quality codebase with clean architecture and enforced quality;
3. a public, installable, offline PWA, self-hosted on a Synology NAS and shipped by a GitHub pipeline.

## Scope

**In v1 (2.0.0)**
- Standard style only. Rules follow Wikipedia *Jawbreaker (Windows Mobile game)*; gaps were filled by user decision (01).
- 11 × 12 board, 5 colors, two-tap select/burst, `X(X−1)` scoring, gravity down, columns close right.
- No undo, no end bonus.
- Screens: Game, Menu, Scoring, Statistics, Options (Breaker Set, shape hints, sound), How to Play, About, Paused.
- Keyboard play, screen-reader support, WCAG 2.2 AA, reduced motion.
- Greyscale Breaker Set.
- Game in progress survives reload. Statistics and settings are stored locally.
- PWA: installable, offline, update toast, install hint.
- Retro Win95/WinMobile look from the Claude Design handoff. Light only.
- English only; strings centralized.
- CI quality gates, release-please releases, GHCR image, Synology deployment with automatic update.

**Out of v1 (explicitly)**
- Continuous, Shifter, MegaShift styles (engine is prepared: separate physics steps).
- Online leaderboards, accounts, backend of any kind, analytics/telemetry.
- Dark theme, languages other than English.
- Native app-store builds.
- Undo, end bonus.

## Key decisions (one line each)

| Area | Decision | Ref |
|---|---|---|
| Framework | Angular 22, zoneless, signals, OnPush, strict TS 6.0 | ADR-0001 |
| Structure | engine / state / platform / ui with lint-enforced dependency rule | ADR-0002 |
| Rendering | DOM, absolutely positioned balls keyed by stable id, `transform` animations | ADR-0003 |
| State | Plain signal stores; PhaseRunner with injectable clock | ADR-0004 |
| Persistence | localStorage `bb:v1:*`, guarded reads, exactly-once stats via `gameId` | ADR-0005 |
| Navigation | Router for screens; menu/dialog/toast as overlays | ADR-0006 |
| PWA | Angular service worker, asset groups only | ADR-0007 |
| Copy | English, `strings.ts` | ADR-0008 |
| Tests | Vitest (only runner) + fast-check + Testing Library + Playwright + axe + visual snapshots | 04 |
| Gates | Coverage engine 95 / state 90 / overall 80; LH Perf ≥ 90, A11y 100; bundle ≤ 200 kB | 04 |
| Repo | Public, `main`, squash merges, ruleset with required checks | 05 |
| Release | release-please PR → tag → GHCR `X.Y.Z / X.Y / latest / sha` → Trivy | 05 |
| Runtime | `nginx-unprivileged`, read-only, localhost-bound, behind DSM reverse proxy | 06 |
| Updater | DSM Task Scheduler, `update.sh` every 15 min, health-gated, email on failure | 06 |

## Traceability: legacy problem → prevention

| Legacy problem (00) | Prevented by | Verified by |
|---|---|---|
| Two click paths, split selection state | Single `GameStore.tap` / keyboard intents (03) | State unit tests (04) |
| In-place board mutation | Immutable engine (03) | Property tests; `readonly` types |
| Stale ball ids, index trackBy | `BallId` fixed per game, `track ball.id` (03) | Component test: node identity across burst |
| DOM-query animation, hard-coded sizes | PhaseRunner + `board-layout.ts` (03) | Layout unit tests, visual snapshots |
| No keyboard / ARIA | Board cursor, live region, native dialog (02, 03) | Component tests, axe, manual SR pass |
| AudioContext before gesture | Lazy Audio port (03) | Unit test with fake AudioContext |
| Pause resets timer | Accumulated elapsed model (03) | State unit test |
| Best score saved every move | Stats written once at game over, idempotent (03) | State unit + e2e |
| Blanket `translateZ` hack, UA sniffing | Not carried over; perf budget + profiling (03) | Lighthouse |
| Tests re-implement logic, ~0 % coverage | Tests import real code; coverage gates (04) | CI `quality` |
| Lint/format configured, not installed | Installed, pre-commit + CI (04) | CI `quality` |
| Two test runners | Vitest only (04) | `angular.json` review |
| Docker ships prebuilt `dist` | Multi-stage build (06) | CI `docker` job |
| No SW cache rules | `no-cache` SW files, immutable hashed assets (06) | CI `docker` header asserts |
| Fake `/api` data groups in ngsw | Asset groups only (06) | Config review |
| Incomplete manifest | 192/512 + maskable, tokens colors (06) | E2E installability check |
| README claims unimplemented features | Docs describe actual state; DoD item 1 (04) | PR review |
| No CI | Workflows in 05 | Required checks |

## Rules → verification (spot list)

| Rule | Check |
|---|---|
| R6/R7 adjacency, min group | Engine unit + property "game over ⇔ no adjacent pair" |
| R8/R9 selection | GameStore unit tests; e2e scripted game |
| R10 scoring | Engine unit table; property "delta = X(X−1)" |
| R11/R12 gravity, collapse right | Properties "no floating", "no empty column right of non-empty" |
| R13/R16 game over → Scoring | State unit (500 ms / 0 ms reduced) + e2e |
| R17 statistics exactly once | State unit (double game-over) + e2e reload-at-game-over |
| R18 Breaker Set | Visual snapshot greyscale; axe both sets |
| R5 determinism | Property "same seed + moves ⇒ same game"; e2e `?seed=` |

## Prerequisites before implementation

1. Upgrade local **Node to ≥ 24.15** (Angular 22 requirement; machine has 24.3).
2. Upgrade local **git** (2.15 → current; needed for Husky, `git switch/restore`).
3. Set commit email to GitHub noreply address; enable "Keep my email addresses private".
4. Create fine-grained PAT `RELEASE_PLEASE_TOKEN` (05).
5. Decide `<game-domain>` (kept out of the repo; used only in DSM config).

## Verify during implementation (known unknowns)

| Item | Fallback |
|---|---|
| Angular `security.autoCsp` works with `script-src 'self'` | Disable `inlineCritical` |
| `@lhci/cli` works with current Chrome/Lighthouse 13 | Run `lighthouse` CLI with same assertions |
| `nginx-unprivileged` writable paths under read-only root | Add tmpfs mounts |
| DSM docker binary path, `docker compose` v2 present | Use `docker-compose` binary |
| Noto Sans subset + self-hosting within bundle budget | Single weight + system fallback |
| Legacy sound synthesis port quality | Re-tune in playtest |

## Implementation milestones (input for the implementation plan)

1. **Skeleton & pipeline**: Angular 22 workspace, strict config, lint/format/hooks, Vitest, empty app shell with tokens + font, `ci.yml` green. Create `main`, go public, ruleset.
2. **Engine**: rules, rng, board, groups, physics, move, game-over with unit + property tests (≥ 95 %).
3. **State & platform**: stores, PhaseRunner, timer, persistence guards, ports + fakes (≥ 90 %).
4. **Board UI**: layout math, balls, highlight, bubble, focus cursor, live region, pointer + keyboard, animations.
5. **Chrome & screens**: title bar, status strip, softkeys, menu, dialog, toast; all screens and routes.
6. **PWA**: manifest, icons, ngsw config, update/offline/install flows.
7. **Container & release**: Dockerfile, nginx, `docker` CI job, release-please, image workflow, Trivy, Dependabot, CodeQL.
8. **Deploy**: `deploy/compose.yml` + `update.sh`, DSM setup, first release 2.0.0 live.
9. **Polish & e2e**: Playwright suites, axe, visual baselines, Lighthouse gates, manual device checks, README/About.
