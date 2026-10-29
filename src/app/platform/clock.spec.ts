import { BrowserClock } from './clock';

describe('BrowserClock', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('reads a monotonic time', () => {
    const clock = new BrowserClock();
    const first = clock.now();
    expect(clock.now()).toBeGreaterThanOrEqual(first);
  });

  it('reads the wall-clock time', () => {
    vi.useFakeTimers({ now: Date.UTC(2026, 9, 29) });
    expect(new BrowserClock().epochMs()).toBe(Date.UTC(2026, 9, 29));
  });

  it('runs and cancels timers', () => {
    vi.useFakeTimers();
    const clock = new BrowserClock();
    const fired: string[] = [];
    clock.setTimeout(() => fired.push('kept'), 100);
    const cancelled = clock.setTimeout(() => fired.push('cancelled'), 100);
    clock.clearTimeout(cancelled);
    vi.advanceTimersByTime(100);
    expect(fired).toEqual(['kept']);
  });
});
