import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { formatClock, formatNumber } from '../../state/format';
import { GameStore } from '../../state/game.store';
import { StatsStore } from '../../state/stats.store';
import { STRINGS } from '../../strings';
import { Screen } from './screen';
import { StatRows, totalRows } from './stat-rows';

/**
 * Opens by itself 500 ms after game over (rule R16): the score, a "New high score" badge, the
 * time (not scored) and the updated totals. The finished game is already in `StatsStore.last`.
 */
@Component({
  selector: 'bb-scoring-screen',
  imports: [Screen, StatRows],
  templateUrl: './scoring-screen.html',
  styleUrl: './scoring-screen.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScoringScreen {
  private readonly game = inject(GameStore);
  private readonly router = inject(Router);
  protected readonly stats = inject(StatsStore);
  protected readonly strings = STRINGS;

  protected readonly score = computed(() => formatNumber(this.stats.last().score));
  protected readonly time = computed(() =>
    STRINGS.scoring.time(formatClock(this.stats.last().timeMs)),
  );
  protected readonly rows = computed(() => totalRows(this.stats));

  protected newGame(): void {
    this.game.newGame();
    void this.router.navigate(['/']);
  }
}
