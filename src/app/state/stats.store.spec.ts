import { TestBed } from '@angular/core/testing';
import { createFakePlatform, type FakePlatform } from '../platform/testing/fakes';
import { DEFAULT_STATS, KEYS } from './persistence';
import { StatsStore } from './stats.store';

describe('StatsStore', () => {
  let platform: FakePlatform;

  const create = (): StatsStore => {
    TestBed.configureTestingModule({ providers: platform.providers });
    return TestBed.inject(StatsStore);
  };

  beforeEach(() => {
    platform = createFakePlatform();
  });

  it('starts empty with an average of 0', () => {
    const stats = create();
    expect([stats.high(), stats.total(), stats.played(), stats.average()]).toEqual([0, 0, 0, 0]);
    expect(stats.last()).toEqual({ score: 0, timeMs: 0 });
    expect(stats.newHigh()).toBe(false);
  });

  it('records a finished game and persists it', () => {
    const stats = create();
    expect(stats.recordFinished('game-1', 240, 61_000)).toBe(true);
    expect([stats.high(), stats.total(), stats.played()]).toEqual([240, 240, 1]);
    expect(stats.last()).toEqual({ score: 240, timeMs: 61_000 });
    expect(stats.newHigh()).toBe(true);
    expect(platform.storage.get(KEYS.stats)).toEqual({
      high: 240,
      total: 240,
      played: 1,
      last: { score: 240, timeMs: 61_000 },
      lastRecordedGameId: 'game-1',
    });
  });

  it('records each game exactly once (rule R17)', () => {
    const stats = create();
    stats.recordFinished('game-1', 240, 61_000);
    expect(stats.recordFinished('game-1', 240, 61_000)).toBe(false);
    expect(stats.played()).toBe(1);
    expect(stats.total()).toBe(240);
  });

  it('stays idempotent across reloads', () => {
    create().recordFinished('game-1', 240, 61_000);
    TestBed.resetTestingModule();
    const reloaded = create();
    expect(reloaded.recordFinished('game-1', 240, 61_000)).toBe(false);
    expect(reloaded.played()).toBe(1);
  });

  it('tracks the high score and a rounded average', () => {
    const stats = create();
    stats.recordFinished('a', 100, 1);
    stats.recordFinished('b', 50, 1);
    expect(stats.newHigh()).toBe(false);
    stats.recordFinished('c', 51, 1);
    expect([stats.high(), stats.total(), stats.played(), stats.average()]).toEqual([
      100, 201, 3, 67,
    ]);
    stats.recordFinished('d', 101, 1);
    expect(stats.newHigh()).toBe(true);
    expect(stats.high()).toBe(101);
  });

  it('loads stored statistics and ignores invalid ones', () => {
    platform.storage.set(KEYS.stats, { ...DEFAULT_STATS, high: 9, total: 9, played: 1 });
    expect(create().high()).toBe(9);
    TestBed.resetTestingModule();
    platform.storage.set(KEYS.stats, { high: -1 });
    expect(create().high()).toBe(0);
  });

  it('reset clears the numbers but still blocks re-recording the last game', () => {
    const stats = create();
    stats.recordFinished('game-1', 240, 61_000);
    stats.reset();
    expect([stats.high(), stats.total(), stats.played()]).toEqual([0, 0, 0]);
    expect(stats.newHigh()).toBe(false);
    expect(stats.recordFinished('game-1', 240, 61_000)).toBe(false);
    expect(platform.storage.get(KEYS.stats)).toEqual({
      ...DEFAULT_STATS,
      lastRecordedGameId: 'game-1',
    });
  });
});
