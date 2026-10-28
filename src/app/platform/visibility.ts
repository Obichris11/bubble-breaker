import { signal, type Signal } from '@angular/core';

/** Page visibility. `hidden` turns true when the tab or app goes to the background. */
export abstract class VisibilityPort {
  abstract readonly hidden: Signal<boolean>;
}

export interface VisibilitySource {
  readonly visibilityState: DocumentVisibilityState;
  addEventListener(type: 'visibilitychange', listener: () => void): void;
}

export class BrowserVisibility extends VisibilityPort {
  private readonly state;
  readonly hidden: Signal<boolean>;

  constructor(source: VisibilitySource) {
    super();
    this.state = signal(source.visibilityState === 'hidden');
    this.hidden = this.state.asReadonly();
    source.addEventListener('visibilitychange', () => {
      this.state.set(source.visibilityState === 'hidden');
    });
  }
}
