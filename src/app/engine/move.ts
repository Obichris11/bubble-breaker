import { ballAt, type BallId, type Board, type Cell } from './board';
import type { Game } from './game';
import { groupAt, hasMoves } from './groups';
import { applyGravity, collapseRight } from './physics';
import { scoreFor } from './rules';

export interface MoveResult {
  readonly removed: readonly BallId[];
  readonly points: number;
  readonly afterGravity: Board;
  /** Same reference as `afterGravity` when no column slid. */
  readonly afterCollapse: Board;
  readonly game: Game;
  readonly gameOver: boolean;
}

/** Bursts the group at `cell` (rules R8–R13). Returns null when there is nothing to burst. */
export function burst(game: Game, cell: Cell): MoveResult | null {
  const group = groupAt(game, cell);
  if (group.length === 0) {
    return null;
  }
  const removed = group
    .map((member) => ballAt(game.board, member))
    .filter((id): id is BallId => id !== null);
  const removedSet = new Set(removed);
  const cleared: Board = {
    ...game.board,
    cells: game.board.cells.map((id) => (id !== null && removedSet.has(id) ? null : id)),
  };
  const afterGravity = applyGravity(cleared);
  const afterCollapse = collapseRight(afterGravity);
  const points = scoreFor(removed.length);
  const next: Game = { ...game, board: afterCollapse, score: game.score + points };
  return { removed, points, afterGravity, afterCollapse, game: next, gameOver: !hasMoves(next) };
}
