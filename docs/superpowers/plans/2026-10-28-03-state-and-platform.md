---
aliases:
  - "Plan 03: State & platform"
tags:
  - bubble-breaker/plan
status: ready
created: 2026-10-28
---
# Plan 03 — State & Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Angular state layer (GameStore, StatsStore, SettingsStore, PhaseRunner, timer, versioned persistence) and the platform ports it runs on (Storage, Clock, Audio, Visibility, reduced motion) with browser implementations, test fakes and ≥ 90 % state coverage. No UI changes: Plan 04 renders the board from these signals.

**Architecture:** Two new folders under `src/app/`, wired by the lint-enforced dependency rule from Plan 01.
- `platform/` holds the ports as abstract classes (they double as DI tokens), their `Browser*` implementations and `providePlatform()`, which `app.config.ts` uses. `platform/testing/fakes.ts` holds a fake for every port and `createFakePlatform()` for `TestBed`.
- `state/` holds three root-provided signal stores (ADR-0004). `GameStore` owns two plain classes built on the injected clock: `Timer` (accumulated elapsed time) and `PhaseRunner` (plays the burst frames pop → fall → slide → over).
- `persistence.ts` defines the `bb:v1:*` schema with hand-written guards (ADR-0005). Invalid or unreadable data falls back to defaults and never throws.
- Every time-, storage-, audio- or document-dependent call goes through a port, so all state tests run on `FakeClock` and `FakeStorage` without real timers.

**Tech Stack:** Angular 22.2 signals (`signal`, `computed`, `effect`, `untracked`) and DI (`inject`, `TestBed`), TypeScript 6.0 strict, Vitest 5 via `ng test`, Web Audio API (behind a port).

