import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable } from 'rxjs';

import { GameService } from './services/game.service';
import { GameState } from './models/game.model';
import { GameBoardComponent } from './components/game-board/game-board';
import { ScoreComponent } from './components/score/score';
import { SoundControlsComponent } from './components/sound-controls/sound-controls';

@Component({
  selector: 'app-root',
  imports: [CommonModule, GameBoardComponent, ScoreComponent, SoundControlsComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {
  title = 'Bubble Breaker';
  gameState$: Observable<GameState>;

  constructor(private gameService: GameService) {
    this.gameState$ = this.gameService.gameState$;
  }

  ngOnInit(): void {
    // Application initialization
  }

  startNewGame(): void {
    this.gameService.startNewGame();
  }

  pauseGame(): void {
    this.gameService.pauseGame();
  }

  resumeGame(): void {
    this.gameService.resumeGame();
  }

  returnToMenu(): void {
    this.gameService.returnToMenu();
  }
}
