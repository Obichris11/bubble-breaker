/** Opaque handle returned by `ClockPort.setTimeout`. */
export type TimerId = number;

/** Time source for the state layer. Tests bind `FakeClock` instead. */
export abstract class ClockPort {
  /** Milliseconds from an arbitrary, monotonic origin. */
  abstract now(): number;
  abstract setTimeout(callback: () => void, ms: number): TimerId;
  abstract clearTimeout(id: TimerId): void;
}

export class BrowserClock extends ClockPort {
  now(): number {
    return performance.now();
  }

  setTimeout(callback: () => void, ms: number): TimerId {
    return window.setTimeout(callback, ms);
  }

  clearTimeout(id: TimerId): void {
    window.clearTimeout(id);
  }
}
