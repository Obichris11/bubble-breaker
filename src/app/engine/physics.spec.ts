import { applyGravity, collapseRight } from './physics';
import { gameFrom, lettersOf } from './testing/fixtures';

describe('applyGravity', () => {
  it('drops balls to the bottom of their column', () => {
    const game = gameFrom(['r.', '..', 'gb']);
    expect(lettersOf(game, applyGravity(game.board))).toEqual(['..', 'r.', 'gb']);
  });

  it('keeps the vertical order of balls and their ids', () => {
    const game = gameFrom(['r', '.', 'g', '.']);
    const after = applyGravity(game.board);
    expect(after.cells).toEqual([null, null, 0, 1]);
  });

  it('leaves a settled board unchanged in content', () => {
    const game = gameFrom(['..', 'rb']);
    expect(applyGravity(game.board)).toEqual(game.board);
  });
});

describe('collapseRight', () => {
  it('closes one empty column to the right', () => {
    const game = gameFrom(['r..', 'g.b']);
    expect(lettersOf(game, collapseRight(game.board))).toEqual(['.r.', '.gb']);
  });

  it('closes several empty columns and keeps column order', () => {
    const game = gameFrom(['r..b.', 'g..y.']);
    expect(lettersOf(game, collapseRight(game.board))).toEqual(['...rb', '...gy']);
  });

  it('returns the same reference when empty columns are already on the left', () => {
    const game = gameFrom(['.rb', '.gb']);
    expect(collapseRight(game.board)).toBe(game.board);
  });

  it('returns the same reference for a full or an empty board', () => {
    const full = gameFrom(['rb', 'gy']);
    const empty = gameFrom(['..', '..']);
    expect(collapseRight(full.board)).toBe(full.board);
    expect(collapseRight(empty.board)).toBe(empty.board);
  });
});
