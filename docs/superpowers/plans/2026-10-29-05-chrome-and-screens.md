---
aliases:
  - "Plan 05: Chrome & screens"
tags:
  - bubble-breaker/plan
status: ready
created: 2026-10-29
---
# Plan 05 — Chrome & Screens Implementation Plan

> **For agentic workers:** run **one implementer subagent per task**, in order, and review each task's diff and test output before starting the next (the superpowers plugin does not load in cloud sessions; see the roadmap's working agreement). Steps use checkbox (`- [ ]`) syntax for tracking. Task 14 includes a **browser check** with Playwright against `npm start`. Open the PR and poll its checks with the **GitHub connector** (`gh` has no token in cloud sessions). **Do not merge**: the user merges.

**Goal:** Wrap the Plan 04 board in the app chrome and add every other screen: title bar, status strip (Score / Selected / Time), softkeys, popup menu, confirm dialog and toast; routes for Scoring, Statistics, Options, How to Play and About; the Paused dialog. The UI stops the timer while a menu, screen or dialog covers the board (`GameStore.setCovered`), shows Paused while `GameStore.paused()` is true, and opens Scoring when `GameStore.showScoring()` turns true. `src/app/ui/**` coverage stays ≥ 80 % and `src/app/state/**` ≥ 90 %. No PWA, service worker or install flow: that is Plan 06.

