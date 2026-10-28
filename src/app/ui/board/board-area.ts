import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  signal,
} from '@angular/core';
import { GameStore } from '../../state/game.store';
import { GameBoard } from './board';
import { cellSize, OFF_BOARD, parseCellMax } from './board-layout';

/**
 * The white area between the status strip and the softkeys. It measures itself with a
 * ResizeObserver, derives the whole-pixel cell size and bottom-aligns the board. A tap on the
 * free space around the board counts as "outside the board" (rule R9: clears the selection).
 */
@Component({
  selector: 'bb-board-area',
  imports: [GameBoard],
  template: '<bb-board [cell]="cell()" />',
  styleUrl: './board-area.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(click)': 'onClick($event)' },
})
export class BoardArea {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly store = inject(GameStore);
  protected readonly cell = signal(0);

  constructor() {
    afterNextRender(() => {
      if (typeof ResizeObserver === 'undefined') {
        return;
      }
      const element = this.host.nativeElement;
      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const cellMax = parseCellMax(getComputedStyle(element).getPropertyValue('--bb-cell-max'));
          this.cell.set(cellSize(entry.contentRect, this.store.game().board, cellMax));
        }
      });
      observer.observe(element);
      this.destroyRef.onDestroy(() => {
        observer.disconnect();
      });
    });
  }

  protected onClick(event: MouseEvent): void {
    if (event.target === this.host.nativeElement) {
      this.store.tap(OFF_BOARD);
    }
  }
}
