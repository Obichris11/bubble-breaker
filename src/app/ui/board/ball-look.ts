import type { Color } from '../../engine';
import type { BreakerSet } from '../../state/persistence';
import { STRINGS } from '../../strings';

type PerColor = readonly [string, string, string, string, string];

/** Ball recipe classes from tokens.css, indexed by engine `Color`. */
const LOOKS: Record<BreakerSet, PerColor> = {
  colorful: [
    'bb-ball--red',
    'bb-ball--blue',
    'bb-ball--green',
    'bb-ball--yellow',
    'bb-ball--purple',
  ],
  greyscale: ['bb-ball--g1', 'bb-ball--g2', 'bb-ball--g3', 'bb-ball--g4', 'bb-ball--g5'],
};

/** Optional shape hints for the Colorful set (02-ux): ▲ ● ■ ◆ ✚. */
const HINTS: PerColor = ['▲', '●', '■', '◆', '✚'];

/** The `.bb-ball--*` class that draws `color` in the given Breaker Set. */
export function ballLook(color: Color, set: BreakerSet): string {
  return LOOKS[set][color];
}

/** The shape-hint glyph, or '' when hints are off or the set is Greyscale (it has patterns). */
export function shapeHint(color: Color, set: BreakerSet, hints: boolean): string {
  return hints && set === 'colorful' ? HINTS[color] : '';
}

/** The spoken name of a ball: its colour, or its pattern in the Greyscale set. */
export function colorName(color: Color, set: BreakerSet): string {
  return STRINGS.board.colorNames[set][color];
}
