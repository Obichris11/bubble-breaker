import { burst } from './move';
import { gameFrom, lettersOf } from './testing/fixtures';

describe('burst', () => {
  const start = gameFrom(['r.b', 'rgb', 'ggb']);

  it('removes the group, applies gravity, collapses right and scores X(X − 1)', () => {
    const result = burst(start, { row: 0, col: 2 });
    expect(result).not.toBeNull();
    if (result === null) return;
    expect(result.removed).toHaveLength(3);
    expect(result.points).toBe(6);
    expect(lettersOf(start, result.afterGravity)).toEqual(['r..', 'rg.', 'gg.']);
    expect(lettersOf(start, result.afterCollapse)).toEqual(['.r.', '.rg', '.gg']);
    expect(result.game.board).toBe(result.afterCollapse);
    expect(result.game.score).toBe(6);
    expect(result.gameOver).toBe(false);
  });

  it('reuses the gravity board when no column empties', () => {
    const afterFirst = burst(start, { row: 0, col: 2 });
    if (afterFirst === null) throw new Error('expected a move');
    const second = burst(afterFirst.game, { row: 0, col: 1 });
    if (second === null) throw new Error('expected a move');
    expect(second.points).toBe(2);
    expect(lettersOf(start, second.afterCollapse)).toEqual(['...', '..g', '.gg']);
    expect(second.afterCollapse).toBe(second.afterGravity);
    expect(second.game.score).toBe(8);
  });

  it('reports game over when the board is cleared', () => {
    const cleared = burst(gameFrom(['gg', 'gg']), { row: 1, col: 1 });
    expect(cleared?.gameOver).toBe(true);
    expect(cleared?.game.board.cells.every((id) => id === null)).toBe(true);
  });

  it('reports game over when only isolated balls remain', () => {
    const result = burst(gameFrom(['rr', 'gb']), { row: 0, col: 0 });
    expect(result?.gameOver).toBe(true);
    expect(result?.points).toBe(2);
  });

  it('returns null for a lone ball or an empty cell', () => {
    const board = gameFrom(['r.', 'gb']);
    expect(burst(board, { row: 0, col: 0 })).toBeNull();
    expect(burst(board, { row: 0, col: 1 })).toBeNull();
  });

  it('never mutates the input game', () => {
    const before = JSON.stringify(start);
    burst(start, { row: 0, col: 2 });
    expect(JSON.stringify(start)).toBe(before);
  });

  it('keeps ball ids and colours stable', () => {
    const result = burst(start, { row: 0, col: 2 });
    expect(result?.game.colors).toBe(start.colors);
    const survivors = result?.game.board.cells.filter((id) => id !== null) ?? [];
    expect(new Set(survivors).size).toBe(survivors.length);
    survivors.forEach((id) => {
      expect(start.board.cells).toContain(id);
    });
  });
});
