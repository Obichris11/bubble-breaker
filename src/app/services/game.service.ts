import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { GameBoard, GameConfig, GameState, GameStats, GameMode, DEFAULT_GAME_CONFIG } from '../models/game.model';
import { Ball, BallGroup } from '../models/ball.model';
import { GridService } from './grid.service';
import { ScoreService } from './score.service';
import { AnimationService } from './animation.service';
import { SoundService } from './sound.service';

@Injectable({
  providedIn: 'root'
})
export class GameService {
  private gameStateSubject = new BehaviorSubject<GameState>(GameState.MENU);
  private gameBoardSubject = new BehaviorSubject<GameBoard | null>(null);
  private gameStatsSubject = new BehaviorSubject<GameStats>({
    score: { current: 0, best: 0, lastMove: 0, ballsRemoved: 0, movesCount: 0 },
    timeElapsed: 0,
    level: 1
  });
  private selectedGroupSubject = new BehaviorSubject<BallGroup | null>(null);

  public gameState$ = this.gameStateSubject.asObservable();
  public gameBoard$ = this.gameBoardSubject.asObservable();
  public gameStats$ = this.gameStatsSubject.asObservable();
  public selectedGroup$ = this.selectedGroupSubject.asObservable();

  private gameConfig: GameConfig = { ...DEFAULT_GAME_CONFIG };
  private gameStartTime = 0;
  private gameTimer: any;

  constructor(
    private gridService: GridService,
    private scoreService: ScoreService,
    private animationService: AnimationService,
    private soundService: SoundService
  ) {}

  startNewGame(config?: Partial<GameConfig>): void {
    if (config) {
      this.gameConfig = { ...DEFAULT_GAME_CONFIG, ...config };
    }

    const gameBoard = this.gridService.generateRandomGrid(this.gameConfig);
    this.gameBoardSubject.next(gameBoard);

    const initialStats: GameStats = {
      score: this.scoreService.resetScore(),
      timeElapsed: 0,
      level: 1
    };
    this.gameStatsSubject.next(initialStats);

    this.selectedGroupSubject.next(null);
    this.gameStateSubject.next(GameState.PLAYING);

    this.startTimer();
    this.soundService.playNewGame();
    this.animationService.clearAnimations();
  }

  pauseGame(): void {
    if (this.gameStateSubject.value === GameState.PLAYING) {
      this.gameStateSubject.next(GameState.PAUSED);
      this.stopTimer();
    }
  }

  resumeGame(): void {
    if (this.gameStateSubject.value === GameState.PAUSED) {
      this.gameStateSubject.next(GameState.PLAYING);
      this.startTimer();
    }
  }

  endGame(): void {
    this.stopTimer();
    this.soundService.playGameOver();

    const currentStats = this.gameStatsSubject.value;
    const currentBoard = this.gameBoardSubject.value;

    // Update best score if current score exceeds it
    const finalScore = this.scoreService.updateBestScore(currentStats.score);

    this.gameStatsSubject.next({
      ...currentStats,
      score: finalScore
    });

    this.gameStateSubject.next(GameState.GAME_OVER);
  }

  returnToMenu(): void {
    this.stopTimer();
    this.gameStateSubject.next(GameState.MENU);
    this.gameBoardSubject.next(null);
    this.selectedGroupSubject.next(null);
  }

  async onBallClick(row: number, col: number): Promise<void> {
    const currentState = this.gameStateSubject.value;
    const currentBoard = this.gameBoardSubject.value;
    const currentStats = this.gameStatsSubject.value;

    if (currentState !== GameState.PLAYING || !currentBoard) {
      return;
    }

    const grid = currentBoard.grid;
    this.gridService.clearSelection(grid);

    const group = this.gridService.findAdjacentGroup(grid, row, col);

    if (group && group.size >= 2) {
      // Play ball selection and explosion sounds
      this.soundService.playBallClick();
      this.soundService.playBallPop();

      // Remove the balls after explosion animation
      this.gridService.removeBalls(grid, group.balls);

      // Apply gravity
      this.gridService.applyGravity(grid);

      // Remove empty columns
      this.gridService.removeEmptyColumns(grid);

      // Update score
      const updatedScore = this.scoreService.updateScore(currentStats.score, group.size);

      // Play bonus sound for large groups
      if (group.size >= 5) {
        this.soundService.playScoreBonus();
      }

      const updatedStats: GameStats = {
        ...currentStats,
        score: updatedScore
      };

      this.gameStatsSubject.next(updatedStats);
      this.selectedGroupSubject.next(null);
      this.gameBoardSubject.next({ ...currentBoard });

      // Check for game over
      if (!this.gridService.hasValidMoves(currentBoard.grid)) {
        this.endGame();
        return;
      }

      // Handle continuous mode
      if (this.gameConfig.mode === GameMode.CONTINUOUS) {
        this.handleContinuousMode(currentBoard);
      }
    } else {
      this.selectedGroupSubject.next(null);
    }
  }

  confirmMove(): void {
    const selectedGroup = this.selectedGroupSubject.value;
    const currentBoard = this.gameBoardSubject.value;
    const currentStats = this.gameStatsSubject.value;

    if (!selectedGroup || !currentBoard) {
      return;
    }

    // Remove balls from grid
    this.gridService.removeBalls(currentBoard.grid, selectedGroup.balls);

    // Apply gravity and remove empty columns
    this.gridService.applyGravity(currentBoard.grid);
    this.gridService.removeEmptyColumns(currentBoard.grid);

    // Update score
    const updatedScore = this.scoreService.updateScore(currentStats.score, selectedGroup.size);
    const updatedStats: GameStats = {
      ...currentStats,
      score: updatedScore
    };

    this.gameStatsSubject.next(updatedStats);
    this.selectedGroupSubject.next(null);
    this.gameBoardSubject.next({ ...currentBoard });

    // Check for game over
    if (!this.gridService.hasValidMoves(currentBoard.grid)) {
      this.endGame();
      return;
    }

    // Handle continuous mode
    if (this.gameConfig.mode === GameMode.CONTINUOUS) {
      this.handleContinuousMode(currentBoard);
    }
  }

  private handleContinuousMode(gameBoard: GameBoard): void {
    // Add new column from left when a column is completely cleared
    const hasEmptyColumn = gameBoard.grid.some(row =>
      row.every(cell => cell === null)
    );

    if (hasEmptyColumn) {
      // This is a simplified implementation
      // In a full implementation, you'd shift all columns and add a new one
      console.log('Continuous mode: Adding new column');
    }
  }

  private countRemainingBalls(grid: (Ball | null)[][]): number {
    let count = 0;
    grid.forEach(row => {
      row.forEach(cell => {
        if (cell) count++;
      });
    });
    return count;
  }

  private startTimer(): void {
    this.gameStartTime = Date.now();
    this.gameTimer = setInterval(() => {
      const currentStats = this.gameStatsSubject.value;
      this.gameStatsSubject.next({
        ...currentStats,
        timeElapsed: Math.floor((Date.now() - this.gameStartTime) / 1000)
      });
    }, 1000);
  }

  private stopTimer(): void {
    if (this.gameTimer) {
      clearInterval(this.gameTimer);
      this.gameTimer = null;
    }
  }

  getGameConfig(): GameConfig {
    return { ...this.gameConfig };
  }

  updateGameConfig(config: Partial<GameConfig>): void {
    this.gameConfig = { ...this.gameConfig, ...config };
  }

}