import { STANDARD_RULES, scoreFor } from './rules';

describe('STANDARD_RULES', () => {
  it('matches rules R2, R3 and R7 (11 × 12 board, 5 colours, groups of 2+)', () => {
    expect(STANDARD_RULES).toEqual({ columns: 11, rows: 12, colors: 5, minGroup: 2 });
  });
});

describe('scoreFor', () => {
  it.each([
    [2, 2],
    [3, 6],
    [5, 20],
    [10, 90],
    [16, 240],
    [20, 380],
  ])('scores a group of %i balls as %i points (Y = X(X − 1))', (size, points) => {
    expect(scoreFor(size)).toBe(points);
  });
});
