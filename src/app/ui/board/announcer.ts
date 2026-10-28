import type { Cell, Game } from '../../engine';
import { formatNumber } from '../../state/format';
import type { Selection } from '../../state/game.store';
import type { BreakerSet } from '../../state/persistence';
import { STRINGS } from '../../strings';
import { colorName } from './ball-look';

/** The parts of `GameStore` the live region reports on, read before and after an input. */
export interface BoardSnapshot {
  readonly gameId: string;
  readonly game: Game;
  readonly selection: Selection | null;
  readonly cursor: Cell;
  /** `GameStore.cursorGroup().length`. */
  readonly cursorGroupSize: number;
}

function nameAt(game: Game, cell: Cell, set: BreakerSet): string | null {
  const id = game.board.cells[cell.row * game.board.columns + cell.col] ?? null;
  const color = id === null ? undefined : game.colors[id];
  return color === undefined ? null : colorName(color, set);
}

/** "Row 4, column 7, blue, group of 6": rows and columns count from 1, top left. */
export function cursorText(snapshot: BoardSnapshot, set: BreakerSet): string {
  const { cursor } = snapshot;
  const name = nameAt(snapshot.game, cursor, set);
  return name === null
    ? STRINGS.board.cursorEmpty(cursor.row + 1, cursor.col + 1)
    : STRINGS.board.cursorBall(cursor.row + 1, cursor.col + 1, name, snapshot.cursorGroupSize);
}

/** "6 blue balls selected, 30 points. Press Enter again to burst." */
export function selectionText(game: Game, selection: Selection, set: BreakerSet): string {
  const size = selection.cells.length;
  return STRINGS.board.selected(
    size,
    nameAt(game, selection.anchor, set) ?? '',
    formatNumber(size * (size - 1)),
  );
}

export function gameOverText(score: number): string {
  return STRINGS.board.gameOver(formatNumber(score));
}

/**
 * What the live region says after one pointer or keyboard input, or null when nothing worth
 * announcing changed. The first matching change wins: new game, burst, selection, cleared
 * selection, cursor move.
 */
export function announcement(
  before: BoardSnapshot,
  after: BoardSnapshot,
  set: BreakerSet,
): string | null {
  if (after.gameId !== before.gameId) {
    return STRINGS.board.newGame;
  }
  const gained = after.game.score - before.game.score;
  if (gained > 0) {
    return STRINGS.board.burst(formatNumber(gained), formatNumber(after.game.score));
  }
  if (after.selection !== null && after.selection !== before.selection) {
    return selectionText(after.game, after.selection, set);
  }
  if (after.selection === null && before.selection !== null) {
    return STRINGS.board.cleared;
  }
  if (after.cursor.row !== before.cursor.row || after.cursor.col !== before.cursor.col) {
    return cursorText(after, set);
  }
  return null;
}
