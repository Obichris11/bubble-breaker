---
aliases:
  - Quality Strategy
tags:
  - bubble-breaker/planning
  - bubble-breaker/phase-4
  - bubble-breaker/quality
  - bubble-breaker/testing
status: accepted
created: 2026-09-27
---
# 04 — Quality Strategy

Goal: every rule in [01-rules.md](01-rules.md) and every "must not get wrong" item in [02-ux.md](02-ux.md) is guarded by an automated check. Checks run locally (pre-commit) and in CI (required for merge).

## Toolchain (versions verified 2026-09-27)

| Concern | Tool | Notes |
|---|---|---|
| Runtime | Node 24 LTS ≥ 24.15, npm | `.nvmrc` + `engines` field; CI uses same |
| Types | TypeScript **6.0.x** | Angular 22 peer range is `>=6.0 <6.1`; TS 7 not yet supported |
| Lint | ESLint 10 (flat config) + `angular-eslint` 22 + `typescript-eslint` (type-checked rules) | Template a11y rules on |
| Layer rules | `eslint-plugin-boundaries` | Enforces ADR-0002 dependency rule |
| Format | Prettier 3 | Single config file; `prettier --check` in CI |
| Unit / component | **Vitest 5** via Angular `@angular/build:unit-test` builder, jsdom | One runner only (no Karma, no Jest) |
| Coverage | `@vitest/coverage-v8` | Thresholds below |
| Property tests | fast-check 4 | Engine invariants |
| Component queries | `@testing-library/angular` 19 (peer `@angular/core >= 21`) | Test by role/label, not CSS classes |
| E2E | Playwright 1.63 | Chromium + WebKit, desktop + mobile viewports |
| A11y automated | `@axe-core/playwright` | Every screen, both Breaker Sets |
| Performance | Lighthouse CI (`@lhci/cli`) | Last release 2025-06; if incompatible with current Chrome, run `lighthouse` CLI directly with same assertions |
| Git hooks | Husky 9 + lint-staged | Requires git ≥ 2.9; upgrade local git 2.15 anyway |
| Commits | commitlint (Conventional Commits) | Needed for release-please (Phase 5) |

## Compiler strictness

`tsconfig`: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noPropertyAccessFromIndexSignature`, `noFallthroughCasesInSwitch`.
Angular: `strictTemplates`, `strictInjectionParameters`, `strictInputAccessModifiers`, `extendedDiagnostics` as errors.
Lint bans: `any` (explicit and implicit), non-null assertions in `src/` (allowed in specs), `console.*` except `warn`/`error`, default exports.

## Test pyramid

| Level | Scope | Environment | Examples |
|---|---|---|---|
| **Engine unit** | `engine/*` pure functions | Vitest, node | Group detection edge cases; X(X−1) table; collapse right with gaps; game over on 1-ball and checkerboard boards; RNG determinism snapshot for seed 1 |
| **Engine property** | Invariants 1–6 from 01-rules | Vitest + fast-check (≥ 500 runs per property) | Ball count conserved; no floating balls; no empty column right of non-empty; score delta = X(X−1); same seed + moves ⇒ same result; game over ⇔ no adjacent pair |
| **State unit** | Stores, PhaseRunner, timer, persistence guards | Vitest + fake Clock + fake Storage | Tap state machine (R8/R9); input ignored during phases; phase order pop→fall→slide; reduced motion = zero delays; stats recorded exactly once; corrupt storage → defaults; restore → Paused |
| **Pure UI logic** | `board-layout.ts` cell math | Vitest | 360×640→32, 390×844→34, 768×1024→69, desktop→48; integer only |
| **Component** | Board, chrome, screens | Vitest + Testing Library + jsdom | Board: keyboard cursor, Enter select/burst, Esc clear, live-region text; Menu: arrows/Home/End/Esc, focus return; Dialog: starts on Cancel; Options toggle persists |
| **E2E** | Full app, production build | Playwright vs `ng build` served statically | Seeded game via `?seed=` (dev/test flag only) → play scripted moves, assert score & board; game over → Scoring → stats +1 once; reload mid-game restores Paused; offline reload works (SW); manifest + SW registration present (installability) |
| **A11y** | Every screen | axe via Playwright | Zero violations (serious/critical fail build) |
| **Visual** | Game screen idle/highlight, Scoring, Options, greyscale | Playwright `toHaveScreenshot`, Chromium only, fixed seed, reduced motion | Guards ball recipe & chrome against drift from design; baselines updated deliberately |

Test seed hook: the app reads `?seed=<uint32>` **only** when `environment.testHooks` is true (dev + e2e builds). The production build ignores it.

## Gates

| Gate | Threshold | Where |
|---|---|---|
| Lint, format, typecheck | 0 errors, 0 warnings | pre-commit (staged files) + CI |
| Unit/component tests | all pass | pre-push + CI |
| Coverage `engine/` | ≥ 95 % lines & branches | CI |
| Coverage `state/` | ≥ 90 % | CI |
| Coverage overall | ≥ 80 % | CI |
| E2E + axe | all pass, 0 serious/critical | CI |
| Bundle budget (angular.json) | initial ≤ 150 kB warn / 200 kB error (gzip est.); component styles ≤ 4 kB warn / 8 kB error | build |
| Lighthouse (mobile, simulated throttling) | Performance ≥ 90, Accessibility = 100, Best Practices ≥ 95, SEO ≥ 90 | CI on PR |
| Visual regression | ≤ 0.1 % pixel diff | CI |

> [!NOTE]
> Lighthouse removed its PWA category in v12; installability is asserted in E2E instead (manifest fields, 192/512 + maskable icons, SW controls page, offline reload).

## Local workflow

- `npm run check` = lint + format check + typecheck + unit tests (same as CI fast job).
- `pre-commit`: lint-staged → ESLint `--fix` + Prettier on staged files.
- `commit-msg`: commitlint.
- `pre-push`: `npm test` (unit + component).
- E2E and Lighthouse run in CI; locally on demand (`npm run e2e`, `npm run lh`).

## Definition of Done (per PR)

1. Behavior matches 01-rules / 02-ux; any deviation documented in the doc or a new ADR.
2. Tests added at the lowest level that can prove the behavior; engine changes include a property test when an invariant is affected.
3. All gates green in CI.
4. Keyboard + screen-reader path works for any new UI (axe clean + manual check of announcement text).
5. No new runtime dependency without an ADR.
6. Conventional Commit title; PR description states what and why.
7. Visual baselines updated only when the design changed intentionally (noted in PR).

## Manual checks per release

- Real phone (iOS Safari + Android Chrome): install, offline, update toast, back gesture, safe areas.
- VoiceOver / TalkBack quick pass: select, burst, game over.
- Playtest 3 full games: feel of animation timings.
