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
