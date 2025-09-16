import { Ball, BallColor } from './ball.model';

export enum GameMode {
  STANDARD = 'standard',
  CONTINUOUS = 'continuous',
  SHIFTER = 'shifter',
  MEGASHIFT = 'megashift'
}

export enum GameState {
  MENU = 'menu',
  PLAYING = 'playing',
  PAUSED = 'paused',
  GAME_OVER = 'game_over'
}

export interface GameConfig {
  rows: number;
  cols: number;
  colors: BallColor[];
  mode: GameMode;
  enableColorblindMode: boolean;
}

export interface GameBoard {
  grid: (Ball | null)[][];
  rows: number;
  cols: number;
}

export interface GameScore {
  current: number;
  best: number;
  lastMove: number;
  ballsRemoved: number;
  movesCount: number;
}

export interface GameStats {
  score: GameScore;
  timeElapsed: number;
  level: number;
}

export const DEFAULT_GAME_CONFIG: GameConfig = {
  rows: 12,
  cols: 8,
  colors: [BallColor.RED, BallColor.BLUE, BallColor.GREEN, BallColor.YELLOW, BallColor.PURPLE],
  mode: GameMode.STANDARD,
  enableColorblindMode: false
};