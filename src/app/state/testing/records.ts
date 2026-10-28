import { STANDARD_RULES, type BallId, type Color } from '../../engine';
import type { GameRecord } from '../persistence';

const LETTERS = 'rbgyp';
const EMPTY_ROW = '.'.repeat(STANDARD_RULES.columns);

/**
 * A valid `bb:v1:game` record. `bottomRows` are the lowest rows of the 11 × 12 board as
 * letters (r b g y p, '.' empty); rows above them are empty. Each ball's id is its cell index;
 * unused ids get colour 0 so `colors` always has 132 entries.
 */
export function recordFrom(
  bottomRows: readonly string[],
  overrides: Partial<GameRecord> = {},
): GameRecord {
  const rows = [
    ...new Array<string>(STANDARD_RULES.rows - bottomRows.length).fill(EMPTY_ROW),
    ...bottomRows,
  ];
  const colors = new Array<Color>(STANDARD_RULES.columns * STANDARD_RULES.rows).fill(0);
  const cells: (BallId | null)[] = [];
  for (const letter of rows.join('')) {
    if (letter === '.') {
      cells.push(null);
    } else {
      colors[cells.length] = LETTERS.indexOf(letter) as Color;
      cells.push(cells.length);
    }
  }
  return {
    gameId: 'saved-game',
    seed: 7,
    colors,
    cells,
    score: 100,
    elapsedMs: 65_000,
    ...overrides,
  };
}
