/** Animation durations in ms. Mirrors the motion tokens in `src/styles/tokens.css`. */
export interface MotionDurations {
  readonly bubble: number;
  readonly pop: number;
  readonly fall: number;
  readonly slide: number;
  readonly gameOver: number;
  readonly toast: number;
}

export const MOTION: MotionDurations = {
  bubble: 80,
  pop: 160,
  fall: 240,
  slide: 200,
  gameOver: 500,
  toast: 150,
};

/** `prefers-reduced-motion: reduce`: everything jumps except an 80 ms opacity pop (tokens.css). */
export const REDUCED_MOTION: MotionDurations = {
  bubble: 0,
  pop: 80,
  fall: 0,
  slide: 0,
  gameOver: 0,
  toast: 0,
};

export function motionFor(reduced: boolean): MotionDurations {
  return reduced ? REDUCED_MOTION : MOTION;
}
