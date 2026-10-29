import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export interface StatRow {
  readonly label: string;
  readonly value: string;
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
