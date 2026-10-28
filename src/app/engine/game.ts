import { itemAt, type BallId, type Board } from './board';
import { createRng } from './rng';
import { STANDARD_RULES, type Color, type Rules } from './rules';

export interface Game {
  /** Normalised uint32 seed the board was dealt from. */
  readonly seed: number;
  readonly rules: Rules;
  /** Colour of each ball, indexed by BallId. Never changes during a game. */
  readonly colors: readonly Color[];
  readonly board: Board;
  readonly score: number;
}

/** Deals a full board: every cell gets an independent uniform-random colour (rules R1, R4, R5). */
export function newGame(seed: number, rules: Rules = STANDARD_RULES): Game {
  const normalizedSeed = seed >>> 0;
  const random = createRng(normalizedSeed);
  const size = rules.columns * rules.rows;
  const colors = Array.from({ length: size }, () => Math.floor(random() * rules.colors) as Color);
  const cells = Array.from({ length: size }, (_, id) => id);
  return {
    seed: normalizedSeed,
    rules,
    colors,
    board: { columns: rules.columns, rows: rules.rows, cells },
    score: 0,
  };
}

export function colorOf(game: Game, id: BallId): Color {
  return itemAt(game.colors, id);
}
