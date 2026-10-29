import { newGame } from '../engine';
import { FakeStorage } from '../platform/testing/fakes';
import {
  DEFAULT_SETTINGS,
  DEFAULT_STATS,
  KEYS,
  clearGame,
  fromGameRecord,
  isGameRecord,
  isSettings,
  isStatsRecord,
  loadGame,
  loadSettings,
  loadStats,
  saveGame,
  saveSettings,
  saveStats,
  toGameRecord,
  type GameRecord,
} from './persistence';
import { recordFrom } from './testing/records';

describe('storage keys', () => {
  it('use the v1 schema names from ADR-0005', () => {
    expect(KEYS).toEqual({ settings: 'bb:v1:settings', stats: 'bb:v1:stats', game: 'bb:v1:game' });
  });
});

describe('isSettings', () => {
  it('accepts valid settings', () => {
    expect(
      isSettings({
        breakerSet: 'greyscale',
        shapeHints: true,
        sound: false,
        installDismissedAt: 5,
      }),
    ).toBe(true);
    expect(
      isSettings({
        breakerSet: 'colorful',
        shapeHints: false,
        sound: true,
        installDismissedAt: null,
      }),
    ).toBe(true);
  });

  it('accepts settings saved before the install notice existed', () => {
    expect(isSettings({ breakerSet: 'greyscale', shapeHints: true, sound: false })).toBe(true);
  });

  it.each([
    ['null', null],
    ['an array', []],
    ['a string', 'colorful'],
    ['an unknown breaker set', { breakerSet: 'neon', shapeHints: false, sound: true }],
    ['a non-boolean flag', { breakerSet: 'colorful', shapeHints: 'no', sound: true }],
    ['a missing field', { breakerSet: 'colorful', shapeHints: false }],
    [
      'a negative dismissal time',
      { breakerSet: 'colorful', shapeHints: false, sound: true, installDismissedAt: -1 },
    ],
    [
      'a text dismissal time',
      { breakerSet: 'colorful', shapeHints: false, sound: true, installDismissedAt: 'today' },
    ],
  ])('rejects %s', (_, value) => {
    expect(isSettings(value)).toBe(false);
  });
});

describe('isStatsRecord', () => {
  const valid = {
    high: 240,
    total: 500,
    played: 3,
    last: { score: 100, timeMs: 61_250.5 },
    lastRecordedGameId: 'abc',
  };

  it('accepts valid statistics, with or without a recorded game id', () => {
    expect(isStatsRecord(valid)).toBe(true);
    expect(isStatsRecord({ ...valid, lastRecordedGameId: null })).toBe(true);
    expect(isStatsRecord(DEFAULT_STATS)).toBe(true);
  });

  it.each([
    ['null', null],
    ['missing last', { ...valid, last: undefined }],
    ['a negative count', { ...valid, played: -1 }],
    ['a fractional score', { ...valid, total: 1.5 }],
    ['a non-finite time', { ...valid, last: { score: 1, timeMs: Infinity } }],
    ['a numeric game id', { ...valid, lastRecordedGameId: 7 }],
  ])('rejects %s', (_, value) => {
    expect(isStatsRecord(value)).toBe(false);
  });
});

describe('isGameRecord', () => {
  const valid = recordFrom(['...rr.bbyyg']);

  it('accepts a valid record', () => {
    expect(isGameRecord(valid)).toBe(true);
  });

  it.each<[string, Partial<Record<keyof GameRecord, unknown>>]>([
    ['an empty game id', { gameId: '' }],
    ['a seed above uint32', { seed: 2 ** 32 }],
    ['a negative score', { score: -2 }],
    ['a negative time', { elapsedMs: -1 }],
    ['too few colours', { colors: [0, 1] }],
    ['a colour out of range', { colors: [...valid.colors.slice(1), 5] }],
    ['too few cells', { cells: valid.cells.slice(1) }],
    ['a ball id out of range', { cells: [...valid.cells.slice(1), 132] }],
    ['a duplicate ball id', { cells: [...valid.cells.slice(0, -2), 5, 5] }],
    ['cells that are not an array', { cells: 'nope' }],
  ])('rejects %s', (_, change) => {
    expect(isGameRecord({ ...valid, ...change })).toBe(false);
  });

  it('rejects non-objects', () => {
    expect(isGameRecord(null)).toBe(false);
    expect(isGameRecord([valid])).toBe(false);
  });
});

describe('game record conversion', () => {
  it('round-trips a real game', () => {
    const saved = { gameId: 'id-1', game: newGame(42), elapsedMs: 1234 };
    const record = toGameRecord(saved);
    expect(record).toEqual({
      gameId: 'id-1',
      seed: 42,
      colors: saved.game.colors,
      cells: saved.game.board.cells,
      score: 0,
      elapsedMs: 1234,
    });
    expect(isGameRecord(record)).toBe(true);
    expect(fromGameRecord(record)).toEqual(saved);
  });
});

describe('load and save', () => {
  let storage: FakeStorage;

  beforeEach(() => {
    storage = new FakeStorage();
  });

  it('returns defaults when nothing is stored', () => {
    expect(loadSettings(storage)).toBe(DEFAULT_SETTINGS);
    expect(loadStats(storage)).toBe(DEFAULT_STATS);
    expect(loadGame(storage)).toBeNull();
  });

  it('returns defaults for corrupt JSON or wrong shapes, never throwing', () => {
    storage.data.set(KEYS.settings, '{"breakerSet":');
    storage.set(KEYS.stats, { high: 'lots' });
    storage.set(KEYS.game, { gameId: 'x' });
    expect(loadSettings(storage)).toBe(DEFAULT_SETTINGS);
    expect(loadStats(storage)).toBe(DEFAULT_STATS);
    expect(loadGame(storage)).toBeNull();
  });

  it('fills in the install dismissal for settings saved before it existed', () => {
    storage.set(KEYS.settings, { breakerSet: 'greyscale', shapeHints: true, sound: false });
    expect(loadSettings(storage)).toEqual({
      breakerSet: 'greyscale',
      shapeHints: true,
      sound: false,
      installDismissedAt: null,
    });
  });

  it('round-trips settings and stats', () => {
    const settings = {
      breakerSet: 'greyscale',
      shapeHints: true,
      sound: false,
      installDismissedAt: 1_700_000_000_000,
    } as const;
    const stats = { ...DEFAULT_STATS, high: 12, total: 12, played: 1 };
    saveSettings(storage, settings);
    saveStats(storage, stats);
    expect(loadSettings(storage)).toEqual(settings);
    expect(loadStats(storage)).toEqual(stats);
  });

  it('saves, loads and clears the game in progress', () => {
    const saved = { gameId: 'id-2', game: newGame(9), elapsedMs: 5000 };
    saveGame(storage, saved);
    expect(storage.get(KEYS.game)).toEqual(toGameRecord(saved));
    expect(loadGame(storage)).toEqual(saved);
    clearGame(storage);
    expect(loadGame(storage)).toBeNull();
  });
});
