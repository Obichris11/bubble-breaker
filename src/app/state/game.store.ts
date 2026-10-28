import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import {
  burst,
  groupAt,
  hasMoves,
  isInside,
  newGame as deal,
  scoreFor,
  type BallId,
  type Board,
  type Cell,
  type Game,
  type MoveResult,
} from '../engine';
import { AudioPort, type Sound } from '../platform/audio';
import { ClockPort } from '../platform/clock';
import { ReducedMotionPort } from '../platform/reduced-motion';
import { StoragePort } from '../platform/storage';
import { VisibilityPort } from '../platform/visibility';
import { STRINGS } from '../strings';
import { formatClock, formatNumber } from './format';
import { motionFor } from './motion';
import { clearGame, loadGame, saveGame, type SavedGame } from './persistence';
import { framesFor, PhaseRunner, type Frame, type Phase } from './phase-runner';
import { SettingsStore } from './settings.store';
import { StatsStore } from './stats.store';
import { Timer } from './timer';

export interface Selection {
  /** Every cell of the highlighted group. */
  readonly cells: readonly Cell[];
  /** The tapped cell; the points bubble is anchored to it. */
  readonly anchor: Cell;
}

export type Direction = 'up' | 'down' | 'left' | 'right';

const STEPS: Record<Direction, Cell> = {
  up: { row: -1, col: 0 },
  down: { row: 1, col: 0 },
  left: { row: 0, col: -1 },
  right: { row: 0, col: 1 },
};

const START_CURSOR: Cell = { row: 0, col: 0 };
const NO_BALLS: ReadonlySet<BallId> = new Set();

function positionsOf(board: Board): ReadonlyMap<BallId, Cell> {
  const positions = new Map<BallId, Cell>();
  board.cells.forEach((id, index) => {
    if (id !== null) {
      positions.set(id, { row: Math.floor(index / board.columns), col: index % board.columns });
    }
  });
  return positions;
}

function sameCell(a: Cell, b: Cell): boolean {
  return a.row === b.row && a.col === b.col;
}

function clamp(value: number, max: number): number {
  return Math.min(Math.max(value, 0), max);
}

function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 32);
}

/**
 * The game in progress: selection rules R8/R9, burst animation phases, timer, pause and
 * persistence. The only place that changes the selection (pointer and keyboard both
 * call `tap`).
 */
@Injectable({ providedIn: 'root' })
export class GameStore {
  private readonly storage = inject(StoragePort);
  private readonly audio = inject(AudioPort);
  private readonly visibility = inject(VisibilityPort);
  private readonly reducedMotion = inject(ReducedMotionPort);
  private readonly settings = inject(SettingsStore);
  private readonly stats = inject(StatsStore);
  private readonly clock = inject(ClockPort);
  private readonly timer = new Timer(this.clock);
  private readonly runner = new PhaseRunner(this.clock);

  // Placeholder values; the constructor restores a saved game or deals a new one.
  private readonly gameIdSignal = signal('');
  private readonly gameSignal = signal<Game>(deal(0));
  private readonly shownBoard = signal<Board>(this.gameSignal().board);
  private readonly selectionSignal = signal<Selection | null>(null);
  private readonly phaseSignal = signal<Phase>('idle');
  private readonly poppingSignal = signal<ReadonlySet<BallId>>(NO_BALLS);
  private readonly cursorSignal = signal<Cell>(START_CURSOR);
  private readonly pausedSignal = signal(false);
  private readonly coveredSignal = signal(false);
  /** The timer has started: a tap selected a group, or a restored game already had time. */
  private readonly startedSignal = signal(false);
  private readonly showScoringSignal = signal(false);

  /** `crypto.randomUUID()` per game; makes the statistics entry idempotent. */
  readonly gameId = this.gameIdSignal.asReadonly();
  /** Engine state. Jumps to the final state of a burst immediately. */
  readonly game = this.gameSignal.asReadonly();
  readonly selection = this.selectionSignal.asReadonly();
  readonly phase = this.phaseSignal.asReadonly();
  /** Where each ball is drawn. Lags `game().board` while a burst animates. */
  readonly positions = computed(() => positionsOf(this.shownBoard()));
  /** Balls running the pop animation. */
  readonly popping = this.poppingSignal.asReadonly();
  /** Keyboard cursor; may rest on an empty cell. */
  readonly cursor = this.cursorSignal.asReadonly();
  /** The Paused dialog is due: the page was hidden or a saved game was restored. */
  readonly paused = this.pausedSignal.asReadonly();
  /** A menu, screen or dialog covers the board; the timer stops but no Paused dialog. */
  readonly covered = this.coveredSignal.asReadonly();
  /** The game-over hold is over; the UI navigates to Scoring (rule R16). */
  readonly showScoring = this.showScoringSignal.asReadonly();
  readonly elapsedMs = this.timer.elapsedMs;

  readonly selectedPoints = computed(() => {
    const selection = this.selectionSignal();
    return selection === null ? 0 : scoreFor(selection.cells.length);
  });
  readonly selectedText = computed(() =>
    this.selectionSignal() === null
      ? STRINGS.status.noSelection
      : formatNumber(this.selectedPoints()),
  );
  readonly scoreText = computed(() => formatNumber(this.gameSignal().score));
  readonly timeText = computed(() => {
    const time = formatClock(this.elapsedMs());
    return this.pausedSignal() || this.coveredSignal() ? STRINGS.status.pausedPrefix + time : time;
  });
  /** The group under the keyboard cursor ([] for an empty cell or a lone ball). */
  readonly cursorGroup = computed(() => groupAt(this.gameSignal(), this.cursorSignal()));
  /** Taps count only when no animation runs and the game is not paused. */
  readonly canInteract = computed(() => this.phaseSignal() === 'idle' && !this.pausedSignal());

