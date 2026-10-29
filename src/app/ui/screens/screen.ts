import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';

/**
 * Frame of every screen except the Game screen: a white scroll area between the title bar and
 * the softkeys, with the screen's heading on top. After an in-app navigation the heading takes
 * focus, so keyboard and screen-reader users start on the new screen; a fresh page load
 * leaves focus alone.
 */
@Component({
  selector: 'bb-screen',
  template: `
    <h1 #title class="heading" tabindex="-1">{{ heading() }}</h1>
    <ng-content />
  `,
  styleUrl: './screen.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Screen {
  readonly heading = input.required<string>();
  private readonly titleRef = viewChild.required<ElementRef<HTMLElement>>('title');

  constructor() {
    // False while the first navigation of the page is still running.
    const inApp = inject(Router).navigated;
    afterNextRender(() => {
      if (inApp) {
        this.titleRef().nativeElement.focus();
      }
    });
  }
}
