import { ChangeDetectionStrategy, Component } from '@angular/core';
import { STRINGS } from '../../strings';

/** Navy gradient bar with the app name (26 px, Component Sheet §4). */
@Component({
  selector: 'bb-title-bar',
  template: '<header class="title-bar">{{ strings.appTitle }}</header>',
  styleUrl: './title-bar.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TitleBar {
  protected readonly strings = STRINGS;
}
