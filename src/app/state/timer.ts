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