**Spec:** [2026-09-27-bubble-breaker-rewrite-design.md](../specs/2026-09-27-bubble-breaker-rewrite-design.md) · state, persistence and ports in [03-architecture.md](../../03-architecture.md#state-signals) · timings and pause rules in [02-ux.md](../../02-ux.md#motion) · gates in [04-quality.md](../../04-quality.md#gates) · [ADR-0004](../../adr/0004-signals-no-state-library.md) · [ADR-0005](../../adr/0005-persistence-schema.md)

> [!NOTE]
> **Cloud session:** `.claude/hooks/cloud-setup.sh` provides Node ≥ 24.15. `gh` has no valid token there: open the PR and poll its check runs with the GitHub connector (Task 13), and leave the merge to the user.

## Global Constraints

- Plan 02 is done. The engine API is `src/app/engine/index.ts`; state code imports the engine only from `'../engine'`. Specs may also use `'../engine/testing/fixtures'`.
- Layers (lint-enforced since Plan 01): `platform` imports nothing from `state` or `ui`; `state` imports `engine` and `platform`; nothing imports `ui` yet.
- Ports are abstract classes named `*Port` (`ClockPort`, `StoragePort`, `VisibilityPort`, `ReducedMotionPort`, `AudioPort`). The suffix avoids clashes with the DOM globals `Storage` and `Audio`. Browser implementations are plain classes created by factories in `providePlatform()`.
- State code never touches `setTimeout`, `performance`, `localStorage`, `document`, `matchMedia` or `AudioContext` directly. Two exceptions: `crypto.randomUUID()` for the game id (03-architecture) and `Math.random()` for new seeds.
- Stores are `@Injectable({ providedIn: 'root' })`. They keep private writable signals and expose readonly signals plus intent methods. No RxJS.
- Persistence keys are `bb:v1:settings`, `bb:v1:stats` and `bb:v1:game`. Every read goes through a guard. Invalid data → defaults; the storage port never throws.
- Motion durations mirror `src/styles/tokens.css`: bubble 80, pop 160, fall 240, slide 200, game over 500, toast 150 ms. With reduced motion the pop keeps an 80 ms fade and everything else is 0.
- Coverage for `src/app/state/**` ≥ 90 % lines, statements, functions and branches; overall ≥ 80 %. Folders named `testing/` are excluded.
- Lint bans `any`, non-null assertions in `src/` (allowed in specs and `testing/`), default exports, and `console.*` other than `warn`/`error`.
- Specs use Vitest globals. Store specs use `TestBed` with `createFakePlatform().providers` and flush effects with `TestBed.tick()`.
- User-visible text lives in `src/app/strings.ts` (ADR-0008).

## Decisions this plan makes

The phase docs leave these points open or contradict each other. Task 12 writes them back into `03-architecture.md` and `04-quality.md`.

| Topic | Decision | Why |
|---|---|---|
| Port names | `ClockPort`, `StoragePort`, `AudioPort`, `VisibilityPort`, `ReducedMotionPort`; implementations `Browser*`, fakes `Fake*` | Abstract classes work as DI tokens without `InjectionToken`; the suffix avoids the DOM globals `Storage` and `Audio` |
| Reduced motion | A fifth port, `ReducedMotionPort` (`reduced` signal from `matchMedia`) | 03 says "with reduced motion every duration is 0" but names no source for the preference |
| Reduced-motion durations | Pop keeps an 80 ms fade; fall, slide and the game-over hold are 0 | `tokens.css` and 02-ux say so; 03's "every duration is 0" contradicts them |
| Sound on/off | `GameStore` checks `SettingsStore.sound()` before calling `AudioPort.play()`; the port has no on/off state | `platform` must not import `state` (ADR-0002) |
| AudioContext creation | Created or resumed on the first `play()`. Every first play happens inside a tap or key press | Fixes the legacy "created before gesture" bug without a separate unlock call |
| Sounds | `select`, `pop`, `gameOver`, synthesized from the legacy click, pop and game-over designs at master volume 0.25 | 03 lists these three; the legacy fall, bonus and start sounds are dropped |
| Default settings | Colorful Breakers, shape hints off, sound on | 02-ux: shape hints off by default; legacy had sound on |
| Timer start | Runs from the deal; stops at game over and while paused or covered | No doc says when it starts; matches the design prototype |
| Covered vs paused | `setCovered(true)` (menu, screen or dialog open) stops the timer only. `pause()` (page hidden, restored game) also shows the Paused dialog and blocks taps | 02-ux distinguishes the two |
| Time text | `m:ss`, prefixed with `‖ ` while paused or covered; Selected shows `–` without a selection | Design prototype (`Game Screen.dc.html`) |
| Game-over sequence | At the start of the hold: phase `over`, timer stops, stats recorded, save cleared, game-over sound. After the hold (500 ms, 0 reduced): `showScoring` turns true and the UI navigates | Recording before the hold keeps "exactly once" safe if the page reloads during the hold |
| New high score | `StatsStore.newHigh` is true when the recorded score beats the previous high. It is not persisted | The Scoring badge needs it; Scoring is reachable only straight after game over |
| Stats reset | Zeroes the numbers but keeps `lastRecordedGameId` | A later repeat of the same game must still be ignored |
| `last` before any game | `{ score: 0, timeMs: 0 }` | Matches the prototype's reset values |
| Save points | At the deal, after each burst settles, on `pause()`, on `setCovered(true)`, and through `save()` (Plan 06 calls it before a SW reload). Cleared at game over | Saving at the deal stops an abandoned game from being restored after a reload |
| Restore | A valid save that still has moves is restored as Paused. One without moves is dropped and a new game is dealt | Never resume into a dead board |
| Keyboard cursor | Starts at row 0, col 0 for each new game; moves stay on the board and never wrap | No doc gives a start cell |
| `?seed=` test hook | Deferred to Plan 08. `newGame(seed?)` already accepts a seed | No `environment.testHooks` exists yet; only the e2e suite needs it |

## File Structure

```text
src/app/
  app.config.ts               + providePlatform()
  strings.ts                  + status.noSelection, status.pausedPrefix
  platform/
    clock.ts                  ClockPort, TimerId, BrowserClock
    storage.ts                StoragePort, StorageBackend, BrowserStorage
    visibility.ts             VisibilityPort, VisibilitySource, BrowserVisibility
    reduced-motion.ts         ReducedMotionPort, MediaQuerySource, REDUCED_MOTION_QUERY, BrowserReducedMotion
    audio.ts                  Sound, AudioPort, synthesize(), AudioContextLike (+ node types), MASTER_VOLUME, BrowserAudio
    provide-platform.ts       providePlatform()
    testing/fakes.ts          FakeClock, FakeStorage, FakeAudio, FakeVisibility, FakeReducedMotion, createFakePlatform()
    clock.spec.ts  storage.spec.ts  visibility.spec.ts  reduced-motion.spec.ts
    audio.spec.ts  provide-platform.spec.ts  testing/fake-clock.spec.ts
  state/
    motion.ts                 MotionDurations, MOTION, REDUCED_MOTION, motionFor()
    format.ts                 formatNumber(), formatClock()
    persistence.ts            KEYS, Settings, StatsRecord, GameRecord, SavedGame, guards, load/save/clear
    timer.ts                  Timer
    phase-runner.ts           Phase, Frame, framesFor(), PhaseRunner
    settings.store.ts         SettingsStore
    stats.store.ts            StatsStore
    game.store.ts             GameStore, Selection, Direction
    testing/records.ts        recordFrom()   (test-only, excluded from coverage)
    motion.spec.ts  format.spec.ts  persistence.spec.ts  timer.spec.ts
    phase-runner.spec.ts  settings.store.spec.ts  stats.store.spec.ts  game.store.spec.ts
```

Dependency order (no cycles): platform ports ← `fakes` / `providePlatform` ← `motion`, `format` ← `persistence` ← `timer`, `phase-runner` ← `settings.store`, `stats.store` ← `game.store`.

## Branch

```bash
git checkout main && git pull
git checkout -b feat/state
```

Baseline: `npm test` → 9 files, 63 tests pass.

---

### Task 1: Clock port

**Files:**
- Create: `src/app/platform/clock.ts`, `src/app/platform/clock.spec.ts`

**Interfaces:**
- Produces:
  - `type TimerId = number`
  - `abstract class ClockPort { now(): number; setTimeout(callback: () => void, ms: number): TimerId; clearTimeout(id: TimerId): void }`
  - `class BrowserClock extends ClockPort`. Uses `performance.now()` and `window.setTimeout` (`window.*` keeps the return type `number` under both tsconfigs).

- [ ] **Step 1: Write the failing test**

`src/app/platform/clock.spec.ts`:

```ts
import { BrowserClock } from './clock';

describe('BrowserClock', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('reads a monotonic time', () => {
    const clock = new BrowserClock();
    const first = clock.now();
    expect(clock.now()).toBeGreaterThanOrEqual(first);
  });

  it('runs and cancels timers', () => {
    vi.useFakeTimers();
    const clock = new BrowserClock();
    const fired: string[] = [];
    clock.setTimeout(() => fired.push('kept'), 100);
    const cancelled = clock.setTimeout(() => fired.push('cancelled'), 100);
    clock.clearTimeout(cancelled);
    vi.advanceTimersByTime(100);
    expect(fired).toEqual(['kept']);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test`
Expected: FAIL. The build reports `Could not resolve "./clock"`.

- [ ] **Step 3: Implement**

`src/app/platform/clock.ts`:

```ts
/** Opaque handle returned by `ClockPort.setTimeout`. */
export type TimerId = number;

/** Time source for the state layer. Tests bind `FakeClock` instead. */
export abstract class ClockPort {
  /** Milliseconds from an arbitrary, monotonic origin. */
  abstract now(): number;
  abstract setTimeout(callback: () => void, ms: number): TimerId;
  abstract clearTimeout(id: TimerId): void;
}

export class BrowserClock extends ClockPort {
  now(): number {
    return performance.now();
  }

  setTimeout(callback: () => void, ms: number): TimerId {
    return window.setTimeout(callback, ms);
  }

  clearTimeout(id: TimerId): void {
    window.clearTimeout(id);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (65 tests, 2 new).

- [ ] **Step 5: Commit**

```bash
git add src/app/platform/clock.ts src/app/platform/clock.spec.ts
git commit -m "feat(platform): add clock port"
```

---

### Task 2: Storage port

**Files:**
- Create: `src/app/platform/storage.ts`, `src/app/platform/storage.spec.ts`

**Interfaces:**
- Produces:
  - `abstract class StoragePort { get(key: string): unknown; set(key: string, value: unknown): void; remove(key: string): void }`. Values are JSON. `get` returns `undefined` when the key is missing or unreadable. No method throws.
  - `type StorageBackend = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>`
  - `class BrowserStorage extends StoragePort`, built as `new BrowserStorage(() => window.localStorage)`. The getter runs on every call, because merely reading `window.localStorage` throws when storage is blocked. Every failure is logged with `console.warn` (03-architecture "Error handling").

- [ ] **Step 1: Write the failing test**

`src/app/platform/storage.spec.ts`:

```ts
import type { MockInstance } from 'vitest';
import { BrowserStorage, type StorageBackend } from './storage';

function memoryBackend(): StorageBackend & { readonly items: Map<string, string> } {
  const items = new Map<string, string>();
  return {
    items,
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => items.set(key, value),
    removeItem: (key) => items.delete(key),
  };
}

const failing: StorageBackend = {
  getItem: () => {
    throw new DOMException('blocked', 'SecurityError');
  },
  setItem: () => {
    throw new DOMException('full', 'QuotaExceededError');
  },
  removeItem: () => {
    throw new DOMException('blocked', 'SecurityError');
  },
};

describe('BrowserStorage', () => {
  let warn: MockInstance<typeof console.warn>;

  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    warn.mockRestore();
  });

  it('round-trips JSON values', () => {
    const backend = memoryBackend();
    const storage = new BrowserStorage(() => backend);
    storage.set('bb:v1:test', { a: 1, b: [true, null] });
    expect(backend.items.get('bb:v1:test')).toBe('{"a":1,"b":[true,null]}');
    expect(storage.get('bb:v1:test')).toEqual({ a: 1, b: [true, null] });
  });

  it('returns undefined for a missing key', () => {
    expect(new BrowserStorage(memoryBackend).get('missing')).toBeUndefined();
  });

  it('removes keys', () => {
    const backend = memoryBackend();
    const storage = new BrowserStorage(() => backend);
    storage.set('k', 1);
    storage.remove('k');
    expect(storage.get('k')).toBeUndefined();
  });

  it('returns undefined and warns for corrupt JSON', () => {
    const backend = memoryBackend();
    backend.items.set('k', '{not json');
    expect(new BrowserStorage(() => backend).get('k')).toBeUndefined();
    expect(warn).toHaveBeenCalledOnce();
  });

  it('never throws when the backend throws (private mode, quota)', () => {
    const storage = new BrowserStorage(() => failing);
    expect(storage.get('k')).toBeUndefined();
    expect(() => {
      storage.set('k', 1);
    }).not.toThrow();
    expect(() => {
      storage.remove('k');
    }).not.toThrow();
    expect(warn).toHaveBeenCalledTimes(3);
  });

  it('never throws when localStorage itself is inaccessible', () => {
    const storage = new BrowserStorage(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    expect(storage.get('k')).toBeUndefined();
    expect(warn).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test`
Expected: FAIL. The build reports `Could not resolve "./storage"`.

- [ ] **Step 3: Implement**

`src/app/platform/storage.ts`:

```ts
/** JSON key-value storage. Never throws: failures are logged and reads return `undefined`. */
export abstract class StoragePort {
  /** The parsed value, or `undefined` when the key is missing or unreadable. */
  abstract get(key: string): unknown;
  abstract set(key: string, value: unknown): void;
  abstract remove(key: string): void;
}

export type StorageBackend = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/**
 * `localStorage` adapter. The backend is resolved lazily because merely reading
 * `window.localStorage` throws a SecurityError when storage is blocked.
 */
export class BrowserStorage extends StoragePort {
  constructor(private readonly backend: () => StorageBackend) {
    super();
  }

  get(key: string): unknown {
    try {
      const raw = this.backend().getItem(key);
      return raw === null ? undefined : (JSON.parse(raw) as unknown);
    } catch (error) {
      console.warn(`Could not read "${key}" from storage`, error);
      return undefined;
    }
  }

  set(key: string, value: unknown): void {
    try {
      this.backend().setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn(`Could not write "${key}" to storage`, error);
    }
  }

  remove(key: string): void {
    try {
      this.backend().removeItem(key);
    } catch (error) {
      console.warn(`Could not remove "${key}" from storage`, error);
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (71 tests, 6 new).

- [ ] **Step 5: Lint and commit**

```bash
npm run lint
git add src/app/platform/storage.ts src/app/platform/storage.spec.ts
git commit -m "feat(platform): add storage port that never throws"
```

`npm run lint` must exit 0. The specs type the `console.warn` spy as `MockInstance<typeof console.warn>`; the looser `ReturnType<typeof vi.spyOn>` fails `no-unsafe-call`.

---

### Task 3: Visibility and reduced-motion ports

**Files:**
- Create: `src/app/platform/visibility.ts`, `src/app/platform/visibility.spec.ts`, `src/app/platform/reduced-motion.ts`, `src/app/platform/reduced-motion.spec.ts`

**Interfaces:**
- Produces:
  - `abstract class VisibilityPort { readonly hidden: Signal<boolean> }`
  - `interface VisibilitySource { readonly visibilityState: DocumentVisibilityState; addEventListener(type: 'visibilitychange', listener: () => void): void }`. `document` satisfies it.
  - `class BrowserVisibility extends VisibilityPort`, built as `new BrowserVisibility(source)`
  - `abstract class ReducedMotionPort { readonly reduced: Signal<boolean> }`
  - `const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'`
  - `interface MediaQuerySource { readonly matches: boolean; addEventListener(type: 'change', listener: () => void): void }`. `MediaQueryList` satisfies it.
  - `class BrowserReducedMotion extends ReducedMotionPort`, built as `new BrowserReducedMotion(query | null)`. `null` (no `matchMedia`, as in jsdom) means motion is never reduced.

The listeners live as long as the app (root providers), so they are never removed.

- [ ] **Step 1: Write the failing tests**

`src/app/platform/visibility.spec.ts`:

```ts
import { BrowserVisibility, type VisibilitySource } from './visibility';

class FakeDocument extends EventTarget implements VisibilitySource {
  visibilityState: DocumentVisibilityState = 'visible';

  override addEventListener(type: 'visibilitychange', listener: () => void): void {
    super.addEventListener(type, listener);
  }

  become(state: DocumentVisibilityState): void {
    this.visibilityState = state;
    this.dispatchEvent(new Event('visibilitychange'));
  }
}

describe('BrowserVisibility', () => {
  it('starts from the current visibility state', () => {
    const doc = new FakeDocument();
    doc.visibilityState = 'hidden';
    expect(new BrowserVisibility(doc).hidden()).toBe(true);
  });

  it('follows visibilitychange events', () => {
    const doc = new FakeDocument();
    const visibility = new BrowserVisibility(doc);
    expect(visibility.hidden()).toBe(false);
    doc.become('hidden');
    expect(visibility.hidden()).toBe(true);
    doc.become('visible');
    expect(visibility.hidden()).toBe(false);
  });
});
```

`src/app/platform/reduced-motion.spec.ts`:

```ts
import { BrowserReducedMotion, type MediaQuerySource } from './reduced-motion';

class FakeMediaQuery extends EventTarget implements MediaQuerySource {
  constructor(public matches: boolean) {
    super();
  }

  override addEventListener(type: 'change', listener: () => void): void {
    super.addEventListener(type, listener);
  }

  change(matches: boolean): void {
    this.matches = matches;
    this.dispatchEvent(new Event('change'));
  }
}

describe('BrowserReducedMotion', () => {
  it('reads the media query and follows changes', () => {
    const query = new FakeMediaQuery(true);
    const motion = new BrowserReducedMotion(query);
    expect(motion.reduced()).toBe(true);
    query.change(false);
    expect(motion.reduced()).toBe(false);
  });

  it('is false where matchMedia is unavailable', () => {
    expect(new BrowserReducedMotion(null).reduced()).toBe(false);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm test`
Expected: FAIL. The build reports `Could not resolve "./visibility"` and `Could not resolve "./reduced-motion"`.

- [ ] **Step 3: Implement**

`src/app/platform/visibility.ts`:

```ts
import { signal, type Signal } from '@angular/core';

/** Page visibility. `hidden` turns true when the tab or app goes to the background. */
export abstract class VisibilityPort {
  abstract readonly hidden: Signal<boolean>;
}

export interface VisibilitySource {
  readonly visibilityState: DocumentVisibilityState;
  addEventListener(type: 'visibilitychange', listener: () => void): void;
}

export class BrowserVisibility extends VisibilityPort {
  private readonly state;
  readonly hidden: Signal<boolean>;

  constructor(source: VisibilitySource) {
    super();
    this.state = signal(source.visibilityState === 'hidden');
    this.hidden = this.state.asReadonly();
    source.addEventListener('visibilitychange', () => {
      this.state.set(source.visibilityState === 'hidden');
    });
  }
}
```

`src/app/platform/reduced-motion.ts`:

```ts
import { signal, type Signal } from '@angular/core';

/** The user's `prefers-reduced-motion` setting. */
export abstract class ReducedMotionPort {
  abstract readonly reduced: Signal<boolean>;
}

export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

export interface MediaQuerySource {
  readonly matches: boolean;
  addEventListener(type: 'change', listener: () => void): void;
}

export class BrowserReducedMotion extends ReducedMotionPort {
  private readonly state;
  readonly reduced: Signal<boolean>;

  /** `query` is null where `matchMedia` is unavailable (then motion is never reduced). */
  constructor(query: MediaQuerySource | null) {
    super();
    this.state = signal(query?.matches ?? false);
    this.reduced = this.state.asReadonly();
    query?.addEventListener('change', () => {
      this.state.set(query.matches);
    });
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (75 tests, 4 new).

- [ ] **Step 5: Commit**

```bash
git add src/app/platform/visibility.ts src/app/platform/visibility.spec.ts src/app/platform/reduced-motion.ts src/app/platform/reduced-motion.spec.ts
git commit -m "feat(platform): add visibility and reduced-motion ports"
```

---

### Task 4: Audio port

**Files:**
- Create: `src/app/platform/audio.ts`, `src/app/platform/audio.spec.ts`

**Interfaces:**
- Produces:
  - `type Sound = 'select' | 'pop' | 'gameOver'`
  - `abstract class AudioPort { play(sound: Sound): void }`. The port has no on/off state; callers check the setting.
  - `synthesize(sound: Sound, sampleRate: number): Float32Array`. A pure function that ports the legacy click (1200 Hz, 50 ms), pop (falling 600→100 Hz, 250 ms) and game-over (wobbling sawtooth, 800 ms) envelopes from the legacy `src/app/services/sound.service.ts` (tag `v0-legacy`).
  - `AudioContextLike`, `AudioNodeLike`, `AudioBufferLike`: the slice of Web Audio that `BrowserAudio` uses. A real `AudioContext` satisfies `AudioContextLike`, and tests pass a small fake.
  - `const MASTER_VOLUME = 0.25` (the legacy default volume)
  - `class BrowserAudio extends AudioPort`, built as `new BrowserAudio(() => new AudioContext())`. It creates the context, a master gain and one buffer per sound lazily on the first `play()`. It resumes a `suspended` context. If the constructor throws (no Web Audio), it warns once and stays silent.

- [ ] **Step 1: Write the failing test**

`src/app/platform/audio.spec.ts`:

```ts
import type { MockInstance } from 'vitest';
import {
  BrowserAudio,
  MASTER_VOLUME,
  synthesize,
  type AudioBufferLike,
  type AudioContextLike,
  type AudioNodeLike,
  type Sound,
} from './audio';

class FakeNode implements AudioNodeLike {
  readonly connections: AudioNodeLike[] = [];

  connect(destination: AudioNodeLike): void {
    this.connections.push(destination);
  }
}

class FakeBuffer implements AudioBufferLike {
  samples: Float32Array | null = null;

  copyToChannel(source: Float32Array): void {
    this.samples = source;
  }
}

class FakeSource extends FakeNode {
  buffer: AudioBufferLike | null = null;
  started = false;

  start(): void {
    this.started = true;
  }
}

class FakeAudioContext implements AudioContextLike {
  state: AudioContextState = 'running';
  readonly sampleRate = 8000;
  readonly destination = new FakeNode();
  readonly gains: (FakeNode & { gain: { value: number } })[] = [];
  readonly sources: FakeSource[] = [];
  buffersCreated = 0;
  resumeCalls = 0;
  resumeError: Error | null = null;

  resume(): Promise<void> {
    this.resumeCalls++;
    return this.resumeError === null ? Promise.resolve() : Promise.reject(this.resumeError);
  }

  createBuffer(): FakeBuffer {
    this.buffersCreated++;
    return new FakeBuffer();
  }

  createBufferSource(): FakeSource {
    const source = new FakeSource();
    this.sources.push(source);
    return source;
  }

  createGain(): FakeNode & { gain: { value: number } } {
    const gain = Object.assign(new FakeNode(), { gain: { value: 1 } });
    this.gains.push(gain);
    return gain;
  }
}

describe('synthesize', () => {
  it.each<[Sound, number]>([
    ['select', 400],
    ['pop', 2000],
    ['gameOver', 6400],
  ])('renders %s as %i samples at 8 kHz, within [-1, 1]', (sound, length) => {
    const samples = synthesize(sound, 8000);
    expect(samples).toHaveLength(length);
    expect(samples.every((value) => Math.abs(value) <= 1)).toBe(true);
    expect(samples.some((value) => value !== 0)).toBe(true);
  });

  it('is deterministic', () => {
    expect(synthesize('pop', 8000)).toEqual(synthesize('pop', 8000));
  });
});

describe('BrowserAudio', () => {
  let warn: MockInstance<typeof console.warn>;

  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    warn.mockRestore();
  });

  it('does not create an AudioContext before the first play', () => {
    const create = vi.fn(() => new FakeAudioContext());
    new BrowserAudio(create);
    expect(create).not.toHaveBeenCalled();
  });

  it('creates the context once, routes through a master gain and plays', () => {
    const context = new FakeAudioContext();
    const create = vi.fn(() => context);
    const audio = new BrowserAudio(create);
    audio.play('select');
    audio.play('pop');
    expect(create).toHaveBeenCalledOnce();
    const [gain] = context.gains;
    expect(gain?.gain.value).toBe(MASTER_VOLUME);
    expect(gain?.connections).toEqual([context.destination]);
    expect(context.sources).toHaveLength(2);
    expect(context.sources.every((source) => source.started)).toBe(true);
    expect(context.sources[0]?.connections).toEqual([gain]);
  });

  it('synthesizes each sound once and reuses the buffer', () => {
    const context = new FakeAudioContext();
    const audio = new BrowserAudio(() => context);
    audio.play('pop');
    audio.play('pop');
    expect(context.buffersCreated).toBe(1);
    expect(context.sources[0]?.buffer).toBe(context.sources[1]?.buffer);
  });

  it('resumes a suspended context', async () => {
    const context = new FakeAudioContext();
    context.state = 'suspended';
    new BrowserAudio(() => context).play('select');
    expect(context.resumeCalls).toBe(1);
    await Promise.resolve();
    expect(warn).not.toHaveBeenCalled();
  });

  it('warns when resuming fails', async () => {
    const context = new FakeAudioContext();
    context.state = 'suspended';
    context.resumeError = new Error('not allowed');
    new BrowserAudio(() => context).play('select');
    await vi.waitFor(() => {
      expect(warn).toHaveBeenCalledOnce();
    });
  });

  it('stays silent without throwing when Web Audio is unavailable', () => {
    const create = vi.fn((): AudioContextLike => {
      throw new ReferenceError('AudioContext is not defined');
    });
    const audio = new BrowserAudio(create);
    expect(() => {
      audio.play('select');
      audio.play('pop');
    }).not.toThrow();
    expect(create).toHaveBeenCalledOnce();
    expect(warn).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test`
Expected: FAIL. The build reports `Could not resolve "./audio"`.

- [ ] **Step 3: Implement**

`src/app/platform/audio.ts`:

```ts
/** Game sounds, synthesized like the legacy `sound.service.ts`. */
export type Sound = 'select' | 'pop' | 'gameOver';

/** Plays game sounds. Callers decide whether sound is on (SettingsStore). */
export abstract class AudioPort {
  abstract play(sound: Sound): void;
}

interface Synth {
  readonly seconds: number;
  /** Sample value at time `t` seconds, roughly within [-0.5, 0.5]. */
  readonly sample: (t: number) => number;
}

/** Envelopes and frequencies ported from the legacy click, pop and game-over sounds. */
const SYNTHS: Record<Sound, Synth> = {
  select: {
    seconds: 0.05,
    sample: (t) => Math.sin(2 * Math.PI * 1200 * t) * Math.exp(-t * 40) * 0.3,
  },
  pop: {
    seconds: 0.25,
    sample: (t) => {
      const frequency = 600 * Math.exp(-t * 12) + 100;
      const sine = Math.sin(2 * Math.PI * frequency * t);
      const square = Math.sign(sine) * 0.3;
      return (sine * 0.7 + square * 0.3) * Math.exp(-t * 8) * 0.5;
    },
  },
  gameOver: {
    seconds: 0.8,
    sample: (t) => {
      const frequency = 220 - 80 * Math.sin(t * 8);
      const sawtooth = 2 * ((frequency * t) % 1) - 1;
      return sawtooth * Math.max(0, 1 - t * 1.25) * 0.3;
    },
  },
};

/** Mono PCM samples for `sound` at `sampleRate` Hz. Pure, so it is testable without Web Audio. */
export function synthesize(sound: Sound, sampleRate: number): Float32Array {
  const synth = SYNTHS[sound];
  const samples = new Float32Array(Math.floor(synth.seconds * sampleRate));
  for (let i = 0; i < samples.length; i++) {
    samples[i] = synth.sample(i / sampleRate);
  }
  return samples;
}

/** The slice of the Web Audio API that BrowserAudio uses (lets tests pass a fake). */
export interface AudioNodeLike {
  connect(destination: AudioNodeLike): unknown;
}

export interface AudioBufferLike {
  copyToChannel(source: Float32Array, channelNumber: number): void;
}

export interface AudioContextLike {
  readonly state: AudioContextState;
  readonly sampleRate: number;
  readonly destination: AudioNodeLike;
  resume(): Promise<void>;
  createBuffer(channels: number, length: number, sampleRate: number): AudioBufferLike;
  createBufferSource(): AudioNodeLike & { buffer: AudioBufferLike | null; start(): void };
  createGain(): AudioNodeLike & { readonly gain: { value: number } };
}

export const MASTER_VOLUME = 0.25;

interface AudioGraph {
  readonly context: AudioContextLike;
  readonly output: AudioNodeLike;
}

/**
 * Creates the AudioContext lazily on the first `play()`, which always runs inside a
 * user gesture (tap or key press), and resumes it when the browser suspended it.
 */
export class BrowserAudio extends AudioPort {
  private graph: AudioGraph | null = null;
  private unavailable = false;
  private readonly buffers = new Map<Sound, AudioBufferLike>();

  constructor(private readonly createContext: () => AudioContextLike) {
    super();
  }

  play(sound: Sound): void {
    const graph = this.ensureGraph();
    if (graph === null) {
      return;
    }
    const { context, output } = graph;
    if (context.state === 'suspended') {
      context.resume().catch((error: unknown) => {
        console.warn('Could not resume audio', error);
      });
    }
    const source = context.createBufferSource();
    source.buffer = this.bufferFor(context, sound);
    source.connect(output);
    source.start();
  }

  private ensureGraph(): AudioGraph | null {
    if (this.graph === null && !this.unavailable) {
      try {
        const context = this.createContext();
        const output = context.createGain();
        output.gain.value = MASTER_VOLUME;
        output.connect(context.destination);
        this.graph = { context, output };
      } catch (error) {
        this.unavailable = true;
        console.warn('Web Audio is unavailable; sound is off', error);
      }
    }
    return this.graph;
  }

  private bufferFor(context: AudioContextLike, sound: Sound): AudioBufferLike {
    let buffer = this.buffers.get(sound);
    if (buffer === undefined) {
      const samples = synthesize(sound, context.sampleRate);
      buffer = context.createBuffer(1, samples.length, context.sampleRate);
      buffer.copyToChannel(samples, 0);
      this.buffers.set(sound, buffer);
    }
    return buffer;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (85 tests, 10 new).

- [ ] **Step 5: Typecheck, lint and commit**

```bash
npm run typecheck && npm run lint
git add src/app/platform/audio.ts src/app/platform/audio.spec.ts
git commit -m "feat(platform): add lazy web audio port with legacy sounds"
```

---

### Task 5: Fakes and platform providers

**Files:**
- Create: `src/app/platform/testing/fakes.ts`, `src/app/platform/testing/fake-clock.spec.ts`, `src/app/platform/provide-platform.ts`, `src/app/platform/provide-platform.spec.ts`
- Modify: `src/app/app.config.ts`

**Interfaces:**
- Consumes: all ports from Tasks 1–4.
- Produces (`provide-platform.ts`): `providePlatform(): Provider[]`, which binds each port to its browser implementation. Visibility uses `inject(DOCUMENT)`; reduced motion uses `window.matchMedia` when it is a function, else `null`.
- Produces (`testing/fakes.ts`, tests only; consumed by every state spec):
  - `FakeClock`: `now()` starts at 0 and moves only in `advance(ms)`, which fires due timers in time order, including timers scheduled by those timers. `pending` counts live timers.
  - `FakeStorage`: `data: Map<string, string>` holds JSON text, so specs can plant corrupt JSON.
  - `FakeAudio`: `played: Sound[]`.
  - `FakeVisibility`: `hidden` is a `WritableSignal<boolean>`.
  - `FakeReducedMotion`: `reduced` is a `WritableSignal<boolean>`.
  - `createFakePlatform(): FakePlatform`, which returns `{ clock, storage, audio, visibility, motion, providers }`.

- [ ] **Step 1: Write the failing tests**

`src/app/platform/testing/fake-clock.spec.ts`:

```ts
import { FakeClock } from './fakes';

describe('FakeClock', () => {
  it('fires due timers in time order and moves time to each', () => {
    const clock = new FakeClock();
    const fired: string[] = [];
    clock.setTimeout(() => fired.push(`b@${String(clock.now())}`), 200);
    clock.setTimeout(() => fired.push(`a@${String(clock.now())}`), 100);
    clock.advance(150);
    expect(fired).toEqual(['a@100']);
    expect(clock.now()).toBe(150);
    clock.advance(50);
    expect(fired).toEqual(['a@100', 'b@200']);
  });

  it('fires timers scheduled by timers within the same advance', () => {
    const clock = new FakeClock();
    const fired: number[] = [];
    clock.setTimeout(() => {
      fired.push(clock.now());
      clock.setTimeout(() => fired.push(clock.now()), 0);
    }, 10);
    clock.advance(10);
    expect(fired).toEqual([10, 10]);
    expect(clock.pending).toBe(0);
  });

  it('cancels timers', () => {
    const clock = new FakeClock();
    const id = clock.setTimeout(() => {
      throw new Error('must not fire');
    }, 10);
    clock.clearTimeout(id);
    clock.advance(20);
    expect(clock.pending).toBe(0);
  });
});
```

`src/app/platform/provide-platform.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { AudioPort, BrowserAudio } from './audio';
import { BrowserClock, ClockPort } from './clock';
import { providePlatform } from './provide-platform';
import { BrowserReducedMotion, ReducedMotionPort } from './reduced-motion';
import { BrowserStorage, StoragePort } from './storage';
import { BrowserVisibility, VisibilityPort } from './visibility';

describe('providePlatform', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: providePlatform() });
  });

  it('binds every port to its browser implementation', () => {
    expect(TestBed.inject(ClockPort)).toBeInstanceOf(BrowserClock);
    expect(TestBed.inject(StoragePort)).toBeInstanceOf(BrowserStorage);
    expect(TestBed.inject(VisibilityPort)).toBeInstanceOf(BrowserVisibility);
    expect(TestBed.inject(ReducedMotionPort)).toBeInstanceOf(BrowserReducedMotion);
    expect(TestBed.inject(AudioPort)).toBeInstanceOf(BrowserAudio);
  });

  it('uses localStorage', () => {
    TestBed.inject(StoragePort).set('bb:test', 1);
    expect(localStorage.getItem('bb:test')).toBe('1');
    localStorage.removeItem('bb:test');
  });

  it('reads the document visibility and motion preference', () => {
    expect(TestBed.inject(VisibilityPort).hidden()).toBe(document.visibilityState === 'hidden');
    expect(TestBed.inject(ReducedMotionPort).reduced()).toBe(false);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm test`
Expected: FAIL. The build reports `Could not resolve "./fakes"` and `Could not resolve "./provide-platform"`.

- [ ] **Step 3: Implement the fakes**

`src/app/platform/testing/fakes.ts`:

```ts
import { signal, type Provider } from '@angular/core';
import { AudioPort, type Sound } from '../audio';
import { ClockPort, type TimerId } from '../clock';
import { ReducedMotionPort } from '../reduced-motion';
import { StoragePort } from '../storage';
import { VisibilityPort } from '../visibility';

interface PendingTimer {
  readonly at: number;
  readonly callback: () => void;
}

/** Manual clock: time only moves in `advance()`, which fires due timers in order. */
export class FakeClock implements ClockPort {
  private time = 0;
  private nextId = 1;
  private readonly timers = new Map<TimerId, PendingTimer>();

  now(): number {
    return this.time;
  }

  setTimeout(callback: () => void, ms: number): TimerId {
    const id = this.nextId++;
    this.timers.set(id, { at: this.time + Math.max(0, ms), callback });
    return id;
  }

  clearTimeout(id: TimerId): void {
    this.timers.delete(id);
  }

  /** Number of timers that have not fired or been cleared. */
  get pending(): number {
    return this.timers.size;
  }

  /** Moves time forward by `ms`, firing every timer that falls due (including ones they schedule). */
  advance(ms: number): void {
    const end = this.time + ms;
    for (let next = this.nextDue(end); next !== undefined; next = this.nextDue(end)) {
      const [id, timer] = next;
      this.timers.delete(id);
      this.time = timer.at;
      timer.callback();
    }
    this.time = end;
  }

  private nextDue(end: number): [TimerId, PendingTimer] | undefined {
    let due: [TimerId, PendingTimer] | undefined;
    for (const entry of this.timers) {
      if (entry[1].at <= end && (due === undefined || entry[1].at < due[1].at)) {
        due = entry;
      }
    }
    return due;
  }
}

/** In-memory storage that serializes like localStorage, so corrupt JSON can be simulated. */
export class FakeStorage implements StoragePort {
  readonly data = new Map<string, string>();

  get(key: string): unknown {
    const raw = this.data.get(key);
    if (raw === undefined) {
      return undefined;
    }
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      return undefined;
    }
  }

  set(key: string, value: unknown): void {
    this.data.set(key, JSON.stringify(value));
  }

  remove(key: string): void {
    this.data.delete(key);
  }
}

export class FakeAudio implements AudioPort {
  readonly played: Sound[] = [];

  play(sound: Sound): void {
    this.played.push(sound);
  }
}

export class FakeVisibility implements VisibilityPort {
  readonly hidden = signal(false);
}

export class FakeReducedMotion implements ReducedMotionPort {
  readonly reduced = signal(false);
}

export interface FakePlatform {
  readonly clock: FakeClock;
  readonly storage: FakeStorage;
  readonly audio: FakeAudio;
  readonly visibility: FakeVisibility;
  readonly motion: FakeReducedMotion;
  readonly providers: Provider[];
}

/** Fresh fakes for every port plus the providers that bind them (pass to TestBed). */
export function createFakePlatform(): FakePlatform {
  const clock = new FakeClock();
  const storage = new FakeStorage();
  const audio = new FakeAudio();
  const visibility = new FakeVisibility();
  const motion = new FakeReducedMotion();
  return {
    clock,
    storage,
    audio,
    visibility,
    motion,
    providers: [
      { provide: ClockPort, useValue: clock },
      { provide: StoragePort, useValue: storage },
      { provide: AudioPort, useValue: audio },
      { provide: VisibilityPort, useValue: visibility },
      { provide: ReducedMotionPort, useValue: motion },
    ],
  };
}
```

- [ ] **Step 4: Implement `providePlatform`**

`src/app/platform/provide-platform.ts`:

```ts
import { DOCUMENT, inject, type Provider } from '@angular/core';
import { AudioPort, BrowserAudio } from './audio';
import { BrowserClock, ClockPort } from './clock';
import { BrowserReducedMotion, REDUCED_MOTION_QUERY, ReducedMotionPort } from './reduced-motion';
import { BrowserStorage, StoragePort } from './storage';
import { BrowserVisibility, VisibilityPort } from './visibility';

/** Binds the browser implementations of the platform ports (used in `app.config.ts`). */
export function providePlatform(): Provider[] {
  return [
    { provide: ClockPort, useFactory: () => new BrowserClock() },
    { provide: StoragePort, useFactory: () => new BrowserStorage(() => window.localStorage) },
    { provide: VisibilityPort, useFactory: () => new BrowserVisibility(inject(DOCUMENT)) },
    {
      provide: ReducedMotionPort,
      useFactory: () =>
        new BrowserReducedMotion(
          typeof window.matchMedia === 'function' ? window.matchMedia(REDUCED_MOTION_QUERY) : null,
        ),
    },
    { provide: AudioPort, useFactory: () => new BrowserAudio(() => new AudioContext()) },
  ];
}
```

`typeof window.matchMedia === 'function'` is deliberate: jsdom defines the property but not the function, so `'matchMedia' in window` would crash the spec.

- [ ] **Step 5: Bind the ports in the app**

Replace `src/app/app.config.ts` with:

```ts
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { providePlatform } from './platform/provide-platform';

export const appConfig: ApplicationConfig = {
  providers: [provideBrowserGlobalErrorListeners(), provideRouter(routes), providePlatform()],
};
```

- [ ] **Step 6: Run tests and the build**

Run: `npm test`
Expected: PASS (91 tests, 6 new).

Run: `npm run build`
Expected: success. The initial total stays far below the 350 kB warning (≈ 200 kB), because nothing injects the ports yet.

- [ ] **Step 7: Commit**

```bash
git add src/app/platform src/app/app.config.ts
git commit -m "feat(platform): add port fakes and bind browser implementations"
```

---

### Task 6: Motion durations and status formatting

**Files:**
- Create: `src/app/state/motion.ts`, `src/app/state/motion.spec.ts`, `src/app/state/format.ts`, `src/app/state/format.spec.ts`
- Modify: `src/app/strings.ts`

**Interfaces:**
- Produces:
  - `interface MotionDurations { bubble; pop; fall; slide; gameOver; toast }` (all `readonly number`, ms)
  - `MOTION` (80 / 160 / 240 / 200 / 500 / 150) and `REDUCED_MOTION` (0 / 80 / 0 / 0 / 0 / 0). These mirror `--bb-dur-*` in `tokens.css`, including its `prefers-reduced-motion` block.
  - `motionFor(reduced: boolean): MotionDurations`
  - `formatNumber(value: number): string`, en-US grouping (`1,234`)
  - `formatClock(ms: number): string`, `m:ss` with uncapped minutes (`75:03`)
  - `STRINGS.status.noSelection` (`'–'`) and `STRINGS.status.pausedPrefix` (`'‖ '`)

- [ ] **Step 1: Write the failing tests**

`src/app/state/motion.spec.ts`:

```ts
import { MOTION, REDUCED_MOTION, motionFor } from './motion';

describe('motion durations', () => {
  it('mirror the --bb-dur-* tokens in src/styles/tokens.css', () => {
    expect(MOTION).toEqual({
      bubble: 80,
      pop: 160,
      fall: 240,
      slide: 200,
      gameOver: 500,
      toast: 150,
    });
  });

  it('keep only the 80 ms pop fade with reduced motion', () => {
    expect(REDUCED_MOTION).toEqual({
      bubble: 0,
      pop: 80,
      fall: 0,
      slide: 0,
      gameOver: 0,
      toast: 0,
    });
  });

  it('pick the set for the motion preference', () => {
    expect(motionFor(false)).toBe(MOTION);
    expect(motionFor(true)).toBe(REDUCED_MOTION);
  });
});
```

`src/app/state/format.spec.ts`:

```ts
import { formatClock, formatNumber } from './format';

describe('formatNumber', () => {
  it.each([
    [0, '0'],
    [240, '240'],
    [1234, '1,234'],
    [1234567, '1,234,567'],
  ])('formats %i as %s', (value, text) => {
    expect(formatNumber(value)).toBe(text);
  });
});

describe('formatClock', () => {
  it.each([
    [0, '0:00'],
    [999, '0:00'],
    [1000, '0:01'],
    [59_999, '0:59'],
    [60_000, '1:00'],
    [252_000, '4:12'],
    [4_503_000, '75:03'],
  ])('formats %i ms as %s', (ms, text) => {
    expect(formatClock(ms)).toBe(text);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm test`
Expected: FAIL. The build reports `Could not resolve "./motion"` and `Could not resolve "./format"`.

- [ ] **Step 3: Implement**

`src/app/state/motion.ts`:

```ts
/** Animation durations in ms. Mirrors the motion tokens in `src/styles/tokens.css`. */
export interface MotionDurations {
  readonly bubble: number;
  readonly pop: number;
  readonly fall: number;
  readonly slide: number;
  readonly gameOver: number;
  readonly toast: number;
}

export const MOTION: MotionDurations = {
  bubble: 80,
  pop: 160,
  fall: 240,
  slide: 200,
  gameOver: 500,
  toast: 150,
};

/** `prefers-reduced-motion: reduce`: everything jumps except an 80 ms opacity pop (tokens.css). */
export const REDUCED_MOTION: MotionDurations = {
  bubble: 0,
  pop: 80,
  fall: 0,
  slide: 0,
  gameOver: 0,
  toast: 0,
};

export function motionFor(reduced: boolean): MotionDurations {
  return reduced ? REDUCED_MOTION : MOTION;
}
```

`src/app/state/format.ts`:

```ts
/** `1234` → `"1,234"` (the design formats every number with en-US grouping). */
export function formatNumber(value: number): string {
  return value.toLocaleString('en-US');
}

/** Elapsed milliseconds as `m:ss`; minutes are not capped (`75:03`). */
export function formatClock(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  return `${String(Math.floor(seconds / 60))}:${String(seconds % 60).padStart(2, '0')}`;
}
```

- [ ] **Step 4: Add the status strings**

Replace `src/app/strings.ts` with:

```ts
/** All user-visible copy (ADR-0008). Components never hard-code text. */
export const STRINGS = {
  appTitle: 'Bubble Breaker',
  status: {
    /** "Selected" field when nothing is selected. */
    noSelection: '–',
    /** Prefix of the time field while the timer is stopped by Paused or an open menu/screen. */
    pausedPrefix: '‖ ',
  },
} as const;
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (105 tests, 14 new).

- [ ] **Step 6: Commit**

```bash
git add src/app/state src/app/strings.ts
git commit -m "feat(state): add motion durations and status formatting"
```

---

### Task 7: Persistence schema and guards

**Files:**
- Create: `src/app/state/persistence.ts`, `src/app/state/persistence.spec.ts`, `src/app/state/testing/records.ts`

**Interfaces:**
- Consumes: `STANDARD_RULES`, `BallId`, `Color`, `Game` from `../engine`; `StoragePort` (Task 2); `FakeStorage` (Task 5, specs only).
- Produces:
  - `KEYS = { settings: 'bb:v1:settings', stats: 'bb:v1:stats', game: 'bb:v1:game' }`
  - `type BreakerSet = 'colorful' | 'greyscale'`; `interface Settings { breakerSet; shapeHints; sound }`; `DEFAULT_SETTINGS = { breakerSet: 'colorful', shapeHints: false, sound: true }`
  - `interface LastGame { score; timeMs }`; `interface StatsRecord { high; total; played; last; lastRecordedGameId: string | null }`; `DEFAULT_STATS`
  - `interface GameRecord { gameId; seed; colors; cells; score; elapsedMs }` (stored form, exactly the `bb:v1:game` columns of 03-architecture); `interface SavedGame { gameId; game: Game; elapsedMs }` (in-memory form)
  - Guards `isSettings`, `isStatsRecord`, `isGameRecord`. `isGameRecord` checks: a non-empty id; a uint32 seed; integer score ≥ 0; finite time ≥ 0; 132 colours in `0…4`; 132 cells, each `null` or a unique id `< 132`. Extra fields are ignored.
  - `toGameRecord`, `fromGameRecord` (always `STANDARD_RULES`)
  - `loadSettings`, `saveSettings`, `loadStats`, `saveStats`, `loadGame` (returns `SavedGame | null`), `saveGame`, `clearGame`. Each takes the `StoragePort` as its first argument.
- Produces (`testing/records.ts`, tests only): `recordFrom(bottomRows, overrides?)`, which builds a valid `GameRecord` from the bottom rows of the board as letters. Each ball's id is its cell index.

- [ ] **Step 1: Write the test fixture**

`src/app/state/testing/records.ts`:

```ts
import { STANDARD_RULES, type BallId, type Color } from '../../engine';
import type { GameRecord } from '../persistence';

const LETTERS = 'rbgyp';
const EMPTY_ROW = '.'.repeat(STANDARD_RULES.columns);

/**
 * A valid `bb:v1:game` record. `bottomRows` are the lowest rows of the 11 × 12 board as
 * letters (r b g y p, '.' empty); rows above them are empty. Each ball's id is its cell index;
 * unused ids get colour 0 so `colors` always has 132 entries.
 */
export function recordFrom(
  bottomRows: readonly string[],
  overrides: Partial<GameRecord> = {},
): GameRecord {
  const rows = [
    ...new Array<string>(STANDARD_RULES.rows - bottomRows.length).fill(EMPTY_ROW),
    ...bottomRows,
  ];
  const colors = new Array<Color>(STANDARD_RULES.columns * STANDARD_RULES.rows).fill(0);
  const cells: (BallId | null)[] = [];
  for (const letter of rows.join('')) {
    if (letter === '.') {
      cells.push(null);
    } else {
      colors[cells.length] = LETTERS.indexOf(letter) as Color;
      cells.push(cells.length);
    }
  }
  return {
    gameId: 'saved-game',
    seed: 7,
    colors,
    cells,
    score: 100,
    elapsedMs: 65_000,
    ...overrides,
  };
}
```

- [ ] **Step 2: Write the failing test**

`src/app/state/persistence.spec.ts`:

```ts
import { newGame } from '../engine';
import { FakeStorage } from '../platform/testing/fakes';
import {
  DEFAULT_SETTINGS,
  DEFAULT_STATS,
  KEYS,
  clearGame,
  fromGameRecord,
  isGameRecord,
  isSettings,
  isStatsRecord,
  loadGame,
  loadSettings,
  loadStats,
  saveGame,
  saveSettings,
  saveStats,
  toGameRecord,
  type GameRecord,
} from './persistence';
import { recordFrom } from './testing/records';

describe('storage keys', () => {
  it('use the v1 schema names from ADR-0005', () => {
    expect(KEYS).toEqual({ settings: 'bb:v1:settings', stats: 'bb:v1:stats', game: 'bb:v1:game' });
  });
});

describe('isSettings', () => {
  it('accepts valid settings', () => {
    expect(isSettings({ breakerSet: 'greyscale', shapeHints: true, sound: false })).toBe(true);
  });

  it.each([
    ['null', null],
    ['an array', []],
    ['a string', 'colorful'],
    ['an unknown breaker set', { breakerSet: 'neon', shapeHints: false, sound: true }],
    ['a non-boolean flag', { breakerSet: 'colorful', shapeHints: 'no', sound: true }],
    ['a missing field', { breakerSet: 'colorful', shapeHints: false }],
  ])('rejects %s', (_, value) => {
    expect(isSettings(value)).toBe(false);
  });
});

describe('isStatsRecord', () => {
  const valid = {
    high: 240,
    total: 500,
    played: 3,
    last: { score: 100, timeMs: 61_250.5 },
    lastRecordedGameId: 'abc',
  };

  it('accepts valid statistics, with or without a recorded game id', () => {
    expect(isStatsRecord(valid)).toBe(true);
    expect(isStatsRecord({ ...valid, lastRecordedGameId: null })).toBe(true);
    expect(isStatsRecord(DEFAULT_STATS)).toBe(true);
  });

  it.each([
    ['null', null],
    ['missing last', { ...valid, last: undefined }],
    ['a negative count', { ...valid, played: -1 }],
    ['a fractional score', { ...valid, total: 1.5 }],
    ['a non-finite time', { ...valid, last: { score: 1, timeMs: Infinity } }],
    ['a numeric game id', { ...valid, lastRecordedGameId: 7 }],
  ])('rejects %s', (_, value) => {
    expect(isStatsRecord(value)).toBe(false);
  });
});

describe('isGameRecord', () => {
  const valid = recordFrom(['...rr.bbyyg']);

  it('accepts a valid record', () => {
    expect(isGameRecord(valid)).toBe(true);
  });

  it.each<[string, Partial<Record<keyof GameRecord, unknown>>]>([
    ['an empty game id', { gameId: '' }],
    ['a seed above uint32', { seed: 2 ** 32 }],
    ['a negative score', { score: -2 }],
    ['a negative time', { elapsedMs: -1 }],
    ['too few colours', { colors: [0, 1] }],
    ['a colour out of range', { colors: [...valid.colors.slice(1), 5] }],
    ['too few cells', { cells: valid.cells.slice(1) }],
    ['a ball id out of range', { cells: [...valid.cells.slice(1), 132] }],
    ['a duplicate ball id', { cells: [...valid.cells.slice(0, -2), 5, 5] }],
    ['cells that are not an array', { cells: 'nope' }],
  ])('rejects %s', (_, change) => {
    expect(isGameRecord({ ...valid, ...change })).toBe(false);
  });

  it('rejects non-objects', () => {
    expect(isGameRecord(null)).toBe(false);
    expect(isGameRecord([valid])).toBe(false);
  });
});

describe('game record conversion', () => {
  it('round-trips a real game', () => {
    const saved = { gameId: 'id-1', game: newGame(42), elapsedMs: 1234 };
    const record = toGameRecord(saved);
    expect(record).toEqual({
      gameId: 'id-1',
      seed: 42,
      colors: saved.game.colors,
      cells: saved.game.board.cells,
      score: 0,
      elapsedMs: 1234,
    });
    expect(isGameRecord(record)).toBe(true);
    expect(fromGameRecord(record)).toEqual(saved);
  });
});

describe('load and save', () => {
  let storage: FakeStorage;

  beforeEach(() => {
    storage = new FakeStorage();
  });

  it('returns defaults when nothing is stored', () => {
    expect(loadSettings(storage)).toBe(DEFAULT_SETTINGS);
    expect(loadStats(storage)).toBe(DEFAULT_STATS);
    expect(loadGame(storage)).toBeNull();
  });

  it('returns defaults for corrupt JSON or wrong shapes, never throwing', () => {
    storage.data.set(KEYS.settings, '{"breakerSet":');
    storage.set(KEYS.stats, { high: 'lots' });
    storage.set(KEYS.game, { gameId: 'x' });
    expect(loadSettings(storage)).toBe(DEFAULT_SETTINGS);
    expect(loadStats(storage)).toBe(DEFAULT_STATS);
    expect(loadGame(storage)).toBeNull();
  });

  it('round-trips settings and stats', () => {
    const settings = { breakerSet: 'greyscale', shapeHints: true, sound: false } as const;
    const stats = { ...DEFAULT_STATS, high: 12, total: 12, played: 1 };
    saveSettings(storage, settings);
    saveStats(storage, stats);
    expect(loadSettings(storage)).toEqual(settings);
    expect(loadStats(storage)).toEqual(stats);
  });

  it('saves, loads and clears the game in progress', () => {
    const saved = { gameId: 'id-2', game: newGame(9), elapsedMs: 5000 };
    saveGame(storage, saved);
    expect(storage.get(KEYS.game)).toEqual(toGameRecord(saved));
    expect(loadGame(storage)).toEqual(saved);
    clearGame(storage);
    expect(loadGame(storage)).toBeNull();
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npm test`
Expected: FAIL. The build reports `Could not resolve "./persistence"` (and `"../persistence"` from the fixture).

- [ ] **Step 4: Implement**

`src/app/state/persistence.ts`:

```ts
import { STANDARD_RULES, type BallId, type Color, type Game } from '../engine';
import type { StoragePort } from '../platform/storage';

/** localStorage keys, schema version 1 (ADR-0005). */
export const KEYS = {
  settings: 'bb:v1:settings',
  stats: 'bb:v1:stats',
  game: 'bb:v1:game',
} as const;

export type BreakerSet = 'colorful' | 'greyscale';

export interface Settings {
  readonly breakerSet: BreakerSet;
  readonly shapeHints: boolean;
  readonly sound: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  breakerSet: 'colorful',
  shapeHints: false,
  sound: true,
};

export interface LastGame {
  readonly score: number;
  readonly timeMs: number;
}

export interface StatsRecord {
  readonly high: number;
  readonly total: number;
  readonly played: number;
  readonly last: LastGame;
  /** Id of the last game added to the totals; makes recording idempotent. */
  readonly lastRecordedGameId: string | null;
}

export const DEFAULT_STATS: StatsRecord = {
  high: 0,
  total: 0,
  played: 0,
  last: { score: 0, timeMs: 0 },
  lastRecordedGameId: null,
};

/** Stored form of the game in progress. The board is always STANDARD_RULES-sized. */
export interface GameRecord {
  readonly gameId: string;
  readonly seed: number;
  readonly colors: readonly Color[];
  readonly cells: readonly (BallId | null)[];
  readonly score: number;
  readonly elapsedMs: number;
}

/** In-memory form of a saved game. */
export interface SavedGame {
  readonly gameId: string;
  readonly game: Game;
  readonly elapsedMs: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isDuration(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

export function isSettings(value: unknown): value is Settings {
  return (
    isRecord(value) &&
    (value['breakerSet'] === 'colorful' || value['breakerSet'] === 'greyscale') &&
    typeof value['shapeHints'] === 'boolean' &&
    typeof value['sound'] === 'boolean'
  );
}

export function isStatsRecord(value: unknown): value is StatsRecord {
  if (!isRecord(value) || !isRecord(value['last'])) {
    return false;
  }
  const { high, total, played, last, lastRecordedGameId } = value;
  return (
    isCount(high) &&
    isCount(total) &&
    isCount(played) &&
    isCount(last['score']) &&
    isDuration(last['timeMs']) &&
    (lastRecordedGameId === null || typeof lastRecordedGameId === 'string')
  );
}

export function isGameRecord(value: unknown): value is GameRecord {
  if (!isRecord(value)) {
    return false;
  }
  const { gameId, seed, colors, cells, score, elapsedMs } = value;
  const size = STANDARD_RULES.columns * STANDARD_RULES.rows;
  if (
    typeof gameId !== 'string' ||
    gameId === '' ||
    !isCount(seed) ||
    seed > 0xffffffff ||
    !isCount(score) ||
    !isDuration(elapsedMs) ||
    !Array.isArray(colors) ||
    !Array.isArray(cells) ||
    colors.length !== size ||
    cells.length !== size
  ) {
    return false;
  }
  const validColors = colors.every(
    (color: unknown) => isCount(color) && color < STANDARD_RULES.colors,
  );
  const ids = cells.filter((id: unknown) => id !== null);
  const validIds = ids.every((id: unknown) => isCount(id) && id < size);
  return validColors && validIds && new Set(ids).size === ids.length;
}

export function toGameRecord({ gameId, game, elapsedMs }: SavedGame): GameRecord {
  return {
    gameId,
    seed: game.seed,
    colors: game.colors,
    cells: game.board.cells,
    score: game.score,
    elapsedMs,
  };
}

export function fromGameRecord(record: GameRecord): SavedGame {
  const { columns, rows } = STANDARD_RULES;
  return {
    gameId: record.gameId,
    elapsedMs: record.elapsedMs,
    game: {
      seed: record.seed,
      rules: STANDARD_RULES,
      colors: record.colors,
      board: { columns, rows, cells: record.cells },
      score: record.score,
    },
  };
}

export function loadSettings(storage: StoragePort): Settings {
  const value = storage.get(KEYS.settings);
  return isSettings(value) ? value : DEFAULT_SETTINGS;
}

export function saveSettings(storage: StoragePort, settings: Settings): void {
  storage.set(KEYS.settings, settings);
}

export function loadStats(storage: StoragePort): StatsRecord {
  const value = storage.get(KEYS.stats);
  return isStatsRecord(value) ? value : DEFAULT_STATS;
}

export function saveStats(storage: StoragePort, stats: StatsRecord): void {
  storage.set(KEYS.stats, stats);
}

/** The saved game in progress, or null when there is none or it fails validation. */
export function loadGame(storage: StoragePort): SavedGame | null {
  const value = storage.get(KEYS.game);
  return isGameRecord(value) ? fromGameRecord(value) : null;
}

export function saveGame(storage: StoragePort, saved: SavedGame): void {
  storage.set(KEYS.game, toGameRecord(saved));
}

export function clearGame(storage: StoragePort): void {
  storage.remove(KEYS.game);
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (137 tests, 32 new).

- [ ] **Step 6: Commit**

```bash
git add src/app/state
git commit -m "feat(state): add versioned persistence with hand-written guards"
```

---

### Task 8: Timer

**Files:**
- Create: `src/app/state/timer.ts`, `src/app/state/timer.spec.ts`

**Interfaces:**
- Consumes: `ClockPort`, `TimerId` (Task 1); `FakeClock` (specs).
- Produces: `class Timer`, built as `new Timer(clock)`:
  - `running: Signal<boolean>`
  - `elapsedMs: Signal<number>`. Updates on every whole second of the total while running; drives `timeText`.
  - `exactMs(): number`. Exact elapsed time now; used for saves and statistics.
  - `start()` and `stop()`, both idempotent. `stop()` adds the running segment to the total, so time is accumulated and never reset by a pause (rule R19, legacy bug).
  - `reset(elapsedMs = 0)`. Stops the timer and sets the total.

- [ ] **Step 1: Write the failing test**

`src/app/state/timer.spec.ts`:

```ts
import { FakeClock } from '../platform/testing/fakes';
import { Timer } from './timer';

describe('Timer', () => {
  let clock: FakeClock;
  let timer: Timer;

  beforeEach(() => {
    clock = new FakeClock();
    timer = new Timer(clock);
  });

  it('starts stopped at 0', () => {
    expect(timer.running()).toBe(false);
    expect(timer.elapsedMs()).toBe(0);
  });

  it('updates elapsed time on every whole second while running', () => {
    timer.start();
    clock.advance(999);
    expect(timer.elapsedMs()).toBe(0);
    clock.advance(1);
    expect(timer.elapsedMs()).toBe(1000);
    clock.advance(2500);
    expect(timer.elapsedMs()).toBe(3000);
  });

  it('accumulates across stop and start instead of resetting (legacy bug)', () => {
    timer.start();
    clock.advance(1500);
    timer.stop();
    expect(timer.elapsedMs()).toBe(1500);
    clock.advance(10_000);
    expect(timer.elapsedMs()).toBe(1500);
    timer.start();
    clock.advance(500);
    expect(timer.elapsedMs()).toBe(2000);
  });

  it('reads the exact time between ticks', () => {
    timer.reset(1000);
    timer.start();
    clock.advance(250);
    expect(timer.elapsedMs()).toBe(1000);
    expect(timer.exactMs()).toBe(1250);
    timer.stop();
    expect(timer.exactMs()).toBe(1250);
  });

  it('ticks on whole seconds of the total, not of the segment', () => {
    timer.reset(1500);
    timer.start();
    clock.advance(500);
    expect(timer.elapsedMs()).toBe(2000);
  });

  it('ignores repeated start and stop calls', () => {
    timer.start();
    clock.advance(400);
    timer.start();
    clock.advance(600);
    expect(timer.elapsedMs()).toBe(1000);
    timer.stop();
    timer.stop();
    expect(timer.elapsedMs()).toBe(1000);
    expect(clock.pending).toBe(0);
  });

  it('reset stops the timer and sets the total', () => {
    timer.start();
    clock.advance(3000);
    timer.reset(65_000);
    expect(timer.running()).toBe(false);
    expect(timer.elapsedMs()).toBe(65_000);
    expect(clock.pending).toBe(0);
    timer.reset();
    expect(timer.elapsedMs()).toBe(0);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test`
Expected: FAIL. The build reports `Could not resolve "./timer"`.

- [ ] **Step 3: Implement**

`src/app/state/timer.ts`:

```ts
import { computed, signal } from '@angular/core';
import type { ClockPort, TimerId } from '../platform/clock';

/**
 * Accumulating stopwatch (rule R19). `start()` opens a running segment, `stop()` adds it to
 * the total, so pausing never loses or resets time. While running, `elapsedMs` updates on
 * every whole second.
 */
export class Timer {
  private readonly accumulated = signal(0);
  private readonly startedAt = signal<number | null>(null);
  private readonly now = signal(0);
  private tick: TimerId | null = null;

  readonly running = computed(() => this.startedAt() !== null);
  readonly elapsedMs = computed(() => {
    const startedAt = this.startedAt();
    return this.accumulated() + (startedAt === null ? 0 : this.now() - startedAt);
  });

  constructor(private readonly clock: ClockPort) {}

  /** Exact elapsed time right now (for saving); `elapsedMs` only moves on whole seconds. */
  exactMs(): number {
    const startedAt = this.startedAt();
    return this.accumulated() + (startedAt === null ? 0 : this.clock.now() - startedAt);
  }

  start(): void {
    if (this.running()) {
      return;
    }
    const now = this.clock.now();
    this.now.set(now);
    this.startedAt.set(now);
    this.scheduleTick();
  }

  stop(): void {
    const startedAt = this.startedAt();
    if (startedAt === null) {
      return;
    }
    this.cancelTick();
    this.accumulated.update((total) => total + this.clock.now() - startedAt);
    this.startedAt.set(null);
  }

  /** Stops and sets the total, e.g. 0 for a new game or the saved time of a restored one. */
  reset(elapsedMs = 0): void {
    this.cancelTick();
    this.startedAt.set(null);
    this.accumulated.set(elapsedMs);
  }

  private scheduleTick(): void {
    const untilNextSecond = 1000 - (this.elapsedMs() % 1000);
    this.tick = this.clock.setTimeout(() => {
      this.now.set(this.clock.now());
      this.scheduleTick();
    }, untilNextSecond);
  }

  private cancelTick(): void {
    if (this.tick !== null) {
      this.clock.clearTimeout(this.tick);
      this.tick = null;
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (144 tests, 7 new).

- [ ] **Step 5: Commit**

```bash
git add src/app/state/timer.ts src/app/state/timer.spec.ts
git commit -m "feat(state): add accumulating game timer"
```

---

### Task 9: PhaseRunner

**Files:**
- Create: `src/app/state/phase-runner.ts`, `src/app/state/phase-runner.spec.ts`

**Interfaces:**
- Consumes: `MoveResult`, `Board`, `BallId` from `../engine`; `MotionDurations` (Task 6); `ClockPort` (Task 1).
- Produces:
  - `type Phase = 'idle' | 'pop' | 'fall' | 'slide' | 'over'`
  - `interface Frame { phase: Exclude<Phase, 'idle'>; board: Board; popping: ReadonlySet<BallId>; durationMs: number }`
  - `framesFor(before: Board, result: MoveResult, motion: MotionDurations): readonly Frame[]`:
    - `pop` on `before`, with the removed ids popping;
    - `fall` on `afterGravity`;
    - `slide` on `afterCollapse`, only when `afterCollapse !== afterGravity` (the engine's reference contract);
    - `over` with the game-over hold, only when `result.gameOver`.
  - `class PhaseRunner`, built as `new PhaseRunner(clock)`:
    - `run(frames, apply, done)` calls `apply(frame)`, waits `durationMs`, and repeats; `done()` runs after the last frame. Zero-length frames are applied synchronously, so with reduced motion the board jumps straight to its end state.
    - `run` cancels any previous run. `cancel()` drops the rest and never calls `done`.

- [ ] **Step 1: Write the failing test**

`src/app/state/phase-runner.spec.ts`:

```ts
import { burst, type Board, type MoveResult } from '../engine';
import { gameFrom } from '../engine/testing/fixtures';
import { FakeClock } from '../platform/testing/fakes';
import { MOTION, REDUCED_MOTION } from './motion';
import { framesFor, PhaseRunner, type Frame } from './phase-runner';

function burstAt(rows: readonly string[], row: number, col: number): [Board, MoveResult] {
  const game = gameFrom(rows);
  const result = burst(game, { row, col });
  if (result === null) throw new Error('expected a burst');
  return [game.board, result];
}

// Burst the bottom-right pair: the left column slides right, a pair is left (no game over).
const [slideBefore, slideResult] = burstAt(['b..', 'brr'], 1, 2);
// Burst the left column: nothing slides, the right column is left (no game over).
const [plainBefore, plainResult] = burstAt(['rb', 'rb', 'gb'], 0, 0);
// Burst the only pair: the board is empty (game over, nothing slides).
const [overBefore, overResult] = burstAt(['..', 'rr'], 1, 0);

describe('framesFor', () => {
  it('pops on the old board, then falls, then slides', () => {
    const frames = framesFor(slideBefore, slideResult, MOTION);
    expect(frames.map((frame) => [frame.phase, frame.durationMs])).toEqual([
      ['pop', 160],
      ['fall', 240],
      ['slide', 200],
    ]);
    expect(frames[0]?.board).toBe(slideBefore);
    expect([...(frames[0]?.popping ?? [])]).toEqual(slideResult.removed);
    expect(frames[1]?.board).toBe(slideResult.afterGravity);
    expect(frames[1]?.popping.size).toBe(0);
    expect(frames[2]?.board).toBe(slideResult.afterCollapse);
  });

  it('skips the slide when no column moved', () => {
    const frames = framesFor(plainBefore, plainResult, MOTION);
    expect(frames.map((frame) => frame.phase)).toEqual(['pop', 'fall']);
  });

  it('ends with a 500 ms game-over hold', () => {
    const frames = framesFor(overBefore, overResult, MOTION);
    expect(frames.map((frame) => [frame.phase, frame.durationMs])).toEqual([
      ['pop', 160],
      ['fall', 240],
      ['over', 500],
    ]);
  });

  it('uses the reduced-motion durations', () => {
    const frames = framesFor(overBefore, overResult, REDUCED_MOTION);
    expect(frames.map((frame) => frame.durationMs)).toEqual([80, 0, 0]);
  });
});

describe('PhaseRunner', () => {
  let clock: FakeClock;
  let runner: PhaseRunner;
  let applied: string[];
  let done: number;

  const run = (frames: readonly Frame[]): void => {
    runner.run(
      frames,
      (frame) => applied.push(frame.phase),
      () => done++,
    );
  };

  beforeEach(() => {
    clock = new FakeClock();
    runner = new PhaseRunner(clock);
    applied = [];
    done = 0;
  });

  it('applies each frame after the previous one has run its duration', () => {
    run(framesFor(slideBefore, slideResult, MOTION));
    expect(applied).toEqual(['pop']);
    clock.advance(159);
    expect(applied).toEqual(['pop']);
    clock.advance(1);
    expect(applied).toEqual(['pop', 'fall']);
    clock.advance(240);
    expect(applied).toEqual(['pop', 'fall', 'slide']);
    expect(done).toBe(0);
    clock.advance(200);
    expect(done).toBe(1);
    expect(clock.pending).toBe(0);
  });

  it('applies zero-length frames synchronously (reduced motion)', () => {
    run(framesFor(overBefore, overResult, REDUCED_MOTION));
    expect(applied).toEqual(['pop']);
    clock.advance(80);
    expect(applied).toEqual(['pop', 'fall', 'over']);
    expect(done).toBe(1);
  });

  it('cancel drops the remaining frames and never calls done', () => {
    run(framesFor(slideBefore, slideResult, MOTION));
    runner.cancel();
    clock.advance(1000);
    expect(applied).toEqual(['pop']);
    expect(done).toBe(0);
  });

  it('a new run cancels the previous one', () => {
    run(framesFor(slideBefore, slideResult, MOTION));
    run(framesFor(plainBefore, plainResult, MOTION));
    clock.advance(1000);
    expect(applied).toEqual(['pop', 'pop', 'fall']);
    expect(done).toBe(1);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test`
Expected: FAIL. The build reports `Could not resolve "./phase-runner"`.

- [ ] **Step 3: Implement**

`src/app/state/phase-runner.ts`:

```ts
import type { BallId, Board, MoveResult } from '../engine';
import type { ClockPort, TimerId } from '../platform/clock';
import type { MotionDurations } from './motion';

export type Phase = 'idle' | 'pop' | 'fall' | 'slide' | 'over';

/** One animation step: what the board shows while `phase` runs for `durationMs`. */
export interface Frame {
  readonly phase: Exclude<Phase, 'idle'>;
  readonly board: Board;
  readonly popping: ReadonlySet<BallId>;
  readonly durationMs: number;
}

const NONE: ReadonlySet<BallId> = new Set();

/**
 * The burst sequence from 02-ux: pop on the old board, fall to `afterGravity`, slide to
 * `afterCollapse` (skipped when nothing slid), then hold on game over.
 */
export function framesFor(
  before: Board,
  result: MoveResult,
  motion: MotionDurations,
): readonly Frame[] {
  const frames: Frame[] = [
    { phase: 'pop', board: before, popping: new Set(result.removed), durationMs: motion.pop },
    { phase: 'fall', board: result.afterGravity, popping: NONE, durationMs: motion.fall },
  ];
  if (result.afterCollapse !== result.afterGravity) {
    frames.push({
      phase: 'slide',
      board: result.afterCollapse,
      popping: NONE,
      durationMs: motion.slide,
    });
  }
  if (result.gameOver) {
    frames.push({
      phase: 'over',
      board: result.afterCollapse,
      popping: NONE,
      durationMs: motion.gameOver,
    });
  }
  return frames;
}

/**
 * Plays frames one after another on the injected clock. Zero-length frames are applied
 * synchronously, so reduced motion jumps straight to the end state.
 */
export class PhaseRunner {
  private pending: TimerId | null = null;

  constructor(private readonly clock: ClockPort) {}

  run(frames: readonly Frame[], apply: (frame: Frame) => void, done: () => void): void {
    this.cancel();
    const step = (index: number): void => {
      const frame = frames[index];
      if (frame === undefined) {
        done();
        return;
      }
      apply(frame);
      if (frame.durationMs === 0) {
        step(index + 1);
        return;
      }
      this.pending = this.clock.setTimeout(() => {
        this.pending = null;
        step(index + 1);
      }, frame.durationMs);
    };
    step(0);
  }

  /** Drops the remaining frames (new game during an animation). `done` is not called. */
  cancel(): void {
    if (this.pending !== null) {
      this.clock.clearTimeout(this.pending);
      this.pending = null;
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (152 tests, 8 new).

- [ ] **Step 5: Commit**

```bash
git add src/app/state/phase-runner.ts src/app/state/phase-runner.spec.ts
git commit -m "feat(state): add phase runner for burst animations"
```

---

### Task 10: SettingsStore and StatsStore

**Files:**
- Create: `src/app/state/settings.store.ts`, `src/app/state/settings.store.spec.ts`, `src/app/state/stats.store.ts`, `src/app/state/stats.store.spec.ts`

**Interfaces:**
- Consumes: `StoragePort` (Task 2); persistence (Task 7); `createFakePlatform` (specs).
- Produces (consumed by GameStore in Task 11 and by the Options, Statistics and Scoring screens in Plan 05):
  - `SettingsStore`
    - signals `breakerSet`, `shapeHints`, `sound`
    - intents `setBreakerSet(set)`, `setShapeHints(on)`, `setSound(on)`; each change is persisted at once
  - `StatsStore`
    - signals `high`, `total`, `played`, `last`, `average` (rounded, 0 before the first game), `newHigh`
    - `recordFinished(gameId, score, timeMs): boolean`. Idempotent per `gameId` through the persisted `lastRecordedGameId`; returns whether the game was added
    - `reset()`. Zeroes the numbers and keeps `lastRecordedGameId`

- [ ] **Step 1: Write the failing tests**

`src/app/state/settings.store.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { createFakePlatform, type FakePlatform } from '../platform/testing/fakes';
import { DEFAULT_SETTINGS, KEYS } from './persistence';
import { SettingsStore } from './settings.store';

describe('SettingsStore', () => {
  let platform: FakePlatform;

  const create = (): SettingsStore => {
    TestBed.configureTestingModule({ providers: platform.providers });
    return TestBed.inject(SettingsStore);
  };

  beforeEach(() => {
    platform = createFakePlatform();
  });

  it('starts with Colorful Breakers, no shape hints and sound on', () => {
    const settings = create();
    expect(settings.breakerSet()).toBe('colorful');
    expect(settings.shapeHints()).toBe(false);
    expect(settings.sound()).toBe(true);
  });

  it('loads stored settings', () => {
    platform.storage.set(KEYS.settings, {
      breakerSet: 'greyscale',
      shapeHints: true,
      sound: false,
    });
    const settings = create();
    expect(settings.breakerSet()).toBe('greyscale');
    expect(settings.shapeHints()).toBe(true);
    expect(settings.sound()).toBe(false);
  });

  it('falls back to defaults for invalid stored settings', () => {
    platform.storage.set(KEYS.settings, { breakerSet: 'neon' });
    const settings = create();
    expect(settings.breakerSet()).toBe(DEFAULT_SETTINGS.breakerSet);
  });

  it('persists every change', () => {
    const settings = create();
    settings.setBreakerSet('greyscale');
    settings.setShapeHints(true);
    settings.setSound(false);
    expect(settings.breakerSet()).toBe('greyscale');
    expect(settings.shapeHints()).toBe(true);
    expect(settings.sound()).toBe(false);
    expect(platform.storage.get(KEYS.settings)).toEqual({
      breakerSet: 'greyscale',
      shapeHints: true,
      sound: false,
    });
  });
});
```

`src/app/state/stats.store.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { createFakePlatform, type FakePlatform } from '../platform/testing/fakes';
import { DEFAULT_STATS, KEYS } from './persistence';
import { StatsStore } from './stats.store';

describe('StatsStore', () => {
  let platform: FakePlatform;

  const create = (): StatsStore => {
    TestBed.configureTestingModule({ providers: platform.providers });
    return TestBed.inject(StatsStore);
  };

  beforeEach(() => {
    platform = createFakePlatform();
  });

  it('starts empty with an average of 0', () => {
    const stats = create();
    expect([stats.high(), stats.total(), stats.played(), stats.average()]).toEqual([0, 0, 0, 0]);
    expect(stats.last()).toEqual({ score: 0, timeMs: 0 });
    expect(stats.newHigh()).toBe(false);
  });

  it('records a finished game and persists it', () => {
    const stats = create();
    expect(stats.recordFinished('game-1', 240, 61_000)).toBe(true);
    expect([stats.high(), stats.total(), stats.played()]).toEqual([240, 240, 1]);
    expect(stats.last()).toEqual({ score: 240, timeMs: 61_000 });
    expect(stats.newHigh()).toBe(true);
    expect(platform.storage.get(KEYS.stats)).toEqual({
      high: 240,
      total: 240,
      played: 1,
      last: { score: 240, timeMs: 61_000 },
      lastRecordedGameId: 'game-1',
    });
  });

  it('records each game exactly once (rule R17)', () => {
    const stats = create();
    stats.recordFinished('game-1', 240, 61_000);
    expect(stats.recordFinished('game-1', 240, 61_000)).toBe(false);
    expect(stats.played()).toBe(1);
    expect(stats.total()).toBe(240);
  });

  it('stays idempotent across reloads', () => {
    create().recordFinished('game-1', 240, 61_000);
    TestBed.resetTestingModule();
    const reloaded = create();
    expect(reloaded.recordFinished('game-1', 240, 61_000)).toBe(false);
    expect(reloaded.played()).toBe(1);
  });

  it('tracks the high score and a rounded average', () => {
    const stats = create();
    stats.recordFinished('a', 100, 1);
    stats.recordFinished('b', 50, 1);
    expect(stats.newHigh()).toBe(false);
    stats.recordFinished('c', 51, 1);
    expect([stats.high(), stats.total(), stats.played(), stats.average()]).toEqual([
      100, 201, 3, 67,
    ]);
    stats.recordFinished('d', 101, 1);
    expect(stats.newHigh()).toBe(true);
    expect(stats.high()).toBe(101);
  });

  it('loads stored statistics and ignores invalid ones', () => {
    platform.storage.set(KEYS.stats, { ...DEFAULT_STATS, high: 9, total: 9, played: 1 });
    expect(create().high()).toBe(9);
    TestBed.resetTestingModule();
    platform.storage.set(KEYS.stats, { high: -1 });
    expect(create().high()).toBe(0);
  });

  it('reset clears the numbers but still blocks re-recording the last game', () => {
    const stats = create();
    stats.recordFinished('game-1', 240, 61_000);
    stats.reset();
    expect([stats.high(), stats.total(), stats.played()]).toEqual([0, 0, 0]);
    expect(stats.newHigh()).toBe(false);
    expect(stats.recordFinished('game-1', 240, 61_000)).toBe(false);
    expect(platform.storage.get(KEYS.stats)).toEqual({
      ...DEFAULT_STATS,
      lastRecordedGameId: 'game-1',
    });
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm test`
Expected: FAIL. The build reports `Could not resolve "./settings.store"` and `Could not resolve "./stats.store"`.

- [ ] **Step 3: Implement**

`src/app/state/settings.store.ts`:

```ts
import { computed, inject, Injectable, signal } from '@angular/core';
import { StoragePort } from '../platform/storage';
import { loadSettings, saveSettings, type BreakerSet, type Settings } from './persistence';

/** Options screen state (rule R18, shape hints, sound), persisted on every change. */
@Injectable({ providedIn: 'root' })
export class SettingsStore {
  private readonly storage = inject(StoragePort);
  private readonly state = signal(loadSettings(this.storage));

  readonly breakerSet = computed(() => this.state().breakerSet);
  readonly shapeHints = computed(() => this.state().shapeHints);
  readonly sound = computed(() => this.state().sound);

  setBreakerSet(breakerSet: BreakerSet): void {
    this.update({ breakerSet });
  }

  setShapeHints(shapeHints: boolean): void {
    this.update({ shapeHints });
  }

  setSound(sound: boolean): void {
    this.update({ sound });
  }

  private update(change: Partial<Settings>): void {
    const next = { ...this.state(), ...change };
    this.state.set(next);
    saveSettings(this.storage, next);
  }
}
```

`src/app/state/stats.store.ts`:

```ts
import { computed, inject, Injectable, signal } from '@angular/core';
import { StoragePort } from '../platform/storage';
import { DEFAULT_STATS, loadStats, saveStats } from './persistence';

/** Statistics (rule R17), written once per finished game. */
@Injectable({ providedIn: 'root' })
export class StatsStore {
  private readonly storage = inject(StoragePort);
  private readonly state = signal(loadStats(this.storage));
  private readonly newHighSignal = signal(false);

  readonly high = computed(() => this.state().high);
  readonly total = computed(() => this.state().total);
  readonly played = computed(() => this.state().played);
  readonly last = computed(() => this.state().last);
  readonly average = computed(() => {
    const { total, played } = this.state();
    return played === 0 ? 0 : Math.round(total / played);
  });
  /** True when the last recorded game beat the previous high score (Scoring badge). */
  readonly newHigh = this.newHighSignal.asReadonly();

  /**
   * Adds a finished game to the statistics. Idempotent per `gameId`: a repeat call for the
   * last recorded game (double game-over, reload at game over) changes nothing.
   * Returns whether the game was recorded.
   */
  recordFinished(gameId: string, score: number, timeMs: number): boolean {
    const current = this.state();
    if (current.lastRecordedGameId === gameId) {
      return false;
    }
    const next = {
      high: Math.max(current.high, score),
      total: current.total + score,
      played: current.played + 1,
      last: { score, timeMs },
      lastRecordedGameId: gameId,
    };
    this.newHighSignal.set(score > current.high);
    this.state.set(next);
    saveStats(this.storage, next);
    return true;
  }

  /** "Reset statistics…": back to zero, but still remembers the last recorded game id. */
  reset(): void {
    const next = { ...DEFAULT_STATS, lastRecordedGameId: this.state().lastRecordedGameId };
    this.newHighSignal.set(false);
    this.state.set(next);
    saveStats(this.storage, next);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (163 tests, 11 new).

- [ ] **Step 5: Commit**

```bash
git add src/app/state/settings.store.ts src/app/state/settings.store.spec.ts src/app/state/stats.store.ts src/app/state/stats.store.spec.ts
git commit -m "feat(state): add settings and statistics stores"
```

---

### Task 11: GameStore

**Files:**
- Create: `src/app/state/game.store.ts`, `src/app/state/game.store.spec.ts`

**Interfaces:**
- Consumes: engine `burst`, `groupAt`, `hasMoves`, `isInside`, `newGame`, `scoreFor`; all five ports; `Timer`, `PhaseRunner`, `framesFor`, `motionFor`, persistence, `formatNumber`, `formatClock`, `SettingsStore`, `StatsStore`, `STRINGS`.
- Produces (consumed by the board in Plan 04 and the chrome and screens in Plan 05):

```ts
interface Selection { readonly cells: readonly Cell[]; readonly anchor: Cell }   // anchor = tapped cell (bubble)
type Direction = 'up' | 'down' | 'left' | 'right';

class GameStore {
  // state
  gameId: Signal<string>;                          // crypto.randomUUID() per game
  game: Signal<Game>;                              // jumps to the burst result at once
  selection: Signal<Selection | null>;
  phase: Signal<Phase>;                            // 'idle' | 'pop' | 'fall' | 'slide' | 'over'
  positions: Signal<ReadonlyMap<BallId, Cell>>;    // drives transforms; lags game().board during a burst
  popping: Signal<ReadonlySet<BallId>>;
  cursor: Signal<Cell>;                            // keyboard cursor, may rest on an empty cell
  paused: Signal<boolean>;                         // Paused dialog due (page hidden / restored game)
  covered: Signal<boolean>;                        // menu, screen or dialog open
  showScoring: Signal<boolean>;                    // game-over hold done → UI navigates to 'scoring'
  elapsedMs: Signal<number>;
  // derived
  selectedPoints: Signal<number>;  selectedText: Signal<string>;   // '–' without selection
  scoreText: Signal<string>;       timeText: Signal<string>;       // '1,234', 'm:ss' / '‖ m:ss'
  canInteract: Signal<boolean>;                    // phase 'idle' and not paused
  // intents
  tap(cell: Cell): void;                           // R8/R9; off-board cells clear the selection
  newGame(seed?: number): void;                    // R21: abandoned game is not counted
  pause(): void;  resume(): void;  setCovered(covered: boolean): void;
  moveCursor(direction: Direction): void;  activateCursor(): void;  clearSelection(): void;
  save(): void;                                    // Plan 06 calls it before a service-worker reload
}
```

Behaviour summary:
- **Start-up:** a valid `bb:v1:game` with moves left is restored as Paused. Otherwise a new game is dealt and saved at once.
- **Burst:** the selection clears, `game` jumps to the result, the pop sound plays, and the PhaseRunner applies the frames. When they settle, `phase` returns to `idle` and the game is saved.
- **Game over:** the `over` frame stops the timer, calls `StatsStore.recordFinished(gameId, score, exactMs)`, clears `bb:v1:game` and plays the game-over sound. After the hold, `showScoring` turns true.
- **Timer:** runs while not paused, not covered and not over.
- **Hidden page:** an `effect` on `VisibilityPort.hidden` calls `pause()`. Becoming visible again does not resume.
- **Sounds:** play only when `SettingsStore.sound()` is on. `select` plays on selection, `pop` on burst, `gameOver` at the over frame.

- [ ] **Step 1: Write the failing test**

`src/app/state/game.store.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { allGroups, ballAt, groupAt, newGame, scoreFor, type Cell, type Game } from '../engine';
import { createFakePlatform, type FakePlatform } from '../platform/testing/fakes';
import { GameStore } from './game.store';
import { KEYS, type GameRecord } from './persistence';
import { SettingsStore } from './settings.store';
import { StatsStore } from './stats.store';
import { recordFrom } from './testing/records';

// Bottom of the board: a vertical blue pair at column 8 and a red pair to its right.
// Bursting the reds empties columns 9 and 10, so the blues slide right; the game goes on.
const SLIDE = recordFrom(['........b..', '........brr']);
// Only one red pair: bursting it clears the board (game over).
const LAST_PAIR = recordFrom(['.........rr']);
// Two lone balls: a saved game without moves.
const NO_MOVES = recordFrom(['.........rb']);

function firstGroup(game: Game): readonly Cell[] {
  return allGroups(game)[0]!;
}

function loneCell(game: Game): Cell {
  for (let row = 0; row < game.board.rows; row++) {
    for (let col = 0; col < game.board.columns; col++) {
      const cell = { row, col };
      if (ballAt(game.board, cell) !== null && groupAt(game, cell).length === 0) {
        return cell;
      }
    }
  }
  throw new Error('no lone ball on this board');
}

describe('GameStore', () => {
  let platform: FakePlatform;

  const start = (saved?: GameRecord): GameStore => {
    if (saved !== undefined) {
      platform.storage.set(KEYS.game, saved);
    }
    TestBed.configureTestingModule({ providers: platform.providers });
    return TestBed.inject(GameStore);
  };

  /** Simulates a page reload: new injector, same storage and clock. */
  const reload = (): GameStore => {
    TestBed.resetTestingModule();
    return start();
  };

  const stored = (): unknown => platform.storage.get(KEYS.game);

  /** Resumes a restored SLIDE or LAST_PAIR game and bursts its bottom-right red pair. */
  const burstRedPair = (store: GameStore): void => {
    store.resume();
    store.tap({ row: 11, col: 9 });
    store.tap({ row: 11, col: 9 });
  };

  beforeEach(() => {
    platform = createFakePlatform();
  });

  describe('start-up', () => {
    it('deals a new game when nothing is saved, and saves it at once', () => {
      const store = start();
      expect(store.game().board.cells).toHaveLength(132);
      expect(store.game().score).toBe(0);
      expect(store.phase()).toBe('idle');
      expect(store.paused()).toBe(false);
      expect(store.gameId()).toMatch(/^[0-9a-f-]{36}$/);
      expect(stored()).toMatchObject({ gameId: store.gameId(), seed: store.game().seed });
    });

    it('restores a saved game in the Paused state', () => {
      const store = start(SLIDE);
      expect(store.gameId()).toBe('saved-game');
      expect(store.game().score).toBe(100);
      expect(store.game().board.cells).toEqual(SLIDE.cells);
      expect(store.paused()).toBe(true);
      expect(store.elapsedMs()).toBe(65_000);
      expect(store.timeText()).toBe('‖ 1:05');
      platform.clock.advance(5000);
      expect(store.elapsedMs()).toBe(65_000);
    });

    it('deals a new game when the saved game has no moves left', () => {
      const store = start(NO_MOVES);
      expect(store.gameId()).not.toBe('saved-game');
      expect(store.paused()).toBe(false);
    });

    it('deals a new game when the save is corrupt', () => {
      platform.storage.data.set(KEYS.game, '{"gameId":');
      const store = start();
      expect(store.game().score).toBe(0);
      expect(store.paused()).toBe(false);
    });
  });

  describe('newGame', () => {
    it('deals the given seed with a fresh game id', () => {
      const store = start();
      const firstId = store.gameId();
      store.newGame(1);
      expect(store.game()).toEqual(newGame(1));
      expect(store.gameId()).not.toBe(firstId);
      expect(stored()).toMatchObject({ gameId: store.gameId(), seed: 1, score: 0, elapsedMs: 0 });
    });

    it('resets selection, cursor, pause and time', () => {
      const store = start(SLIDE);
      store.resume();
      store.moveCursor('down');
      platform.clock.advance(3000);
      store.newGame(1);
      expect(store.selection()).toBeNull();
      expect(store.cursor()).toEqual({ row: 0, col: 0 });
      expect(store.paused()).toBe(false);
      expect(store.elapsedMs()).toBe(0);
      platform.clock.advance(1000);
      expect(store.elapsedMs()).toBe(1000);
    });
  });

  describe('tap (rules R8/R9)', () => {
    let store: GameStore;

    beforeEach(() => {
      store = start();
      store.newGame(1);
    });

    it('selects a group, anchors it on the tapped cell and shows its points', () => {
      const group = firstGroup(store.game());
      const cell = group[0]!;
      store.tap(cell);
      expect(store.selection()).toEqual({ cells: groupAt(store.game(), cell), anchor: cell });
      expect(store.selectedPoints()).toBe(scoreFor(group.length));
      expect(store.selectedText()).toBe(String(scoreFor(group.length)));
      expect(platform.audio.played).toEqual(['select']);
    });

    it('moves the selection to another group', () => {
      const [first, second] = allGroups(store.game());
      store.tap(first![0]!);
      store.tap(second![0]!);
      expect(store.selection()?.anchor).toEqual(second![0]);
    });

    it('clears the selection on a lone ball or a cell off the board', () => {
      const cell = firstGroup(store.game())[0]!;
      store.tap(cell);
      store.tap(loneCell(store.game()));
      expect(store.selection()).toBeNull();
      expect(store.selectedText()).toBe('–');
      expect(store.selectedPoints()).toBe(0);
      store.tap(cell);
      store.tap({ row: -1, col: 3 });
      expect(store.selection()).toBeNull();
    });

    it('bursts when any cell of the selected group is tapped again', () => {
      const group = firstGroup(store.game());
      store.tap(group[0]!);
      store.tap(group[group.length - 1]!);
      expect(store.phase()).toBe('pop');
      expect(store.selection()).toBeNull();
      expect(store.game().score).toBe(scoreFor(group.length));
      expect(store.scoreText()).toBe(String(scoreFor(group.length)));
      expect(store.popping().size).toBe(group.length);
      expect(platform.audio.played).toEqual(['select', 'pop']);
    });
  });

  describe('burst animation', () => {
    let store: GameStore;

    beforeEach(() => {
      store = start(SLIDE);
      burstRedPair(store);
    });

    it('steps pop → fall → slide → idle while positions lag the engine board', () => {
      expect(store.phase()).toBe('pop');
      expect(store.game().score).toBe(102);
      expect(store.positions().get(130)).toEqual({ row: 11, col: 9 });
      expect(store.popping()).toEqual(new Set([130, 131]));
      platform.clock.advance(160);
      expect(store.phase()).toBe('fall');
      expect(store.positions().has(130)).toBe(false);
      expect(store.positions().get(129)).toEqual({ row: 11, col: 8 });
      platform.clock.advance(240);
      expect(store.phase()).toBe('slide');
      expect(store.positions().get(129)).toEqual({ row: 11, col: 10 });
      platform.clock.advance(200);
      expect(store.phase()).toBe('idle');
      expect(store.canInteract()).toBe(true);
    });

    it('ignores taps while the animation runs', () => {
      expect(store.canInteract()).toBe(false);
      store.tap({ row: 11, col: 8 });
      expect(store.selection()).toBeNull();
    });

    it('saves the final game once the animation settles', () => {
      platform.clock.advance(599);
      expect(stored()).toMatchObject({ score: 100 });
      platform.clock.advance(1);
      expect(stored()).toMatchObject({ gameId: 'saved-game', score: 102, elapsedMs: 65_600 });
    });

    it('a new game cancels the running animation', () => {
      store.newGame(1);
      platform.clock.advance(1000);
      expect(store.phase()).toBe('idle');
      expect(store.positions().size).toBe(132);
    });
  });

  describe('game over (rules R13, R16, R17)', () => {
    let store: GameStore;

    beforeEach(() => {
      store = start(LAST_PAIR);
      burstRedPair(store);
    });

    it('enters "over" after pop and fall, records statistics and drops the save', () => {
      platform.clock.advance(399);
      expect(TestBed.inject(StatsStore).played()).toBe(0);
      platform.clock.advance(1);
      expect(store.phase()).toBe('over');
      const stats = TestBed.inject(StatsStore);
      expect(stats.played()).toBe(1);
      expect(stats.last()).toEqual({ score: 102, timeMs: 65_400 });
      expect(stored()).toBeUndefined();
      expect(platform.audio.played).toEqual(['select', 'pop', 'gameOver']);
    });

    it('stops the timer at game over', () => {
      platform.clock.advance(400);
      platform.clock.advance(10_000);
      expect(store.elapsedMs()).toBe(65_400);
    });

    it('holds the board for 500 ms, then asks for the Scoring screen', () => {
      platform.clock.advance(400);
      expect(store.showScoring()).toBe(false);
      platform.clock.advance(499);
      expect(store.showScoring()).toBe(false);
      platform.clock.advance(1);
      expect(store.showScoring()).toBe(true);
    });

    it('ignores pause and save after game over', () => {
      platform.clock.advance(400);
      store.pause();
      store.save();
      expect(store.paused()).toBe(false);
      expect(stored()).toBeUndefined();
    });

    it('starts a new game after a reload at game over, without counting twice', () => {
      platform.clock.advance(400);
      const reloaded = reload();
      expect(reloaded.paused()).toBe(false);
      expect(reloaded.gameId()).not.toBe('saved-game');
      expect(TestBed.inject(StatsStore).played()).toBe(1);
    });

    it('counts a replayed game once even if the save could not be cleared', () => {
      platform.clock.advance(900);
      platform.storage.set(KEYS.game, LAST_PAIR);
      store = reload();
      burstRedPair(store);
      platform.clock.advance(900);
      expect(store.phase()).toBe('over');
      expect(TestBed.inject(StatsStore).played()).toBe(1);
    });
  });

  describe('timer, pause and cover (rule R19)', () => {
    let store: GameStore;

    beforeEach(() => {
      store = start();
      store.newGame(1);
    });

    it('runs from the deal and shows m:ss', () => {
      platform.clock.advance(61_000);
      expect(store.timeText()).toBe('1:01');
    });

    it('pause stops the timer, saves and blocks taps until resume', () => {
      platform.clock.advance(2000);
      store.pause();
      expect(store.paused()).toBe(true);
      expect(stored()).toMatchObject({ elapsedMs: 2000 });
      platform.clock.advance(5000);
      expect(store.timeText()).toBe('‖ 0:02');
      store.tap(firstGroup(store.game())[0]!);
      expect(store.selection()).toBeNull();
      store.resume();
      store.resume();
      platform.clock.advance(1000);
      expect(store.elapsedMs()).toBe(3000);
    });

    it('pauses when the page is hidden and stays paused when it is visible again', () => {
      platform.clock.advance(1000);
      platform.visibility.hidden.set(true);
      TestBed.tick();
      expect(store.paused()).toBe(true);
      expect(stored()).toMatchObject({ elapsedMs: 1000 });
      platform.visibility.hidden.set(false);
      TestBed.tick();
      expect(store.paused()).toBe(true);
    });

    it('stops the timer while covered, without the Paused state', () => {
      platform.clock.advance(1000);
      store.setCovered(true);
      store.setCovered(true);
      expect(store.covered()).toBe(true);
      expect(store.paused()).toBe(false);
      expect(stored()).toMatchObject({ elapsedMs: 1000 });
      platform.clock.advance(5000);
      expect(store.timeText()).toBe('‖ 0:01');
      store.setCovered(false);
      platform.clock.advance(1000);
      expect(store.timeText()).toBe('0:02');
    });

    it('keeps the timer stopped when the cover closes while paused', () => {
      store.setCovered(true);
      store.pause();
      store.setCovered(false);
      platform.clock.advance(5000);
      expect(store.elapsedMs()).toBe(0);
    });
  });

  describe('keyboard', () => {
    let store: GameStore;

    beforeEach(() => {
      store = start();
      store.newGame(1);
    });

    it('moves the cursor without wrapping', () => {
      expect(store.cursor()).toEqual({ row: 0, col: 0 });
      store.moveCursor('up');
      store.moveCursor('left');
      expect(store.cursor()).toEqual({ row: 0, col: 0 });
      store.moveCursor('down');
      store.moveCursor('right');
      expect(store.cursor()).toEqual({ row: 1, col: 1 });
      for (let i = 0; i < 20; i++) {
        store.moveCursor('down');
        store.moveCursor('right');
      }
      expect(store.cursor()).toEqual({ row: 11, col: 10 });
    });

    it('activates the cursor cell like a tap, and Esc clears the selection', () => {
      const cell = firstGroup(store.game())[0]!;
      for (let i = 0; i < cell.row; i++) store.moveCursor('down');
      for (let i = 0; i < cell.col; i++) store.moveCursor('right');
      store.activateCursor();
      expect(store.selection()?.anchor).toEqual(cell);
      store.clearSelection();
      expect(store.selection()).toBeNull();
      store.activateCursor();
      store.activateCursor();
      expect(store.phase()).toBe('pop');
    });
  });

  describe('sound', () => {
    it('plays nothing when sound is off', () => {
      const store = start();
      store.newGame(1);
      TestBed.inject(SettingsStore).setSound(false);
      const cell = firstGroup(store.game())[0]!;
      store.tap(cell);
      store.tap(cell);
      expect(platform.audio.played).toEqual([]);
    });
  });

  describe('reduced motion', () => {
    beforeEach(() => {
      platform.motion.reduced.set(true);
    });

    it('jumps to the end state after the 80 ms pop fade', () => {
      const store = start(SLIDE);
      burstRedPair(store);
      platform.clock.advance(79);
      expect(store.phase()).toBe('pop');
      platform.clock.advance(1);
      expect(store.phase()).toBe('idle');
      expect(store.positions().get(129)).toEqual({ row: 11, col: 10 });
    });

    it('opens Scoring without the game-over hold', () => {
      const store = start(LAST_PAIR);
      burstRedPair(store);
      platform.clock.advance(80);
      expect(store.phase()).toBe('over');
      expect(store.showScoring()).toBe(true);
    });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test`
Expected: FAIL. The build reports `Could not resolve "./game.store"`.

- [ ] **Step 3: Implement**

`src/app/state/game.store.ts`:

```ts
import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import {
  burst,
  groupAt,
  hasMoves,
  isInside,
  newGame as deal,
  scoreFor,
  type BallId,
  type Board,
  type Cell,
  type Game,
  type MoveResult,
} from '../engine';
import { AudioPort, type Sound } from '../platform/audio';
import { ClockPort } from '../platform/clock';
import { ReducedMotionPort } from '../platform/reduced-motion';
import { StoragePort } from '../platform/storage';
import { VisibilityPort } from '../platform/visibility';
import { STRINGS } from '../strings';
import { formatClock, formatNumber } from './format';
import { motionFor } from './motion';
import { clearGame, loadGame, saveGame, type SavedGame } from './persistence';
import { framesFor, PhaseRunner, type Frame, type Phase } from './phase-runner';
import { SettingsStore } from './settings.store';
import { StatsStore } from './stats.store';
import { Timer } from './timer';

export interface Selection {
  /** Every cell of the highlighted group. */
  readonly cells: readonly Cell[];
  /** The tapped cell; the points bubble is anchored to it. */
  readonly anchor: Cell;
}

export type Direction = 'up' | 'down' | 'left' | 'right';

const STEPS: Record<Direction, Cell> = {
  up: { row: -1, col: 0 },
  down: { row: 1, col: 0 },
  left: { row: 0, col: -1 },
  right: { row: 0, col: 1 },
};

const START_CURSOR: Cell = { row: 0, col: 0 };
const NO_BALLS: ReadonlySet<BallId> = new Set();

function positionsOf(board: Board): ReadonlyMap<BallId, Cell> {
  const positions = new Map<BallId, Cell>();
  board.cells.forEach((id, index) => {
    if (id !== null) {
      positions.set(id, { row: Math.floor(index / board.columns), col: index % board.columns });
    }
  });
  return positions;
}

function sameCell(a: Cell, b: Cell): boolean {
  return a.row === b.row && a.col === b.col;
}

function clamp(value: number, max: number): number {
  return Math.min(Math.max(value, 0), max);
}

function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 32);
}

/**
 * The game in progress: selection rules R8/R9, burst animation phases, timer, pause and
 * persistence. The only place that changes the selection (pointer and keyboard both
 * call `tap`).
 */
@Injectable({ providedIn: 'root' })
export class GameStore {
  private readonly storage = inject(StoragePort);
  private readonly audio = inject(AudioPort);
  private readonly visibility = inject(VisibilityPort);
  private readonly reducedMotion = inject(ReducedMotionPort);
  private readonly settings = inject(SettingsStore);
  private readonly stats = inject(StatsStore);
  private readonly clock = inject(ClockPort);
  private readonly timer = new Timer(this.clock);
  private readonly runner = new PhaseRunner(this.clock);

  // Placeholder values; the constructor restores a saved game or deals a new one.
  private readonly gameIdSignal = signal('');
  private readonly gameSignal = signal<Game>(deal(0));
  private readonly shownBoard = signal<Board>(this.gameSignal().board);
  private readonly selectionSignal = signal<Selection | null>(null);
  private readonly phaseSignal = signal<Phase>('idle');
  private readonly poppingSignal = signal<ReadonlySet<BallId>>(NO_BALLS);
  private readonly cursorSignal = signal<Cell>(START_CURSOR);
  private readonly pausedSignal = signal(false);
  private readonly coveredSignal = signal(false);
  private readonly showScoringSignal = signal(false);

  /** `crypto.randomUUID()` per game; makes the statistics entry idempotent. */
  readonly gameId = this.gameIdSignal.asReadonly();
  /** Engine state. Jumps to the final state of a burst immediately. */
  readonly game = this.gameSignal.asReadonly();
  readonly selection = this.selectionSignal.asReadonly();
  readonly phase = this.phaseSignal.asReadonly();
  /** Where each ball is drawn. Lags `game().board` while a burst animates. */
  readonly positions = computed(() => positionsOf(this.shownBoard()));
  /** Balls running the pop animation. */
  readonly popping = this.poppingSignal.asReadonly();
  /** Keyboard cursor; may rest on an empty cell. */
  readonly cursor = this.cursorSignal.asReadonly();
  /** The Paused dialog is due: the page was hidden or a saved game was restored. */
  readonly paused = this.pausedSignal.asReadonly();
  /** A menu, screen or dialog covers the board; the timer stops but no Paused dialog. */
  readonly covered = this.coveredSignal.asReadonly();
  /** The game-over hold is over; the UI navigates to Scoring (rule R16). */
  readonly showScoring = this.showScoringSignal.asReadonly();
  readonly elapsedMs = this.timer.elapsedMs;

  readonly selectedPoints = computed(() => {
    const selection = this.selectionSignal();
    return selection === null ? 0 : scoreFor(selection.cells.length);
  });
  readonly selectedText = computed(() =>
    this.selectionSignal() === null
      ? STRINGS.status.noSelection
      : formatNumber(this.selectedPoints()),
  );
  readonly scoreText = computed(() => formatNumber(this.gameSignal().score));
  readonly timeText = computed(() => {
    const time = formatClock(this.elapsedMs());
    return this.pausedSignal() || this.coveredSignal() ? STRINGS.status.pausedPrefix + time : time;
  });
  /** Taps count only when no animation runs and the game is not paused. */
  readonly canInteract = computed(() => this.phaseSignal() === 'idle' && !this.pausedSignal());

  private readonly motion = computed(() => motionFor(this.reducedMotion.reduced()));

  constructor() {
    const saved = loadGame(this.storage);
    if (saved !== null && hasMoves(saved.game)) {
      this.restore(saved);
    } else {
      this.newGame();
    }
    effect(() => {
      if (this.visibility.hidden()) {
        untracked(() => {
          this.pause();
        });
      }
    });
  }

  /**
   * Rules R8/R9: a group → select it; the selected group again → burst it; a lone ball,
   * an empty cell or a cell off the board → clear the selection.
   */
  tap(cell: Cell): void {
    if (!this.canInteract()) {
      return;
    }
    const game = this.gameSignal();
    const group = isInside(game.board, cell) ? groupAt(game, cell) : [];
    if (group.length === 0) {
      this.selectionSignal.set(null);
      return;
    }
    const selected = this.selectionSignal()?.cells.some((member) => sameCell(member, cell));
    if (selected === true) {
      this.burstAt(cell);
      return;
    }
    this.selectionSignal.set({ cells: group, anchor: cell });
    this.playSound('select');
  }

  /** Deals a new game. The abandoned game is not counted (rule R21). */
  newGame(seed = randomSeed()): void {
    this.runner.cancel();
    const game = deal(seed);
    this.gameIdSignal.set(crypto.randomUUID());
    this.gameSignal.set(game);
    this.shownBoard.set(game.board);
    this.selectionSignal.set(null);
    this.phaseSignal.set('idle');
    this.poppingSignal.set(NO_BALLS);
    this.cursorSignal.set(START_CURSOR);
    this.pausedSignal.set(false);
    this.showScoringSignal.set(false);
    this.timer.reset();
    this.syncTimer();
    this.save();
  }

  /** Enters the Paused state (page hidden). Saves the game. */
  pause(): void {
    if (this.pausedSignal() || this.phaseSignal() === 'over') {
      return;
    }
    this.pausedSignal.set(true);
    this.syncTimer();
    this.save();
  }

  resume(): void {
    if (!this.pausedSignal()) {
      return;
    }
    this.pausedSignal.set(false);
    this.syncTimer();
  }

  /** Called by the UI when a menu, screen or dialog opens (true) or closes (false). */
  setCovered(covered: boolean): void {
    if (covered === this.coveredSignal()) {
      return;
    }
    this.coveredSignal.set(covered);
    this.syncTimer();
    if (covered) {
      this.save();
    }
  }

  moveCursor(direction: Direction): void {
    const { rows, columns } = this.gameSignal().board;
    const step = STEPS[direction];
    this.cursorSignal.update((cursor) => ({
      row: clamp(cursor.row + step.row, rows - 1),
      col: clamp(cursor.col + step.col, columns - 1),
    }));
  }

  /** Enter / Space on the board. */
  activateCursor(): void {
    this.tap(this.cursorSignal());
  }

  /** Esc on the board. */
  clearSelection(): void {
    this.selectionSignal.set(null);
  }

  /** Writes `bb:v1:game`. Also called by the Pwa port before a reload (Plan 06). */
  save(): void {
    if (this.phaseSignal() === 'over') {
      return;
    }
    saveGame(this.storage, {
      gameId: this.gameIdSignal(),
      game: this.gameSignal(),
      elapsedMs: this.timer.exactMs(),
    });
  }

  private burstAt(cell: Cell): void {
    const before = this.gameSignal();
    const result = burst(before, cell);
    if (result === null) {
      return; // Unreachable: a selected cell always belongs to a burstable group.
    }
    this.animate(before.board, result);
  }

  private animate(before: Board, result: MoveResult): void {
    this.selectionSignal.set(null);
    this.gameSignal.set(result.game);
    this.playSound('pop');
    this.runner.run(
      framesFor(before, result, this.motion()),
      (frame) => {
        this.applyFrame(frame);
      },
      () => {
        this.settle();
      },
    );
  }

  private applyFrame(frame: Frame): void {
    this.phaseSignal.set(frame.phase);
    this.shownBoard.set(frame.board);
    this.poppingSignal.set(frame.popping);
    if (frame.phase === 'over') {
      this.finish();
    }
  }

  /** Game over (rule R13): stop the clock, record statistics once, drop the save. */
  private finish(): void {
    this.syncTimer();
    this.stats.recordFinished(this.gameIdSignal(), this.gameSignal().score, this.timer.exactMs());
    clearGame(this.storage);
    this.playSound('gameOver');
  }

  private settle(): void {
    if (this.phaseSignal() === 'over') {
      this.showScoringSignal.set(true);
      return;
    }
    this.phaseSignal.set('idle');
    this.save();
  }

  private restore(saved: SavedGame): void {
    this.gameIdSignal.set(saved.gameId);
    this.gameSignal.set(saved.game);
    this.shownBoard.set(saved.game.board);
    this.timer.reset(saved.elapsedMs);
    this.pausedSignal.set(true);
  }

  private syncTimer(): void {
    const running = !this.pausedSignal() && !this.coveredSignal() && this.phaseSignal() !== 'over';
    if (running) {
      this.timer.start();
    } else {
      this.timer.stop();
    }
  }

  private playSound(sound: Sound): void {
    if (this.settings.sound()) {
      this.audio.play(sound);
    }
  }
}
```

Notes for the implementer:
- `newGame as deal` avoids shadowing the `newGame()` intent.
- The fields start with a placeholder deal; the constructor immediately restores or re-deals.
- `effect()` must run in the constructor (injection context). `untracked()` stops the effect from also tracking the signals that `pause()` reads.
- `burstAt` has one unreachable `null` branch (a selected cell always belongs to a burstable group). It is the only uncovered branch in `state/`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (193 tests, 30 new).

- [ ] **Step 5: Commit**

```bash
git add src/app/state/game.store.ts src/app/state/game.store.spec.ts
git commit -m "feat(state): add game store with selection, phases, timer and persistence"
```

---

### Task 12: Coverage gate and docs sync

**Files:**
- Modify: `docs/03-architecture.md` (Folder layout, State, Persistence, Platform ports), `docs/04-quality.md` (State unit row)

- [ ] **Step 1: Run the coverage gate**

Run: `npm run test:ci`
Expected: PASS (193 tests), with no `ERROR: Coverage for … does not meet` line. Reference run: overall statements 99.6 %, branches 99.1 %, functions 99.4 %, lines 99.8 %. In `src/app/state/` only the unreachable `null` branch in `GameStore.burstAt` and its `return` line are uncovered. If a metric drops below 90 % for `src/app/state/**`, open `coverage/bubble-breaker/index.html` and add a unit test for the uncovered branch in the matching spec. Do not lower the threshold.

- [ ] **Step 2: Sync `docs/03-architecture.md` with the implementation**

1. In "Folder layout", replace the `state/` and `platform/` lines with:

```text
    state/           game.store.ts stats.store.ts settings.store.ts phase-runner.ts timer.ts persistence.ts motion.ts format.ts
    platform/        clock.ts storage.ts audio.ts visibility.ts reduced-motion.ts provide-platform.ts (pwa.ts in Plan 06) + testing/fakes.ts
```

2. In "State (signals)" → **GameStore**:
   - Add the state signals `cursor` (keyboard cursor), `covered` (menu, screen or dialog open; stops the timer) and `showScoring` (the game-over hold is over, so the UI navigates to Scoring).
   - Add `selectedText` to the derived signals.
   - Change the intents to `newGame(seed?)`, `pause()`, `resume()`, `setCovered(covered)` and `save()`.
   - Replace the PhaseRunner bullet with: "**PhaseRunner** plays the frames built by `framesFor(before, result, motion)`: pop on the old board, fall to `afterGravity`, slide to `afterCollapse` (skipped when `afterCollapse === afterGravity`), then an `over` hold on game over. It uses the durations from `state/motion.ts` (which mirrors `tokens.css`) and the injected clock. With reduced motion the pop keeps an 80 ms fade and every other duration is 0; zero-length frames apply synchronously. Tests use `FakeClock`."
   - Add: "At the `over` frame the store stops the timer, records statistics, clears `bb:v1:game` and plays the game-over sound; `showScoring` turns true after the hold."

3. **StatsStore**: add "`newHigh` (not persisted) marks a record that beat the previous high. `reset()` keeps `lastRecordedGameId`."

4. **SettingsStore**: add "Defaults: Colorful, shape hints off, sound on."

5. **Timer**: replace the first bullet with "Elapsed time is accumulated by `state/timer.ts`. It runs from the deal while the game is not paused, covered or over, and stops at game over. The display updates on whole seconds; saves use the exact value."

6. "Persistence": add two bullets:
   - "`bb:v1:game` is also written when a game is dealt, so a reload never restores an abandoned game."
   - "A saved game without moves is discarded on start."

7. Replace the "Platform ports" bullets with:

```markdown
Abstract classes used as DI tokens, bound by `providePlatform()` in `app.config.ts`; tests use the fakes in `platform/testing/fakes.ts` via `createFakePlatform()`.

- **StoragePort**: `get/set/remove` JSON. `BrowserStorage` resolves `localStorage` on every call and swallows every error with a warning (private mode, quota).
- **ClockPort**: `now()`, `setTimeout`, `clearTimeout`.
- **AudioPort**: `play('select' | 'pop' | 'gameOver')`. `BrowserAudio` creates or resumes the `AudioContext` on the first play, which always runs inside a tap or key press, and plays sounds synthesized from the legacy designs. It stays silent when Web Audio is unavailable. The GameStore calls it only when sound is on.
- **VisibilityPort**: a `hidden` signal from `visibilitychange`.
- **ReducedMotionPort**: a `reduced` signal from `matchMedia('(prefers-reduced-motion: reduce)')`; false where `matchMedia` is missing.
- **Pwa** (Plan 06):
  - Exposes `updateAvailable`, `offlineReady` and `installAvailable` signals from `SwUpdate` and `beforeinstallprompt`.
  - `reload()` saves the game first (`GameStore.save()`).
  - The install "Not now" timestamp is persisted in `bb:v1:settings`.
```

- [ ] **Step 3: Sync `docs/04-quality.md`**

In the test pyramid row **State unit**, replace "reduced motion = zero delays" with "reduced motion = 80 ms pop, no other delays".

- [ ] **Step 4: Full check and commit**

```bash
npm run check
git add docs/03-architecture.md docs/04-quality.md
git commit -m "docs: sync architecture with the state layer and ports"
```

`npm run check` must exit 0.

---

### Task 13: Pull request and merge

**Files:**
- Modify: `docs/superpowers/plans/2026-09-27-00-roadmap.md` (status), this plan (frontmatter `status: done`)

- [ ] **Step 1: Mark the plan done in the roadmap**

In the roadmap table set Plan 03's status to `done` and change Plan 04 to `next — write plan`. Set `status: done` in this plan's frontmatter.

```bash
git add docs/superpowers/plans
git commit -m "docs: mark state and platform plan done"
```

- [ ] **Step 2: Open the PR**

```bash
git push -u origin feat/state
gh pr create --title "feat(state): signal stores, phase runner, persistence and platform ports" --body "$(cat <<'EOF'
## What
State layer (GameStore, StatsStore, SettingsStore, PhaseRunner, Timer, `bb:v1:*` persistence with guards) and platform ports (Storage, Clock, Audio, Visibility, ReducedMotion) with browser implementations and fakes. `providePlatform()` is bound in `app.config.ts`.

## Why
Plan 03 of the rewrite (docs/superpowers/plans/2026-10-28-03-state-and-platform.md). Implements rules R8, R9, R13, R16, R17, R19 and R21 at state level, plus ADR-0004 and ADR-0005.

## Checklist
- [x] Behavior matches docs/01-rules and docs/02-ux (docs/03 and docs/04 updated to the implemented API)
- [x] Tests at the lowest level that proves the behavior (fake clock, fake storage)
- [x] Keyboard + screen-reader path checked for UI changes (no UI changes)
- [x] No new runtime dependency without an ADR

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

In a cloud session, push the branch, then open the PR with the GitHub connector using the same title and body.

- [ ] **Step 3: Watch the checks**

Run: `gh pr checks --watch` (cloud session: poll the PR's check runs with the GitHub connector).
Expected: `quality`, `build`, `pr-title` and both CodeQL analyses pass.

- [ ] **Step 4: Merge after user approval**

Ask the user to review the PR, then run:

```bash
gh pr merge --squash --delete-branch
git checkout main && git pull
```

---

## Done when

- `src/app/platform/` exposes the five ports, their browser implementations, `providePlatform()` and the fakes. `src/app/state/` exposes the three stores with the API in Task 11. Lint is green, so the layer rule holds.
- State unit tests cover:
  - the tap state machine (R8/R9);
  - ignored input during phases;
  - phase order pop → fall → slide (and the skipped slide);
  - the 500 ms / 0 ms game-over hold;
  - zero delays except the 80 ms pop with reduced motion;
  - statistics recorded exactly once (double game-over, reload, reset);
  - corrupt storage → defaults;
  - restore → Paused;
  - the timer accumulating across pause, cover and hidden.
- `src/app/state/**` coverage ≥ 90 % in all four metrics; CI green; PR merged into `main`.
