import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { ClockPort, type TimerId } from '../platform/clock';
import { PwaPort } from '../platform/pwa';
import { VisibilityPort } from '../platform/visibility';
import { GameStore } from './game.store';
import { SettingsStore } from './settings.store';
import { StatsStore } from './stats.store';

/** The PWA notices at the top of the board area (02-ux "PWA notices"). */
export type PwaNotice = 'update' | 'offline' | 'install';

/** "Offline ready" hides itself after 4 s. */
export const OFFLINE_NOTICE_MS = 4_000;
/** "Not now" keeps the install notice away for 30 days. */
export const INSTALL_SNOOZE_MS = 30 * 24 * 60 * 60 * 1_000;

/**
 * Decides which PWA notice shows, one at a time and most urgent first: a new version, then
 * offline ready, then the install offer. Saves the game before every reload.
 */
@Injectable({ providedIn: 'root' })
export class PwaStore {
  private readonly pwa = inject(PwaPort);
  private readonly game = inject(GameStore);
  private readonly stats = inject(StatsStore);
  private readonly settings = inject(SettingsStore);
  private readonly clock = inject(ClockPort);
  private readonly visibility = inject(VisibilityPort);
  private readonly updateDismissed = signal(false);
  private readonly offlineShowing = signal(false);
  private offlineTimer: TimerId | null = null;

  /** Only after a finished game, and not within 30 days of "Not now". */
  private readonly installDue = computed(() => {
    const dismissedAt = this.settings.installDismissedAt();
    return (
      this.pwa.installAvailable() &&
      this.stats.played() > 0 &&
      (dismissedAt === null || this.clock.epochMs() - dismissedAt >= INSTALL_SNOOZE_MS)
    );
  });

  readonly notice = computed<PwaNotice | null>(() => {
    if (this.pwa.updateAvailable() && !this.updateDismissed()) {
      return 'update';
    }
    if (this.offlineShowing()) {
      return 'offline';
    }
    return this.installDue() ? 'install' : null;
  });

  constructor() {
    effect(() => {
      if (this.pwa.offlineReady()) {
        untracked(() => {
          this.showOffline();
        });
      }
    });
    effect(() => {
      if (this.pwa.unrecoverable()) {
        untracked(() => {
          this.reload();
        });
      }
    });
    // A PWA can sit in the background for days: look for a new version when it comes back.
    let wasHidden = this.visibility.hidden();
    effect(() => {
      const hidden = this.visibility.hidden();
      if (wasHidden && !hidden) {
        untracked(() => {
          this.pwa.checkForUpdate();
        });
      }
      wasHidden = hidden;
    });
  }

  /** Reload on "New version" (and after an unrecoverable state): the game is saved first. */
  reload(): void {
    this.game.save();
    this.pwa.reload();
  }

  /** × on "New version" (until the next load) or on "Offline ready". */
  dismiss(): void {
    if (this.notice() === 'update') {
      this.updateDismissed.set(true);
    } else {
      this.hideOffline();
    }
  }

  /** Install: the browser's prompt. Declining it there counts as "Not now". */
  install(): void {
    void this.pwa.install().then((accepted) => {
      if (!accepted) {
        this.notNow();
      }
    });
  }

  notNow(): void {
    this.settings.setInstallDismissedAt(this.clock.epochMs());
  }

  /** The port reports offline ready at most once per page load. */
  private showOffline(): void {
    this.offlineShowing.set(true);
    this.offlineTimer = this.clock.setTimeout(() => {
      this.hideOffline();
    }, OFFLINE_NOTICE_MS);
  }

  private hideOffline(): void {
    if (this.offlineTimer !== null) {
      this.clock.clearTimeout(this.offlineTimer);
      this.offlineTimer = null;
    }
    this.offlineShowing.set(false);
  }
}
