import type { Color } from '../../engine';
import { ballLook, colorName, shapeHint } from './ball-look';

const COLORS: readonly Color[] = [0, 1, 2, 3, 4];

describe('ballLook', () => {
  it('uses the colour classes for the Colorful set', () => {
    expect(COLORS.map((color) => ballLook(color, 'colorful'))).toEqual([
      'bb-ball--red',
      'bb-ball--blue',
      'bb-ball--green',
      'bb-ball--yellow',
      'bb-ball--purple',
    ]);
  });

  it('uses the pattern classes for the Greyscale set (rule R18)', () => {
    expect(COLORS.map((color) => ballLook(color, 'greyscale'))).toEqual([
      'bb-ball--g1',
      'bb-ball--g2',
      'bb-ball--g3',
      'bb-ball--g4',
      'bb-ball--g5',
    ]);
  });
});

describe('shapeHint', () => {
  it('shows ▲ ● ■ ◆ ✚ on Colorful balls when hints are on', () => {
    expect(COLORS.map((color) => shapeHint(color, 'colorful', true))).toEqual([
      '▲',
      '●',
      '■',
      '◆',
      '✚',
    ]);
  });

  it('shows nothing when hints are off or the set is Greyscale', () => {
    expect(shapeHint(0, 'colorful', false)).toBe('');
    expect(shapeHint(0, 'greyscale', true)).toBe('');
  });
});

describe('colorName', () => {
  it('names colours, or patterns in the Greyscale set', () => {
    expect(colorName(1, 'colorful')).toBe('blue');
    expect(colorName(1, 'greyscale')).toBe('solid');
  });
});
