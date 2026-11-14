import { seedFromSearch } from './test-seed';

describe('seedFromSearch', () => {
  it.each([
    ['?seed=42', 42],
    ['?x=1&seed=7', 7],
    ['?seed=0', 0],
    ['?seed=4294967295', 4294967295],
  ])('reads %s', (search, seed) => {
    expect(seedFromSearch(search)).toBe(seed);
  });

  it.each([
    '',
    '?seed=',
    '?seed=4294967296',
    '?seed=-1',
    '?seed=1.5',
    '?seed=abc',
    '?seed=0x10',
    '?seed= 4',
  ])('rejects "%s"', (search) => {
    expect(seedFromSearch(search)).toBeNull();
  });
});
