import fc from 'fast-check';
import { itemAt, type Board } from './board';
import {
  allGroups,
  burst,
  colorOf,
  countBalls,
  newGame,
  scoreFor,
  type Game,
  type MoveResult,
} from './index';

interface Step {
  readonly before: Game;
  readonly result: MoveResult;
}

/** Plays up to `choices.length` moves, choosing among the available groups by index. */
function play(seed: number, choices: readonly number[]): { game: Game; steps: Step[] } {
  let game = newGame(seed);
  const steps: Step[] = [];
  for (const choice of choices) {
    const groups = allGroups(game);
    if (groups.length === 0) break;
    const group = itemAt(groups, choice % groups.length);
    const result = burst(game, itemAt(group, 0));
    if (result === null) throw new Error('allGroups returned a group that cannot burst');
    steps.push({ before: game, result });
    game = result.game;
  }
  return { game, steps };
}

function hasFloatingBall(board: Board): boolean {
  for (let col = 0; col < board.columns; col++) {
    let seenBall = false;
    for (let row = 0; row < board.rows; row++) {
      const id = itemAt(board.cells, row * board.columns + col);
      if (id !== null) seenBall = true;
      else if (seenBall) return true;
    }
  }
  return false;
}

function emptyColumnsAreOnTheLeft(board: Board): boolean {
  let seenFilled = false;
  for (let col = 0; col < board.columns; col++) {
    const filled = Array.from({ length: board.rows }, (_, row) =>
      itemAt(board.cells, row * board.columns + col),
    ).some((id) => id !== null);
    if (filled) seenFilled = true;
    else if (seenFilled) return false;
  }
  return true;
}

/** Independent game-over oracle: any two orthogonally adjacent balls with the same colour. */
function hasAdjacentPair(game: Game): boolean {
  const { columns, rows, cells } = game.board;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      const id = itemAt(cells, row * columns + col);
      if (id === null) continue;
      const right = col + 1 < columns ? itemAt(cells, row * columns + col + 1) : null;
      const below = row + 1 < rows ? itemAt(cells, (row + 1) * columns + col) : null;
      if (right !== null && colorOf(game, right) === colorOf(game, id)) return true;
      if (below !== null && colorOf(game, below) === colorOf(game, id)) return true;
    }
  }
  return false;
}

const seeds = fc.integer({ min: 0, max: 0xffffffff });
const choices = fc.array(fc.nat({ max: 1000 }), { maxLength: 80 });
const runs = { numRuns: 500 };

describe('engine invariants (01-rules.md)', () => {
  it('1: each burst removes exactly X balls, X ≥ 2', () => {
    fc.assert(
      fc.property(seeds, choices, (seed, picks) => {
        for (const { before, result } of play(seed, picks).steps) {
          expect(result.removed.length).toBeGreaterThanOrEqual(2);
          expect(countBalls(result.game.board)).toBe(
            countBalls(before.board) - result.removed.length,
          );
        }
      }),
      runs,
    );
  });

  it('2: after gravity no ball floats above an empty cell', () => {
    fc.assert(
      fc.property(seeds, choices, (seed, picks) => {
        for (const { result } of play(seed, picks).steps) {
          expect(hasFloatingBall(result.afterGravity)).toBe(false);
          expect(hasFloatingBall(result.game.board)).toBe(false);
        }
      }),
      runs,
    );
  });

  it('3: after collapse no empty column lies right of a non-empty column', () => {
    fc.assert(
      fc.property(seeds, choices, (seed, picks) => {
        for (const { result } of play(seed, picks).steps) {
          expect(emptyColumnsAreOnTheLeft(result.game.board)).toBe(true);
        }
      }),
      runs,
    );
  });

  it('4: score never decreases and each burst adds exactly X(X − 1)', () => {
    fc.assert(
      fc.property(seeds, choices, (seed, picks) => {
        for (const { before, result } of play(seed, picks).steps) {
          expect(result.points).toBe(scoreFor(result.removed.length));
          expect(result.game.score).toBe(before.score + result.points);
        }
      }),
      runs,
    );
  });

  it('5: same seed and same moves give an identical game', () => {
    fc.assert(
      fc.property(seeds, choices, (seed, picks) => {
        expect(play(seed, picks).game).toEqual(play(seed, picks).game);
      }),
      runs,
    );
  });

  it('6: game over ⇔ no two adjacent balls share a colour', () => {
    fc.assert(
      fc.property(seeds, choices, (seed, picks) => {
        const { game, steps } = play(seed, picks);
        for (const { result } of steps) {
          expect(result.gameOver).toBe(!hasAdjacentPair(result.game));
        }
        expect(allGroups(game).length > 0).toBe(hasAdjacentPair(game));
      }),
      runs,
    );
  });

  it('ball identity: ids stay unique and colours never change', () => {
    fc.assert(
      fc.property(seeds, choices, (seed, picks) => {
        const { game } = play(seed, picks);
        const start = newGame(seed);
        const ids = game.board.cells.filter((id) => id !== null);
        expect(new Set(ids).size).toBe(ids.length);
        expect(game.colors).toEqual(start.colors);
      }),
      runs,
    );
  });
});
