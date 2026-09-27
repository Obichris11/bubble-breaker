# 03 — Architecture

Inputs: [01-rules.md](01-rules.md), [02-ux.md](02-ux.md). Decisions with trade-offs are recorded as ADRs in [`adr/`](adr/).

## Platform baseline

| Item | Choice |
|---|---|
| Framework | Angular **22.x** (latest stable at planning time: 22.2), standalone components, **zoneless**, signals, `OnPush` everywhere |
| Language | TypeScript strict (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`), Angular `strictTemplates` |
| Runtime | Node **24 LTS ≥ 24.15** (required by Angular 22; local machine has 24.3 → upgrade), npm |
| Rendering | DOM + CSS, absolutely positioned balls moved by `transform` ([ADR-0003](adr/0003-dom-rendering.md)) |
| PWA | `@angular/service-worker` (ngsw) + `SwUpdate` ([ADR-0007](adr/0007-pwa-ngsw.md)) |
| Language | English only; all UI strings in one `strings.ts` ([ADR-0008](adr/0008-english-only-central-strings.md)) |
| Dependencies at runtime | Angular only. No UI kit, no state library, no validation library |

## Layers

```
┌────────────────────────── ui ──────────────────────────┐
│ screens/  chrome/  board/        (components, OnPush)  │
└───────────────▲────────────────────────────────────────┘
                │ reads signals, calls intents
┌───────────────┴──────── state ─────────────────────────┐
│ GameStore  StatsStore  SettingsStore  PhaseRunner      │
└───────▲──────────────────────────────▲─────────────────┘
        │ pure calls                   │ injected ports
┌───────┴──── engine ─────┐   ┌────────┴──── platform ────────────┐
│ pure TS, no Angular     │   │ Storage  Clock  Audio  Visibility │
│ rules, rng, board, move │   │ SwUpdate/Install                  │
└─────────────────────────┘   └───────────────────────────────────┘
```

**Dependency rule** (lint-enforced, [ADR-0002](adr/0002-layered-architecture.md)):
- `engine` imports nothing outside itself; no `@angular/*`, no DOM.
- `platform` imports nothing from `state`/`ui`.
- `state` imports `engine` + `platform` interfaces.
- `ui` imports `state` (+ `engine` types only).

## Folder layout

```
src/
  main.ts
  styles/            tokens.css (verbatim from design), base.css, fonts (self-hosted Noto Sans)
  app/
    app.config.ts    provideZonelessChangeDetection, router, service worker, ports
    app.routes.ts
    strings.ts
    engine/          rules.ts rng.ts board.ts groups.ts physics.ts move.ts game.ts index.ts (+ *.spec.ts)
    state/           game.store.ts stats.store.ts settings.store.ts phase-runner.ts persistence.ts
    platform/        storage.ts clock.ts audio.ts visibility.ts pwa.ts
    ui/
      chrome/        title-bar status-strip softkey-bar popup-menu dialog toast
      board/         board board-layout (cell math) points-bubble live-region
      screens/       game scoring statistics options how-to-play about
```

## Engine (pure TypeScript)

Framework-free and deterministic. Every function returns new values; nothing is mutated.

```ts
type Color = 0 | 1 | 2 | 3 | 4;           // red, blue, green, yellow, purple
type BallId = number;                      // stable for the whole game: 0 … cols·rows−1
type Cell = { row: number; col: number };

interface Rules { columns: 11; rows: 12; colors: 5; minGroup: 2; }   // see 01-rules.md

interface Board {                          // immutable
  readonly columns: number;
  readonly rows: number;
  readonly cells: readonly (BallId | null)[];   // row-major, index = row·columns + col
}

interface Game {
  readonly seed: number;                   // uint32
  readonly colors: readonly Color[];       // indexed by BallId, never changes
  readonly board: Board;
  readonly score: number;
}

interface MoveResult {                     // everything the UI needs to animate one burst
  readonly removed: readonly BallId[];
  readonly points: number;                 // X·(X−1)
  readonly afterGravity: Board;
  readonly afterCollapse: Board;           // === afterGravity when no column emptied
  readonly game: Game;                     // final state
  readonly gameOver: boolean;
}

createRng(seed): () => number              // mulberry32 (same as prototype)
newGame(seed, rules): Game
groupAt(game, cell): readonly Cell[]       // [] when size < minGroup or empty cell
burst(game, cell): MoveResult | null       // null when groupAt is empty
hasMoves(game): boolean
```

- `physics.ts` keeps `applyGravity(board)` and `collapseRight(board)` as separate steps. Later styles can add `shiftRight` or `refillLeft` without touching the existing steps.
- Invariants 1–6 from [01-rules.md](01-rules.md) become fast-check property tests.

## State (signals)

No NgRx ([ADR-0004](adr/0004-signals-no-state-library.md)). Three root-provided stores:

**GameStore**
- State signals:
  - `gameId`: `crypto.randomUUID()` per new game; used for exactly-once stats.
  - `game`: engine `Game`.
  - `selection`: cells + anchor, or null.
  - `phase`: `'idle' | 'pop' | 'fall' | 'slide' | 'over'`.
  - `positions`: BallId → Cell. Drives the transforms and lags `game.board` during animation.
  - `popping`: set of BallIds.
  - `elapsedMs`, `paused`.
- Derived (`computed`): `selectedPoints`, `scoreText`, `timeText`, `canInteract`.
- Intents:
  - `tap(cell)` implements the selection rules R8/R9.
  - `newGame()`, `pause()`, `resume()`.
  - Keyboard helpers: `moveCursor`, `activateCursor`, `clearSelection`.
- **PhaseRunner** takes a `MoveResult` and steps `positions`/`phase` through pop, fall and slide. It uses the durations from `motion.ts` (which mirrors `tokens.css`) and an injected `Clock`. With reduced motion every duration is 0. Tests use a fake clock.

**StatsStore**
- Holds `high`, `total`, `played`, `last { score, timeMs }`, with `average` computed.
- `recordFinished(gameId, score, timeMs)` is **idempotent**: it keeps `lastRecordedGameId` and ignores repeats (handoff "exactly once").

**SettingsStore**
- Holds `breakerSet: 'colorful' | 'greyscale'`, `shapeHints`, `sound`.

**Timer**
- Elapsed time is accumulated: on each resume it stores `startedAt`, and on pause it adds the delta.
- It pauses when a menu, screen or dialog is open, or the page is hidden.
- It never resets on resume (fixes the legacy bug).

## Persistence

- Uses `localStorage` through the `Storage` port.
- The schema is versioned and every read is validated by hand-written guards. A corrupt or unknown version falls back to defaults and never crashes ([ADR-0005](adr/0005-persistence-schema.md)).

| Key | Content | Written |
|---|---|---|
| `bb:v1:settings` | `{ breakerSet, shapeHints, sound }` | on change |
| `bb:v1:stats` | `{ high, total, played, last, lastRecordedGameId }` | on game over |
| `bb:v1:game` | `{ gameId, seed, colors, cells, score, elapsedMs }` | after each burst, on pause/hidden, before SW reload; cleared at game over |

- On start, a valid `bb:v1:game` is restored in the Paused state; otherwise a new game starts.
- Test hook: when `environment.testHooks` is true (dev and e2e builds only), `?seed=<uint32>` starts a new game with that seed. Production ignores it (see 04).
- Saves happen after the animation settles, from the final `Game`.

## UI

**Routing** ([ADR-0006](adr/0006-routing.md))
- Routes: `''` (game), `scoring`, `statistics`, `options`, `how-to-play`, `about`.
- All components are tiny, so they are eager-loaded.
- Android back and browser back behave naturally. Softkey "Done" navigates to `''`.
- The menu, dialogs and toasts are overlays, not routes.
- Scoring is reached only through game over; a direct visit redirects to `''`.

**Board**
- `board-layout.ts` holds the pure cell-size function from the handoff §1; it is unit-tested with the 4 reference viewports.
- A ResizeObserver on the board area feeds a `cell` signal.
- Stacking order: highlight layer (z1) → balls (`@for (ball of balls(); track ball.id)`, z2) → focus ring (z3) → points bubble (z4).
- One pointer handler maps x/y to a cell. A keydown handler drives the cursor.
- The live region is a sibling element announcing the texts from `strings.ts`.

**Ball**
- A plain element with CSS classes from `tokens.css` (`.bb-ball--red`, `.bb-ball--g1`, and so on).
- The shape-hint glyph is a child element.
- The idle look never changes.

**Chrome**
- Title bar, status strip, softkey bar, popup menu (roving focus, Home/End/Esc), dialog (native `<dialog>` with `showModal()` for the focus trap and Esc), toast.

## Platform ports

Injectable interfaces bound in `app.config.ts`; tests use fakes.

- **Storage**: `get/set/remove` JSON, safe when `localStorage` throws (private mode).
- **Clock**: `now()`, `setTimeout`, `clearTimeout`.
- **Audio**: lazily creates or resumes the `AudioContext` on the first user gesture. It plays select, pop and game-over sounds synthesized with WebAudio (ported from legacy `sound.service.ts`) and does nothing when sound is off.
- **Visibility**: a `hidden` signal from `visibilitychange`.
- **Pwa**:
  - Exposes `updateAvailable`, `offlineReady` and `installAvailable` signals from `SwUpdate` and `beforeinstallprompt`.
  - `reload()` saves the game first.
  - The install "Not now" timestamp is persisted in `bb:v1:settings`.

## Error handling

- The engine throws only on programmer error (invalid cell). Tests cover this; the UI never passes an invalid cell.
- The storage port swallows quota and security errors and logs a warning. The game still works without persistence.
- A global `ErrorHandler` logs to the console only. There is no remote telemetry: the About screen promises "no tracking".
- A service-worker `unrecoverable` state triggers a forced reload after saving.

## Performance budget

- Initial JS ≤ 150 kB gzip (warn) / 200 kB (error). Fonts are subset Latin woff2, 2 weights.
- At most 132 ball nodes, animating only `transform` and `opacity`, with no layout work per frame. No blanket `will-change`; add it only if profiling shows jank.

## Legacy problem → architecture answer

| Legacy problem (00) | Answer |
|---|---|
| Two click paths, split selection | Only `GameStore.tap` / keyboard intents change the selection |
| In-place mutation | Immutable engine |
| Unstable ball ids | `BallId` fixed per game, tracked in `@for` |
| DOM-query animation, hard-coded sizes | PhaseRunner drives `positions`; cell size from layout function |
| No keyboard/ARIA | Board cursor, live region, `role="application"`, native dialog |
| AudioContext before gesture | Lazy create/resume in Audio port |
| Pause resets time | Accumulated elapsed model |
| Best score written every move | Stats written once at game over, idempotent |
| Tests re-implement logic | Tests import engine directly; property tests |
| `ngsw-config` references fake `/api` | Asset groups only |
