import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  effect,
  ElementRef,
  inject,
  output,
  untracked,
} from '@angular/core';
import { PwaStore } from '../../state/pwa.store';
import { STRINGS } from '../../strings';
import { Toast } from '../chrome/toast';

/**
 * The PWA notice at the top of the board area (02-ux "PWA notices"): New version, Offline
 * ready or Install, one at a time. It takes its height from the board area, so it never
 * covers a ball. A notice that goes away while it has focus hands focus back to the board.
 */
@Component({
  selector: 'bb-pwa-notice',
  imports: [Toast],
  templateUrl: './pwa-notice.html',
  styleUrl: './pwa-notice.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PwaNotice {
  /** The focused notice went away; the board should take focus. */
  readonly handBack = output();
  protected readonly pwa = inject(PwaStore);
  protected readonly strings = STRINGS;
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly document = inject(DOCUMENT);

  constructor() {
    // Runs before the template drops the old notice, while its button still has focus.
    effect(() => {
      this.pwa.notice();
      untracked(() => {
        if (this.host.nativeElement.contains(this.document.activeElement)) {
          this.handBack.emit();
        }
      });
    });
  }
}
