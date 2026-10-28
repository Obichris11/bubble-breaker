import { FakeClock } from './fakes';

describe('FakeClock', () => {
  it('fires due timers in time order and moves time to each', () => {
    const clock = new FakeClock();
    const fired: string[] = [];
    clock.setTimeout(() => fired.push(`b@${String(clock.now())}`), 200);
    clock.setTimeout(() => fired.push(`a@${String(clock.now())}`), 100);
    clock.advance(150);
    expect(fired).toEqual(['a@100']);
    expect(clock.now()).toBe(150);
    clock.advance(50);
    expect(fired).toEqual(['a@100', 'b@200']);
  });

  it('fires timers scheduled by timers within the same advance', () => {
    const clock = new FakeClock();
    const fired: number[] = [];
    clock.setTimeout(() => {
      fired.push(clock.now());
      clock.setTimeout(() => fired.push(clock.now()), 0);
    }, 10);
    clock.advance(10);
    expect(fired).toEqual([10, 10]);
    expect(clock.pending).toBe(0);
  });

  it('cancels timers', () => {
    const clock = new FakeClock();
    const id = clock.setTimeout(() => {
      throw new Error('must not fire');
    }, 10);
    clock.clearTimeout(id);
    clock.advance(20);
    expect(clock.pending).toBe(0);
  });
});
