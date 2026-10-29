import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { STRINGS } from '../../strings';

/**
 * A notice on the tooltip-yellow face (Component Sheet §4) with an optional action and ×.
 * It fades and slides in with the toast motion tokens. Plan 06 shows the PWA notices with it.
 */
@Component({
  selector: 'bb-toast',
  templateUrl: './toast.html',
  styleUrl: './toast.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'status' },
})
export class Toast {
  readonly heading = input.required<string>();
  readonly detail = input('');
  /** Label of the action button; no button when null. */
  readonly actionLabel = input<string | null>(null);
  readonly dismissible = input(false);
  readonly act = output();
  readonly dismiss = output();

  protected readonly strings = STRINGS;
}
