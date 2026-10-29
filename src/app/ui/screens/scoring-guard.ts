import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { GameStore } from '../../state/game.store';

/** Scoring opens only after game over (ADR-0006); a direct visit goes to the game screen. */
export const scoringGuard: CanActivateFn = () =>
  inject(GameStore).showScoring() || inject(Router).createUrlTree(['/']);
