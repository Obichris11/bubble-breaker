import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { STRINGS } from '../../strings';

/**
 * A notice on the tooltip-yellow face (Component Sheet §4) with an optional action and ×.
 * With a `dismissLabel` it stacks the text above two buttons, the action being the default
 * (the install notice). It fades and slides in with the toast motion tokens.
 */
@Component({
  selector: 'bb-toast',
  templateUrl: './toast.html',
  styleUrl: './toast.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'status', '[class.toast--stacked]': 'dismissLabel() !== null' },
})
export class Toast {
  readonly heading = input.required<string>();
  readonly detail = input('');
  /** Label of the action button; no button when null. */
  readonly actionLabel = input<string | null>(null);
  readonly dismissible = input(false);
  /** A text button that dismisses ("Not now") instead of the ×; stacks the layout. */
  readonly dismissLabel = input<string | null>(null);
  readonly act = output();
  readonly dismiss = output();

  protected readonly strings = STRINGS;
}
