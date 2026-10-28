import { MOTION, REDUCED_MOTION, motionFor } from './motion';

describe('motion durations', () => {
  it('mirror the --bb-dur-* tokens in src/styles/tokens.css', () => {
    expect(MOTION).toEqual({
      bubble: 80,
      pop: 160,
      fall: 240,
      slide: 200,
      gameOver: 500,
      toast: 150,
    });
  });

  it('keep only the 80 ms pop fade with reduced motion', () => {
    expect(REDUCED_MOTION).toEqual({
      bubble: 0,
      pop: 80,
      fall: 0,
      slide: 0,
      gameOver: 0,
      toast: 0,
    });
  });

  it('pick the set for the motion preference', () => {
    expect(motionFor(false)).toBe(MOTION);
    expect(motionFor(true)).toBe(REDUCED_MOTION);
  });
});
