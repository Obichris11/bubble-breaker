import { createRng } from './rng';

describe('createRng (mulberry32)', () => {
  it('produces the reference sequence for seed 1', () => {
    const random = createRng(1);
    expect([random(), random(), random()]).toEqual([
      0.6270739405881613, 0.002735721180215478, 0.5274470399599522,
    ]);
  });

  it('is deterministic for the same seed', () => {
    const a = createRng(123456);
    const b = createRng(123456);
    for (let i = 0; i < 100; i++) {
      expect(a()).toBe(b());
    }
  });

  it('gives different sequences for different seeds', () => {
    expect(createRng(1)()).not.toBe(createRng(2)());
  });

  it('treats seeds modulo 2^32', () => {
    expect(createRng(2 ** 32 + 1)()).toBe(createRng(1)());
  });

  it('returns values in [0, 1)', () => {
    const random = createRng(42);
    for (let i = 0; i < 10_000; i++) {
      const value = random();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});
