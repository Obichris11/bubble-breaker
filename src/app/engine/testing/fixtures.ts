import type { BallId, Board, Cell } from '../board';
import { colorOf, type Game } from '../game';
import { STANDARD_RULES, type Color } from '../rules';

const LETTERS = 'rbgyp';

/**
 * Builds a Game from rows of colour letters (r b g y p) and '.' for empty cells.
 * Ball ids are assigned row-major to non-empty cells, starting at 0.
 */
export function gameFrom(rows: readonly string[], score = 0): Game {
  const columns = rows[0]?.length ?? 0;
  const colors: Color[] = [];
  const cells: (BallId | null)[] = [];
  for (const line of rows) {
    if (line.length !== columns) {
      throw new Error(`All rows must have ${String(columns)} cells: "${line}"`);
    }
    for (const letter of line) {
      if (letter === '.') {
        cells.push(null);
        continue;
      }
      const color = LETTERS.indexOf(letter);
      if (color < 0) {
        throw new Error(`Unknown colour letter "${letter}"`);
      }
      cells.push(colors.length);
      colors.push(color as Color);
    }
  }
  return {
    seed: 0,
    rules: { ...STANDARD_RULES, columns, rows: rows.length },
    colors,
    board: { columns, rows: rows.length, cells },
    score,
  };
}

/** Renders a board as letter rows using the game's colours. */
export function lettersOf(game: Game, board: Board = game.board): string[] {
  return Array.from({ length: board.rows }, (_, row) =>
    board.cells
      .slice(row * board.columns, (row + 1) * board.columns)
      .map((id) => (id === null ? '.' : LETTERS.charAt(colorOf(game, id))))
      .join(''),
  );
}

/** Sorts cells top-to-bottom, left-to-right, so groups compare independent of fill order. */
export function sortCells(cells: readonly Cell[]): Cell[] {
  return [...cells].sort((a, b) => a.row - b.row || a.col - b.col);
}
