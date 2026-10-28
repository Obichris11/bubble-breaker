import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Visually hidden polite live region for the board announcements (02-ux "Screen readers"). */
@Component({
  selector: 'bb-live-region',
  template: '{{ message() }}',
  styleUrl: './live-region.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' },
})
export class LiveRegion {
  readonly message = input.required<string>();
}
