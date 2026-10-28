import { ballAt, columnsOf, countBalls, fromColumns, isInside, itemAt, type Board } from './board';
import { colorOf } from './game';
import { gameFrom, lettersOf } from './testing/fixtures';

const board: Board = { columns: 3, rows: 2, cells: [0, null, 1, 2, 3, null] };

describe('itemAt', () => {
  it('returns the item at an index', () => {
    expect(itemAt(['a', 'b'], 1)).toBe('b');
  });

  it('throws RangeError outside the array', () => {
    expect(() => itemAt(['a'], 1)).toThrow(RangeError);
    expect(() => itemAt(['a'], -1)).toThrow(RangeError);
  });
});

describe('isInside', () => {
  it('accepts cells on the board', () => {
    expect(isInside(board, { row: 0, col: 0 })).toBe(true);
    expect(isInside(board, { row: 1, col: 2 })).toBe(true);
  });

  it('rejects cells off the board or non-integer cells', () => {
    expect(isInside(board, { row: -1, col: 0 })).toBe(false);
    expect(isInside(board, { row: 2, col: 0 })).toBe(false);
    expect(isInside(board, { row: 0, col: -1 })).toBe(false);
    expect(isInside(board, { row: 0, col: 3 })).toBe(false);
    expect(isInside(board, { row: 0.5, col: 0 })).toBe(false);
  });
});

describe('ballAt', () => {
  it('reads row-major cells', () => {
    expect(ballAt(board, { row: 0, col: 2 })).toBe(1);
    expect(ballAt(board, { row: 1, col: 0 })).toBe(2);
    expect(ballAt(board, { row: 0, col: 1 })).toBeNull();
  });

  it('throws RangeError outside the board', () => {
    expect(() => ballAt(board, { row: 2, col: 0 })).toThrow(RangeError);
  });
});

describe('countBalls', () => {
  it('counts non-empty cells', () => {
    expect(countBalls(board)).toBe(4);
  });
});

describe('columnsOf / fromColumns', () => {
  it('splits a board into top-to-bottom columns', () => {
    expect(columnsOf(board)).toEqual([
      [0, 2],
      [null, 3],
      [1, null],
    ]);
  });

  it('round-trips', () => {
    expect(fromColumns(columnsOf(board), board.rows)).toEqual(board);
  });
});

describe('fixtures', () => {
  it('builds a game from letter rows and renders it back', () => {
    const game = gameFrom(['rb.', '.gy']);
    expect(game.board).toEqual({ columns: 3, rows: 2, cells: [0, 1, null, null, 2, 3] });
    expect(game.colors).toEqual([0, 1, 2, 3]);
    expect(colorOf(game, 3)).toBe(3);
    expect(lettersOf(game)).toEqual(['rb.', '.gy']);
  });
});
