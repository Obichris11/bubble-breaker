import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { GameStore } from '../../state/game.store';
import { STRINGS } from '../../strings';

/** Score · Selected · Time in sunken fields above the board (30 px, Component Sheet §4). */
@Component({
  selector: 'bb-status-strip',
  templateUrl: './status-strip.html',
  styleUrl: './status-strip.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatusStrip {
  protected readonly store = inject(GameStore);
  protected readonly strings = STRINGS;
}
