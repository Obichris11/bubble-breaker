import { burst, type Board, type MoveResult } from '../engine';
import { gameFrom } from '../engine/testing/fixtures';
import { FakeClock } from '../platform/testing/fakes';
import { MOTION, REDUCED_MOTION } from './motion';
import { framesFor, PhaseRunner, type Frame } from './phase-runner';

function burstAt(rows: readonly string[], row: number, col: number): [Board, MoveResult] {
  const game = gameFrom(rows);
  const result = burst(game, { row, col });
  if (result === null) throw new Error('expected a burst');
  return [game.board, result];
}

// Burst the bottom-right pair: the left column slides right, a pair is left (no game over).
const [slideBefore, slideResult] = burstAt(['b..', 'brr'], 1, 2);
// Burst the left column: nothing slides, the right column is left (no game over).
const [plainBefore, plainResult] = burstAt(['rb', 'rb', 'gb'], 0, 0);
// Burst the only pair: the board is empty (game over, nothing slides).
const [overBefore, overResult] = burstAt(['..', 'rr'], 1, 0);

describe('framesFor', () => {
  it('pops on the old board, then falls, then slides', () => {
    const frames = framesFor(slideBefore, slideResult, MOTION);
    expect(frames.map((frame) => [frame.phase, frame.durationMs])).toEqual([
      ['pop', 160],
      ['fall', 240],
      ['slide', 200],
    ]);
    expect(frames[0]?.board).toBe(slideBefore);
    expect([...(frames[0]?.popping ?? [])]).toEqual(slideResult.removed);
    expect(frames[1]?.board).toBe(slideResult.afterGravity);
    expect(frames[1]?.popping.size).toBe(0);
    expect(frames[2]?.board).toBe(slideResult.afterCollapse);
  });

  it('skips the slide when no column moved', () => {
    const frames = framesFor(plainBefore, plainResult, MOTION);
    expect(frames.map((frame) => frame.phase)).toEqual(['pop', 'fall']);
  });

  it('ends with a 500 ms game-over hold', () => {
    const frames = framesFor(overBefore, overResult, MOTION);
    expect(frames.map((frame) => [frame.phase, frame.durationMs])).toEqual([
      ['pop', 160],
      ['fall', 240],
      ['over', 500],
    ]);
  });

  it('uses the reduced-motion durations', () => {
    const frames = framesFor(overBefore, overResult, REDUCED_MOTION);
    expect(frames.map((frame) => frame.durationMs)).toEqual([80, 0, 0]);
  });
});

describe('PhaseRunner', () => {
  let clock: FakeClock;
  let runner: PhaseRunner;
  let applied: string[];
  let done: number;

  const run = (frames: readonly Frame[]): void => {
    runner.run(
      frames,
      (frame) => applied.push(frame.phase),
      () => done++,
    );
  };

  beforeEach(() => {
    clock = new FakeClock();
    runner = new PhaseRunner(clock);
    applied = [];
    done = 0;
  });

  it('applies each frame after the previous one has run its duration', () => {
    run(framesFor(slideBefore, slideResult, MOTION));
    expect(applied).toEqual(['pop']);
    clock.advance(159);
    expect(applied).toEqual(['pop']);
    clock.advance(1);
    expect(applied).toEqual(['pop', 'fall']);
    clock.advance(240);
    expect(applied).toEqual(['pop', 'fall', 'slide']);
    expect(done).toBe(0);
    clock.advance(200);
    expect(done).toBe(1);
    expect(clock.pending).toBe(0);
  });

  it('applies zero-length frames synchronously (reduced motion)', () => {
    run(framesFor(overBefore, overResult, REDUCED_MOTION));
    expect(applied).toEqual(['pop']);
    clock.advance(80);
    expect(applied).toEqual(['pop', 'fall', 'over']);
    expect(done).toBe(1);
  });

  it('cancel drops the remaining frames and never calls done', () => {
    run(framesFor(slideBefore, slideResult, MOTION));
    runner.cancel();
    clock.advance(1000);
    expect(applied).toEqual(['pop']);
    expect(done).toBe(0);
  });

  it('a new run cancels the previous one', () => {
    run(framesFor(slideBefore, slideResult, MOTION));
    run(framesFor(plainBefore, plainResult, MOTION));
    clock.advance(1000);
    expect(applied).toEqual(['pop', 'pop', 'fall']);
    expect(done).toBe(1);
  });
});
