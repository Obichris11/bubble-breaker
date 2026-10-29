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
