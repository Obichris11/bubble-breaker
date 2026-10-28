import { colorOf, newGame } from './game';
import { STANDARD_RULES } from './rules';

describe('newGame', () => {
  const game = newGame(1);

  it('deals a full 11 × 12 board with ids 0..131 row-major', () => {
    expect(game.board.columns).toBe(11);
    expect(game.board.rows).toBe(12);
    expect(game.board.cells).toEqual(Array.from({ length: 132 }, (_, id) => id));
  });

  it('assigns one of 5 colours to every ball, reproducibly for seed 1', () => {
    expect(game.colors).toHaveLength(132);
    expect(game.colors.slice(0, 11)).toEqual([3, 0, 2, 4, 4, 1, 3, 3, 2, 4, 2]);
    const counts = [0, 0, 0, 0, 0];
    game.colors.forEach((color) => {
      counts[color] = (counts[color] ?? 0) + 1;
    });
    expect(counts).toEqual([30, 27, 22, 25, 28]);
  });

  it('starts with score 0, the standard rules and the seed', () => {
    expect(game.score).toBe(0);
    expect(game.rules).toBe(STANDARD_RULES);
    expect(game.seed).toBe(1);
  });

  it('normalises the seed to uint32', () => {
    expect(newGame(-1).seed).toBe(4294967295);
    expect(newGame(2 ** 32 + 7).seed).toBe(7);
  });

  it('is deterministic per seed and differs between seeds', () => {
    expect(newGame(99)).toEqual(newGame(99));
    expect(newGame(99).colors).not.toEqual(newGame(100).colors);
  });

  it('honours custom rules', () => {
    const small = newGame(5, { columns: 3, rows: 2, colors: 2, minGroup: 2 });
    expect(small.board.cells).toEqual([0, 1, 2, 3, 4, 5]);
    expect(small.colors.every((color) => color === 0 || color === 1)).toBe(true);
  });

  it('exposes colours per ball id', () => {
    expect(colorOf(game, 0)).toBe(3);
  });
});
