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
