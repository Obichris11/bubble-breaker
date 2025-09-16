import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { GameService } from '../../services/game.service';
import { GameStats, GameState } from '../../models/game.model';

@Component({
  selector: 'app-score',
  imports: [CommonModule],
  templateUrl: './score.html',
  styleUrl: './score.scss'
})
export class ScoreComponent implements OnInit, OnDestroy {
  gameStats: GameStats | null = null;
  gameState: GameState = GameState.MENU;

  private destroy$ = new Subject<void>();

  constructor(private gameService: GameService) {}

  ngOnInit(): void {
    this.gameService.gameStats$
      .pipe(takeUntil(this.destroy$))
      .subscribe(stats => {
        this.gameStats = stats;
      });

    this.gameService.gameState$
      .pipe(takeUntil(this.destroy$))
      .subscribe(state => {
        this.gameState = state;
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  getScoreMultiplierText(): string {
    if (!this.gameStats || this.gameStats.score.lastMove === 0) return '';
    return `+${this.gameStats.score.lastMove}`;
  }
}
