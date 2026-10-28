import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import type { BallId } from '../../engine';
import { formatNumber } from '../../state/format';
import { GameStore, type Direction } from '../../state/game.store';
import { SettingsStore } from '../../state/settings.store';
import { STRINGS } from '../../strings';
import { announcement, gameOverText, type BoardSnapshot } from './announcer';
import { ballLook, shapeHint } from './ball-look';
import { bubblePlacement, cellAt, translate } from './board-layout';
import { LiveRegion } from './live-region';
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

const DIRECTIONS: Partial<Record<string, Direction>> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
};

/**
 * The 11 × 12 board (02-ux, ADR-0003): highlight layer, balls keyed by id and moved with
 * `transform`, keyboard focus ring and points bubble, plus the live region beside it.
 * Pointer and keyboard input both go through `GameStore` intents.
 */
@Component({
  selector: 'bb-board',
  imports: [LiveRegion, PointsBubble],
  templateUrl: './board.html',
  styleUrl: './board.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GameBoard {
  /** Cell size in whole pixels, from `BoardArea`. */
  readonly cell = input.required<number>();

  protected readonly store = inject(GameStore);
  private readonly settings = inject(SettingsStore);
  private readonly boardRef = viewChild.required<ElementRef<HTMLElement>>('board');
  protected readonly strings = STRINGS;

  /** Last live-region announcement. */
  protected readonly message = signal('');
  private readonly focused = signal(false);
  /** The last input was a key: the focus ring shows only for keyboard use. */
  private readonly keyboard = signal(false);
  /** A pointer press is about to focus the board; that focus must not show the ring. */
  private pointerFocus = false;

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

  /** `transform` of the focus ring, or null while it is hidden. */
  protected readonly ring = computed(() =>
    this.focused() && this.keyboard() ? translate(this.store.cursor(), this.cell()) : null,
  );

  constructor() {
    effect(() => {
      if (this.store.phase() === 'over') {
        const score = untracked(() => this.store.game().score);
        this.message.set(gameOverText(score));
      }
    });
  }

  protected onPointerDown(): void {
    this.keyboard.set(false);
    this.pointerFocus = true;
  }

  protected onClick(event: MouseEvent): void {
    this.pointerFocus = false;
    const box = this.boardRef().nativeElement.getBoundingClientRect();
    const cell = cellAt(event.clientX - box.left, event.clientY - box.top, this.cell());
    this.act(() => {
      this.store.tap(cell);
    });
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }
    this.keyboard.set(true);
    const direction = DIRECTIONS[event.key];
    if (direction !== undefined) {
      event.preventDefault();
      this.act(() => {
        this.store.moveCursor(direction);
      });
      return;
    }
    switch (event.key) {
      case 'Enter':
      case ' ':
        event.preventDefault();
        this.act(() => {
          this.store.activateCursor();
        });
        return;
      case 'Escape':
        this.act(() => {
          this.store.clearSelection();
        });
        return;
      case 'n':
      case 'N':
        this.act(() => {
          this.store.newGame();
        });
        return;
    }
  }

  protected onFocus(): void {
    this.focused.set(true);
    if (!this.pointerFocus) {
      this.keyboard.set(true);
    }
    this.pointerFocus = false;
  }

  protected onBlur(): void {
    this.focused.set(false);
  }

  /** Runs an input intent and announces what it changed. */
  private act(intent: () => void): void {
    const before = this.snapshot();
    intent();
    const text = announcement(before, this.snapshot(), this.settings.breakerSet());
    if (text !== null) {
      this.message.set(text);
    }
  }

  private snapshot(): BoardSnapshot {
    return {
      gameId: this.store.gameId(),
      game: this.store.game(),
      selection: this.store.selection(),
      cursor: this.store.cursor(),
      cursorGroupSize: this.store.cursorGroup().length,
    };
  }
}
