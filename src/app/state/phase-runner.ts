import type { BallId, Board, MoveResult } from '../engine';
import type { ClockPort, TimerId } from '../platform/clock';
import type { MotionDurations } from './motion';

export type Phase = 'idle' | 'pop' | 'fall' | 'slide' | 'over';

/** One animation step: what the board shows while `phase` runs for `durationMs`. */
export interface Frame {
  readonly phase: Exclude<Phase, 'idle'>;
  readonly board: Board;
  readonly popping: ReadonlySet<BallId>;
  readonly durationMs: number;
}

const NONE: ReadonlySet<BallId> = new Set();

/**
 * The burst sequence from 02-ux: pop on the old board, fall to `afterGravity`, slide to
 * `afterCollapse` (skipped when nothing slid), then hold on game over.
 */
export function framesFor(
  before: Board,
  result: MoveResult,
  motion: MotionDurations,
): readonly Frame[] {
  const frames: Frame[] = [
    { phase: 'pop', board: before, popping: new Set(result.removed), durationMs: motion.pop },
    { phase: 'fall', board: result.afterGravity, popping: NONE, durationMs: motion.fall },
  ];
  if (result.afterCollapse !== result.afterGravity) {
    frames.push({
      phase: 'slide',
      board: result.afterCollapse,
      popping: NONE,
      durationMs: motion.slide,
    });
  }
  if (result.gameOver) {
    frames.push({
      phase: 'over',
      board: result.afterCollapse,
      popping: NONE,
      durationMs: motion.gameOver,
    });
  }
  return frames;
}

/**
 * Plays frames one after another on the injected clock. Zero-length frames are applied
 * synchronously, so reduced motion jumps straight to the end state.
 */
export class PhaseRunner {
  private pending: TimerId | null = null;

  constructor(private readonly clock: ClockPort) {}

  run(frames: readonly Frame[], apply: (frame: Frame) => void, done: () => void): void {
    this.cancel();
    const step = (index: number): void => {
      const frame = frames[index];
      if (frame === undefined) {
        done();
        return;
      }
      apply(frame);
      if (frame.durationMs === 0) {
        step(index + 1);
        return;
      }
      this.pending = this.clock.setTimeout(() => {
        this.pending = null;
        step(index + 1);
      }, frame.durationMs);
    };
    step(0);
  }

  /** Drops the remaining frames (new game during an animation). `done` is not called. */
  cancel(): void {
    if (this.pending !== null) {
      this.clock.clearTimeout(this.pending);
      this.pending = null;
    }
  }
}
