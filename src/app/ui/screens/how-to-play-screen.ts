import { ChangeDetectionStrategy, Component } from '@angular/core';
import { formatNumber } from '../../state/format';
import { STRINGS } from '../../strings';
import { Screen } from './screen';

/** Group sizes of the points table in 02-ux. */
const EXAMPLES = [2, 5, 10, 20] as const;

/** Rules in short, the points table, "no undo" and the keyboard keys (02-ux "Screens"). */
@Component({
  selector: 'bb-how-to-play-screen',
  imports: [Screen],
  templateUrl: './how-to-play-screen.html',
  styleUrl: './how-to-play-screen.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HowToPlayScreen {
  protected readonly strings = STRINGS;
  protected readonly points = EXAMPLES.map((size) => ({
    label: STRINGS.howToPlay.balls(size),
    value: formatNumber(size * (size - 1)),
  }));
}