  private readonly motion = computed(() => motionFor(this.reducedMotion.reduced()));

  constructor() {
    const saved = loadGame(this.storage);
    if (saved !== null && hasMoves(saved.game)) {
      this.restore(saved);
    } else {
      this.newGame();
    }
    effect(() => {
      if (this.visibility.hidden()) {
        untracked(() => {
          this.pause();
        });
      }
    });
  }

  /**
   * Rules R8/R9: a group → select it; the selected group again → burst it; a lone ball,
   * an empty cell or a cell off the board → clear the selection.
   */
  tap(cell: Cell): void {
    if (!this.canInteract()) {
      return;
    }
    const game = this.gameSignal();
    const group = isInside(game.board, cell) ? groupAt(game, cell) : [];
    if (group.length === 0) {
      this.selectionSignal.set(null);
      return;
    }
    const selected = this.selectionSignal()?.cells.some((member) => sameCell(member, cell));
    if (selected === true) {
      this.burstAt(cell);
      return;
    }
    this.selectionSignal.set({ cells: group, anchor: cell });
    this.playSound('select');
    this.startedSignal.set(true);
    this.syncTimer();
  }

  /** Deals a new game. The abandoned game is not counted (rule R21). */
  newGame(seed = randomSeed()): void {
    this.runner.cancel();
    const game = deal(seed);
    this.gameIdSignal.set(crypto.randomUUID());
    this.gameSignal.set(game);
    this.shownBoard.set(game.board);
    this.selectionSignal.set(null);
    this.phaseSignal.set('idle');
    this.poppingSignal.set(NO_BALLS);
    this.cursorSignal.set(START_CURSOR);
    this.pausedSignal.set(false);
    this.startedSignal.set(false);
    this.showScoringSignal.set(false);
    this.timer.reset();
    this.syncTimer();
    this.save();
  }

  /** Enters the Paused state (page hidden). Saves the game. Does nothing before the first tap. */
  pause(): void {
    if (!this.startedSignal() || this.pausedSignal() || this.phaseSignal() === 'over') {
      return;
    }
    this.pausedSignal.set(true);
    this.syncTimer();
    this.save();
  }

  resume(): void {
    if (!this.pausedSignal()) {
      return;
    }
    this.pausedSignal.set(false);
    this.syncTimer();
  }

  /** Called by the UI when a menu, screen or dialog opens (true) or closes (false). */
  setCovered(covered: boolean): void {
    if (covered === this.coveredSignal()) {
      return;
    }
    this.coveredSignal.set(covered);
    this.syncTimer();
    if (covered) {
      this.save();
    }
  }

  moveCursor(direction: Direction): void {
    const { rows, columns } = this.gameSignal().board;
    const step = STEPS[direction];
    this.cursorSignal.update((cursor) => ({
      row: clamp(cursor.row + step.row, rows - 1),
      col: clamp(cursor.col + step.col, columns - 1),
    }));
  }

  /** Enter / Space on the board. */
  activateCursor(): void {
    this.tap(this.cursorSignal());
  }

  /** Esc on the board. */
  clearSelection(): void {
    this.selectionSignal.set(null);
  }

  /** Writes `bb:v1:game`. Also called by the Pwa port before a reload (Plan 06). */
  save(): void {
    if (this.phaseSignal() === 'over') {
      return;
    }
    saveGame(this.storage, {
      gameId: this.gameIdSignal(),
      game: this.gameSignal(),
      elapsedMs: this.timer.exactMs(),
    });
  }

  private burstAt(cell: Cell): void {
    const before = this.gameSignal();
    const result = burst(before, cell);
    if (result === null) {
      return; // Unreachable: a selected cell always belongs to a burstable group.
    }
    this.animate(before.board, result);
  }

  private animate(before: Board, result: MoveResult): void {
    this.selectionSignal.set(null);
    this.gameSignal.set(result.game);
    this.playSound('pop');
    this.runner.run(
      framesFor(before, result, this.motion()),
      (frame) => {
        this.applyFrame(frame);
      },
      () => {
        this.settle();
      },
    );
  }

  private applyFrame(frame: Frame): void {
    this.phaseSignal.set(frame.phase);
    this.shownBoard.set(frame.board);
    this.poppingSignal.set(frame.popping);
    if (frame.phase === 'over') {
      this.finish();
    }
  }

  /**
   * Game over (rule R13): stop the clock, record statistics once, drop the save. A pause during
   * the final burst is dropped too, so Scoring never opens behind a Paused dialog.
   */
  private finish(): void {
    this.pausedSignal.set(false);
    this.syncTimer();
    this.stats.recordFinished(this.gameIdSignal(), this.gameSignal().score, this.timer.exactMs());
    clearGame(this.storage);
    this.playSound('gameOver');
  }

  private settle(): void {
    if (this.phaseSignal() === 'over') {
      this.showScoringSignal.set(true);
      return;
    }
    this.phaseSignal.set('idle');
    this.save();
  }

  private restore(saved: SavedGame): void {
    this.gameIdSignal.set(saved.gameId);
    this.gameSignal.set(saved.game);
    this.shownBoard.set(saved.game.board);
    this.timer.reset(saved.elapsedMs);
    const started = saved.elapsedMs > 0;
    this.startedSignal.set(started);
    this.pausedSignal.set(started);
  }

  private syncTimer(): void {
    const running =
      this.startedSignal() &&
      !this.pausedSignal() &&
      !this.coveredSignal() &&
      this.phaseSignal() !== 'over';
    if (running) {
      this.timer.start();
    } else {
      this.timer.stop();
    }
  }

  private playSound(sound: Sound): void {
    if (this.settings.sound()) {
      this.audio.play(sound);
    }
  }
}