**Architecture:** Two new ui folders under the lint-enforced layer rule (ADR-0002): ui imports `state`, `strings.ts`, `version.ts` and engine **types** only.
- `src/app/ui/chrome/`:
  - `Shell` (root service): popup-menu state, count of open modal dialogs, and `onGame` (route `''` is active, from the router's `isActive()` signal). It derives `covered = !onGame || menuOpen || dialogs > 0` and pushes it into `GameStore.setCovered` with an effect.
  - Presentational components: `TitleBar`, `StatusStrip`, `SoftkeyBar`, `PopupMenu`, `ConfirmDialog` (native `<dialog>` + `showModal()`) and `Toast`.
  - Shared control styles (`.bb-button`, `.bb-window`) live in a new global `src/styles/chrome.css`; `tokens.css` stays verbatim.
- `src/app/ui/screens/`:
  - `GameScreen` (route `''`) = `StatusStrip` + `BoardArea` + `PausedDialog`.
  - `Screen` (`bb-screen`) is the frame of every other screen: white scroll area with an `<h1>` that takes focus after an in-app navigation. `StatRows` holds the label/value rows of Scoring and Statistics.
  - Screens: `ScoringScreen` (+ `scoringGuard`), `StatisticsScreen` (reset via `ConfirmDialog`), `OptionsScreen`, `HowToPlayScreen`, `AboutScreen`.
- `App` (`bb-root`) becomes the app window: title bar, `<router-outlet>`, softkeys, popup menu; an effect navigates to `/scoring` when `showScoring()` turns true. On desktop (`pointer: fine`) the window is 536 × 668 on the teal backdrop.
- One state change comes first: the keyboard cursor starts in the bottom row, middle column.

**Tech Stack:** Angular 22.2 standalone components, signals (`input`, `output`, `computed`, `effect`, `viewChild`, `viewChildren`), `afterNextRender`, Angular Router 22 (`isActive`, `CanActivateFn`, route `title`, `RouterTestingHarness`); native `<dialog>`; CSS custom properties from `tokens.css`; Vitest 5 via `ng test` with `@testing-library/angular` 19 on jsdom; Playwright (pre-installed Chromium) for the browser check.

**Spec:** [2026-09-27-bubble-breaker-rewrite-design.md](../specs/2026-09-27-bubble-breaker-rewrite-design.md) (milestone 5) · screens, layout, keyboard and motion in [02-ux.md](../../02-ux.md) and the [design handoff](../../design/README.md) (`Bubble Breaker Screens`, `Game Screen`, `Component Sheet`, `Handoff`) · routing and stores in [03-architecture.md](../../03-architecture.md#ui) · gates in [04-quality.md](../../04-quality.md#gates) · [ADR-0002](../../adr/0002-layered-architecture.md) · [ADR-0006](../../adr/0006-routing.md) · [ADR-0008](../../adr/0008-english-only-central-strings.md)

> [!NOTE]
> **Cloud session:** `.claude/hooks/cloud-setup.sh` provides Node ≥ 24.15. `gh` has no valid token there: push the branch, open the PR with the GitHub connector and poll its check runs with it (Task 16). Chromium and Playwright are pre-installed (`require('playwright')` works from any directory; do not run `playwright install`). Do not merge.

## Global Constraints

- Plans 01–04 are merged. Use the real APIs:
  - `GameStore` (`src/app/state/game.store.ts`): `gameId`, `game`, `selection`, `phase`, `cursor`, `paused`, `covered`, `showScoring`, `scoreText`, `selectedText`, `timeText` (`‖ m:ss` while paused or covered); intents `tap`, `newGame(seed?)`, `resume()`, `setCovered(covered)`, `moveCursor`, `activateCursor`, `clearSelection`. `pause()` runs by itself when `VisibilityPort.hidden` turns true (only after the first selecting tap); a restored game whose timer had started opens paused. Game over clears `paused`; `showScoring` turns true after the 500 ms hold and stays true until the next `newGame()`.
  - `StatsStore`: `high`, `total`, `played`, `average`, `last` (`{ score, timeMs }`), `newHigh` (not persisted), `recordFinished(gameId, score, timeMs)`, `reset()` (keeps `lastRecordedGameId`).
  - `SettingsStore`: `breakerSet`, `shapeHints`, `sound`; `setBreakerSet`, `setShapeHints`, `setSound` (each persists `bb:v1:settings`).
  - `formatNumber`, `formatClock` (`state/format.ts`); `KEYS`, `BreakerSet`, `GameRecord`, `StatsRecord` (`state/persistence.ts`); `ballLook()` (`ui/board/ball-look.ts`); `CHROME`, `availableSpace`, `cellSize` (`ui/board/board-layout.ts`); `BoardArea` (`bb-board-area`, sizes the board with a ResizeObserver on its own content box); `GameBoard` (`bb-board`).
  - Test helpers: `createFakePlatform()` (`platform/testing/fakes.ts`; `clock.advance(ms)`, `visibility.hidden.set(…)`, `storage`), `recordFrom()` (`state/testing/records.ts`, ball id = cell index, default `score: 100`, `elapsedMs: 65_000`).
- Layers: production files under `src/app/ui/` import `state`, `strings.ts`, `version.ts`, other `ui` files and engine **types** (`import type`) only; never `platform`. ui specs may use fixtures and the platform fakes.
- Components: standalone, `ChangeDetectionStrategy.OnPush`, selector prefix `bb-`, signal `input()`/`output()`, `inject()`. File names without a `.component` suffix. No RxJS. Outputs must not use DOM event names (`@angular-eslint/no-output-native`: no `cancel`, `close`, `resume`, …).
- Do not edit `src/styles/tokens.css`. Sizes, colours, z-index and motion come from its tokens; values the design has but tokens.css lacks (220 px Paused window, `#F4F3EF` formula box, 184 px menu) are written in component CSS with the prototype's numbers.
- Menus and dialogs appear instantly (02-ux "Motion"); only the toast animates (`--bb-dur-toast`, `--bb-ease-toast`).
- All user-visible text lives in `src/app/strings.ts` (ADR-0008). Every task that adds copy adds a block to `STRINGS` just before `board: {` unless the step says otherwise.
- Component specs query by role, name or text (Testing Library). `render()` from `@testing-library/angular` already provides a router; specs that need real routes call `TestBed.configureTestingModule({ providers: [..., provideRouter(routes)] })` and use `RouterTestingHarness`. After a signal change outside an event handler call `fixture.detectChanges()` (or `await fixture.whenStable()` when an `afterNextRender` or navigation must run); flush root effects with `TestBed.tick()`; move time with `platform.clock.advance(ms)`.
- jsdom 30 has no `HTMLDialogElement.showModal()`/`close()` and no `inert` property. Task 6 adds a stand-in to `src/test-setup.ts`; `inert` is bound as an attribute. The real focus trap, Esc and inertness are checked in the browser (Task 14).
- Coverage: `src/app/ui/**` ≥ 80 %, `src/app/state/**` ≥ 90 %, `src/app/engine/**` ≥ 95 %, overall ≥ 80 % (lines, statements, functions, branches). The thresholds already exist in `vitest-base.config.mts`; do not lower them.
- Lint bans `any`, non-null assertions outside specs and `testing/`, default exports, empty classes and `console.*` other than `warn`/`error`. Template accessibility rules are on (no `autofocus`, click handlers need key handlers).

## Decisions this plan makes

The docs leave these points open or disagree. Task 15 writes them back into `02-ux.md`, `03-architecture.md` and `04-quality.md`.

| Topic | Decision | Why |
|---|---|---|
| Desktop window size | **536 × 668**: 11·48 + 2·4 wide; 26 + 30 + 12·48 + 4 + 32 tall, with the 32 px `pointer: fine` softkeys from tokens.css. New `windowSize()` in `board-layout.ts` (unit-tested) states the formula; `app.css` builds the same size from the tokens. When the viewport is shorter than 708 px (window + 3 px bevel + key hint) or narrower than 560 px, the window fills the height, drops the bevel and hint, and the board area recomputes the cell (1280 × 600 → 42) | 02-ux and the handoff say 536 × 692, but no softkey height gives that: the formula gives 668 with 32 px softkeys and 680 with 44 px (the prototype's D4 frame was sized by hand). tokens.css makes desktop softkeys 32 px |
| Cursor start | Bottom row, middle column (row 12, column 6; `{ row: 11, col: 5 }`) after a deal and after a restore | The Game Screen prototype starts there (`[ROWS − 1, 5]`). The board is bottom-aligned and the bottom row empties last, so the first arrow keys land on balls; top-left is often empty in a restored game. Plan 04 kept the store's `{0, 0}` |
| Paused | A **non-modal** dialog (`role="dialog"`, not `<dialog>`) over the board area only, at `--bb-z-paused` (20) below the softkeys (30): New Game and Menu stay usable. The board area under it is `inert`. It takes focus on Resume; Resume or Esc call `resume()` and focus the board. N and the arrows cannot reach the inert board | tokens.css orders paused < softkeys < menu < dialog, and the prototype draws Paused inside the board area. 02-ux's "Dialogs trap focus" then applies to modal dialogs only (Reset statistics) |
| M key and shortcuts | **M** joins N as a board key: it opens the menu (`Shell.toggleMenu`; once the menu has focus, Esc closes it). Both work while the board has focus (02-ux lists them with the board keys); elsewhere the softkeys are one Tab away | A document-level N would deal a new game while someone reads How to Play |
| Focus order | Tab order: board → left softkey → Menu softkey. The menu focuses its first item; Esc, Tab or a press outside close it and focus goes back to whatever opened it (Menu softkey, or the board for M). A menu choice that changes screen moves focus to the new screen's `<h1>`; Done and New Game from another screen focus the board. A fresh page load leaves focus alone. Paused focuses Resume. The reset dialog starts on Cancel and gives focus back to "Reset statistics…" | 02-ux names the menu and dialog rules only; this fills in screens and the board |
| Covered | `Shell.covered = !onGame \|\| menuOpen \|\| dialogs > 0`, pushed into `GameStore.setCovered` by an effect. `onGame` is `isActive('/', router, { paths: 'exact', queryParams: 'ignored', fragment: 'ignored' })`. A menu choice closes the menu only after the navigation resolves, so `covered` never drops to false between the menu and the new screen | One place decides "covered"; the router already knows the screen |
| Status strip | Only on the Game screen; other screens fill the space between title bar and softkeys | The prototype replaces strip + board on every other screen (`isGame`) |
| Reset dialog | `ConfirmDialog` (`bb-confirm-dialog`): native `<dialog>` opened with `showModal()`, `role="alertdialog"`, Cancel is the default button and gets focus, Esc (`cancel` event) or a browser close emit `dismiss`. Outputs `confirm` / `dismiss` | 02-ux: native dialog, starts on Cancel, Esc closes. `cancel` is a DOM event name, so the output is `dismiss` |
| Popup menu | Arrows wrap; Home/End; Enter/Space click the item (native buttons); Esc and Tab close; pointer hover moves focus (one highlight); a press on the transparent layer above the softkeys closes without reaching the board. Rows use `--bb-menu-row-h` (40 px touch, 28 px `pointer: fine`) | Windows menus wrap and swallow the closing click; tokens.css already shrinks rows for mouse use |
| Scoring | `App` navigates to `/scoring` when `showScoring()` turns true (and closes an open menu). `scoringGuard` sends a direct visit to `''`. Done on Scoring shows the finished board; its New Game button deals and returns to `''`. Going back to Scoring after a new game is redirected | ADR-0006; `showScoring` stays true until the next deal |
| Statistics "Last Game" | "642 in 4:12" (score and time); "–" while `played` is 0 | 02-ux adds Last Game as "score + time"; the prototype shows only the score |
| Options controls | Native radio buttons and checkboxes (`appearance: none`, drawn with the sunken-field token). Shape hints is `disabled` on Greyscale and keeps its value | Native inputs give roles, names and keyboard for free; the prototype's `div role="radio"` needs hand-written keys |
| Toast | `Toast` (`bb-toast`, `role="status"`) is built and tested here with an action button and ×; nothing shows one until Plan 06 mounts the PWA notices at the top of the board area. Enter motion: opacity + translateY −4 → 0 with the toast tokens; the exit is Plan 06's | Roadmap row 05 lists the component; its only users are Plan 06's notices |
| Screen frame | `Screen` (`bb-screen`) renders the `<h1>` and projects the content; it focuses the heading when `Router.navigated` was already true at construction (in-app navigation) | One place for the panel look and the focus rule; `navigated` is false during the first navigation |
| Page titles | Route `title`s: "Bubble Breaker" for the game, "Statistics – Bubble Breaker" and so on; `**` redirects to `''` | WCAG 2.4.2; unknown deep links land on the game |
| Version | `src/app/version.ts` exports `VERSION = '0.0.0'` with an `x-release-please-version` marker; About shows "Version 0.0.0" until Plan 07 wires release-please | The About screen needs a version now; release-please owns it later |
| How to Play points | The screen computes `n × (n − 1)` for 2, 5, 10, 20 | ui may not call the engine's `scoreFor`; the test pins 2, 20, 90, 380 |
| New-game announcement | The board announces "New game." whenever `gameId` changes (softkey, menu, N) | Before, only N on the board announced it |
| Shared styles | `src/styles/chrome.css` (global, added to `angular.json` styles): `.bb-button`, `.bb-button--default`, `.bb-window`, `.bb-window__title`, `.bb-window__body`, `.bb-window__text` | Buttons and windows repeat across six components; tokens.css must stay verbatim |
| Safe areas | `bb-root` pads itself with `env(safe-area-inset-*)`; the board area measures what is left | 02-ux formula subtracts the insets; `index.html` already sets `viewport-fit=cover` |

## File Structure

```text
angular.json                      + src/styles/chrome.css in build styles
src/test-setup.ts                 + HTMLDialogElement showModal()/close() stand-in for jsdom
src/styles/chrome.css             .bb-button, .bb-button--default, .bb-window*
src/app/
  app.ts  app.html  app.css       app window: title bar, outlet, softkeys, menu, Scoring auto-open, desktop window
  app.routes.ts                   '' scoring statistics options how-to-play about, ** → ''
  app.spec.ts                     shell + routes integration tests
  strings.ts                      + pageTitle keyHint status labels softkeys menu toast paused scoring stats options howToPlay about
  version.ts                      VERSION
  state/
    game.store.ts  .spec.ts       cursor starts bottom middle
  ui/
    board/
      board.ts  board.spec.ts     + M key, "New game." on every deal
      board-layout.ts  .spec.ts   + windowSize()
    chrome/
      shell.ts                    Shell: menu, dialogs, onGame, covered → GameStore.setCovered
      title-bar.ts .css           TitleBar (bb-title-bar)
      status-strip.ts .html .css  StatusStrip (bb-status-strip)
      softkey-bar.ts .html .css   SoftkeyBar (bb-softkey-bar)
      popup-menu.ts .html .css    PopupMenu (bb-popup-menu), MenuItem
      confirm-dialog.ts .html .css ConfirmDialog (bb-confirm-dialog)
      toast.ts .html .css         Toast (bb-toast)
      *.spec.ts
    screens/
      screen.ts .css              Screen (bb-screen)
      stat-rows.ts .css           StatRows (bb-stat-rows), totalRows()
      game-screen.ts .html .css   GameScreen (bb-game-screen)
      paused-dialog.ts .html .css PausedDialog (bb-paused-dialog)
      scoring-screen.ts .html .css ScoringScreen (bb-scoring-screen)
      scoring-guard.ts            scoringGuard
      statistics-screen.ts .html .css
      options-screen.ts .html .css
      how-to-play-screen.ts .html .css
      about-screen.ts .html .css
      *.spec.ts                   (screen.spec.ts also covers StatRows)
```

Dependency order (no cycles): `strings`, `version` ← `shell` ← chrome components ← `screen`, `stat-rows` ← screens ← `game-screen` ← `app.routes` ← `app`. `board.ts` imports `shell.ts`.

## Branch

```bash
git checkout main && git pull
git checkout -b feat/chrome-screens
```

Baseline: `npm test` → 31 files, 251 tests pass.

---

### Task 1: Cursor starts in the bottom row (state)

**Files:**
- Modify: `src/app/state/game.store.ts`, `src/app/state/game.store.spec.ts`, `src/app/ui/board/board.spec.ts`

**Interfaces:**
- No API change. `GameStore.cursor()` is `{ row: rows − 1, col: floor(columns / 2) }` (`{ row: 11, col: 5 }`) after `newGame()`, after a restore and before either.

- [ ] **Step 1: Update the tests**

In `src/app/state/game.store.spec.ts`:

1. In `describe('newGame')` → `it('resets selection, cursor, pause and time', …)`, replace

```ts
      store.moveCursor('down');
```

with `store.moveCursor('up');`, and replace `expect(store.cursor()).toEqual({ row: 0, col: 0 });` in the same test with:

```ts
      expect(store.cursor()).toEqual({ row: 11, col: 5 });
```

2. In `describe('keyboard')`, replace `it('moves the cursor without wrapping', …)` with these two tests:

```ts
    it('starts the cursor in the bottom row, middle column', () => {
      expect(store.cursor()).toEqual({ row: 11, col: 5 });
    });

    it('moves the cursor without wrapping', () => {
      store.moveCursor('down');
      store.moveCursor('right');
      expect(store.cursor()).toEqual({ row: 11, col: 6 });
      for (let i = 0; i < 20; i++) {
        store.moveCursor('up');
        store.moveCursor('left');
      }
      expect(store.cursor()).toEqual({ row: 0, col: 0 });
      for (let i = 0; i < 20; i++) {
        store.moveCursor('down');
        store.moveCursor('right');
      }
      expect(store.cursor()).toEqual({ row: 11, col: 10 });
    });
```

3. In `it('activates the cursor cell like a tap, and Esc clears the selection', …)`, insert after `const cell = firstGroup(store.game())[0]!;`:

```ts
      for (let i = 0; i < 20; i++) {
        store.moveCursor('up');
        store.moveCursor('left');
      }
```

4. In `describe('cursor group')`, replace the first lines of the test, up to and including the two `for` loops, with:

```ts
      const store = start(SLIDE);
      expect(store.cursor()).toEqual({ row: 11, col: 5 });
      expect(store.cursorGroup()).toEqual([]);
      for (let i = 0; i < 4; i++) store.moveCursor('right');
```

(The two `expect(store.cursorGroup())…` lines after the loops stay.)

In `src/app/ui/board/board.spec.ts` (`describe('keyboard')`):

1. In `it('shows the focus ring on keyboard focus and moves it with the cursor', …)`, replace the assertions and key presses after `fixture.detectChanges();` with:

```ts
      expect(screen.getByTestId('focus-ring').style.transform).toBe('translate(160px, 352px)');
      press(board, 'ArrowUp');
      press(board, 'ArrowRight');
      fixture.detectChanges();
      expect(screen.getByTestId('focus-ring').style.transform).toBe('translate(192px, 320px)');
      expect(screen.getByRole('status')).toHaveTextContent('Row 11, column 7, empty');
```

2. In `it('selects and bursts with Enter or Space, and announces both', …)`, replace the two `for` loops with:

```ts
      for (let i = 0; i < 4; i++) press(board, 'ArrowRight');
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm test`
Expected: FAIL, 6 tests in 2 files, for example `starts the cursor in the bottom row, middle column` → `AssertionError: expected { row: +0, col: +0 } to deeply equal { row: 11, col: 5 }` and `shows the focus ring on keyboard focus and moves it with the cursor` → `expected 'translate(0px, 0px)' to be 'translate(160px, 352px)'`.

- [ ] **Step 3: Implement**

In `src/app/state/game.store.ts`:

1. Delete `const START_CURSOR: Cell = { row: 0, col: 0 };`.
2. Add above `function sameCell(…)`:

```ts
/** Where the keyboard cursor starts: bottom row, middle column (row 12, column 6 on 11 × 12). */
function startCursor(board: Board): Cell {
  return { row: board.rows - 1, col: Math.floor(board.columns / 2) };
}
```

3. Initialise the signal from the placeholder board:

```ts
  private readonly cursorSignal = signal<Cell>(startCursor(this.gameSignal().board));
```

4. In `newGame()`, replace `this.cursorSignal.set(START_CURSOR);` with `this.cursorSignal.set(startCursor(game.board));`.
5. In `restore()`, add after `this.shownBoard.set(saved.game.board);`:

```ts
    this.cursorSignal.set(startCursor(saved.game.board));
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (31 files, 252 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/state/game.store.ts src/app/state/game.store.spec.ts src/app/ui/board/board.spec.ts
git commit -m "feat(state): start the keyboard cursor in the bottom row"
```

---

### Task 2: Shell service (menu, dialogs, covered)

**Files:**
- Create: `src/app/ui/chrome/shell.ts`, `src/app/ui/chrome/shell.spec.ts`

**Interfaces:**
- Consumes: `GameStore.setCovered`, `Router`, `isActive` (`@angular/router`, public since 21.1).
- Produces: `Shell` (root): `onGame: Signal<boolean>` (route `''`, any query or fragment), `menuOpen: Signal<boolean>`, `covered: Signal<boolean>`; `openMenu(returnTo)`, `closeMenu(restoreFocus = true)`, `toggleMenu(returnTo)`, `openDialog(): () => void` (the returned release runs once). An effect keeps `GameStore.setCovered(covered())` in sync.

- [ ] **Step 1: Write the failing test**

`src/app/ui/chrome/shell.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { createFakePlatform } from '../../platform/testing/fakes';
import { GameStore } from '../../state/game.store';
import { KEYS } from '../../state/persistence';
import { recordFrom } from '../../state/testing/records';
import { Shell } from './shell';

describe('Shell', () => {
  const setup = async () => {
    const platform = createFakePlatform();
    platform.storage.set(KEYS.game, recordFrom(['........b..', '........brr']));
    TestBed.configureTestingModule({
      providers: [
        ...platform.providers,
        provideRouter([
          { path: '', children: [] },
          { path: 'statistics', children: [] },
        ]),
      ],
    });
    const shell = TestBed.inject(Shell);
    const store = TestBed.inject(GameStore);
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/');
    TestBed.tick();
    store.resume();
    return { shell, store, router };
  };

  const button = (): HTMLButtonElement => {
    const element = document.createElement('button');
    document.body.append(element);
    return element;
  };

  afterEach(() => {
    document.body.replaceChildren();
  });

  it('covers the board while another screen shows', async () => {
    const { shell, store, router } = await setup();
    expect(shell.onGame()).toBe(true);
    expect(store.covered()).toBe(false);
    await router.navigateByUrl('/statistics');
    TestBed.tick();
    expect(shell.onGame()).toBe(false);
    expect(store.covered()).toBe(true);
    expect(store.timeText()).toBe('‖ 1:05');
    await router.navigateByUrl('/?seed=4');
    TestBed.tick();
    expect(shell.onGame()).toBe(true);
    expect(store.covered()).toBe(false);
  });

  it('covers the board while the menu is open and gives focus back on close', async () => {
    const { shell, store } = await setup();
    const menuKey = button();
    shell.toggleMenu(menuKey);
    TestBed.tick();
    expect(shell.menuOpen()).toBe(true);
    expect(store.covered()).toBe(true);
    shell.toggleMenu(menuKey);
    TestBed.tick();
    expect(shell.menuOpen()).toBe(false);
    expect(store.covered()).toBe(false);
    expect(menuKey).toHaveFocus();
  });

  it('keeps focus where it is when a menu choice changes the screen', async () => {
    const { shell } = await setup();
    const menuKey = button();
    const other = button();
    shell.openMenu(menuKey);
    other.focus();
    shell.closeMenu(false);
    expect(other).toHaveFocus();
    shell.closeMenu();
    expect(other).toHaveFocus();
  });

  it('counts open dialogs; each release counts once', async () => {
    const { shell, store } = await setup();
    const releaseFirst = shell.openDialog();
    const releaseSecond = shell.openDialog();
    releaseFirst();
    releaseFirst();
    TestBed.tick();
    expect(store.covered()).toBe(true);
    releaseSecond();
    TestBed.tick();
    expect(store.covered()).toBe(false);
  });
});
```

(Routes with `children: []` need no component; an empty component class would trip `no-extraneous-class`.)

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test`
Expected: FAIL. The build reports `Could not resolve "./shell"`.

- [ ] **Step 3: Implement**

`src/app/ui/chrome/shell.ts`:

```ts
import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { isActive, Router } from '@angular/router';
import { GameStore } from '../../state/game.store';

/** Route `''` with any query (`?seed=` in Plan 08) and fragment. */
const GAME_SCREEN = { paths: 'exact', queryParams: 'ignored', fragment: 'ignored' } as const;

/**
 * App-wide chrome state: the popup menu and the open modal dialogs. Whatever hides the board
 * (another screen, the menu or a dialog) stops the game timer through `GameStore.setCovered`
 * (02-ux "Interaction").
 */
@Injectable({ providedIn: 'root' })
export class Shell {
  private readonly store = inject(GameStore);
  private readonly menuSignal = signal(false);
  private readonly dialogs = signal(0);
  private returnFocus: HTMLElement | null = null;

  /** The Game screen (route `''`) is showing. */
  readonly onGame = isActive('/', inject(Router), GAME_SCREEN);
  readonly menuOpen = this.menuSignal.asReadonly();
  /** Another screen, the menu or a dialog hides the board. */
  readonly covered = computed(() => !this.onGame() || this.menuSignal() || this.dialogs() > 0);

  constructor() {
    effect(() => {
      const covered = this.covered();
      untracked(() => {
        this.store.setCovered(covered);
      });
    });
  }

  /** Opens the menu. Closing it gives focus back to `returnTo` (Menu softkey or board). */
  openMenu(returnTo: HTMLElement | null): void {
    this.returnFocus = returnTo;
    this.menuSignal.set(true);
  }

  /** Closes the menu. `restoreFocus` is false when a menu choice opens another screen. */
  closeMenu(restoreFocus = true): void {
    if (!this.menuSignal()) {
      return;
    }
    this.menuSignal.set(false);
    if (restoreFocus) {
      this.returnFocus?.focus();
    }
    this.returnFocus = null;
  }

  toggleMenu(returnTo: HTMLElement | null): void {
    if (this.menuSignal()) {
      this.closeMenu();
    } else {
      this.openMenu(returnTo);
    }
  }

  /** Counts a modal dialog as open until the returned function runs (later calls do nothing). */
  openDialog(): () => void {
    this.dialogs.update((count) => count + 1);
    let open = true;
    return () => {
      if (open) {
        open = false;
        this.dialogs.update((count) => count - 1);
      }
    };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test && npx eslint src/app/ui/chrome`
Expected: PASS (32 files, 256 tests); ESLint reports no problems.

- [ ] **Step 5: Commit**

```bash
git add src/app/ui/chrome/shell.ts src/app/ui/chrome/shell.spec.ts
git commit -m "feat(ui): shell service that covers the board for menus, dialogs and screens"
```

---

### Task 3: Chrome styles, title bar and status strip

**Files:**
- Create: `src/styles/chrome.css`, `src/app/ui/chrome/title-bar.ts`, `title-bar.css`, `title-bar.spec.ts`, `status-strip.ts`, `status-strip.html`, `status-strip.css`, `status-strip.spec.ts` (all under `src/app/ui/chrome/` except the stylesheet)
- Modify: `angular.json`, `src/app/strings.ts`

**Interfaces:**
- Produces: global classes `.bb-button` (44 px bevelled button, dotted focus rect at −6 px, pressed bevel), `.bb-button--default` (bold + 1 px black ring), `.bb-window`, `.bb-window__title` (22 px navy bar), `.bb-window__body`, `.bb-window__text`.
- Produces: `TitleBar` (`bb-title-bar`): `<header>` (banner) with `STRINGS.appTitle`, 26 px.
- Produces: `StatusStrip` (`bb-status-strip`): a `<dl>` of three sunken 20 px fields: Score (`scoreText`, bold), Selected (`selectedText`, bold), Time (`timeText`, 84 px wide); 30 px strip.

- [ ] **Step 1: Write the failing tests**

`src/app/ui/chrome/title-bar.spec.ts`:

```ts
import { render, screen } from '@testing-library/angular';
import { TitleBar } from './title-bar';

describe('TitleBar', () => {
  it('is the banner with the app title', async () => {
    await render(TitleBar);
    expect(screen.getByRole('banner')).toHaveTextContent('Bubble Breaker');
  });
});
```

`src/app/ui/chrome/status-strip.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import { createFakePlatform } from '../../platform/testing/fakes';
import { GameStore } from '../../state/game.store';
import { KEYS } from '../../state/persistence';
import { recordFrom } from '../../state/testing/records';
import { StatusStrip } from './status-strip';

describe('StatusStrip', () => {
  const setup = async () => {
    const platform = createFakePlatform();
    platform.storage.set(KEYS.game, recordFrom(['........b..', '........brr']));
    const view = await render(StatusStrip, { providers: platform.providers });
    return { ...view, platform, store: TestBed.inject(GameStore) };
  };

  /** The value next to a field label. */
  const value = (label: string) => screen.getByText(label).nextElementSibling;

  it('shows the score, the selected points and the time', async () => {
    const { store, platform, fixture } = await setup();
    expect(value('Score')).toHaveTextContent('100');
    expect(value('Selected')).toHaveTextContent('–');
    expect(value('Time')).toHaveTextContent('‖ 1:05');
    store.resume();
    store.tap({ row: 11, col: 9 });
    platform.clock.advance(2000);
    fixture.detectChanges();
    expect(value('Selected')).toHaveTextContent('2');
    expect(value('Time')).toHaveTextContent('1:07');
    expect(value('Time')?.textContent).not.toContain('‖');
  });

  it('keeps label and value pairs in a description list', async () => {
    await setup();
    expect(screen.getAllByRole('term').map((term) => term.textContent)).toEqual([
      'Score',
      'Selected',
      'Time',
    ]);
    expect(screen.getAllByRole('definition')).toHaveLength(3);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm test`
Expected: FAIL. The build reports `Could not resolve "./status-strip"` and `Could not resolve "./title-bar"`.

- [ ] **Step 3: Implement**

In `angular.json` (`projects.bubble-breaker.architect.build.options`), add the stylesheet:

```json
            "styles": ["src/styles/tokens.css", "src/styles/base.css", "src/styles/chrome.css"]
```

`src/styles/chrome.css`:

```css
/* Shared chrome controls from the Component Sheet (§4). Components add layout only. */
.bb-button {
  min-height: var(--bb-target-min);
  margin: 0;
  padding: 0 var(--bb-space-6);
  border: 0;
  border-radius: var(--bb-radius);
  background: var(--bb-face);
  box-shadow: var(--bb-bevel-out);
  color: var(--bb-text);
  font: 400 var(--bb-fs-m) / 1 var(--bb-font);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
.bb-button:active {
  padding-top: 2px;
  box-shadow: var(--bb-bevel-in);
}
.bb-button:focus-visible {
  outline: var(--bb-focus-chrome);
  outline-offset: -6px;
}
/* Default button: bold label and a 1 px black ring (Cancel, Resume, New Game). */
.bb-button--default {
  font-weight: 700;
  box-shadow: var(--bb-default-ring), var(--bb-bevel-out);
}
.bb-button--default:active {
  box-shadow: var(--bb-default-ring), var(--bb-bevel-in);
}

/* Dialog window: bevelled face with a navy title bar. */
.bb-window {
  padding: 3px;
  background: var(--bb-face);
  box-shadow: var(--bb-bevel-out), var(--bb-popup-shadow);
}
.bb-window__title {
  display: flex;
  align-items: center;
  height: 22px;
  margin: 0;
  padding: 0 var(--bb-space-3);
  background: linear-gradient(90deg, var(--bb-title-from), var(--bb-title-to));
  color: var(--bb-title-text);
  font: 700 var(--bb-fs-s) / 1 var(--bb-font);
}
.bb-window__body {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 12px 10px 10px;
}
.bb-window__text {
  margin: 0;
  font: 400 var(--bb-fs-m) / 1.45 var(--bb-font);
}
```

In `src/app/strings.ts`, add the three labels at the top of the existing `status` block:

```ts
  status: {
    score: 'Score',
    selected: 'Selected',
    time: 'Time',
```

`src/app/ui/chrome/title-bar.ts`:

```ts
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { STRINGS } from '../../strings';

/** Navy gradient bar with the app name (26 px, Component Sheet §4). */
@Component({
  selector: 'bb-title-bar',
  template: '<header class="title-bar">{{ strings.appTitle }}</header>',
  styleUrl: './title-bar.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TitleBar {
  protected readonly strings = STRINGS;
}
```

`src/app/ui/chrome/title-bar.css`:

```css
:host {
  display: block;
  flex: none;
}
.title-bar {
  display: flex;
  align-items: center;
  height: var(--bb-titlebar-h);
  padding: 0 var(--bb-space-4);
  background: linear-gradient(90deg, var(--bb-title-from), var(--bb-title-to));
  color: var(--bb-title-text);
  font: 700 var(--bb-fs-m) / 1 var(--bb-font);
}
```

`src/app/ui/chrome/status-strip.ts`:

```ts
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { GameStore } from '../../state/game.store';
import { STRINGS } from '../../strings';

/** Score · Selected · Time in sunken fields above the board (30 px, Component Sheet §4). */
@Component({
  selector: 'bb-status-strip',
  templateUrl: './status-strip.html',
  styleUrl: './status-strip.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatusStrip {
  protected readonly store = inject(GameStore);
  protected readonly strings = STRINGS;
}
```

`src/app/ui/chrome/status-strip.html`:

```html
<dl class="strip">
  <div class="field">
    <dt>{{ strings.status.score }}</dt>
    <dd class="value">{{ store.scoreText() }}</dd>
  </div>
  <div class="field">
    <dt>{{ strings.status.selected }}</dt>
    <dd class="value">{{ store.selectedText() }}</dd>
  </div>
  <div class="field field--time">
    <dt>{{ strings.status.time }}</dt>
    <dd>{{ store.timeText() }}</dd>
  </div>
</dl>
```

`src/app/ui/chrome/status-strip.css`:

```css
:host {
  display: block;
  flex: none;
}
.strip {
  display: flex;
  align-items: center;
  gap: var(--bb-space-2);
  height: var(--bb-status-h);
  margin: 0;
  padding: 0 var(--bb-space-2);
  background: var(--bb-face);
  box-shadow:
    inset 0 1px 0 var(--bb-hilight),
    inset 0 -1px 0 var(--bb-shadow);
}
.field {
  flex: 1;
  min-width: 0;
  height: var(--bb-field-h);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--bb-space-3);
  background: var(--bb-field);
  box-shadow: var(--bb-field-sunken);
  font: 400 var(--bb-fs-s) / 1 var(--bb-font);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.field--time {
  flex: none;
  width: 84px;
}
dd {
  margin: 0;
}
.value {
  font-weight: 700;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test && npx eslint src/app/ui/chrome src/app/strings.ts && npx prettier --check src angular.json`
Expected: PASS (34 files, 259 tests); ESLint reports no problems; Prettier reports all files formatted.

- [ ] **Step 5: Commit**

```bash
git add angular.json src/styles/chrome.css src/app/strings.ts src/app/ui/chrome/title-bar.* src/app/ui/chrome/status-strip.*
git commit -m "feat(ui): title bar, status strip and shared chrome styles"
```

---

### Task 4: Softkey bar

**Files:**
- Create: `src/app/ui/chrome/softkey-bar.ts`, `softkey-bar.html`, `softkey-bar.css`, `softkey-bar.spec.ts`
- Modify: `src/app/strings.ts`

**Interfaces:**
- Produces: `SoftkeyBar` (`bb-softkey-bar`): inputs `leftLabel` (required), `menuOpen` (default false); outputs `left`, `menu` (carries the Menu button element). The Menu softkey has `aria-haspopup="menu"`, `aria-expanded` and the pressed bevel (`key--open`) while the menu is open. Height `--bb-softkey-h` (44 px, 32 px under `pointer: fine`), `z-index: var(--bb-z-softkeys)`.

- [ ] **Step 1: Write the failing test**

`src/app/ui/chrome/softkey-bar.spec.ts`:

```ts
import { fireEvent, render, screen } from '@testing-library/angular';
import { SoftkeyBar } from './softkey-bar';

describe('SoftkeyBar', () => {
  const setup = async (menuOpen = false) => {
    const left = vi.fn<() => void>();
    const menu = vi.fn<(key: HTMLElement) => void>();
    const view = await render(SoftkeyBar, {
      inputs: { leftLabel: 'New Game', menuOpen },
      on: { left, menu },
    });
    return { ...view, left, menu };
  };

  it('shows the left softkey and the Menu softkey', async () => {
    await setup();
    expect(screen.getAllByRole('button').map((key) => key.textContent.trim())).toEqual([
      'New Game',
      'Menu',
    ]);
  });

  it('reports presses; Menu sends its own button for the focus return', async () => {
    const { left, menu } = await setup();
    fireEvent.click(screen.getByRole('button', { name: 'New Game' }));
    expect(left).toHaveBeenCalledTimes(1);
    const menuKey = screen.getByRole('button', { name: 'Menu' });
    fireEvent.click(menuKey);
    expect(menu).toHaveBeenCalledWith(menuKey);
  });

  it('marks the Menu softkey as a popup button and shows it pressed while open', async () => {
    const { rerender } = await setup();
    const menuKey = screen.getByRole('button', { name: 'Menu' });
    expect(menuKey).toHaveAttribute('aria-haspopup', 'menu');
    expect(menuKey).toHaveAttribute('aria-expanded', 'false');
    await rerender({ inputs: { leftLabel: 'Done', menuOpen: true }, partialUpdate: true });
    expect(menuKey).toHaveAttribute('aria-expanded', 'true');
    expect(menuKey).toHaveClass('key--open');
    expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test`
Expected: FAIL. The build reports `Could not resolve "./softkey-bar"`.

- [ ] **Step 3: Implement**

In `src/app/strings.ts`, add before `board: {`:

```ts
  softkeys: {
    newGame: 'New Game',
    /** Left softkey on every screen except the Game screen: back to the game. */
    done: 'Done',
    menu: 'Menu',
  },
```

`src/app/ui/chrome/softkey-bar.ts`:

```ts
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { STRINGS } from '../../strings';

/** Two softkeys at the bottom: New Game or Done on the left, Menu on the right (02-ux). */
@Component({
  selector: 'bb-softkey-bar',
  templateUrl: './softkey-bar.html',
  styleUrl: './softkey-bar.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SoftkeyBar {
  readonly leftLabel = input.required<string>();
  /** The popup menu is open: the Menu softkey shows pressed. */
  readonly menuOpen = input(false);
  readonly left = output();
  /** Menu pressed; carries the softkey so focus can return to it when the menu closes. */
  readonly menu = output<HTMLElement>();

  protected readonly strings = STRINGS;
}
```

`src/app/ui/chrome/softkey-bar.html`:

```html
<div class="bar">
  <button type="button" class="bb-button key" (click)="left.emit()">{{ leftLabel() }}</button>
  <button
    #menuKey
    type="button"
    class="bb-button key"
    aria-haspopup="menu"
    [attr.aria-expanded]="menuOpen()"
    [class.key--open]="menuOpen()"
    (click)="menu.emit(menuKey)"
  >
    {{ strings.softkeys.menu }}
  </button>
</div>
```

`src/app/ui/chrome/softkey-bar.css`:

```css
:host {
  display: block;
  flex: none;
  position: relative;
  z-index: var(--bb-z-softkeys);
}
.bar {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--bb-space-1);
  height: var(--bb-softkey-h);
  padding: var(--bb-space-1);
  background: var(--bb-face);
  box-shadow: inset 0 1px 0 var(--bb-hilight);
}
.key {
  min-height: 0;
  padding: 0;
}
.key--open {
  padding-top: 2px;
  box-shadow: var(--bb-bevel-in);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test && npx eslint src/app/ui/chrome src/app/strings.ts`
Expected: PASS (35 files, 262 tests); ESLint reports no problems.

- [ ] **Step 5: Commit**

```bash
git add src/app/strings.ts src/app/ui/chrome/softkey-bar.*
git commit -m "feat(ui): softkey bar with a popup menu button"
```

---

### Task 5: Popup menu

**Files:**
- Create: `src/app/ui/chrome/popup-menu.ts`, `popup-menu.html`, `popup-menu.css`, `popup-menu.spec.ts`

**Interfaces:**
- Produces: `MenuItem { id; label; separatorBefore? }` and `PopupMenu` (`bb-popup-menu`): inputs `items`, `label` (accessible name); outputs `choose` (item id), `dismiss`. Items are `<button role="menuitem" tabindex="-1">` in a `role="menu"`; the first item gets focus after render. Keys: ArrowDown/ArrowUp (wrapping), Home, End; Escape and Tab emit `dismiss` (default prevented). Pointer hover focuses the row. The host is an absolute layer over everything above the softkeys (`inset: 0 0 var(--bb-softkey-h) 0`, `z-index: var(--bb-z-menu)`); a click on the host itself emits `dismiss`, so the closing press never reaches the board. The 184 px menu sits 2 px above the softkeys at the right.

- [ ] **Step 1: Write the failing test**

`src/app/ui/chrome/popup-menu.spec.ts`:

```ts
import { fireEvent, render, screen } from '@testing-library/angular';
import { PopupMenu, type MenuItem } from './popup-menu';

const ITEMS: readonly MenuItem[] = [
  { id: 'new-game', label: 'New Game' },
  { id: 'statistics', label: 'Statistics', separatorBefore: true },
  { id: 'about', label: 'About' },
];

describe('PopupMenu', () => {
  const setup = async () => {
    const choose = vi.fn<(id: string) => void>();
    const dismiss = vi.fn<() => void>();
    const view = await render(PopupMenu, {
      inputs: { items: ITEMS, label: 'Menu' },
      on: { choose, dismiss },
    });
    return {
      ...view,
      choose,
      dismiss,
      item: (name: string) => screen.getByRole('menuitem', { name }),
    };
  };

  it('lists the items with a separator and focuses the first one', async () => {
    const { item } = await setup();
    expect(screen.getByRole('menu', { name: 'Menu' })).toBeInTheDocument();
    expect(screen.getAllByRole('menuitem').map((row) => row.textContent.trim())).toEqual([
      'New Game',
      'Statistics',
      'About',
    ]);
    expect(screen.getByRole('separator')).toBeInTheDocument();
    expect(item('New Game')).toHaveFocus();
  });

  it('moves focus with the arrow keys (wrapping), Home and End', async () => {
    const { item } = await setup();
    const press = (key: string) => fireEvent.keyDown(document.activeElement!, { key });
    expect(press('ArrowDown')).toBe(false);
    expect(item('Statistics')).toHaveFocus();
    press('ArrowDown');
    press('ArrowDown');
    expect(item('New Game')).toHaveFocus();
    press('ArrowUp');
    expect(item('About')).toHaveFocus();
    press('Home');
    expect(item('New Game')).toHaveFocus();
    press('End');
    expect(item('About')).toHaveFocus();
    expect(press('a')).toBe(true);
  });

  it('follows the pointer and chooses the clicked item', async () => {
    const { item, choose } = await setup();
    fireEvent.pointerEnter(item('About'));
    expect(item('About')).toHaveFocus();
    fireEvent.click(item('Statistics'));
    expect(choose).toHaveBeenCalledWith('statistics');
  });

  it('closes on Escape, on Tab and on a press outside the menu', async () => {
    const { dismiss, fixture } = await setup();
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    expect(fireEvent.keyDown(document.activeElement!, { key: 'Tab' })).toBe(false);
    expect(dismiss).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole('menu'));
    expect(dismiss).toHaveBeenCalledTimes(2);
    fireEvent.click(fixture.nativeElement as HTMLElement);
    expect(dismiss).toHaveBeenCalledTimes(3);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test`
Expected: FAIL. The build reports `Could not resolve "./popup-menu"`.

- [ ] **Step 3: Implement**

`src/app/ui/chrome/popup-menu.ts`:

```ts
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  output,
  viewChildren,
} from '@angular/core';

export interface MenuItem {
  readonly id: string;
  readonly label: string;
  /** Draw a separator line above this item. */
  readonly separatorBefore?: boolean;
}

/**
 * Popup menu above the Menu softkey (02-ux "Accessibility"): focus starts on the first item,
 * arrows move it (wrapping), Home/End jump, Enter/Space choose, Esc or Tab closes. The host is a
 * transparent layer over everything above the softkeys; a press on it closes the menu.
 */
@Component({
  selector: 'bb-popup-menu',
  templateUrl: './popup-menu.html',
  styleUrl: './popup-menu.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(click)': 'onClick($event)', '(keydown)': 'onKeydown($event)' },
})
export class PopupMenu {
  readonly items = input.required<readonly MenuItem[]>();
  /** Accessible name of the menu. */
  readonly label = input.required<string>();
  readonly choose = output<string>();
  readonly dismiss = output();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly rows = viewChildren<ElementRef<HTMLButtonElement>>('row');

  constructor() {
    afterNextRender(() => {
      this.focusAt(0);
    });
  }

  protected onClick(event: MouseEvent): void {
    if (event.target === this.host.nativeElement) {
      this.dismiss.emit();
    }
  }

  protected onKeydown(event: KeyboardEvent): void {
    const rows = this.rows().map((row) => row.nativeElement);
    const current = rows.findIndex((row) => row === document.activeElement);
    switch (event.key) {
      case 'ArrowDown':
        this.focusAt((current + 1) % rows.length);
        break;
      case 'ArrowUp':
        this.focusAt((current - 1 + rows.length) % rows.length);
        break;
      case 'Home':
        this.focusAt(0);
        break;
      case 'End':
        this.focusAt(rows.length - 1);
        break;
      case 'Escape':
      case 'Tab':
        this.dismiss.emit();
        break;
      default:
        return;
    }
    event.preventDefault();
  }

  protected focusAt(index: number): void {
    this.rows()[index]?.nativeElement.focus();
  }
}
```

`src/app/ui/chrome/popup-menu.html`:

```html
<div class="menu" role="menu" [attr.aria-label]="label()">
  @for (item of items(); track item.id; let index = $index) {
    @if (item.separatorBefore) {
      <div class="separator" role="separator"></div>
    }
    <button
      #row
      type="button"
      role="menuitem"
      class="item"
      tabindex="-1"
      (pointerenter)="focusAt(index)"
      (click)="choose.emit(item.id)"
    >
      {{ item.label }}
    </button>
  }
</div>
```

`src/app/ui/chrome/popup-menu.css`:

```css
:host {
  position: absolute;
  inset: 0 0 var(--bb-softkey-h) 0;
  z-index: var(--bb-z-menu);
}
.menu {
  position: absolute;
  right: var(--bb-space-1);
  bottom: var(--bb-space-1);
  width: 184px;
  display: flex;
  flex-direction: column;
  padding: var(--bb-space-1) 0;
  background: var(--bb-field);
  border: 1px solid var(--bb-text);
  box-shadow: var(--bb-popup-shadow);
}
.item {
  height: var(--bb-menu-row-h);
  margin: 0;
  padding: 0 var(--bb-space-5);
  border: 0;
  background: var(--bb-field);
  color: var(--bb-text);
  font: 400 var(--bb-fs-m) / 1 var(--bb-font);
  text-align: left;
  cursor: pointer;
}
.item:focus {
  outline: none;
  background: var(--bb-accent);
  color: var(--bb-title-text);
}
.separator {
  height: 1px;
  margin: var(--bb-space-1) var(--bb-space-2);
  background: var(--bb-shadow);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test && npx eslint src/app/ui/chrome`
Expected: PASS (36 files, 266 tests); ESLint reports no problems.

- [ ] **Step 5: Commit**

```bash
git add src/app/ui/chrome/popup-menu.*
git commit -m "feat(ui): popup menu with roving focus"
```

---

### Task 6: Confirm dialog

**Files:**
- Create: `src/app/ui/chrome/confirm-dialog.ts`, `confirm-dialog.html`, `confirm-dialog.css`, `confirm-dialog.spec.ts`
- Modify: `src/test-setup.ts`

**Interfaces:**
- Consumes: `Shell.openDialog()`.
- Produces: `ConfirmDialog` (`bb-confirm-dialog`): inputs `heading`, `message`, `confirmLabel`, `cancelLabel` (all required); outputs `confirm`, `dismiss`. It is open while the component exists: after render it calls `showModal()` and focuses Cancel (the default button); Esc (`cancel` event, default prevented) or a close by the browser emit `dismiss`. On destroy it closes, releases its `Shell` dialog count and focuses the element that had focus when it was created. `role="alertdialog"`, labelled by its title, described by its message; max 300 px wide, `rgba(0,0,0,.3)` backdrop.

- [ ] **Step 1: Write the failing test**

`src/app/ui/chrome/confirm-dialog.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { fireEvent, render, screen } from '@testing-library/angular';
import { createFakePlatform } from '../../platform/testing/fakes';
import { GameStore } from '../../state/game.store';
import { ConfirmDialog } from './confirm-dialog';

describe('ConfirmDialog', () => {
  const setup = async () => {
    const confirm = vi.fn<() => void>();
    const dismiss = vi.fn<() => void>();
    const view = await render(ConfirmDialog, {
      inputs: {
        heading: 'Reset statistics',
        message: 'Clear everything?',
        confirmLabel: 'Reset',
        cancelLabel: 'Cancel',
      },
      on: { confirm, dismiss },
      providers: createFakePlatform().providers,
    });
    return { ...view, confirm, dismiss, dialog: screen.getByRole('alertdialog') };
  };

  afterEach(() => {
    document.body.replaceChildren();
  });

  it('opens as a modal alert dialog with its title and message', async () => {
    const { dialog } = await setup();
    expect(dialog).toHaveAttribute('open');
    expect(dialog).toHaveAccessibleName('Reset statistics');
    expect(dialog).toHaveAccessibleDescription('Clear everything?');
  });

  it('starts on Cancel, the default button, and reports the choice', async () => {
    const { confirm, dismiss } = await setup();
    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    expect(cancelButton).toHaveFocus();
    expect(cancelButton).toHaveClass('bb-button--default');
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(confirm).toHaveBeenCalledTimes(1);
    fireEvent.click(cancelButton);
    expect(dismiss).toHaveBeenCalledTimes(1);
  });

  it('cancels on Escape and when the browser closes it', async () => {
    const { dialog, dismiss } = await setup();
    const escape = new Event('cancel', { cancelable: true });
    fireEvent(dialog, escape);
    expect(escape.defaultPrevented).toBe(true);
    expect(dismiss).toHaveBeenCalledTimes(1);
    (dialog as HTMLDialogElement).close();
    expect(dismiss).toHaveBeenCalledTimes(2);
  });

  it('covers the board while open, then gives focus back without cancelling', async () => {
    const opener = document.createElement('button');
    document.body.append(opener);
    opener.focus();
    const { fixture, dismiss } = await setup();
    const store = TestBed.inject(GameStore);
    TestBed.tick();
    expect(store.covered()).toBe(true);
    fixture.destroy();
    TestBed.tick();
    expect(store.covered()).toBe(false);
    expect(opener).toHaveFocus();
    expect(dismiss).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test`
Expected: FAIL. The build reports `Could not resolve "./confirm-dialog"`.

- [ ] **Step 3: Implement**

`src/test-setup.ts` (jsdom 30 lacks the dialog methods; without this, `showModal` throws `is not a function`):

```ts
import '@testing-library/jest-dom/vitest';

// jsdom 30 has no HTMLDialogElement.showModal() or close(). This stand-in only opens the dialog
// and fires `close`; the real focus trap, Esc and top layer are checked in the browser.
if (!('showModal' in HTMLDialogElement.prototype)) {
  Object.assign(HTMLDialogElement.prototype, {
    showModal(this: HTMLDialogElement): void {
      this.open = true;
    },
    close(this: HTMLDialogElement): void {
      if (this.open) {
        this.open = false;
        this.dispatchEvent(new Event('close'));
      }
    },
  });
}
```

`src/app/ui/chrome/confirm-dialog.ts`:

```ts
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { Shell } from './shell';

let nextId = 0;

/**
 * Modal confirmation (02-ux "Accessibility"): a native `<dialog>` opened with `showModal()`, so
 * the browser traps focus and Esc cancels. Focus starts on Cancel, the default button, and goes
 * back to the element that had it when the dialog closes. Open while the component exists.
 */
@Component({
  selector: 'bb-confirm-dialog',
  templateUrl: './confirm-dialog.html',
  styleUrl: './confirm-dialog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmDialog {
  readonly heading = input.required<string>();
  readonly message = input.required<string>();
  readonly confirmLabel = input.required<string>();
  readonly cancelLabel = input.required<string>();
  readonly confirm = output();
  readonly dismiss = output();

  protected readonly titleId = `bb-dialog-${String(nextId)}-title`;
  protected readonly messageId = `bb-dialog-${String(nextId++)}-message`;
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly cancelButton = viewChild.required<ElementRef<HTMLButtonElement>>('cancelButton');
  private readonly opener = document.activeElement;
  private closing = false;

  constructor() {
    const release = inject(Shell).openDialog();
    afterNextRender(() => {
      this.dialog().nativeElement.showModal();
      this.cancelButton().nativeElement.focus();
    });
    inject(DestroyRef).onDestroy(() => {
      this.closing = true;
      this.dialog().nativeElement.close();
      release();
      if (this.opener instanceof HTMLElement) {
        this.opener.focus();
      }
    });
  }

  /** Esc: the parent decides, so the dialog stays until it is removed. */
  protected onCancel(event: Event): void {
    event.preventDefault();
    this.dismiss.emit();
  }

  /** The browser closed the dialog on its own (a repeated Esc skips `cancel`). */
  protected onClose(): void {
    if (!this.closing) {
      this.dismiss.emit();
    }
  }
}
```

`src/app/ui/chrome/confirm-dialog.html`:

```html
<dialog
  #dialog
  class="bb-window dialog"
  role="alertdialog"
  [attr.aria-labelledby]="titleId"
  [attr.aria-describedby]="messageId"
  (cancel)="onCancel($event)"
  (close)="onClose()"
>
  <h2 class="bb-window__title" [id]="titleId">{{ heading() }}</h2>
  <div class="bb-window__body">
    <p class="bb-window__text" [id]="messageId">{{ message() }}</p>
    <div class="actions">
      <button type="button" class="bb-button" (click)="confirm.emit()">{{ confirmLabel() }}</button>
      <button
        #cancelButton
        type="button"
        class="bb-button bb-button--default"
        (click)="dismiss.emit()"
      >
        {{ cancelLabel() }}
      </button>
    </div>
  </div>
</dialog>
```

`src/app/ui/chrome/confirm-dialog.css`:

```css
.dialog {
  width: min(300px, 100% - 2 * var(--bb-space-6));
  max-width: none;
  border: 0;
  color: var(--bb-text);
}
.dialog::backdrop {
  background: rgba(0, 0, 0, 0.3);
}
.actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--bb-space-3);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test && npx eslint src/app/ui/chrome src/test-setup.ts`
Expected: PASS (37 files, 270 tests); ESLint reports no problems.

- [ ] **Step 5: Commit**

```bash
git add src/test-setup.ts src/app/ui/chrome/confirm-dialog.*
git commit -m "feat(ui): modal confirm dialog that starts on Cancel"
```

---

### Task 7: Toast

**Files:**
- Create: `src/app/ui/chrome/toast.ts`, `toast.html`, `toast.css`, `toast.spec.ts`
- Modify: `src/app/strings.ts`

**Interfaces:**
- Produces: `Toast` (`bb-toast`, host `role="status"`): inputs `heading` (required, bold), `detail` (default `''`), `actionLabel` (`string | null`, default null), `dismissible` (default false); outputs `act`, `dismiss`. The × button is 44 × 44 with `aria-label` `STRINGS.toast.dismiss`. Enters with opacity 0 → 1 and translateY −4 px → 0 over `--bb-dur-toast` (0 ms under reduced motion via the token). Nothing mounts it until Plan 06.

- [ ] **Step 1: Write the failing test**

`src/app/ui/chrome/toast.spec.ts`:

```ts
import { fireEvent, render, screen } from '@testing-library/angular';
import { Toast } from './toast';

describe('Toast', () => {
  it('is a status notice with a bold title and its detail', async () => {
    await render(Toast, {
      inputs: { heading: 'Ready to play offline.', detail: 'No connection needed.' },
    });
    expect(screen.getByRole('status')).toHaveTextContent(
      'Ready to play offline. No connection needed.',
    );
    expect(screen.getByText('Ready to play offline.').tagName).toBe('STRONG');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('offers an action and a dismiss button when asked', async () => {
    const act = vi.fn<() => void>();
    const dismiss = vi.fn<() => void>();
    await render(Toast, {
      inputs: { heading: 'New version available.', actionLabel: 'Reload', dismissible: true },
      on: { act, dismiss },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
    expect(act).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(dismiss).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test`
Expected: FAIL. The build reports `Could not resolve "./toast"`.

- [ ] **Step 3: Implement**

In `src/app/strings.ts`, add before `board: {`:

```ts
  toast: {
    /** `aria-label` of the × button on a notice. */
    dismiss: 'Dismiss',
  },
```

`src/app/ui/chrome/toast.ts`:

```ts
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { STRINGS } from '../../strings';

/**
 * A notice on the tooltip-yellow face (Component Sheet §4) with an optional action and ×.
 * It fades and slides in with the toast motion tokens. Plan 06 shows the PWA notices with it.
 */
@Component({
  selector: 'bb-toast',
  templateUrl: './toast.html',
  styleUrl: './toast.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'status' },
})
export class Toast {
  readonly heading = input.required<string>();
  readonly detail = input('');
  /** Label of the action button; no button when null. */
  readonly actionLabel = input<string | null>(null);
  readonly dismissible = input(false);
  readonly act = output();
  readonly dismiss = output();

  protected readonly strings = STRINGS;
}
```

`src/app/ui/chrome/toast.html`:

```html
<p class="text">
  <strong>{{ heading() }}</strong>
  {{ detail() }}
</p>
@if (actionLabel(); as label) {
  <button type="button" class="bb-button action" (click)="act.emit()">{{ label }}</button>
}
@if (dismissible()) {
  <button
    type="button"
    class="close"
    [attr.aria-label]="strings.toast.dismiss"
    (click)="dismiss.emit()"
  >
    ×
  </button>
}
```

`src/app/ui/chrome/toast.css`:

```css
:host {
  display: flex;
  align-items: center;
  gap: var(--bb-space-4);
  min-height: 28px;
  padding: var(--bb-space-3) var(--bb-space-3) var(--bb-space-3) 10px;
  background: var(--bb-tip);
  border: 1px solid var(--bb-text);
  box-shadow: 2px 2px 0 rgba(0, 0, 0, 0.3);
  animation: toast-in var(--bb-dur-toast) var(--bb-ease-toast);
}
@keyframes toast-in {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
}
.text {
  flex: 1;
  margin: 0;
  font: 400 var(--bb-fs-s) / 1.4 var(--bb-font);
}
.action {
  padding: 0 14px;
}
.close {
  width: var(--bb-target-min);
  height: var(--bb-target-min);
  margin: calc(-1 * var(--bb-space-3)) calc(-1 * var(--bb-space-3)) calc(-1 * var(--bb-space-3)) 0;
  border: 0;
  background: transparent;
  color: var(--bb-text);
  font: 700 14px / 1 var(--bb-font);
  cursor: pointer;
}
.close:focus-visible {
  outline: var(--bb-focus-chrome);
  outline-offset: -10px;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test && npx eslint src/app/ui/chrome src/app/strings.ts`
Expected: PASS (38 files, 272 tests); ESLint reports no problems.

- [ ] **Step 5: Commit**

```bash
git add src/app/strings.ts src/app/ui/chrome/toast.*
git commit -m "feat(ui): toast notice for the pwa flows"
```

---

### Task 8: Screen frame and stat rows

**Files:**
- Create: `src/app/ui/screens/screen.ts`, `screen.css`, `screen.spec.ts`, `stat-rows.ts`, `stat-rows.css`

**Interfaces:**
- Produces: `Screen` (`bb-screen`): input `heading` (required). Renders `<h1 tabindex="-1">` and projects the content into a white scroll column (padding 10/12/12, 10 px gap, inset top/left shadow). If `Router.navigated` is already true when it is created (an in-app navigation), it focuses the heading after the first render.
- Produces: `StatRow { label; value }` and `StatRows` (`bb-stat-rows`): input `rows`; a `<dl>` of 30 px rows with bold values.

- [ ] **Step 1: Write the failing tests**

`src/app/ui/screens/screen.spec.ts`:

```ts
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { render, screen } from '@testing-library/angular';
import { Screen } from './screen';
import { StatRows } from './stat-rows';

@Component({
  selector: 'bb-test-page',
  imports: [Screen],
  template: '<bb-screen [heading]="heading"><p>Body</p></bb-screen>',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class Page {
  protected readonly heading = 'Statistics';
}

describe('Screen', () => {
  it('shows the heading above the content', async () => {
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: 'a', component: Page }])],
    });
    const harness = await RouterTestingHarness.create('/a');
    expect(screen.getByRole('heading', { level: 1, name: 'Statistics' })).toBeInTheDocument();
    expect(harness.routeNativeElement).toHaveTextContent('StatisticsBody');
  });

  it('takes focus after an in-app navigation, but not on the first page load', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'a', component: Page },
          { path: 'b', component: Page },
        ]),
      ],
    });
    const harness = await RouterTestingHarness.create('/a');
    expect(screen.getByRole('heading')).not.toHaveFocus();
    await harness.navigateByUrl('/b');
    expect(screen.getByRole('heading')).toHaveFocus();
  });
});

describe('StatRows', () => {
  it('lists label and value pairs', async () => {
    await render(StatRows, {
      inputs: {
        rows: [
          { label: 'High Score', value: '1,318' },
          { label: 'Games Played', value: '22' },
        ],
      },
    });
    expect(screen.getAllByRole('term').map((term) => term.textContent)).toEqual([
      'High Score',
      'Games Played',
    ]);
    expect(screen.getAllByRole('definition').map((value) => value.textContent)).toEqual([
      '1,318',
      '22',
    ]);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm test`
Expected: FAIL. The build reports `Could not resolve "./screen"` and `Could not resolve "./stat-rows"`.

- [ ] **Step 3: Implement**

`src/app/ui/screens/screen.ts` (the template reference is `#title`, not `#heading`: a reference named like the input shadows it in the template and fails with `TS2349: This expression is not callable`):

```ts
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';

/**
 * Frame of every screen except the Game screen: a white scroll area between the title bar and
 * the softkeys, with the screen's heading on top. After an in-app navigation the heading takes
 * focus, so keyboard and screen-reader users start on the new screen; a fresh page load
 * leaves focus alone.
 */
@Component({
  selector: 'bb-screen',
  template: `
    <h1 #title class="heading" tabindex="-1">{{ heading() }}</h1>
    <ng-content />
  `,
  styleUrl: './screen.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Screen {
  readonly heading = input.required<string>();
  private readonly titleRef = viewChild.required<ElementRef<HTMLElement>>('title');

  constructor() {
    // False while the first navigation of the page is still running.
    const inApp = inject(Router).navigated;
    afterNextRender(() => {
      if (inApp) {
        this.titleRef().nativeElement.focus();
      }
    });
  }
}
```

`src/app/ui/screens/screen.css`:

```css
:host {
  flex: 1;
  min-height: 0;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px var(--bb-space-5) var(--bb-space-5);
  background: var(--bb-field);
  box-shadow: inset 1px 1px 0 var(--bb-shadow);
  font: 400 var(--bb-fs-m) / 1.45 var(--bb-font);
}
.heading {
  margin: 0;
  padding-bottom: var(--bb-space-2);
  border-bottom: 1px solid var(--bb-accent);
  color: var(--bb-accent);
  font: 700 var(--bb-fs-m) / 1.2 var(--bb-font);
}
.heading:focus {
  outline: none;
}
```

`src/app/ui/screens/stat-rows.ts`:

```ts
import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export interface StatRow {
  readonly label: string;
  readonly value: string;
}

/** Label/value rows of the Scoring and Statistics screens. */
@Component({
  selector: 'bb-stat-rows',
  template: `
    <dl class="rows">
      @for (row of rows(); track row.label) {
        <div class="row">
          <dt>{{ row.label }}</dt>
          <dd>{{ row.value }}</dd>
        </div>
      }
    </dl>
  `,
  styleUrl: './stat-rows.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatRows {
  readonly rows = input.required<readonly StatRow[]>();
}
```

`src/app/ui/screens/stat-rows.css`:

```css
.rows {
  display: flex;
  flex-direction: column;
  margin: 0;
}
.row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  min-height: 30px;
  border-bottom: 1px solid var(--bb-face);
  font-variant-numeric: tabular-nums;
}
dd {
  margin: 0;
  font-weight: 700;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test && npx eslint src/app/ui/screens`
Expected: PASS (39 files, 275 tests); ESLint reports no problems.

- [ ] **Step 5: Commit**

```bash
git add src/app/ui/screens/screen.* src/app/ui/screens/stat-rows.*
git commit -m "feat(ui): screen frame with heading focus and stat rows"
```

---

### Task 9: How to Play and About

**Files:**
- Create: `src/app/version.ts`, `src/app/ui/screens/how-to-play-screen.ts`, `.html`, `.css`, `.spec.ts`, `src/app/ui/screens/about-screen.ts`, `.html`, `.css`, `.spec.ts`
- Modify: `src/app/strings.ts`

**Interfaces:**
- Produces: `VERSION` (`src/app/version.ts`), `'0.0.0'`, marked `// x-release-please-version` for Plan 07.
- Produces: `HowToPlayScreen` (`bb-how-to-play-screen`): two rule paragraphs, the points box ("Points = n × (n − 1)" and a `<dl>` 2→2, 5→20, 10→90, 20→380), "no undo" and the keyboard help with N and M.
- Produces: `AboutScreen` (`bb-about-screen`): 2 × 2 ball logo (`aria-hidden`), name, "Version 0.0.0", tribute note, offline/no-tracking note.
- Every routed screen's host is a flex column that fills `<main>` (`:host { flex: 1; min-height: 0; display: flex; flex-direction: column; }`), so `bb-screen` can scroll.

- [ ] **Step 1: Write the failing tests**

`src/app/ui/screens/how-to-play-screen.spec.ts`:

```ts
import { render, screen } from '@testing-library/angular';
import { HowToPlayScreen } from './how-to-play-screen';

describe('HowToPlayScreen', () => {
  beforeEach(async () => {
    await render(HowToPlayScreen);
  });

  it('explains selecting, bursting and the end of the game', () => {
    expect(screen.getByRole('heading', { name: 'How to Play' })).toBeInTheDocument();
    expect(screen.getByText(/^Tap a group of two or more touching balls/)).toBeInTheDocument();
    expect(screen.getByText(/empty columns close up to the right/)).toBeInTheDocument();
    expect(screen.getByText(/There is no undo\.$/)).toBeInTheDocument();
  });

  it('shows the points table (02-ux: 2→2, 5→20, 10→90, 20→380)', () => {
    expect(screen.getByText('Points = n × (n − 1)')).toBeInTheDocument();
    const pairs = screen
      .getAllByRole('term')
      .map((term) => `${term.textContent}=${term.nextElementSibling?.textContent ?? ''}`);
    expect(pairs).toEqual(['2 balls=2', '5 balls=20', '10 balls=90', '20 balls=380']);
  });

  it('lists the keyboard keys, N and M included', () => {
    expect(screen.getByText(/^Keyboard: arrow keys move/)).toHaveTextContent(
      'N starts a new game and M opens the menu.',
    );
  });
});
```

`src/app/ui/screens/about-screen.spec.ts`:

```ts
import { render, screen } from '@testing-library/angular';
import { VERSION } from '../../version';
import { AboutScreen } from './about-screen';

describe('AboutScreen', () => {
  it('shows the name, version, tribute note and privacy note', async () => {
    await render(AboutScreen);
    expect(screen.getByRole('heading', { name: 'About' })).toBeInTheDocument();
    expect(screen.getByText('Bubble Breaker')).toBeInTheDocument();
    expect(screen.getByText(`Version ${VERSION}`)).toBeInTheDocument();
    expect(screen.getByText(/Not affiliated with any original publisher\.$/)).toBeInTheDocument();
    expect(screen.getByText(/No accounts, no tracking\./)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm test`
Expected: FAIL. The build reports `Could not resolve "../../version"`, `Could not resolve "./about-screen"` and `Could not resolve "./how-to-play-screen"`.

- [ ] **Step 3: Implement**

In `src/app/strings.ts`, add before `board: {` (texts from the Game Screen prototype; the keyboard line adds N and M):

```ts
  howToPlay: {
    title: 'How to Play',
    select:
      'Tap a group of two or more touching balls of the same color. The group is highlighted and shows the points it is worth.',
    burst:
      'Tap the group again to burst it. Balls above fall down, and empty columns close up to the right.',
    formula: 'Points = n × (n − 1)',
    balls: (count: number) => `${String(count)} balls`,
    plan: 'Big groups score far more, so plan ahead. The game ends when no two touching balls share a color. There is no undo.',
    keyboard:
      'Keyboard: arrow keys move, Enter or Space selects and bursts, Esc clears the selection, N starts a new game and M opens the menu.',
  },
  about: {
    title: 'About',
    version: (version: string) => `Version ${version}`,
    tribute:
      'A tribute to the pocket-computer puzzle classic Jawbreaker by oopdreams. Not affiliated with any original publisher.',
    privacy: 'Works offline once loaded. No accounts, no tracking. Statistics stay on this device.',
  },
```

`src/app/version.ts`:

```ts
/** Shown on the About screen. release-please bumps it together with package.json (Plan 07). */
export const VERSION = '0.0.0'; // x-release-please-version
```

`src/app/ui/screens/how-to-play-screen.ts`:

```ts
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { formatNumber } from '../../state/format';
import { STRINGS } from '../../strings';
import { Screen } from './screen';

/** Group sizes of the points table in 02-ux. */
const EXAMPLES = [2, 5, 10, 20] as const;

/** Rules in short, the points table, "no undo" and the keyboard keys (02-ux "Screens"). */
@Component({
  selector: 'bb-how-to-play-screen',
  imports: [Screen],
  templateUrl: './how-to-play-screen.html',
  styleUrl: './how-to-play-screen.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HowToPlayScreen {
  protected readonly strings = STRINGS;
  protected readonly points = EXAMPLES.map((size) => ({
    label: STRINGS.howToPlay.balls(size),
    value: formatNumber(size * (size - 1)),
  }));
}
```

`src/app/ui/screens/how-to-play-screen.html`:

```html
<bb-screen [heading]="strings.howToPlay.title">
  <p>{{ strings.howToPlay.select }}</p>
  <p>{{ strings.howToPlay.burst }}</p>
  <div class="formula">
    <p class="formula__title">{{ strings.howToPlay.formula }}</p>
    <dl class="points">
      @for (row of points; track row.label) {
        <div class="pair">
          <dt>{{ row.label }}</dt>
          <dd>{{ row.value }}</dd>
        </div>
      }
    </dl>
  </div>
  <p>{{ strings.howToPlay.plan }}</p>
  <p class="note">{{ strings.howToPlay.keyboard }}</p>
</bb-screen>
```

`src/app/ui/screens/how-to-play-screen.css`:

```css
:host {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
p {
  margin: 0;
}
.formula {
  display: flex;
  flex-direction: column;
  gap: var(--bb-space-2);
  padding: var(--bb-space-4) 10px;
  background: #f4f3ef;
  box-shadow:
    inset 1px 1px 0 var(--bb-shadow),
    inset -1px -1px 0 var(--bb-hilight);
}
.formula__title {
  font-weight: 700;
}
.points {
  display: grid;
  grid-template-columns: repeat(2, max-content);
  gap: var(--bb-space-1) var(--bb-space-6);
  margin: 0;
  font-size: var(--bb-fs-s);
  font-variant-numeric: tabular-nums;
}
.pair {
  display: flex;
  gap: var(--bb-space-6);
}
dd {
  margin: 0;
  font-weight: 700;
}
.note {
  color: var(--bb-text-muted);
  font-size: var(--bb-fs-s);
}
```

`src/app/ui/screens/about-screen.ts`:

```ts
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { STRINGS } from '../../strings';
import { VERSION } from '../../version';
import { Screen } from './screen';

/** Name, version, tribute note and the offline/no-tracking promise (02-ux "Screens"). */
@Component({
  selector: 'bb-about-screen',
  imports: [Screen],
  templateUrl: './about-screen.html',
  styleUrl: './about-screen.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AboutScreen {
  protected readonly strings = STRINGS;
  protected readonly version = STRINGS.about.version(VERSION);
  /** The four balls of the logo, in the Colorful set. */
  protected readonly logo = ['red', 'blue', 'green', 'purple'] as const;
}
```

`src/app/ui/screens/about-screen.html`:

```html
<bb-screen [heading]="strings.about.title">
  <div class="identity">
    <div class="logo" aria-hidden="true">
      @for (color of logo; track color) {
        <div class="bb-ball" [class]="'bb-ball--' + color"></div>
      }
    </div>
    <div>
      <p class="name">{{ strings.appTitle }}</p>
      <p class="note">{{ version }}</p>
    </div>
  </div>
  <p>{{ strings.about.tribute }}</p>
  <p class="note">{{ strings.about.privacy }}</p>
</bb-screen>
```

`src/app/ui/screens/about-screen.css`:

```css
:host {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
p {
  margin: 0;
}
.identity {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: var(--bb-space-3) 0;
}
.logo {
  display: grid;
  grid-template-columns: repeat(2, 20px);
  gap: 1px;
}
.logo .bb-ball {
  width: 20px;
}
.name {
  font-weight: 700;
}
.note {
  color: var(--bb-text-muted);
  font-size: var(--bb-fs-s);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test && npx eslint src/app/ui/screens src/app/version.ts src/app/strings.ts`
Expected: PASS (41 files, 279 tests); ESLint reports no problems.

- [ ] **Step 5: Commit**

```bash
git add src/app/version.ts src/app/strings.ts src/app/ui/screens/how-to-play-screen.* src/app/ui/screens/about-screen.*
git commit -m "feat(ui): how to play and about screens"
```

---

### Task 10: Options

**Files:**
- Create: `src/app/ui/screens/options-screen.ts`, `.html`, `.css`, `.spec.ts`
- Modify: `src/app/strings.ts`

**Interfaces:**
- Consumes: `SettingsStore`, `ballLook()`.
- Produces: `OptionsScreen` (`bb-options-screen`): fieldset "Breaker Set" with two native radios (Colorful / Greyscale Breakers, each with a five-ball preview, `aria-hidden`); fieldset "Accessibility and sound" with native checkboxes "Shape hints on Colorful Breakers" (described by its note, `disabled` on Greyscale) and "Sound". Every change goes straight to `SettingsStore`, which persists it. Rows are 44 px; the row of a keyboard-focused control gets the 1 px dotted rectangle.

- [ ] **Step 1: Write the failing test**

`src/app/ui/screens/options-screen.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { fireEvent, render, screen } from '@testing-library/angular';
import { createFakePlatform } from '../../platform/testing/fakes';
import { KEYS } from '../../state/persistence';
import { SettingsStore } from '../../state/settings.store';
import { OptionsScreen } from './options-screen';

describe('OptionsScreen', () => {
  const setup = async () => {
    const platform = createFakePlatform();
    const view = await render(OptionsScreen, { providers: platform.providers });
    return { ...view, platform, settings: TestBed.inject(SettingsStore) };
  };

  const hints = () => screen.getByRole('checkbox', { name: /^Shape hints on Colorful Breakers/ });

  it('shows the defaults: Colorful, shape hints off, sound on', async () => {
    await setup();
    expect(screen.getByRole('heading', { name: 'Options' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Breaker Set' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Colorful Breakers' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Greyscale Breakers' })).not.toBeChecked();
    expect(hints()).not.toBeChecked();
    expect(hints()).toBeEnabled();
    expect(hints()).toHaveAccessibleDescription(
      'Adds a small symbol to each color. Off by default.',
    );
    expect(screen.getByRole('checkbox', { name: 'Sound' })).toBeChecked();
  });

  it('previews each set with its five ball looks', async () => {
    const { fixture } = await setup();
    const previews = (fixture.nativeElement as HTMLElement).querySelectorAll('.preview');
    expect(previews[0]?.querySelectorAll('.bb-ball--red, .bb-ball--purple')).toHaveLength(2);
    expect(previews[1]?.querySelectorAll('.bb-ball')).toHaveLength(5);
    expect(previews[1]?.firstElementChild).toHaveClass('bb-ball--g1');
  });

  it('switches to Greyscale, persists it and disables the shape hints', async () => {
    const { settings, platform, fixture } = await setup();
    fireEvent.click(screen.getByRole('radio', { name: 'Greyscale Breakers' }));
    fixture.detectChanges();
    expect(settings.breakerSet()).toBe('greyscale');
    expect(platform.storage.get(KEYS.settings)).toMatchObject({ breakerSet: 'greyscale' });
    expect(hints()).toBeDisabled();
    fireEvent.click(screen.getByRole('radio', { name: 'Colorful Breakers' }));
    fixture.detectChanges();
    expect(settings.breakerSet()).toBe('colorful');
    expect(hints()).toBeEnabled();
  });

  it('toggles shape hints and sound, and persists both', async () => {
    const { settings, platform, fixture } = await setup();
    fireEvent.click(hints());
    fireEvent.click(screen.getByRole('checkbox', { name: 'Sound' }));
    fixture.detectChanges();
    expect(settings.shapeHints()).toBe(true);
    expect(settings.sound()).toBe(false);
    expect(platform.storage.get(KEYS.settings)).toEqual({
      breakerSet: 'colorful',
      shapeHints: true,
      sound: false,
    });
    expect(hints()).toBeChecked();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test`
Expected: FAIL. The build reports `Could not resolve "./options-screen"`.

- [ ] **Step 3: Implement**

In `src/app/strings.ts`, add before `board: {`:

```ts
  options: {
    title: 'Options',
    breakerSet: 'Breaker Set',
    colorful: 'Colorful Breakers',
    greyscale: 'Greyscale Breakers',
    accessibility: 'Accessibility and sound',
    shapeHints: 'Shape hints on Colorful Breakers',
    shapeHintsNote: 'Adds a small symbol to each color. Off by default.',
    sound: 'Sound',
  },
```

`src/app/ui/screens/options-screen.ts`:

```ts
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import type { Color } from '../../engine';
import type { BreakerSet } from '../../state/persistence';
import { SettingsStore } from '../../state/settings.store';
import { STRINGS } from '../../strings';
import { ballLook } from '../board/ball-look';
import { Screen } from './screen';

const COLORS: readonly Color[] = [0, 1, 2, 3, 4];

/**
 * Breaker Set, shape hints and sound (02-ux "Screens"), stored by `SettingsStore` on every
 * change. Shape hints apply to the Colorful set only, so the box is disabled on Greyscale.
 */
@Component({
  selector: 'bb-options-screen',
  imports: [Screen],
  templateUrl: './options-screen.html',
  styleUrl: './options-screen.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OptionsScreen {
  protected readonly settings = inject(SettingsStore);
  protected readonly strings = STRINGS;
  protected readonly greyscale = computed(() => this.settings.breakerSet() === 'greyscale');
  protected readonly sets = (['colorful', 'greyscale'] as const).map((set: BreakerSet) => ({
    set,
    label: STRINGS.options[set],
    looks: COLORS.map((color) => ballLook(color, set)),
  }));
}
```

`src/app/ui/screens/options-screen.html`:

```html
<bb-screen class="options" [heading]="strings.options.title">
  <fieldset class="group">
    <legend class="label">{{ strings.options.breakerSet }}</legend>
    @for (option of sets; track option.set) {
      <label class="row">
        <input
          type="radio"
          name="breaker-set"
          class="control control--radio"
          [checked]="settings.breakerSet() === option.set"
          (change)="settings.setBreakerSet(option.set)"
        />
        <span class="text">{{ option.label }}</span>
        <span class="preview" aria-hidden="true">
          @for (look of option.looks; track look) {
            <span class="bb-ball" [class]="look"></span>
          }
        </span>
      </label>
    }
  </fieldset>
  <fieldset class="group">
    <legend class="label">{{ strings.options.accessibility }}</legend>
    <label class="row" [class.row--disabled]="greyscale()">
      <input
        #hints
        type="checkbox"
        class="control"
        aria-describedby="shape-hints-note"
        [checked]="settings.shapeHints()"
        [disabled]="greyscale()"
        (change)="settings.setShapeHints(hints.checked)"
      />
      <span class="text">
        {{ strings.options.shapeHints }}
        <span id="shape-hints-note" class="note">{{ strings.options.shapeHintsNote }}</span>
      </span>
    </label>
    <label class="row">
      <input
        #sound
        type="checkbox"
        class="control"
        [checked]="settings.sound()"
        (change)="settings.setSound(sound.checked)"
      />
      <span class="text">{{ strings.options.sound }}</span>
    </label>
  </fieldset>
</bb-screen>
```

`src/app/ui/screens/options-screen.css`:

```css
:host {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.options {
  gap: var(--bb-space-3);
}
.group {
  display: flex;
  flex-direction: column;
  margin: var(--bb-space-3) 0 0;
  padding: 0;
  border: 0;
}
.label {
  padding: 0;
  font: 700 var(--bb-fs-s) / 1.4 var(--bb-font);
}
.row {
  min-height: var(--bb-target-min);
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
}
.row:has(.control:focus-visible) {
  outline: var(--bb-focus-chrome);
  outline-offset: -2px;
}
.row--disabled {
  opacity: 0.5;
  cursor: default;
}
.control {
  appearance: none;
  flex: none;
  width: 15px;
  height: 15px;
  margin: 0;
  background: var(--bb-field) center / 100% no-repeat;
  box-shadow: var(--bb-field-sunken);
  cursor: inherit;
}
.control:focus {
  outline: none;
}
.control--radio {
  border-radius: 50%;
}
.control--radio:checked {
  background-image: radial-gradient(circle, var(--bb-text) 0 2.5px, transparent 3px);
}
.control:not(.control--radio):checked {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 15 15'%3E%3Cpath d='M4 7.5 6.5 10 11 4.5' fill='none' stroke='%23000' stroke-width='2'/%3E%3C/svg%3E");
}
.control:disabled {
  background-color: var(--bb-face);
}
.text {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.note {
  color: var(--bb-text-muted);
  font-size: var(--bb-fs-s);
}
.preview {
  display: flex;
  gap: 1px;
}
.preview .bb-ball {
  width: 19px;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test && npx eslint src/app/ui/screens src/app/strings.ts`
Expected: PASS (42 files, 283 tests); ESLint reports no problems.

- [ ] **Step 5: Commit**

```bash
git add src/app/strings.ts src/app/ui/screens/options-screen.*
git commit -m "feat(ui): options screen for breaker set, shape hints and sound"
```

---

### Task 11: Statistics with the reset confirmation

**Files:**
- Create: `src/app/ui/screens/statistics-screen.ts`, `.html`, `.css`, `.spec.ts`
- Modify: `src/app/ui/screens/stat-rows.ts`, `src/app/strings.ts`

**Interfaces:**
- Consumes: `StatsStore`, `ConfirmDialog`, `StatRows`, `formatNumber`, `formatClock`.
- Produces: `totalRows(stats: StatsStore): StatRow[]` in `stat-rows.ts` (High, Average, Total, Games Played; shared with Scoring).
- Produces: `StatisticsScreen` (`bb-statistics-screen`): rows Last Game ("642 in 4:12", "–" while `played` is 0) + `totalRows`; note "stored on this device only"; "Reset statistics…" opens `ConfirmDialog` (Reset / Cancel); Reset calls `StatsStore.reset()`.

- [ ] **Step 1: Write the failing test**

`src/app/ui/screens/statistics-screen.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { fireEvent, render, screen } from '@testing-library/angular';
import { createFakePlatform, type FakePlatform } from '../../platform/testing/fakes';
import { KEYS, type StatsRecord } from '../../state/persistence';
import { StatsStore } from '../../state/stats.store';
import { StatisticsScreen } from './statistics-screen';

const PLAYED: StatsRecord = {
  high: 1318,
  total: 12_914,
  played: 22,
  last: { score: 642, timeMs: 252_000 },
  lastRecordedGameId: 'game-22',
};

describe('StatisticsScreen', () => {
  let platform: FakePlatform;

  const setup = async (stats?: StatsRecord) => {
    platform = createFakePlatform();
    if (stats !== undefined) {
      platform.storage.set(KEYS.stats, stats);
    }
    const view = await render(StatisticsScreen, { providers: platform.providers });
    return { ...view, stats: TestBed.inject(StatsStore) };
  };

  /** The value next to a row label. */
  const value = (label: string) => screen.getByText(label).nextElementSibling;
  const resetButton = () => screen.getByRole('button', { name: 'Reset statistics…' });

  it('lists the last game, high, average, total and games played', async () => {
    await setup(PLAYED);
    expect(screen.getByRole('heading', { name: 'Statistics' })).toBeInTheDocument();
    expect(value('Last Game')).toHaveTextContent('642 in 4:12');
    expect(value('High Score')).toHaveTextContent('1,318');
    expect(value('Average Score')).toHaveTextContent('587');
    expect(value('Total Score')).toHaveTextContent('12,914');
    expect(value('Games Played')).toHaveTextContent('22');
    expect(screen.getByText('Statistics are stored on this device only.')).toBeInTheDocument();
  });

  it('shows a dash for the last game until a game is finished', async () => {
    await setup();
    expect(value('Last Game')).toHaveTextContent('–');
    expect(value('High Score')).toHaveTextContent('0');
  });

  it('asks before resetting; Cancel keeps everything and gives focus back', async () => {
    const { stats, fixture } = await setup(PLAYED);
    resetButton().focus();
    fireEvent.click(resetButton());
    fixture.detectChanges();
    await fixture.whenStable();
    const dialog = screen.getByRole('alertdialog', { name: 'Reset statistics' });
    expect(dialog).toHaveAccessibleDescription(
      'Clear high score, average score, total score and games played? This cannot be undone.',
    );
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fixture.detectChanges();
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(stats.played()).toBe(22);
    expect(resetButton()).toHaveFocus();
  });

  it('resets after confirmation and keeps the last recorded game id', async () => {
    const { stats, fixture } = await setup(PLAYED);
    fireEvent.click(resetButton());
    fixture.detectChanges();
    await fixture.whenStable();
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    fixture.detectChanges();
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(stats.played()).toBe(0);
    expect(value('Last Game')).toHaveTextContent('–');
    expect(platform.storage.get(KEYS.stats)).toMatchObject({
      played: 0,
      lastRecordedGameId: 'game-22',
    });
  });

  it('closes the dialog on Escape', async () => {
    const { stats, fixture } = await setup(PLAYED);
    fireEvent.click(resetButton());
    fixture.detectChanges();
    await fixture.whenStable();
    fireEvent(screen.getByRole('alertdialog'), new Event('cancel', { cancelable: true }));
    fixture.detectChanges();
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(stats.played()).toBe(22);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test`
Expected: FAIL. The build reports `Could not resolve "./statistics-screen"`.

- [ ] **Step 3: Implement**

In `src/app/strings.ts`, add before `board: {`:

```ts
  stats: {
    title: 'Statistics',
    lastGame: 'Last Game',
    lastGameValue: (score: string, time: string) => `${score} in ${time}`,
    /** "Last Game" before any game is finished (or after a reset). */
    none: '–',
    high: 'High Score',
    average: 'Average Score',
    total: 'Total Score',
    played: 'Games Played',
    note: 'Statistics are stored on this device only.',
    reset: 'Reset statistics…',
    resetTitle: 'Reset statistics',
    resetMessage:
      'Clear high score, average score, total score and games played? This cannot be undone.',
    resetConfirm: 'Reset',
    cancel: 'Cancel',
  },
```

In `src/app/ui/screens/stat-rows.ts`, extend the imports and add `totalRows` above the component:

```ts
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { formatNumber } from '../../state/format';
import type { StatsStore } from '../../state/stats.store';
import { STRINGS } from '../../strings';
```

```ts
/** High, Average, Total and Games Played: the rows Scoring and Statistics share. */
export function totalRows(stats: StatsStore): StatRow[] {
  return [
    { label: STRINGS.stats.high, value: formatNumber(stats.high()) },
    { label: STRINGS.stats.average, value: formatNumber(stats.average()) },
    { label: STRINGS.stats.total, value: formatNumber(stats.total()) },
    { label: STRINGS.stats.played, value: formatNumber(stats.played()) },
  ];
}
```

`src/app/ui/screens/statistics-screen.ts`:

```ts
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { formatClock, formatNumber } from '../../state/format';
import { StatsStore } from '../../state/stats.store';
import { STRINGS } from '../../strings';
import { ConfirmDialog } from '../chrome/confirm-dialog';
import { Screen } from './screen';
import { StatRows, totalRows, type StatRow } from './stat-rows';

/** Last game and totals, stored on this device; "Reset statistics…" asks first (02-ux). */
@Component({
  selector: 'bb-statistics-screen',
  imports: [ConfirmDialog, Screen, StatRows],
  templateUrl: './statistics-screen.html',
  styleUrl: './statistics-screen.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatisticsScreen {
  private readonly stats = inject(StatsStore);
  protected readonly strings = STRINGS;
  /** The reset confirmation is open. */
  protected readonly confirming = signal(false);

  protected readonly rows = computed<readonly StatRow[]>(() => {
    const last = this.stats.last();
    const lastGame =
      this.stats.played() === 0
        ? STRINGS.stats.none
        : STRINGS.stats.lastGameValue(formatNumber(last.score), formatClock(last.timeMs));
    return [{ label: STRINGS.stats.lastGame, value: lastGame }, ...totalRows(this.stats)];
  });

  protected reset(): void {
    this.stats.reset();
    this.confirming.set(false);
  }
}
```

`src/app/ui/screens/statistics-screen.html`:

```html
<bb-screen [heading]="strings.stats.title">
  <bb-stat-rows [rows]="rows()" />
  <p class="note">{{ strings.stats.note }}</p>
  <div>
    <button type="button" class="bb-button" (click)="confirming.set(true)">
      {{ strings.stats.reset }}
    </button>
  </div>
</bb-screen>
@if (confirming()) {
  <bb-confirm-dialog
    [heading]="strings.stats.resetTitle"
    [message]="strings.stats.resetMessage"
    [confirmLabel]="strings.stats.resetConfirm"
    [cancelLabel]="strings.stats.cancel"
    (confirm)="reset()"
    (dismiss)="confirming.set(false)"
  />
}
```

`src/app/ui/screens/statistics-screen.css`:

```css
:host {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.note {
  margin: 0;
  color: var(--bb-text-muted);
  font: 400 var(--bb-fs-s) / 1.4 var(--bb-font);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test && npx eslint src/app/ui/screens src/app/strings.ts`
Expected: PASS (43 files, 288 tests); ESLint reports no problems.

- [ ] **Step 5: Commit**

```bash
git add src/app/strings.ts src/app/ui/screens/stat-rows.ts src/app/ui/screens/statistics-screen.*
git commit -m "feat(ui): statistics screen with reset confirmation"
```

---

### Task 12: Scoring and its guard

**Files:**
- Create: `src/app/ui/screens/scoring-screen.ts`, `.html`, `.css`, `.spec.ts`, `src/app/ui/screens/scoring-guard.ts`
- Modify: `src/app/strings.ts`

**Interfaces:**
- Consumes: `GameStore.newGame`, `GameStore.showScoring`, `StatsStore` (`last`, `newHigh`, totals), `totalRows`, `Router`.
- Produces: `ScoringScreen` (`bb-scoring-screen`): heading "Game over", "No groups left. Your score", the score at `--bb-fs-score` (44 px), the "New high score" badge while `StatsStore.newHigh()`, "Time m:ss (not scored)", `totalRows`, and a default "New Game" button that deals and navigates to `/`.
- Produces: `scoringGuard: CanActivateFn`: `showScoring()` or a `UrlTree` to `/`.

- [ ] **Step 1: Write the failing test**

`src/app/ui/screens/scoring-screen.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { fireEvent, screen } from '@testing-library/angular';
import { createFakePlatform, type FakePlatform } from '../../platform/testing/fakes';
import { GameStore } from '../../state/game.store';
import { KEYS, type StatsRecord } from '../../state/persistence';
import { StatsStore } from '../../state/stats.store';
import { recordFrom } from '../../state/testing/records';
import { scoringGuard } from './scoring-guard';
import { ScoringScreen } from './scoring-screen';

const PLAYED: StatsRecord = {
  high: 1318,
  total: 12_914,
  played: 22,
  last: { score: 642, timeMs: 252_000 },
  lastRecordedGameId: 'game-22',
};

describe('ScoringScreen', () => {
  let platform: FakePlatform;

  const setup = async () => {
    platform = createFakePlatform();
    platform.storage.set(KEYS.stats, PLAYED);
    TestBed.configureTestingModule({
      providers: [
        ...platform.providers,
        provideRouter([
          { path: '', children: [] },
          { path: 'scoring', component: ScoringScreen },
        ]),
      ],
    });
    const harness = await RouterTestingHarness.create('/scoring');
    return {
      harness,
      router: TestBed.inject(Router),
      game: TestBed.inject(GameStore),
      stats: TestBed.inject(StatsStore),
    };
  };

  /** The value next to a row label. */
  const value = (label: string) => screen.getByText(label).nextElementSibling;
  const score = () => screen.getByText('No groups left. Your score').nextElementSibling;

  it('shows the final score, the time (not scored) and the totals', async () => {
    await setup();
    expect(screen.getByRole('heading', { name: 'Game over' })).toBeInTheDocument();
    expect(screen.getByText('No groups left. Your score')).toBeInTheDocument();
    expect(score()).toHaveTextContent('642');
    expect(screen.getByText('Time 4:12 (not scored)')).toBeInTheDocument();
    expect(screen.queryByText('New high score')).toBeNull();
    expect(value('High Score')).toHaveTextContent('1,318');
    expect(value('Average Score')).toHaveTextContent('587');
    expect(value('Total Score')).toHaveTextContent('12,914');
    expect(value('Games Played')).toHaveTextContent('22');
  });

  it('shows the badge after a game that beat the high score', async () => {
    const { stats, harness } = await setup();
    stats.recordFinished('game-23', 1402, 301_000);
    harness.detectChanges();
    expect(screen.getByText('New high score')).toBeInTheDocument();
    expect(score()).toHaveTextContent('1,402');
    expect(screen.getByText('Time 5:01 (not scored)')).toBeInTheDocument();
    expect(value('Games Played')).toHaveTextContent('23');
  });

  it('starts a new game and goes back to the board', async () => {
    const { game, router, harness } = await setup();
    const finished = game.gameId();
    fireEvent.click(screen.getByRole('button', { name: 'New Game' }));
    await harness.fixture.whenStable();
    expect(game.gameId()).not.toBe(finished);
    expect(router.url).toBe('/');
  });
});

describe('scoringGuard', () => {
  const setup = () => {
    const platform = createFakePlatform();
    platform.storage.set(KEYS.game, recordFrom(['.........rr'], { elapsedMs: 0 }));
    TestBed.configureTestingModule({
      providers: [
        ...platform.providers,
        provideRouter([
          { path: '', children: [] },
          { path: 'scoring', canActivate: [scoringGuard], children: [] },
        ]),
      ],
    });
    return { platform, router: TestBed.inject(Router), game: TestBed.inject(GameStore) };
  };

  it('sends a direct visit to the game screen', async () => {
    const { router } = setup();
    await router.navigateByUrl('/scoring');
    expect(router.url).toBe('/');
  });

  it('lets the game-over navigation through', async () => {
    const { router, game, platform } = setup();
    game.tap({ row: 11, col: 9 });
    game.tap({ row: 11, col: 9 });
    platform.clock.advance(1000);
    expect(game.showScoring()).toBe(true);
    await router.navigateByUrl('/scoring');
    expect(router.url).toBe('/scoring');
  });
});
```

(The score is read through its label's sibling: "1,402" also appears in the High Score row.)

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test`
Expected: FAIL. The build reports `Could not resolve "./scoring-guard"` and `Could not resolve "./scoring-screen"`.

- [ ] **Step 3: Implement**

In `src/app/strings.ts`, add before `board: {`:

```ts
  scoring: {
    title: 'Game over',
    noGroups: 'No groups left. Your score',
    newHigh: 'New high score',
    time: (time: string) => `Time ${time} (not scored)`,
    newGame: 'New Game',
  },
```

`src/app/ui/screens/scoring-guard.ts`:

```ts
import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { GameStore } from '../../state/game.store';

/** Scoring opens only after game over (ADR-0006); a direct visit goes to the game screen. */
export const scoringGuard: CanActivateFn = () =>
  inject(GameStore).showScoring() || inject(Router).createUrlTree(['/']);
```

`src/app/ui/screens/scoring-screen.ts`:

```ts
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { formatClock, formatNumber } from '../../state/format';
import { GameStore } from '../../state/game.store';
import { StatsStore } from '../../state/stats.store';
import { STRINGS } from '../../strings';
import { Screen } from './screen';
import { StatRows, totalRows } from './stat-rows';

/**
 * Opens by itself 500 ms after game over (rule R16): the score, a "New high score" badge, the
 * time (not scored) and the updated totals. The finished game is already in `StatsStore.last`.
 */
@Component({
  selector: 'bb-scoring-screen',
  imports: [Screen, StatRows],
  templateUrl: './scoring-screen.html',
  styleUrl: './scoring-screen.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScoringScreen {
  private readonly game = inject(GameStore);
  private readonly router = inject(Router);
  protected readonly stats = inject(StatsStore);
  protected readonly strings = STRINGS;

  protected readonly score = computed(() => formatNumber(this.stats.last().score));
  protected readonly time = computed(() =>
    STRINGS.scoring.time(formatClock(this.stats.last().timeMs)),
  );
  protected readonly rows = computed(() => totalRows(this.stats));

  protected newGame(): void {
    this.game.newGame();
    void this.router.navigate(['/']);
  }
}
```

`src/app/ui/screens/scoring-screen.html`:

```html
<bb-screen [heading]="strings.scoring.title">
  <div class="result">
    <p class="muted">{{ strings.scoring.noGroups }}</p>
    <p class="score">{{ score() }}</p>
    @if (stats.newHigh()) {
      <p class="badge">{{ strings.scoring.newHigh }}</p>
    }
    <p class="muted">{{ time() }}</p>
  </div>
  <bb-stat-rows [rows]="rows()" />
  <button type="button" class="bb-button bb-button--default new-game" (click)="newGame()">
    {{ strings.scoring.newGame }}
  </button>
</bb-screen>
```

`src/app/ui/screens/scoring-screen.css`:

```css
:host {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
p {
  margin: 0;
}
.result {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--bb-space-2);
  padding: 10px 0 var(--bb-space-3);
}
.muted {
  color: var(--bb-text-muted);
  font-size: var(--bb-fs-s);
}
.score {
  font: 700 var(--bb-fs-score) / 1.1 var(--bb-font);
  font-variant-numeric: tabular-nums;
}
.badge {
  padding: 1px var(--bb-space-4);
  background: var(--bb-tip);
  border: 1px solid var(--bb-text);
  font-size: var(--bb-fs-s);
  font-weight: 700;
}
.new-game {
  flex: none;
  margin-top: auto;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test && npx eslint src/app/ui/screens src/app/strings.ts`
Expected: PASS (44 files, 293 tests); ESLint reports no problems.

- [ ] **Step 5: Commit**

```bash
git add src/app/strings.ts src/app/ui/screens/scoring-*
git commit -m "feat(ui): scoring screen, reachable only after game over"
```

---

### Task 13: Game screen, Paused dialog and the M key

**Files:**
- Create: `src/app/ui/screens/paused-dialog.ts`, `.html`, `.css`, `.spec.ts`, `src/app/ui/screens/game-screen.ts`, `.html`, `.css`, `.spec.ts`
- Modify: `src/app/ui/board/board.ts`, `src/app/ui/board/board.spec.ts`, `src/app/strings.ts`

**Interfaces:**
- Produces: `PausedDialog` (`bb-paused-dialog`): output `resumeGame` (Resume click or Esc anywhere inside). A `<section role="dialog">` labelled "Paused", described by "The timer is stopped. Your board is saved."; focuses Resume after render. Host: absolute overlay over its positioned parent, `rgba(255,255,255,.88)`, `z-index: var(--bb-z-paused)`, centred 220 px window.
- Produces: `GameScreen` (`bb-game-screen`): `StatusStrip` above a positioned stage holding `BoardArea` (with `inert` while `paused()`) and, while `paused()`, `PausedDialog`. Resume calls `GameStore.resume()` and focuses the board after the next render (it is still inert until then). After an in-app navigation (`Router.navigated` true at construction) it focuses the board unless Paused shows.
- Changes `GameBoard`: **M** (no modifier) calls `Shell.toggleMenu(board element)`; an effect announces "New game." whenever `gameId` changes; the board label mentions M.

- [ ] **Step 1: Write the failing tests**

`src/app/ui/screens/paused-dialog.spec.ts`:

```ts
import { fireEvent, render, screen } from '@testing-library/angular';
import { PausedDialog } from './paused-dialog';

describe('PausedDialog', () => {
  const setup = async () => {
    const resumeGame = vi.fn<() => void>();
    await render(PausedDialog, { on: { resumeGame } });
    return { resumeGame, dialog: screen.getByRole('dialog', { name: 'Paused' }) };
  };

  it('says the timer is stopped and starts on Resume', async () => {
    const { dialog } = await setup();
    expect(dialog).toHaveAccessibleDescription('The timer is stopped. Your board is saved.');
    expect(screen.getByRole('button', { name: 'Resume' })).toHaveFocus();
  });

  it('resumes on the button and on Escape', async () => {
    const { resumeGame, dialog } = await setup();
    fireEvent.click(screen.getByRole('button', { name: 'Resume' }));
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(resumeGame).toHaveBeenCalledTimes(2);
  });
});
```

`src/app/ui/screens/game-screen.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { fireEvent, screen } from '@testing-library/angular';
import { createFakePlatform, type FakePlatform } from '../../platform/testing/fakes';
import { GameStore } from '../../state/game.store';
import { KEYS, type GameRecord } from '../../state/persistence';
import { recordFrom } from '../../state/testing/records';
import { GameScreen } from './game-screen';

// Restored with time on the clock, so it opens Paused (03-architecture "Persistence").
const STARTED = recordFrom(['........b..', '........brr']);
const FRESH = recordFrom(['........b..', '........brr'], { elapsedMs: 0 });

describe('GameScreen', () => {
  let platform: FakePlatform;

  const setup = async (saved: GameRecord, url = '/') => {
    platform = createFakePlatform();
    platform.storage.set(KEYS.game, saved);
    TestBed.configureTestingModule({
      providers: [
        ...platform.providers,
        provideRouter([
          { path: '', component: GameScreen },
          { path: 'statistics', children: [] },
        ]),
      ],
    });
    const harness = await RouterTestingHarness.create(url);
    return { harness, store: TestBed.inject(GameStore) };
  };

  const boardArea = () => screen.getByRole('application').closest('bb-board-area');

  it('shows the status strip above the board', async () => {
    await setup(FRESH);
    expect(screen.getByText('Score').nextElementSibling).toHaveTextContent('100');
    expect(screen.getByRole('application')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(boardArea()).not.toHaveAttribute('inert');
  });

  it('opens Paused over an inert board for a restored game, and Resume goes back to the board', async () => {
    const { store, harness } = await setup(STARTED);
    expect(screen.getByRole('dialog', { name: 'Paused' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Resume' })).toHaveFocus();
    expect(boardArea()).toHaveAttribute('inert');
    fireEvent.click(screen.getByRole('button', { name: 'Resume' }));
    await harness.fixture.whenStable();
    expect(store.paused()).toBe(false);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(boardArea()).not.toHaveAttribute('inert');
    expect(screen.getByRole('application')).toHaveFocus();
  });

  it('opens Paused when the page is hidden after the first tap', async () => {
    const { store, harness } = await setup(FRESH);
    store.tap({ row: 11, col: 9 });
    platform.visibility.hidden.set(true);
    await harness.fixture.whenStable();
    expect(store.paused()).toBe(true);
    expect(screen.getByRole('dialog', { name: 'Paused' })).toBeInTheDocument();
  });

  it('focuses the board when the player comes back from another screen', async () => {
    const { harness } = await setup(FRESH, '/statistics');
    await harness.navigateByUrl('/');
    expect(screen.getByRole('application')).toHaveFocus();
  });

  it('leaves focus alone on the first page load', async () => {
    await setup(FRESH);
    expect(screen.getByRole('application')).not.toHaveFocus();
  });
});
```

In `src/app/ui/board/board.spec.ts`:

1. Add the import (after the `recordFrom` import):

```ts
import { Shell } from '../chrome/shell';
```

2. In `describe('keyboard')`, add before `it('leaves other keys alone', …)`:

```ts
    it('opens and closes the menu with M, then gives focus back to the board', async () => {
      const { board } = await setup();
      const shell = TestBed.inject(Shell);
      board.focus();
      press(board, 'm', { altKey: true });
      expect(shell.menuOpen()).toBe(false);
      press(board, 'M');
      expect(shell.menuOpen()).toBe(true);
      board.blur();
      press(board, 'm');
      expect(shell.menuOpen()).toBe(false);
      expect(board).toHaveFocus();
    });
```

3. Add before `it('announces game over', …)`:

```ts
  it('announces a new game dealt from outside the board (softkey or menu)', async () => {
    const { store, fixture } = await setup();
    store.newGame(3);
    fixture.detectChanges();
    expect(screen.getByRole('status')).toHaveTextContent('New game.');
  });
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm test`
Expected: FAIL. The build reports `Could not resolve "./game-screen"` and `Could not resolve "./paused-dialog"`. (Once those files exist but `board.ts` is unchanged, 2 tests fail: `opens and closes the menu with M, then gives focus back to the board` → `AssertionError: expected false to be true`, and `announces a new game dealt from outside the board (softkey or menu)` → `expect(element).toHaveTextContent()`.)

- [ ] **Step 3: Implement**

In `src/app/strings.ts`, add before `board: {`:

```ts
  paused: {
    title: 'Paused',
    message: 'The timer is stopped. Your board is saved.',
    resume: 'Resume',
  },
```

and end the board label with M:

```ts
    label:
      'Bubble Breaker board, 11 columns by 12 rows. Arrow keys move, Enter or Space selects and bursts, Escape clears, N starts a new game, M opens the menu.',
```

In `src/app/ui/board/board.ts`:

1. Import the shell after the `STRINGS` import and inject it after `settings`:

```ts
import { Shell } from '../chrome/shell';
```

```ts
  private readonly shell = inject(Shell);
```

2. At the start of the constructor, before the game-over effect:

```ts
    // "New game." for every deal, also from the softkey or the menu; N announces it in `act`.
    let dealt = this.store.gameId();
    effect(() => {
      const gameId = this.store.gameId();
      if (gameId !== dealt) {
        dealt = gameId;
        this.message.set(STRINGS.board.newGame);
      }
    });
```

3. In `onKeydown`, add after the `'N'` case:

```ts
      case 'm':
      case 'M':
        this.shell.toggleMenu(this.boardRef().nativeElement);
        return;
```

`src/app/ui/screens/paused-dialog.ts` (the output is `resumeGame`: `resume` is a DOM event name):

```ts
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  output,
  viewChild,
} from '@angular/core';
import { STRINGS } from '../../strings';

/**
 * Paused (02-ux "Screens"): a non-modal dialog over the board area only, below the softkeys
 * (`--bb-z-paused` < `--bb-z-softkeys`), so New Game and Menu stay usable. It takes focus when
 * it appears; Resume or Esc continue the game.
 */
@Component({
  selector: 'bb-paused-dialog',
  templateUrl: './paused-dialog.html',
  styleUrl: './paused-dialog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(keydown.escape)': 'resumeGame.emit()' },
})
export class PausedDialog {
  readonly resumeGame = output();
  protected readonly strings = STRINGS;
  private readonly resumeButton = viewChild.required<ElementRef<HTMLButtonElement>>('resumeButton');

  constructor() {
    afterNextRender(() => {
      this.resumeButton().nativeElement.focus();
    });
  }
}
```

`src/app/ui/screens/paused-dialog.html`:

```html
<section
  class="bb-window window"
  role="dialog"
  aria-labelledby="bb-paused-title"
  aria-describedby="bb-paused-message"
>
  <h2 id="bb-paused-title" class="bb-window__title">{{ strings.paused.title }}</h2>
  <div class="bb-window__body body">
    <p id="bb-paused-message" class="bb-window__text">{{ strings.paused.message }}</p>
    <button
      #resumeButton
      type="button"
      class="bb-button bb-button--default"
      (click)="resumeGame.emit()"
    >
      {{ strings.paused.resume }}
    </button>
  </div>
</section>
```

`src/app/ui/screens/paused-dialog.css`:

```css
:host {
  position: absolute;
  inset: 0;
  z-index: var(--bb-z-paused);
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.88);
}
.window {
  width: 220px;
}
.body {
  gap: var(--bb-space-5);
}
```

`src/app/ui/screens/game-screen.ts`:

```ts
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  Injector,
} from '@angular/core';
import { Router } from '@angular/router';
import { GameStore } from '../../state/game.store';
import { BoardArea } from '../board/board-area';
import { StatusStrip } from '../chrome/status-strip';
import { PausedDialog } from './paused-dialog';

/**
 * Route `''`: status strip, then the board area between it and the softkeys. While the game is
 * Paused the board is inert under the Paused dialog. Coming back from another screen puts
 * focus on the board.
 */
@Component({
  selector: 'bb-game-screen',
  imports: [BoardArea, PausedDialog, StatusStrip],
  templateUrl: './game-screen.html',
  styleUrl: './game-screen.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GameScreen {
  protected readonly store = inject(GameStore);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  constructor() {
    // False while the first navigation of the page is still running.
    const inApp = inject(Router).navigated;
    afterNextRender(() => {
      if (inApp && !this.store.paused()) {
        this.focusBoard();
      }
    });
  }

  protected resume(): void {
    this.store.resume();
    // The board stays inert until the next render.
    afterNextRender(
      () => {
        this.focusBoard();
      },
      { injector: this.injector },
    );
  }

  private focusBoard(): void {
    this.host.nativeElement.querySelector<HTMLElement>('[role="application"]')?.focus();
  }
}
```

`src/app/ui/screens/game-screen.html` (`inert` is bound as an attribute: jsdom has no `inert` property):

```html
<bb-status-strip />
<div class="stage">
  <bb-board-area [attr.inert]="store.paused() ? '' : null" />
  @if (store.paused()) {
    <bb-paused-dialog (resumeGame)="resume()" />
  }
</div>
```

`src/app/ui/screens/game-screen.css`:

```css
:host {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.stage {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test && npx eslint src/app/ui src/app/strings.ts`
Expected: PASS (46 files, 302 tests); ESLint reports no problems.

- [ ] **Step 5: Commit**

```bash
git add src/app/strings.ts src/app/ui/board/board.ts src/app/ui/board/board.spec.ts src/app/ui/screens/paused-dialog.* src/app/ui/screens/game-screen.*
git commit -m "feat(ui): game screen with status strip and paused dialog, m opens the menu"
```

---

### Task 14: App shell, routes and the desktop window

**Files:**
- Modify: `src/app/app.ts`, `src/app/app.html`, `src/app/app.css`, `src/app/app.routes.ts`, `src/app/app.spec.ts`, `src/app/strings.ts`, `src/app/ui/board/board-layout.ts`, `src/app/ui/board/board-layout.spec.ts`

**Interfaces:**
- Produces: `windowSize(grid, cell, softkeys): Size` in `board-layout.ts` (48 px, 32 px → 536 × 668).
- Produces: `routes`: `''` → `GameScreen`, `scoring` → `ScoringScreen` (`scoringGuard`), `statistics`, `options`, `how-to-play`, `about`, `**` → `''`; each with a `title`.
- Produces: `App`: `.frame` › `.app-window` (title bar, `<main>` with the outlet, softkeys, popup menu while `Shell.menuOpen()`), then the desktop key hint (`aria-hidden`). Left softkey: New Game on the Game screen (deals; closes an open menu), Done elsewhere (navigates to `/`). Menu softkey toggles the menu. Menu choices: New Game deals (and goes to `/` from another screen); the others navigate to `/<id>`; the menu closes after the navigation. An effect navigates to `/scoring` when `GameStore.showScoring()` turns true.

- [ ] **Step 1: Write the failing tests**

In `src/app/ui/board/board-layout.spec.ts`, add `windowSize` to the import list and this block before `describe('parseCellMax', …)`:

```ts
describe('windowSize (desktop app window)', () => {
  it('is 536 × 668 for 48 px cells with the 32 px desktop softkeys', () => {
    expect(windowSize(GRID, 48, CHROME.softkeysFine)).toEqual({ width: 536, height: 668 });
  });

  it('fits exactly one 48 px board', () => {
    const window = windowSize(GRID, 48, CHROME.softkeysFine);
    expect(cellSize(availableSpace(window, CHROME.softkeysFine), GRID, 48)).toBe(48);
    expect(
      cellSize(availableSpace({ ...window, height: 667 }, CHROME.softkeysFine), GRID, 48),
    ).toBe(47);
  });
});
```

Replace `src/app/app.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { fireEvent, render, screen } from '@testing-library/angular';
import { App } from './app';
import { routes } from './app.routes';
import { createFakePlatform, type FakePlatform } from './platform/testing/fakes';
import { GameStore } from './state/game.store';
import { KEYS, type GameRecord } from './state/persistence';
import { recordFrom } from './state/testing/records';
import { STRINGS } from './strings';

// Not started (no time yet), so no Paused dialog. Bursting the red pair of LAST_PAIR ends the game.
const FRESH = recordFrom(['........b..', '........brr'], { elapsedMs: 0 });
const LAST_PAIR = recordFrom(['.........rr'], { elapsedMs: 0 });

describe('App shell', () => {
  let platform: FakePlatform;

  const setup = async (saved: GameRecord = FRESH, url = '/') => {
    platform = createFakePlatform();
    platform.storage.set(KEYS.game, saved);
    const view = await render(App, { providers: [...platform.providers, provideRouter(routes)] });
    const router = TestBed.inject(Router);
    await router.navigateByUrl(url);
    await view.fixture.whenStable();
    return { ...view, router, store: TestBed.inject(GameStore) };
  };

  const button = (name: string) => screen.getByRole('button', { name });

  /** Opens the menu with the Menu softkey and picks an item. */
  const choose = async (fixture: { whenStable(): Promise<unknown> }, item: string) => {
    fireEvent.click(button('Menu'));
    await fixture.whenStable();
    fireEvent.click(screen.getByRole('menuitem', { name: item }));
    await fixture.whenStable();
  };

  it('uses "Bubble Breaker" as the app title', () => {
    expect(STRINGS.appTitle).toBe('Bubble Breaker');
  });

  it('shows the title bar, the game screen in the main area and the softkeys', async () => {
    await setup();
    expect(screen.getByRole('banner')).toHaveTextContent('Bubble Breaker');
    expect(screen.getByRole('main')).toContainElement(screen.getByRole('application'));
    expect(screen.getByText('Score')).toBeInTheDocument();
    expect(button('New Game')).toBeInTheDocument();
    expect(button('Menu')).toHaveAttribute('aria-expanded', 'false');
    expect(document.title).toBe('Bubble Breaker');
    expect(screen.getByText(STRINGS.keyHint)).toHaveAttribute('aria-hidden', 'true');
  });

  it('deals a new game with the New Game softkey', async () => {
    const { store } = await setup();
    fireEvent.click(button('New Game'));
    expect(store.gameId()).not.toBe('saved-game');
  });

  it('opens the menu over the game and stops the timer while it is open', async () => {
    const { store, fixture } = await setup();
    fireEvent.click(button('Menu'));
    await fixture.whenStable();
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent.trim())).toEqual([
      'New Game',
      'Statistics',
      'Options',
      'How to Play',
      'About',
    ]);
    expect(screen.getByRole('menuitem', { name: 'New Game' })).toHaveFocus();
    expect(button('Menu')).toHaveAttribute('aria-expanded', 'true');
    expect(store.covered()).toBe(true);
  });

  it('closes the menu with Escape and gives focus back to the Menu softkey', async () => {
    const { store, fixture } = await setup();
    fireEvent.click(button('Menu'));
    await fixture.whenStable();
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    await fixture.whenStable();
    expect(screen.queryByRole('menu')).toBeNull();
    expect(button('Menu')).toHaveFocus();
    expect(store.covered()).toBe(false);
  });

  it('opens a screen from the menu; Done goes back to the board', async () => {
    const { router, store, fixture } = await setup();
    await choose(fixture, 'Statistics');
    expect(router.url).toBe('/statistics');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Statistics' })).toHaveFocus();
    expect(document.title).toBe('Statistics – Bubble Breaker');
    expect(store.covered()).toBe(true);
    fireEvent.click(button('Done'));
    await fixture.whenStable();
    expect(router.url).toBe('/');
    expect(screen.getByRole('application')).toHaveFocus();
    expect(store.covered()).toBe(false);
  });

  it.each([
    ['Options', '/options'],
    ['How to Play', '/how-to-play'],
    ['About', '/about'],
  ])('opens %s from the menu', async (item, url) => {
    const { router, fixture } = await setup();
    await choose(fixture, item);
    expect(router.url).toBe(url);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(item);
  });

  it('deals a new game from the menu on another screen and shows the board', async () => {
    const { router, store, fixture } = await setup(FRESH, '/about');
    await choose(fixture, 'New Game');
    expect(router.url).toBe('/');
    expect(store.gameId()).not.toBe('saved-game');
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('opens Scoring by itself after game over (rule R16)', async () => {
    const { router, store, fixture } = await setup(LAST_PAIR);
    store.tap({ row: 11, col: 9 });
    store.tap({ row: 11, col: 9 });
    platform.clock.advance(1000);
    await fixture.whenStable();
    expect(router.url).toBe('/scoring');
    expect(screen.getByRole('heading', { name: 'Game over' })).toHaveFocus();
    expect(button('Done')).toBeInTheDocument();
  });

  it.each(['/scoring', '/no-such-screen'])('sends %s to the game screen', async (url) => {
    const { router } = await setup(FRESH, url);
    expect(router.url).toBe('/');
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm test`
Expected: FAIL. The build reports `TS2339: Property 'keyHint' does not exist on type …` and `TS2305: Module '"./board-layout"' has no exported member 'windowSize'`.

- [ ] **Step 3: Implement**

In `src/app/strings.ts`, add after `appTitle`:

```ts
  /** Browser tab title of a screen other than the game. */
  pageTitle: (screen: string) => `${screen} – Bubble Breaker`,
  /** Desktop only, under the app window (handoff D4); the board's label says the same. */
  keyHint: 'Arrow keys move · Enter selects and bursts · Esc clears · N new game · M menu',
```

and before `board: {`:

```ts
  menu: {
    newGame: 'New Game',
    statistics: 'Statistics',
    options: 'Options',
    howToPlay: 'How to Play',
    about: 'About',
  },
```

In `src/app/ui/board/board-layout.ts`, add above `cellSize`:

```ts
/**
 * The desktop app window around a board of `cell` px cells: 48 px cells and the 32 px
 * `pointer: fine` softkeys give 536 × 668. `app.css` builds the same size from the tokens.
 */
export function windowSize(grid: Grid, cell: number, softkeys: number): Size {
  return {
    width: grid.columns * cell + 2 * CHROME.boardSidePad,
    height:
      CHROME.titleBar + CHROME.statusStrip + grid.rows * cell + CHROME.boardBottomPad + softkeys,
  };
}
```

`src/app/app.routes.ts`:

```ts
import type { Routes } from '@angular/router';
import { STRINGS } from './strings';
import { AboutScreen } from './ui/screens/about-screen';
import { GameScreen } from './ui/screens/game-screen';
import { HowToPlayScreen } from './ui/screens/how-to-play-screen';
import { OptionsScreen } from './ui/screens/options-screen';
import { scoringGuard } from './ui/screens/scoring-guard';
import { ScoringScreen } from './ui/screens/scoring-screen';
import { StatisticsScreen } from './ui/screens/statistics-screen';

/** ADR-0006: eager routes; the menu, dialogs and toasts are overlays, not routes. */
export const routes: Routes = [
  { path: '', component: GameScreen, title: STRINGS.appTitle },
  {
    path: 'scoring',
    component: ScoringScreen,
    canActivate: [scoringGuard],
    title: STRINGS.pageTitle(STRINGS.scoring.title),
  },
  {
    path: 'statistics',
    component: StatisticsScreen,
    title: STRINGS.pageTitle(STRINGS.stats.title),
  },
  { path: 'options', component: OptionsScreen, title: STRINGS.pageTitle(STRINGS.options.title) },
  {
    path: 'how-to-play',
    component: HowToPlayScreen,
    title: STRINGS.pageTitle(STRINGS.howToPlay.title),
  },
  { path: 'about', component: AboutScreen, title: STRINGS.pageTitle(STRINGS.about.title) },
  { path: '**', redirectTo: '' },
];
```

`src/app/app.ts`:

```ts
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  untracked,
} from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { GameStore } from './state/game.store';
import { STRINGS } from './strings';
import { PopupMenu, type MenuItem } from './ui/chrome/popup-menu';
import { Shell } from './ui/chrome/shell';
import { SoftkeyBar } from './ui/chrome/softkey-bar';
import { TitleBar } from './ui/chrome/title-bar';

/** Menu rows (02-ux "Screens"); a screen's id is its route path. */
const MENU: readonly MenuItem[] = [
  { id: 'new-game', label: STRINGS.menu.newGame },
  { id: 'statistics', label: STRINGS.menu.statistics, separatorBefore: true },
  { id: 'options', label: STRINGS.menu.options },
  { id: 'how-to-play', label: STRINGS.menu.howToPlay },
  { id: 'about', label: STRINGS.menu.about },
];

/**
 * The app window: title bar, the routed screen, the softkeys and the popup menu. On desktop
 * (`pointer: fine`) it is a 536 × 668 window on the teal backdrop.
 */
@Component({
  selector: 'bb-root',
  imports: [PopupMenu, RouterOutlet, SoftkeyBar, TitleBar],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  protected readonly strings = STRINGS;
  protected readonly menu = MENU;
  protected readonly shell = inject(Shell);
  private readonly store = inject(GameStore);
  private readonly router = inject(Router);

  protected readonly leftLabel = computed(() =>
    this.shell.onGame() ? STRINGS.softkeys.newGame : STRINGS.softkeys.done,
  );

  constructor() {
    // Rule R16: Scoring opens by itself once the game-over hold is over.
    effect(() => {
      if (this.store.showScoring()) {
        untracked(() => {
          this.shell.closeMenu(false);
          void this.router.navigateByUrl('/scoring');
        });
      }
    });
  }

  /** New Game on the game screen; Done (back to the game) on every other screen. */
  protected onLeft(): void {
    if (this.shell.onGame()) {
      this.newGame();
    } else {
      this.goTo('/');
    }
  }

  protected onChoose(id: string): void {
    if (id === 'new-game') {
      this.newGame();
    } else {
      this.goTo(`/${id}`);
    }
  }

  /** No confirmation, and the abandoned game is not counted (rule R21). */
  private newGame(): void {
    this.store.newGame();
    if (this.shell.onGame()) {
      this.shell.closeMenu();
    } else {
      this.goTo('/');
    }
  }

  /**
   * Changes screen. An open menu closes once the new screen is in place, so the timer never
   * runs in between; the new screen takes focus.
   */
  private goTo(url: string): void {
    void this.router.navigateByUrl(url).then(() => {
      this.shell.closeMenu(false);
    });
  }
}
```

`src/app/app.html`:

```html
<div class="frame">
  <div class="app-window">
    <bb-title-bar />
    <main class="content">
      <router-outlet />
    </main>
    <bb-softkey-bar
      [leftLabel]="leftLabel()"
      [menuOpen]="shell.menuOpen()"
      (left)="onLeft()"
      (menu)="shell.toggleMenu($event)"
    />
    @if (shell.menuOpen()) {
      <bb-popup-menu
        [items]="menu"
        [label]="strings.softkeys.menu"
        (choose)="onChoose($event)"
        (dismiss)="shell.closeMenu()"
      />
    }
  </div>
</div>
<p class="key-hint" aria-hidden="true">{{ strings.keyHint }}</p>
```

`src/app/app.css` (replaces the file; the 708 px threshold is the 668 px window + 2 × 3 px bevel + the 14 px gap and the hint line):

```css
:host {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100dvh;
  padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom)
    env(safe-area-inset-left);
}
.frame {
  display: flex;
  width: 100%;
  height: 100%;
}
.app-window {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: var(--bb-face);
}
.content {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: var(--bb-board-bg);
}
.key-hint {
  display: none;
}

/* Desktop (02-ux "Screen layout"): as wide as a 48 px board; the cell follows the height. */
@media (pointer: fine) {
  .frame {
    width: min(100%, calc(var(--bb-cols) * var(--bb-cell-max) + 2 * var(--bb-board-pad)));
  }
}

/* Room for the whole window (windowSize(): 536 × 668), its bevel and the key hint. */
@media (pointer: fine) and (min-width: 560px) and (min-height: 708px) {
  :host {
    gap: 14px;
  }
  .frame {
    width: auto;
    height: auto;
    padding: 3px;
    background: var(--bb-face);
    box-shadow:
      var(--bb-bevel-out),
      4px 4px 0 rgba(0, 0, 0, 0.35);
  }
  .app-window {
    width: calc(var(--bb-cols) * var(--bb-cell-max) + 2 * var(--bb-board-pad));
    height: calc(
      var(--bb-titlebar-h) + var(--bb-status-h) + var(--bb-rows) * var(--bb-cell-max) +
        var(--bb-board-pad) + var(--bb-softkey-h)
    );
  }
  .key-hint {
    display: block;
    margin: 0;
    color: var(--bb-title-text);
    font-size: var(--bb-fs-s);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run check`
Expected: exit 0: ESLint and Prettier clean, typecheck clean, PASS (46 files, 314 tests).

- [ ] **Step 5: Check it in a browser**

Start the dev server in the background (`npm start`, wait for `Local: http://localhost:4200/`). Save this script **outside the repo** (for example in the session scratchpad as `bb-check.cjs`; do not commit it) and run `node bb-check.cjs <screenshot dir>`:

```js
// Plan 05 browser check (scratch file, not committed). Needs `npm start` on port 4200.
const { chromium } = require('playwright');

const BASE = 'http://localhost:4200';
const out = process.argv[2] ?? '.';
const size = (page, selector) =>
  page.$eval(selector, (el) => {
    const r = el.getBoundingClientRect();
    return `${Math.round(r.width)}x${Math.round(r.height)}`;
  });
const focused = (page) =>
  page.evaluate(() => {
    const el = document.activeElement;
    return el?.getAttribute('role') === 'application' ? 'board' : (el?.textContent?.trim() ?? '');
  });
const setHidden = (page, hidden) =>
  page.evaluate((value) => {
    Object.defineProperty(document, 'visibilityState', {
      value: value ? 'hidden' : 'visible',
      configurable: true,
    });
    document.dispatchEvent(new Event('visibilitychange'));
  }, hidden);

(async () => {
  const browser = await chromium.launch();

  // Phone, touch: 360 × 640.
  let page = await (
    await browser.newContext({ viewport: { width: 360, height: 640 }, hasTouch: true, isMobile: true })
  ).newPage();
  await page.goto(BASE);
  await page.waitForSelector('[role=application]');
  await page.waitForTimeout(300);
  console.log('phone board', await size(page, '[role=application]'),
    'strip', await size(page, 'bb-status-strip'), 'softkeys', await size(page, 'bb-softkey-bar'));
  await page.screenshot({ path: `${out}/phone-game.png` });
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await page.waitForSelector('[role=menu]');
  console.log('menu', await size(page, '[role=menu]'), 'focus', await focused(page));
  await page.screenshot({ path: `${out}/phone-menu.png` });
  await page.getByRole('menuitem', { name: 'Statistics' }).click();
  await page.waitForTimeout(200);
  console.log('statistics', new URL(page.url()).pathname, 'focus', await focused(page), 'title', await page.title());
  await page.getByRole('button', { name: 'Reset statistics…' }).click();
  await page.waitForTimeout(100);
  console.log('reset dialog modal', await page.$eval('dialog', (d) => d.matches(':modal')), 'focus', await focused(page));
  await page.screenshot({ path: `${out}/phone-reset.png` });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(100);
  console.log('after Esc dialog', await page.isVisible('dialog'), 'focus', await focused(page));
  await page.getByRole('button', { name: 'Done' }).click();
  await page.waitForTimeout(200);
  console.log('done', new URL(page.url()).pathname, 'focus', await focused(page));
  for (const path of ['options', 'how-to-play', 'about']) {
    await page.goto(`${BASE}/${path}`);
    await page.waitForTimeout(200);
    await page.screenshot({ path: `${out}/phone-${path}.png` });
  }
  await page.goto(`${BASE}/scoring`);
  await page.waitForTimeout(200);
  console.log('direct /scoring ->', new URL(page.url()).pathname);

  // Desktop: 1280 × 800, then 1280 × 600.
  page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  await page.goto(BASE);
  await page.waitForSelector('[role=application]');
  await page.waitForTimeout(300);
  console.log('desktop 1280x800 window', await size(page, '.app-window'),
    'board', await size(page, '[role=application]'), 'softkeys', await size(page, 'bb-softkey-bar'),
    'hint', await page.isVisible('.key-hint'));
  await page.keyboard.press('Tab');
  console.log('Tab ->', await focused(page));
  await page.keyboard.press('m');
  await page.waitForSelector('[role=menu]');
  console.log('M ->', await focused(page));
  await page.keyboard.press('Escape');
  await page.waitForSelector('[role=menu]', { state: 'detached' });
  console.log('Esc ->', await focused(page));
  for (let col = 0; col < 11; col++) {
    await page.click('[role=application]', { position: { x: col * 48 + 24, y: 11 * 48 + 24 } });
    if ((await page.$$eval('bb-status-strip dd', (dd) => dd[1].textContent.trim())) !== '–') break;
  }
  await page.waitForTimeout(1100);
  await setHidden(page, true);
  await setHidden(page, false);
  await page.waitForTimeout(100);
  console.log('paused', await page.isVisible('[role=dialog]'), 'focus', await focused(page),
    'inert', await page.$eval('bb-board-area', (el) => el.hasAttribute('inert')),
    'time', await page.$$eval('bb-status-strip dd', (dd) => dd[2].textContent.trim()));
  await page.screenshot({ path: `${out}/desktop-paused.png` });
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await page.waitForTimeout(100);
  console.log('menu over Paused', await page.isVisible('[role=menu]'));
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Resume' }).click();
  await page.waitForTimeout(100);
  console.log('Resume ->', await focused(page), 'paused', await page.isVisible('[role=dialog]'));

  page = await (await browser.newContext({ viewport: { width: 1280, height: 600 } })).newPage();
  await page.goto(BASE);
  await page.waitForSelector('[role=application]');
  await page.waitForTimeout(300);
  console.log('desktop 1280x600 window', await size(page, '.app-window'),
    'board', await size(page, '[role=application]'), 'hint', await page.isVisible('.key-hint'));
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

Expected output (reference run):

```text
phone board 352x384 strip 360x30 softkeys 360x44
menu 184x211 focus New Game
statistics /statistics focus Statistics title Statistics – Bubble Breaker
reset dialog modal true focus Cancel
after Esc dialog false focus Reset statistics…
done / focus board
direct /scoring -> /
desktop 1280x800 window 536x668 board 528x576 softkeys 536x32 hint true
Tab -> board
M -> New Game
Esc -> board
paused true focus Resume inert true time ‖ 0:01
menu over Paused true
Resume -> board paused false
desktop 1280x600 window 536x600 board 462x504 hint false
```

Then look at the screenshots: `phone-game.png` matches design frame A1 (strip, bottom-aligned board, softkeys), `phone-menu.png` B1 (menu bottom right, separator under New Game, first row navy), `phone-reset.png` B5, the Options/How to Play/About screenshots B6–B8, and `desktop-paused.png` D4 + A7 (bevelled window on teal, key hint below, Paused over a faded board). Stop the dev server.

- [ ] **Step 6: Commit**

```bash
git add src/app/app.ts src/app/app.html src/app/app.css src/app/app.routes.ts src/app/app.spec.ts src/app/strings.ts src/app/ui/board/board-layout.ts src/app/ui/board/board-layout.spec.ts
git commit -m "feat(ui): app shell with routes, softkeys, menu and desktop window"
```

---

### Task 15: Coverage, build and docs sync

**Files:**
- Modify: `docs/02-ux.md`, `docs/03-architecture.md`, `docs/04-quality.md`

- [ ] **Step 1: Run the coverage gate**

Run: `npm run test:ci`
Expected: PASS (314 tests), with no `ERROR: Coverage for … does not meet` line. Reference run: overall statements 99.31 %, branches 98.68 %, functions 97.95 %, lines 99.88 %; `src/app/ui/` lines 100 %, branches 98.4 %, functions 95.7 %; `src/app/state/` lines 99.7 %, branches 99.3 %, functions 100 %. Uncovered in ui are the defensive fallbacks of `ConfirmDialog` (an opener that is not an `HTMLElement`, a `close` event while it is already closing) and the two Plan 04 fallbacks. If a metric drops below its gate, open `coverage/bubble-breaker/index.html` and add a test for the uncovered branch. Do not lower a threshold.

- [ ] **Step 2: Production build within budget**

Run: `npm run build`
Expected: success without budget warnings. Reference: initial total ≈ 284 kB raw (budget 350 kB warn / 450 kB error), global styles ≈ 6.8 kB; every component stylesheet is under the 4 kB warning.

- [ ] **Step 3: Sync `docs/02-ux.md`**

1. In "Screen layout", replace the **Desktop** row of the table with:

```markdown
| Desktop (`pointer: fine`) | 48 px | app window 536×668 (32 px softkeys); below 708 px of height or 560 px of width the window fills the viewport and the cell follows the height (1280×600 → 42) |
```

   and add after the table's paragraph: "The handoff's 536×692 does not follow from the formula: with the 32 px desktop softkeys from tokens.css it gives 668 (680 with 44 px)."
2. In "Screens":
   - **Statistics** row: start the contents with "Last Game ("642 in 4:12"; "–" before the first finished game), High, …".
   - **Paused** row: screen column "Non-modal dialog over the board area (softkeys stay usable)"; contents "After returning from background, or on reload of a game whose timer had started; "timer stopped, board saved"; Resume or Esc, then focus goes to the board".
   - Below the table, add: "Every screen except Game replaces the status strip and the board; its heading takes focus after an in-app navigation."
3. In "Accessibility", in the **Keyboard** bullet:
   - after "with its own cursor." add "The cursor starts in the bottom row, middle column (row 12, column 6).";
   - change "**M** menu" to "**M** opens the menu (both are board keys)";
   - replace "Menus: arrows, Home/End, Esc, return focus to Menu softkey. Dialogs trap focus, start on Cancel, close on Esc." with "Menus: arrows (wrapping), Home/End; Esc, Tab or a press outside close them and focus goes back to what opened them (the Menu softkey, or the board for **M**). Modal dialogs (Reset statistics) trap focus, start on Cancel, close on Esc and give focus back. Paused is non-modal: focus starts on Resume. Tab order on the Game screen: board → left softkey → Menu; a fresh page load does not move focus."

- [ ] **Step 4: Sync `docs/03-architecture.md`**

1. In "Folder layout":
   - `styles/` line: "tokens.css (verbatim from design), base.css, chrome.css (shared buttons and windows), fonts (self-hosted Noto Sans)".
   - Add `    version.ts       VERSION for About (bumped by release-please, Plan 07)` below `strings.ts`.
   - Replace the `chrome/` and `screens/` lines with:

```text
      chrome/        shell title-bar status-strip softkey-bar popup-menu confirm-dialog toast
      screens/       screen stat-rows game-screen paused-dialog scoring-screen scoring-guard
                     statistics-screen options-screen how-to-play-screen about-screen
```

2. In "State (signals)" → **GameStore**, change the `cursor` bullet to "`cursor`: keyboard cursor; starts in the bottom row, middle column after a deal or a restore."
3. In "UI" → **Routing**, add two bullets: "Each route has a `title` ("Statistics – Bubble Breaker"); unknown paths redirect to `''`." and "`scoringGuard` lets `/scoring` through only while `GameStore.showScoring()` is true; `App` navigates there when it turns true."
4. In **Board**:
   - replace "Until Plan 05 the area fills everything below the title bar (352×610 at 360×640, still cell 32)." with "It sits in the Game screen between the status strip and the softkeys.";
   - replace "Esc, N (M arrives with the menu in Plan 05)." with "Esc, N, M (opens the menu through `Shell`).";
   - add to the live-region bullet: "Every new deal is announced ("New game."), whatever started it."
5. Replace the **Chrome** block with:

```markdown
**Chrome** (`ui/chrome/`)
- `Shell` (root service) holds the popup-menu state and the number of open modal dialogs, and knows whether the Game screen shows (`isActive('/')`). `covered = !onGame || menuOpen || dialogs > 0` reaches `GameStore.setCovered` through an effect. Closing the menu gives focus back to its opener; a menu choice that changes screen closes the menu after the navigation, so the timer never runs in between.
- `TitleBar` (26 px banner), `StatusStrip` (Score / Selected / Time; Game screen only), `SoftkeyBar` (New Game or Done, and Menu with `aria-haspopup`/`aria-expanded`), `PopupMenu` (roving focus, wrapping arrows, Home/End, Esc/Tab; a press outside closes it), `ConfirmDialog` (native `<dialog>` with `showModal()`, `role="alertdialog"`, starts on Cancel, Esc dismisses, focus returns) and `Toast` (`role="status"`, optional action and ×; Plan 06 shows the PWA notices with it).
- Shared button and window styles live in the global `src/styles/chrome.css`.
- Desktop (`pointer: fine`): `App` draws a 536 × 668 window (`windowSize()` in `board-layout.ts`) with a 3 px bevel on the `#2F6468` backdrop and the key hint below it; below 708 px of height or 560 px of width the window fills the viewport and the cell follows the height.

**Screens** (`ui/screens/`)
- `GameScreen` (route `''`): status strip, board area and `PausedDialog`, a non-modal dialog over the board area (below the softkeys) shown while `GameStore.paused()`; the board area is `inert` meanwhile. Resume or Esc call `resume()` and focus the board.
- The other screens use `Screen` (`bb-screen`): an `<h1>` that takes focus after an in-app navigation, above a scrolling white panel. `StatRows` renders the label/value rows.
- `ScoringScreen`, `StatisticsScreen` (reset through `ConfirmDialog`), `OptionsScreen` (native radios and checkboxes bound to `SettingsStore`), `HowToPlayScreen`, `AboutScreen` (`VERSION` from `src/app/version.ts`).
```

- [ ] **Step 5: Sync `docs/04-quality.md`**

1. Test pyramid, row **Component**: replace the examples after the Board part ("Menu: arrows/Home/End/Esc, focus return; Dialog: starts on Cancel; Options toggle persists") with "Shell: covered for menu, dialogs and screens; Menu: wrapping arrows, Home/End, Esc/Tab, focus return; Confirm dialog: starts on Cancel, Esc dismisses; Paused: Resume/Esc, inert board; Scoring: opens after game over, guard; Options toggles persist; App: menu navigation, Done, page titles".
2. Below the test pyramid table, add: "jsdom 30 lacks `HTMLDialogElement.showModal()`/`close()` and `inert`: `src/test-setup.ts` adds a stand-in that only toggles `open` and fires `close`, and `inert` is bound as an attribute. The focus trap, Esc and inertness are checked in a browser (Plan 05 browser check, Plan 08 e2e)."

- [ ] **Step 6: Full check and commit**

```bash
npm run check
git add docs/02-ux.md docs/03-architecture.md docs/04-quality.md
git commit -m "docs: sync ux, architecture and quality with the chrome and screens"
```

`npm run check` must exit 0.

---

### Task 16: Pull request (do not merge)

**Files:**
- Modify: `docs/superpowers/plans/2026-09-27-00-roadmap.md` (status), this plan (frontmatter `status: done`)

- [ ] **Step 1: Mark the plan done in the roadmap**

In the roadmap table set Plan 05's status to `done` and Plan 06's to `next — write plan`. Set `status: done` in this plan's frontmatter.

```bash
git add docs/superpowers/plans
git commit -m "docs: mark chrome and screens plan done"
```

- [ ] **Step 2: Push and open the PR with the GitHub connector**

```bash
git push -u origin feat/chrome-screens
```

Open the PR against `main` with the GitHub connector (`gh` has no token in cloud sessions), following `.github/pull_request_template.md`.
- Title: `feat(ui): chrome, screens, routes and paused dialog`
- Body:

```markdown
## What
App chrome and screens. `src/app/ui/chrome/`: `Shell` (menu and dialog state; pushes "covered" into `GameStore.setCovered`), title bar, status strip (Score / Selected / Time), softkeys, popup menu, confirm dialog (native `<dialog>`) and toast. `src/app/ui/screens/`: Game screen (status strip + board + Paused dialog), Scoring (auto-opens after game over, guarded), Statistics (reset with confirmation), Options, How to Play and About, on eager routes with page titles. Desktop shows a 536 × 668 window on the teal backdrop. M opens the menu; the keyboard cursor now starts in the bottom row.

## Why
Plan 05 of the rewrite (docs/superpowers/plans/2026-10-29-05-chrome-and-screens.md), spec milestone 5. Covers 02-ux "Screen layout", "Screens", "Accessibility" (menus, dialogs, focus) and ADR-0006. The plan settles the desktop window size (536 × 668, not 692), the cursor start, the non-modal Paused dialog and the focus order; 02-ux, 03-architecture and 04-quality are updated to match.

## Checklist
- [x] Behavior matches docs/01-rules and docs/02-ux (or docs updated / ADR added)
- [x] Tests at the lowest level that proves the behavior
- [x] Keyboard + screen-reader path checked for UI changes (component tests for menu, dialogs, focus return and headings; browser check in Task 14)
- [x] No new runtime dependency without an ADR

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

- [ ] **Step 3: Poll the checks until they are green**

Poll the PR's check runs with the GitHub connector until all have finished.
Expected: `quality`, `build`, `pr-title` and both CodeQL analyses pass. If one fails, read its log through the connector, fix the cause on `feat/chrome-screens` (re-run `npm run check` before pushing), push, and poll again.

- [ ] **Step 4: Hand over**

Do **not** merge. Report the PR URL, the check results and the browser-check output to the user; the user reviews and merges (`gh pr merge --squash --delete-branch` locally).

---

## Done when

- `src/app/ui/chrome/` holds `Shell`, `TitleBar`, `StatusStrip`, `SoftkeyBar`, `PopupMenu`, `ConfirmDialog` and `Toast`; `src/app/ui/screens/` holds `Screen`, `StatRows`, `GameScreen`, `PausedDialog`, `ScoringScreen` + `scoringGuard`, `StatisticsScreen`, `OptionsScreen`, `HowToPlayScreen` and `AboutScreen`; `app.routes.ts` routes them. Lint is green, so the layer rule holds.
- Tests cover:
  - the cursor start; `windowSize()` 536 × 668;
  - covered for another screen, the menu and dialogs (timer shows `‖`);
  - status strip values; softkey labels and `aria-expanded`;
  - menu keys (wrapping arrows, Home/End, Esc, Tab, outside press) and focus return to the Menu softkey or the board (M);
  - confirm dialog: modal, starts on Cancel, Esc and browser close dismiss, focus returns;
  - Paused for a restored game and after the page was hidden; Resume and Esc; inert board;
  - Scoring auto-open after game over, the guard, the badge and New Game;
  - Statistics rows, reset confirm/cancel/Esc; Options persistence and the disabled shape hints; How to Play table; About version;
  - menu navigation, Done, page titles, unknown URLs.
- The browser check prints the reference output above; `src/app/ui/**` coverage ≥ 80 % and `src/app/state/**` ≥ 90 % in all four metrics; CI green on the PR; the PR is left open for the user to merge.
