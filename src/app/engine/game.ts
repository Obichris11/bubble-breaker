import { itemAt, type BallId, type Board } from './board';
import type { Color, Rules } from './rules';

export interface Game {
  /** Normalised uint32 seed the board was dealt from. */
  readonly seed: number;
  readonly rules: Rules;
  /** Colour of each ball, indexed by BallId. Never changes during a game. */
  readonly colors: readonly Color[];
  readonly board: Board;
  readonly score: number;
}

export function colorOf(game: Game, id: BallId): Color {
  return itemAt(game.colors, id);
}
