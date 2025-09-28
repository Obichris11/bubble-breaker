import { Injectable } from '@angular/core';
import { GameScore } from '../models/game.model';

@Injectable({
  providedIn: 'root'
})
export class ScoreService {
  private readonly SCORE_STORAGE_KEY = 'bubble-breaker-best-score';

  calculateScore(groupSize: number): number {
    if (groupSize < 2) return 0;

    // Original scoring: groupSize * (groupSize - 1)
    // 2 balls = 2 points, 3 balls = 6 points, 4 balls = 12 points, etc.
    return groupSize * (groupSize - 1);
  }

  updateScore(currentScore: GameScore, groupSize: number): GameScore {
    const moveScore = this.calculateScore(groupSize);
    const newScore: GameScore = {
      ...currentScore,
      current: currentScore.current + moveScore,
      lastMove: moveScore,
      ballsRemoved: currentScore.ballsRemoved + groupSize,
      movesCount: currentScore.movesCount + 1
    };

    // Update best score if current score exceeds it
    if (newScore.current > newScore.best) {
      newScore.best = newScore.current;
      this.saveBestScore(newScore.best);
    }

    return newScore;
  }

  resetScore(): GameScore {
    return {
      current: 0,
      best: this.loadBestScore(),
      lastMove: 0,
      ballsRemoved: 0,
      movesCount: 0
    };
  }

  getBonusScore(remainingBalls: number): number {
    // Bonus points for completing the game with fewer remaining balls
    if (remainingBalls === 0) {
      return 1000; // Perfect game bonus
    } else if (remainingBalls <= 5) {
      return 500; // Near perfect bonus
    } else if (remainingBalls <= 10) {
      return 200; // Good completion bonus
    }
    return 0;
  }

  private saveBestScore(score: number): void {
    try {
      localStorage.setItem(this.SCORE_STORAGE_KEY, score.toString());
    } catch (error) {
      console.warn('Could not save best score to localStorage:', error);
    }
  }

  private loadBestScore(): number {
    try {
      const saved = localStorage.getItem(this.SCORE_STORAGE_KEY);
      return saved ? parseInt(saved, 10) || 0 : 0;
    } catch (error) {
      console.warn('Could not load best score from localStorage:', error);
      return 0;
    }
  }

  getScoreMultiplier(level: number): number {
    // Increase score multiplier based on level/difficulty
    return Math.max(1, Math.floor(level / 5) + 1);
  }

  calculateTimeBonus(timeElapsed: number, targetTime: number = 300): number {
    // Bonus for completing faster than target time (5 minutes)
    if (timeElapsed < targetTime) {
      return Math.floor((targetTime - timeElapsed) * 2);
    }
    return 0;
  }

  updateBestScore(currentScore: GameScore): GameScore {
    // Check if current score exceeds best score and update accordingly
    if (currentScore.current > currentScore.best) {
      const updatedScore = {
        ...currentScore,
        best: currentScore.current
      };
      this.saveBestScore(updatedScore.best);
      return updatedScore;
    }
    return currentScore;
  }
}