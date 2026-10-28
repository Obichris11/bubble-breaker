import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * The "N points" tip above the tapped ball (02-ux "Interaction"). It never takes input and is
 * hidden from screen readers: the live region and the Selected field repeat its value.
 */
@Component({
  selector: 'bb-points-bubble',
  template: '{{ text() }}',
  styleUrl: './points-bubble.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'aria-hidden': 'true',
    '[style.left.px]': 'x()',
    '[style.top.px]': 'y()',
    '[class.below]': 'below()',
  },
})
export class PointsBubble {
  readonly text = input.required<string>();
  readonly x = input.required<number>();
  readonly y = input.required<number>();
  readonly below = input(false);
}
