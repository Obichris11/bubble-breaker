import { FakeClock } from '../platform/testing/fakes';
import { Timer } from './timer';

describe('Timer', () => {
  let clock: FakeClock;
  let timer: Timer;

  beforeEach(() => {
    clock = new FakeClock();
    timer = new Timer(clock);
  });

  it('starts stopped at 0', () => {
    expect(timer.running()).toBe(false);
    expect(timer.elapsedMs()).toBe(0);
  });

  it('updates elapsed time on every whole second while running', () => {
    timer.start();
    clock.advance(999);
    expect(timer.elapsedMs()).toBe(0);
    clock.advance(1);
    expect(timer.elapsedMs()).toBe(1000);
    clock.advance(2500);
    expect(timer.elapsedMs()).toBe(3000);
  });

  it('accumulates across stop and start instead of resetting (legacy bug)', () => {
    timer.start();
    clock.advance(1500);
    timer.stop();
    expect(timer.elapsedMs()).toBe(1500);
    clock.advance(10_000);
    expect(timer.elapsedMs()).toBe(1500);
    timer.start();
    clock.advance(500);
    expect(timer.elapsedMs()).toBe(2000);
  });

  it('reads the exact time between ticks', () => {
    timer.reset(1000);
    timer.start();
    clock.advance(250);
    expect(timer.elapsedMs()).toBe(1000);
    expect(timer.exactMs()).toBe(1250);
    timer.stop();
    expect(timer.exactMs()).toBe(1250);
  });

  it('ticks on whole seconds of the total, not of the segment', () => {
    timer.reset(1500);
    timer.start();
    clock.advance(500);
    expect(timer.elapsedMs()).toBe(2000);
  });

  it('ignores repeated start and stop calls', () => {
    timer.start();
    clock.advance(400);
    timer.start();
    clock.advance(600);
    expect(timer.elapsedMs()).toBe(1000);
    timer.stop();
    timer.stop();
    expect(timer.elapsedMs()).toBe(1000);
    expect(clock.pending).toBe(0);
  });

  it('reset stops the timer and sets the total', () => {
    timer.start();
    clock.advance(3000);
    timer.reset(65_000);
    expect(timer.running()).toBe(false);
    expect(timer.elapsedMs()).toBe(65_000);
    expect(clock.pending).toBe(0);
    timer.reset();
    expect(timer.elapsedMs()).toBe(0);
  });
});
