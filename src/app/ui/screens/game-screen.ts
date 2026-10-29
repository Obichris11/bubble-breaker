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
import { PwaNotice } from './pwa-notice';

/**
 * Route `''`: status strip, then the PWA notice and the board area between it and the
 * softkeys. While the game is Paused both are inert under the Paused dialog. Coming back from
 * another screen puts focus on the board.
 */
@Component({
  selector: 'bb-game-screen',
  imports: [BoardArea, PausedDialog, PwaNotice, StatusStrip],
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

  protected focusBoard(): void {
    this.host.nativeElement.querySelector<HTMLElement>('[role="application"]')?.focus();
  }
}
