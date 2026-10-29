import { computed, inject, Injectable, signal } from '@angular/core';
import { StoragePort } from '../platform/storage';
import { loadSettings, saveSettings, type BreakerSet, type Settings } from './persistence';

/**
 * Options screen state (rule R18, shape hints, sound) and the install notice's "Not now" time,
 * persisted on every change.
 */
@Injectable({ providedIn: 'root' })
export class SettingsStore {
  private readonly storage = inject(StoragePort);
  private readonly state = signal(loadSettings(this.storage));

  readonly breakerSet = computed(() => this.state().breakerSet);
  readonly shapeHints = computed(() => this.state().shapeHints);
  readonly sound = computed(() => this.state().sound);
  readonly installDismissedAt = computed(() => this.state().installDismissedAt);

  setBreakerSet(breakerSet: BreakerSet): void {
    this.update({ breakerSet });
  }

  setShapeHints(shapeHints: boolean): void {
    this.update({ shapeHints });
  }

  setSound(sound: boolean): void {
    this.update({ sound });
  }

  /** "Not now" on the install notice, at `epochMs` wall-clock time. */
  setInstallDismissedAt(installDismissedAt: number): void {
    this.update({ installDismissedAt });
  }

  private update(change: Partial<Settings>): void {
    const next = { ...this.state(), ...change };
    this.state.set(next);
    saveSettings(this.storage, next);
  }
}
