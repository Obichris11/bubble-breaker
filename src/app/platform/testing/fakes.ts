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
