import { signal, type Signal } from '@angular/core';

/** The user's `prefers-reduced-motion` setting. */
export abstract class ReducedMotionPort {
  abstract readonly reduced: Signal<boolean>;
}

export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

export interface MediaQuerySource {
  readonly matches: boolean;
  addEventListener(type: 'change', listener: () => void): void;
}

export class BrowserReducedMotion extends ReducedMotionPort {
  private readonly state;
  readonly reduced: Signal<boolean>;

  /** `query` is null where `matchMedia` is unavailable (then motion is never reduced). */
  constructor(query: MediaQuerySource | null) {
    super();
    this.state = signal(query?.matches ?? false);
    this.reduced = this.state.asReadonly();
    query?.addEventListener('change', () => {
      this.state.set(query.matches);
    });
  }
}
