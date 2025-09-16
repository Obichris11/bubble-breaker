import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { GameService } from '../../services/game.service';
import { GameBoard as GameBoardModel, GameState } from '../../models/game.model';
import { Ball as BallModel, BallGroup } from '../../models/ball.model';
import { BallComponent } from '../ball/ball';

@Component({
  selector: 'app-game-board',
  imports: [CommonModule, BallComponent],
  templateUrl: './game-board.html',
  styleUrl: './game-board.scss'
})
export class GameBoardComponent implements OnInit, OnDestroy {
  gameBoard: GameBoardModel | null = null;
  gameState: GameState = GameState.MENU;
  selectedGroup: BallGroup | null = null;
  colorblindMode = false;

  private destroy$ = new Subject<void>();

  constructor(private gameService: GameService) {}

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



  trackByRow(index: number): number {
    return index;
  }

  trackByCol(index: number): number {
    return index;
  }
}
