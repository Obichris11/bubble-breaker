import { STANDARD_RULES, type BallId, type Color, type Game } from '../engine';
import type { StoragePort } from '../platform/storage';

/** localStorage keys, schema version 1 (ADR-0005). */
export const KEYS = {
  settings: 'bb:v1:settings',
  stats: 'bb:v1:stats',
  game: 'bb:v1:game',
} as const;

export type BreakerSet = 'colorful' | 'greyscale';

export interface Settings {
  readonly breakerSet: BreakerSet;
  readonly shapeHints: boolean;
  readonly sound: boolean;
  /** When the player last turned down the install notice (`ClockPort.epochMs()`), or null. */
  readonly installDismissedAt: number | null;
}

/** Stored form of the settings: records written before Plan 06 lack `installDismissedAt`. */
export type StoredSettings = Omit<Settings, 'installDismissedAt'> & {
  readonly installDismissedAt?: number | null;
};

export const DEFAULT_SETTINGS: Settings = {
  breakerSet: 'colorful',
  shapeHints: false,
  sound: true,
  installDismissedAt: null,
};

export interface LastGame {
  readonly score: number;
  readonly timeMs: number;
}

export interface StatsRecord {
  readonly high: number;
  readonly total: number;
  readonly played: number;
  readonly last: LastGame;
  /** Id of the last game added to the totals; makes recording idempotent. */
  readonly lastRecordedGameId: string | null;
}

export const DEFAULT_STATS: StatsRecord = {
  high: 0,
  total: 0,
  played: 0,
  last: { score: 0, timeMs: 0 },
  lastRecordedGameId: null,
};

/** Stored form of the game in progress. The board is always STANDARD_RULES-sized. */
export interface GameRecord {
  readonly gameId: string;
  readonly seed: number;
  readonly colors: readonly Color[];
  readonly cells: readonly (BallId | null)[];
  readonly score: number;
  readonly elapsedMs: number;
}

/** In-memory form of a saved game. */
export interface SavedGame {
  readonly gameId: string;
  readonly game: Game;
  readonly elapsedMs: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isDuration(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

export function isSettings(value: unknown): value is StoredSettings {
  return (
    isRecord(value) &&
    (value['breakerSet'] === 'colorful' || value['breakerSet'] === 'greyscale') &&
    typeof value['shapeHints'] === 'boolean' &&
    typeof value['sound'] === 'boolean' &&
    (value['installDismissedAt'] === undefined ||
      value['installDismissedAt'] === null ||
      isDuration(value['installDismissedAt']))
  );
}

export function isStatsRecord(value: unknown): value is StatsRecord {
  if (!isRecord(value) || !isRecord(value['last'])) {
    return false;
  }
  const { high, total, played, last, lastRecordedGameId } = value;
  return (
    isCount(high) &&
    isCount(total) &&
    isCount(played) &&
    isCount(last['score']) &&
    isDuration(last['timeMs']) &&
    (lastRecordedGameId === null || typeof lastRecordedGameId === 'string')
  );
}

export function isGameRecord(value: unknown): value is GameRecord {
  if (!isRecord(value)) {
    return false;
  }
  const { gameId, seed, colors, cells, score, elapsedMs } = value;
  const size = STANDARD_RULES.columns * STANDARD_RULES.rows;
  if (
    typeof gameId !== 'string' ||
    gameId === '' ||
    !isCount(seed) ||
    seed > 0xffffffff ||
    !isCount(score) ||
    !isDuration(elapsedMs) ||
    !Array.isArray(colors) ||
    !Array.isArray(cells) ||
    colors.length !== size ||
    cells.length !== size
  ) {
    return false;
  }
  const validColors = colors.every(
    (color: unknown) => isCount(color) && color < STANDARD_RULES.colors,
  );
  const ids = cells.filter((id: unknown) => id !== null);
  const validIds = ids.every((id: unknown) => isCount(id) && id < size);
  return validColors && validIds && new Set(ids).size === ids.length;
}

export function toGameRecord({ gameId, game, elapsedMs }: SavedGame): GameRecord {
  return {
    gameId,
    seed: game.seed,
    colors: game.colors,
    cells: game.board.cells,
    score: game.score,
    elapsedMs,
  };
}

export function fromGameRecord(record: GameRecord): SavedGame {
  const { columns, rows } = STANDARD_RULES;
  return {
    gameId: record.gameId,
    elapsedMs: record.elapsedMs,
    game: {
      seed: record.seed,
      rules: STANDARD_RULES,
      colors: record.colors,
      board: { columns, rows, cells: record.cells },
      score: record.score,
    },
  };
}

export function loadSettings(storage: StoragePort): Settings {
  const value = storage.get(KEYS.settings);
  return isSettings(value) ? { ...DEFAULT_SETTINGS, ...value } : DEFAULT_SETTINGS;
}

export function saveSettings(storage: StoragePort, settings: Settings): void {
  storage.set(KEYS.settings, settings);
}

export function loadStats(storage: StoragePort): StatsRecord {
  const value = storage.get(KEYS.stats);
  return isStatsRecord(value) ? value : DEFAULT_STATS;
}

export function saveStats(storage: StoragePort, stats: StatsRecord): void {
  storage.set(KEYS.stats, stats);
}

/** The saved game in progress, or null when there is none or it fails validation. */
export function loadGame(storage: StoragePort): SavedGame | null {
  const value = storage.get(KEYS.game);
  return isGameRecord(value) ? fromGameRecord(value) : null;
}

export function saveGame(storage: StoragePort, saved: SavedGame): void {
  storage.set(KEYS.game, toGameRecord(saved));
}

export function clearGame(storage: StoragePort): void {
  storage.remove(KEYS.game);
}
