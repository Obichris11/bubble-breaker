import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { formatNumber } from '../../state/format';
import type { StatsStore } from '../../state/stats.store';
import { STRINGS } from '../../strings';

export interface StatRow {
  readonly label: string;
  readonly value: string;
}

/** High, Average, Total and Games Played: the rows Scoring and Statistics share. */
export function totalRows(stats: StatsStore): StatRow[] {
  return [
    { label: STRINGS.stats.high, value: formatNumber(stats.high()) },
    { label: STRINGS.stats.average, value: formatNumber(stats.average()) },
    { label: STRINGS.stats.total, value: formatNumber(stats.total()) },
    { label: STRINGS.stats.played, value: formatNumber(stats.played()) },
  ];
}

/** Label/value rows of the Scoring and Statistics screens. */
@Component({
  selector: 'bb-stat-rows',
  template: `
    <dl class="rows">
      @for (row of rows(); track row.label) {
        <div class="row">
          <dt>{{ row.label }}</dt>
          <dd>{{ row.value }}</dd>
        </div>
      }
    </dl>
  `,
  styleUrl: './stat-rows.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatRows {
  readonly rows = input.required<readonly StatRow[]>();
}
