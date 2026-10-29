import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { STRINGS } from '../../strings';

/** Two softkeys at the bottom: New Game or Done on the left, Menu on the right (02-ux). */
@Component({
  selector: 'bb-softkey-bar',
  templateUrl: './softkey-bar.html',
  styleUrl: './softkey-bar.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SoftkeyBar {
  readonly leftLabel = input.required<string>();
  /** The popup menu is open: the Menu softkey shows pressed. */
  readonly menuOpen = input(false);
  readonly left = output();
  /** Menu pressed; carries the softkey so focus can return to it when the menu closes. */
  readonly menu = output<HTMLElement>();

  protected readonly strings = STRINGS;
}
