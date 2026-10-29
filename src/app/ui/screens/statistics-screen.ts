import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { formatClock, formatNumber } from '../../state/format';
import { StatsStore } from '../../state/stats.store';
import { STRINGS } from '../../strings';
import { ConfirmDialog } from '../chrome/confirm-dialog';
import { Screen } from './screen';
import { StatRows, totalRows, type StatRow } from './stat-rows';

/** Last game and totals, stored on this device; "Reset statistics…" asks first (02-ux). */
@Component({
  selector: 'bb-statistics-screen',
  imports: [ConfirmDialog, Screen, StatRows],
  templateUrl: './statistics-screen.html',
  styleUrl: './statistics-screen.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatisticsScreen {
  private readonly stats = inject(StatsStore);
  protected readonly strings = STRINGS;
  /** The reset confirmation is open. */
  protected readonly confirming = signal(false);

  protected readonly rows = computed<readonly StatRow[]>(() => {
    const last = this.stats.last();
    const lastGame =
      this.stats.played() === 0
        ? STRINGS.stats.none
        : STRINGS.stats.lastGameValue(formatNumber(last.score), formatClock(last.timeMs));
    return [{ label: STRINGS.stats.lastGame, value: lastGame }, ...totalRows(this.stats)];
  });

  protected reset(): void {
    this.stats.reset();
    this.confirming.set(false);
  }
}
