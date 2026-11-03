import { InjectionToken } from '@angular/core';

/** The seed of the first game in test builds (04-quality "Test seed hook"); null elsewhere. */
export const TEST_SEED = new InjectionToken<number | null>('TEST_SEED', {
  providedIn: 'root',
  factory: () => null,
});

/** Reads `?seed=<uint32>` from a query string; anything else is null. */
export function seedFromSearch(search: string): number | null {
  const value = new URLSearchParams(search).get('seed');
  if (value === null || !/^\d{1,10}$/.test(value)) {
    return null;
  }
  const seed = Number(value);
  return seed <= 2 ** 32 - 1 ? seed : null;
}
