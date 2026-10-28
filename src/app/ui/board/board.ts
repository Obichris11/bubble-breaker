import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import type { BallId } from '../../engine';
import { formatNumber } from '../../state/format';
import { GameStore } from '../../state/game.store';
import { SettingsStore } from '../../state/settings.store';
import { STRINGS } from '../../strings';
import { ballLook, shapeHint } from './ball-look';
import { bubblePlacement, translate } from './board-layout';
import { PointsBubble } from './points-bubble';

interface BallView {
  readonly id: BallId;
  readonly transform: string;
  readonly look: string;
  readonly glyph: string;
  readonly popping: boolean;
}

interface Spot {
  readonly key: string;
  readonly transform: string;
}

/**
 * The 11 × 12 board (02-ux, ADR-0003): highlight layer, balls keyed by id and moved with
 * `transform`, and the points bubble.
 */
@Component({
  selector: 'bb-board',
  imports: [PointsBubble],
  templateUrl: './board.html',
  styleUrl: './board.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GameBoard {
  /** Cell size in whole pixels, from `BoardArea`. */
  readonly cell = input.required<number>();

  protected readonly store = inject(GameStore);
  private readonly settings = inject(SettingsStore);
  protected readonly strings = STRINGS;

  protected readonly width = computed(() => this.cell() * this.store.game().board.columns);
  protected readonly height = computed(() => this.cell() * this.store.game().board.rows);
  protected readonly greyscale = computed(() => this.settings.breakerSet() === 'greyscale');

  /** Every ball on the shown board, in id order so DOM nodes never move between phases. */
  protected readonly balls = computed<readonly BallView[]>(() => {
    const { colors } = this.store.game();
    const positions = this.store.positions();
    const popping = this.store.popping();
    const set = this.settings.breakerSet();
    const hints = this.settings.shapeHints();
    const cell = this.cell();
    const views: BallView[] = [];
    colors.forEach((color, id) => {
      const at = positions.get(id);
      if (at !== undefined) {
        views.push({
          id,
          transform: translate(at, cell),
          look: ballLook(color, set),
          glyph: shapeHint(color, set, hints),
          popping: popping.has(id),
        });
      }
    });
    return views;
  });

  /** Cells behind the selected group, and behind popping balls while they burst. */
  protected readonly highlight = computed<readonly Spot[]>(() => {
    const cell = this.cell();
    const positions = this.store.positions();
    const cells = [
      ...(this.store.selection()?.cells ?? []),
      ...[...this.store.popping()].flatMap((id) => positions.get(id) ?? []),
    ];
    return cells.map((at) => ({
      key: `${String(at.row)}:${String(at.col)}`,
      transform: translate(at, cell),
    }));
  });

  protected readonly bubble = computed(() => {
    const selection = this.store.selection();
    if (selection === null) {
      return null;
    }
    return {
      text: STRINGS.board.points(formatNumber(this.store.selectedPoints())),
      ...bubblePlacement(selection.anchor, this.cell(), this.store.game().board),
    };
  });
}
