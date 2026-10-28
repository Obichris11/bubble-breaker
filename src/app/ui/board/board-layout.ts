import type { Board, Cell } from '../../engine';

/** Chrome heights and board padding from 02-ux "Screen layout" (px). */
export const CHROME = {
  titleBar: 26,
  statusStrip: 30,
  softkeysTouch: 44,
  softkeysFine: 32,
  boardSidePad: 4,
  boardBottomPad: 4,
} as const;

/** `--bb-cell-max` on touch screens; `pointer: fine` lowers it to 48 px in tokens.css. */
export const CELL_MAX_TOUCH = 72;

/** Minimum distance of the points bubble's centre from the board's left and right edges. */
export const BUBBLE_EDGE = 34;

/** A cell left of and above the board: `GameStore.tap` treats it as "outside", which clears. */
export const OFF_BOARD: Cell = { row: -1, col: -1 };

export type Grid = Pick<Board, 'columns' | 'rows'>;

export interface Size {
  readonly width: number;
  readonly height: number;
}

export interface BubblePlacement {
  /** Centre of the bubble, board coordinates (px). */
  readonly x: number;
  /** Bottom edge of the bubble (above the anchor) or its top edge (`below`). */
  readonly y: number;
  /** True for an anchor in the top row: the bubble hangs below the ball. */
  readonly below: boolean;
}

/** Space left for the board in a viewport once the chrome and the board padding are taken. */
export function availableSpace(viewport: Size, softkeys: number): Size {
  return {
    width: viewport.width - 2 * CHROME.boardSidePad,
    height:
      viewport.height - CHROME.titleBar - CHROME.statusStrip - softkeys - CHROME.boardBottomPad,
  };
}

/** Handoff §1: the largest whole-pixel cell that fits `space`, capped at `cellMax`. */
export function cellSize(space: Size, grid: Grid, cellMax: number): number {
  const fit = Math.min(space.width / grid.columns, space.height / grid.rows, cellMax);
  return Math.max(0, Math.floor(fit));
}

/** Reads `--bb-cell-max` ("72px"); falls back to the touch value when it is missing. */
export function parseCellMax(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : CELL_MAX_TOUCH;
}

/** The cell under a point in board coordinates. Points off the board give off-board cells. */
export function cellAt(x: number, y: number, cell: number): Cell {
  if (cell <= 0) {
    return OFF_BOARD;
  }
  return { row: Math.floor(y / cell), col: Math.floor(x / cell) };
}

/** `translate()` that places a cell-sized element on `at`. */
export function translate(at: Cell, cell: number): string {
  return `translate(${String(at.col * cell)}px, ${String(at.row * cell)}px)`;
}

/** Handoff §2: above the tapped ball (below it in the top row), centre clamped 34 px from the edges. */
export function bubblePlacement(anchor: Cell, cell: number, grid: Grid): BubblePlacement {
  const centre = anchor.col * cell + cell / 2;
  const x = Math.min(Math.max(centre, BUBBLE_EDGE), grid.columns * cell - BUBBLE_EDGE);
  const below = anchor.row === 0;
  return { x, y: below ? cell + 2 : anchor.row * cell - 2, below };
}
