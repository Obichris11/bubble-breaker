import { allGroups, groupAt, hasMoves } from './groups';
import { gameFrom, sortCells } from './testing/fixtures';

const game = gameFrom(['rrb', 'rbb', 'gyb']);

describe('groupAt', () => {
  it('finds an orthogonally connected same-colour group', () => {
    expect(sortCells(groupAt(game, { row: 0, col: 0 }))).toEqual([
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 1, col: 0 },
    ]);
  });

  it('follows a group around corners', () => {
    expect(sortCells(groupAt(game, { row: 2, col: 2 }))).toEqual([
      { row: 0, col: 2 },
      { row: 1, col: 1 },
      { row: 1, col: 2 },
      { row: 2, col: 2 },
    ]);
  });

  it('never connects diagonally', () => {
    const diagonal = gameFrom(['rb', 'br']);
    expect(groupAt(diagonal, { row: 0, col: 0 })).toEqual([]);
  });

  it('returns [] for a lone ball (a single ball is never a group)', () => {
    expect(groupAt(game, { row: 2, col: 0 })).toEqual([]);
  });

  it('returns [] for an empty cell', () => {
    const holey = gameFrom(['.r', 'rr']);
    expect(groupAt(holey, { row: 0, col: 0 })).toEqual([]);
  });

  it('throws RangeError for a cell outside the board', () => {
    expect(() => groupAt(game, { row: 3, col: 0 })).toThrow(RangeError);
  });
});

describe('allGroups', () => {
  it('lists every group of 2+ exactly once', () => {
    const groups = allGroups(game).map((group) => sortCells(group));
    expect(groups).toHaveLength(2);
    expect(groups.map((group) => group.length).sort()).toEqual([3, 4]);
  });

  it('skips empty cells', () => {
    expect(allGroups(gameFrom(['..', 'rr']))).toHaveLength(1);
  });
});

describe('hasMoves', () => {
  it('is true while any two adjacent balls share a colour', () => {
    expect(hasMoves(game)).toBe(true);
  });

  it('is false on a checkerboard (game over)', () => {
    expect(hasMoves(gameFrom(['rb', 'br']))).toBe(false);
  });

  it('is false on an empty board', () => {
    expect(hasMoves(gameFrom(['..', '..']))).toBe(false);
  });
});
