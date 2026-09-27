# 00 — Legacy Inventory

Snapshot of the pre-rewrite implementation, preserved as git tag `v0-legacy` (commit `f16fc4d`).
Purpose: record what existed, what was broken, and what is worth carrying into the rewrite.

## Stack (legacy)

- Angular 20.3, standalone components, zone.js change detection, RxJS `BehaviorSubject` services
- TypeScript 5.9, SCSS
- Jest 30 via `npm test`, but `ng test` still wired to Karma (two runners configured)
- ESLint + Prettier configured but not installed — no effective linting
- `@angular/service-worker` PWA, incomplete manifest (16/32/48 px icons only)
- Unused runtime dependency: `canvas`
- Docker: `nginx:alpine` serving a prebuilt `dist/` (no multi-stage build); compose with Traefik placeholder labels
- No CI

## Code map (~1,300 LOC app code)

| File | Purpose | State |
|---|---|---|
| `services/game.service.ts` | State machine, timer, click handling | Dead `confirmMove`/`selectedGroup$`; pause resets timer |
| `services/grid.service.ts` | Random grid, flood fill, gravity, column collapse, `hasValidMoves` | **Salvage algorithms** |
| `services/score.service.ts` | `n*(n-1)` scoring, best score in localStorage | Saves on every move; unused bonus helpers |
| `services/animation.service.ts` | DOM-query animations, rAF particles | Almost entirely unused; hard-coded 60 px cells |
| `services/sound.service.ts` | WebAudio-synthesized sounds | **Salvage sound designs**; AudioContext never resumed |
| `components/game-board` | Grid, select-then-confirm, "+N" preview, game-over overlay | Own selection state conflicts with service |
| `components/ball` | CSS ball, colorblind glyphs ●■▲★◆ | Glyphs never enabled (no UI) |
| `components/score`, `sound-controls`, `particles` | Score panel, sound toggle/volume, particle divs | Particles never triggered |
| `components/menu`, `game-controls` | Empty scaffolds | Dead |

## Features actually working

- Standard mode only; Continuous is a `console.log`, Shifter/MegaShift are enum values only
- 11 rows × 12 columns, 5 colors, 4-way adjacency, min group 2
- Two-click select-then-confirm with "+N" preview
- Score `n*(n-1)`, best score persisted
- Pause (hides board), sound on/off + volume

Not working / absent: removal & falling animations, particles, colorblind toggle, keyboard navigation, ARIA, undo, end-of-game bonus, board-clear win state, settings persistence, dark/reduced-motion support.

## Problems → rewrite requirement

| Legacy problem | Rewrite must |
|---|---|
| Two click paths, split selection state | Single source of truth for game state; UI dispatches intents only |
| Board mutated in place, shallow re-emit | Immutable engine state |
| Ball ids `${row}-${col}` go stale after gravity; trackBy by index | Stable ball identity for animations |
| Animations query DOM with hard-coded sizes | Animation driven by state diff, sizes from layout tokens |
| No keyboard / ARIA | `role="grid"`, roving tabindex, labels, WCAG 2.2 AA |
| AudioContext created before user gesture | Lazy create/resume on first gesture |
| Pause resets elapsed time | Accumulated elapsed-time model |
| Best score written every move | Persist at defined points via storage adapter |
| `translateZ(0)` on `*`, UA sniffing | No blanket hacks; measure first |
| Tests re-implement logic or target non-existent APIs; ~0% real coverage | Tests import real code; coverage gates in CI |
| Lint/format configured but not installed | Tooling installed and enforced in pre-commit + CI |
| Two test runners | Exactly one unit runner |
| Docker ships prebuilt `dist` | Multi-stage build; image is reproducible from source |
| No cache rules for `ngsw.json` / worker | `no-cache` for SW + index; immutable hashed assets |
| `ngsw-config.json` references non-existent `/api` | Config matches reality |
| Incomplete manifest | 192/512 + maskable icons, correct `theme-color` |
| README claims unimplemented features done | Docs describe actual state |
| No CI | GitHub Actions quality + release pipeline |

## Salvage list

- Flood fill, gravity, and column-collapse logic — `src/app/services/grid.service.ts` (port to pure, immutable engine)
- Synthesized sound designs — `src/app/services/sound.service.ts` (frequencies/envelopes)
- Security headers and gzip config — `nginx.conf`
- Synology DS224+ deployment notes — `DEPLOYMENT.md`
- Colorblind glyph set ●■▲★◆ — `components/ball`
- Favicons — `public/`

## Environment notes

- Local git is 2.15 (2017): no `git restore`/`git switch`. Upgrade (e.g. Homebrew) before Husky setup.
- Remote: `github.com/Obichris11/bubble-breaker`, default branch `master` (rewrite targets `main`).
- Deleted junk file `gh.tar.gz` (9-byte "Not Found" from a failed download).
