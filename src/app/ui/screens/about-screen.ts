import { ChangeDetectionStrategy, Component } from '@angular/core';
import { STRINGS } from '../../strings';
import { VERSION } from '../../version';
import { Screen } from './screen';

/** Name, version, tribute note and the offline/no-tracking promise (02-ux "Screens"). */
@Component({
  selector: 'bb-about-screen',
  imports: [Screen],
  templateUrl: './about-screen.html',
  styleUrl: './about-screen.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AboutScreen {
  protected readonly strings = STRINGS;
  protected readonly version = STRINGS.about.version(VERSION);
  /** The four balls of the logo, in the Colorful set. */
  protected readonly logo = ['red', 'blue', 'green', 'purple'] as const;
}
