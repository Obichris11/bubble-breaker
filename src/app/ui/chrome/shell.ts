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
