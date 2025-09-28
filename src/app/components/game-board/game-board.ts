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
        // Clear hover state when game is not in playing state
        if (state !== GameState.PLAYING) {
          this.clearHoverState();
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
    this.gameService.onBallClick(ball.row, ball.col);
  }

  onBallHover(event: MouseEvent, ball: BallModel): void {
    if (this.gameState !== GameState.PLAYING || !this.gameBoard) {
      return;
    }

    const group = this.gridService.findAdjacentGroup(this.gameBoard.grid, ball.row, ball.col);

    if (group && group.size >= 2) {
      // Clear previous hover state
      this.clearHoverState();

      this.hoveredGroup = group;

      // Highlight all balls in the group
      group.balls.forEach(ball => {
        const ballInGrid = this.gameBoard!.grid[ball.row][ball.col];
        if (ballInGrid) {
          ballInGrid.isHovered = true;
        }
      });

      const points = this.scoreService.calculateScore(group.size);

      // Find the center position above the group
      const minRow = Math.min(...group.balls.map(b => b.row));
      const maxRow = Math.max(...group.balls.map(b => b.row));
      const minCol = Math.min(...group.balls.map(b => b.col));
      const maxCol = Math.max(...group.balls.map(b => b.col));

      // Calculate center position of the group
      const centerRow = minRow;
      const centerCol = Math.floor((minCol + maxCol) / 2);

      // Find the center-top ball of the group
      const centerTopElements = document.querySelectorAll(`[data-ball-id="${centerRow}-${centerCol}"]`);
      if (centerTopElements.length > 0) {
        const rect = centerTopElements[0].getBoundingClientRect();
        this.hoverPreview = {
          points,
          x: rect.left + (rect.width / 2),
          y: rect.top - 30
        };
      } else {
        // Fallback: try to find any ball in the top row of the selection
        const topRowBalls = group.balls.filter(b => b.row === minRow);
        if (topRowBalls.length > 0) {
          const middleBall = topRowBalls[Math.floor(topRowBalls.length / 2)];
          const fallbackElements = document.querySelectorAll(`[data-ball-id="${middleBall.row}-${middleBall.col}"]`);
          if (fallbackElements.length > 0) {
            const rect = fallbackElements[0].getBoundingClientRect();
            this.hoverPreview = {
              points,
              x: rect.left + (rect.width / 2),
              y: rect.top - 30
            };
          }
        } else {
          // Final fallback to mouse position
          const rect = (event.target as HTMLElement).getBoundingClientRect();
          this.hoverPreview = {
            points,
            x: rect.left + (rect.width / 2),
            y: rect.top - 30
          };
        }
      }
    } else {
      this.clearHoverState();
    }
  }

  onBallLeave(): void {
    this.clearHoverState();
  }

  private clearHoverState(): void {
    this.hoverPreview = null;
    this.hoveredGroup = null;

    // Clear hover state from all balls
    if (this.gameBoard) {
      this.gameBoard.grid.forEach(row => {
        row.forEach(ball => {
          if (ball) {
            ball.isHovered = false;
          }
        });
      });
    }
  }




  trackByRow(index: number): number {
    return index;
  }

  trackByCol(index: number): number {
    return index;
  }
}
