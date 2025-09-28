import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { GameService } from '../../services/game.service';
import { ScoreService } from '../../services/score.service';
import { GridService } from '../../services/grid.service';
import { GameBoard as GameBoardModel, GameState } from '../../models/game.model';
import { Ball as BallModel, BallGroup } from '../../models/ball.model';
import { BallComponent } from '../ball/ball';
import { ParticlesComponent } from '../particles/particles';

@Component({
  selector: 'app-game-board',
  imports: [CommonModule, BallComponent, ParticlesComponent],
  templateUrl: './game-board.html',
  styleUrl: './game-board.scss'
})
export class GameBoardComponent implements OnInit, OnDestroy {
  gameBoard: GameBoardModel | null = null;
  gameState: GameState = GameState.MENU;
  selectedGroup: BallGroup | null = null;
  colorblindMode = false;
  hoverPreview: { points: number; x: number; y: number } | null = null;
  hoveredGroup: BallGroup | null = null;

  private destroy$ = new Subject<void>();

  constructor(
    private gameService: GameService,
    private scoreService: ScoreService,
    private gridService: GridService
  ) {}

  ngOnInit(): void {
    this.gameService.gameBoard$
      .pipe(takeUntil(this.destroy$))
      .subscribe(board => {
        this.gameBoard = board;
      });

    this.gameService.gameState$
      .pipe(takeUntil(this.destroy$))
      .subscribe(state => {
        this.gameState = state;
        // Clear selection when game is not in playing state
        if (state !== GameState.PLAYING) {
          this.clearSelection();
        }
      });

    this.gameService.selectedGroup$
      .pipe(takeUntil(this.destroy$))
      .subscribe(group => {
        this.selectedGroup = group;
      });

    const config = this.gameService.getGameConfig();
    this.colorblindMode = config.enableColorblindMode;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onBallClick(ball: BallModel): void {
    if (this.gameState !== GameState.PLAYING || !this.gameBoard) {
      return;
    }

    const group = this.gridService.findAdjacentGroup(this.gameBoard.grid, ball.row, ball.col);

    if (group && group.size >= 2) {
      // If this group is already selected, execute the move
      if (this.selectedGroup && this.isSameGroup(this.selectedGroup, group)) {
        this.gameService.onBallClick(ball.row, ball.col);
        this.clearSelection();
      } else {
        // Select this new group
        this.selectGroup(group);
      }
    } else {
      // Clear selection if clicking on invalid bubble or empty space
      this.clearSelection();
    }
  }

  onBallDoubleClick(ball: BallModel): void {
    // Double-click does nothing now - we use single clicks for the two-step process
  }

  private clearSelection(): void {
    this.hoverPreview = null;
    this.hoveredGroup = null;

    // Clear selection state from all balls
    if (this.gameBoard) {
      this.gameBoard.grid.forEach(row => {
        row.forEach(ball => {
          if (ball) {
            ball.isHovered = false;
            ball.isSelected = false;
          }
        });
      });
    }
  }

  private selectGroup(group: BallGroup): void {
    this.clearSelection();
    this.selectedGroup = group;

    // Mark all balls in the group as selected
    group.balls.forEach(ball => {
      const ballInGrid = this.gameBoard!.grid[ball.row][ball.col];
      if (ballInGrid) {
        ballInGrid.isSelected = true;
      }
    });

    // Show point preview
    const points = this.scoreService.calculateScore(group.size);
    const minRow = Math.min(...group.balls.map(b => b.row));
    const minCol = Math.min(...group.balls.map(b => b.col));
    const maxCol = Math.max(...group.balls.map(b => b.col));
    const centerCol = Math.floor((minCol + maxCol) / 2);

    // Find a ball element to position the preview
    const centerTopElements = document.querySelectorAll(`[data-ball-id="${minRow}-${centerCol}"]`);
    if (centerTopElements.length > 0) {
      const rect = centerTopElements[0].getBoundingClientRect();
      this.hoverPreview = {
        points,
        x: rect.left + (rect.width / 2),
        y: rect.top - 30
      };
    }
  }

  private isSameGroup(group1: BallGroup, group2: BallGroup): boolean {
    if (group1.size !== group2.size) return false;

    const group1Keys = new Set(group1.balls.map(b => `${b.row},${b.col}`));
    return group2.balls.every(b => group1Keys.has(`${b.row},${b.col}`));
  }

  trackByRow(index: number): number {
    return index;
  }

  trackByCol(index: number): number {
    return index;
  }
}