import {
  availableSpace,
  bubblePlacement,
  cellAt,
  cellSize,
  CHROME,
  OFF_BOARD,
  parseCellMax,
  translate,
  windowSize,
} from './board-layout';

const GRID = { columns: 11, rows: 12 };

describe('cellSize (handoff §1)', () => {
  it.each([
    // viewport, softkeys, cell max, cell
    [360, 640, CHROME.softkeysTouch, 72, 32],
    [390, 844, CHROME.softkeysTouch, 72, 34],
    [768, 1024, CHROME.softkeysTouch, 72, 69],
    [1280, 800, CHROME.softkeysFine, 48, 48],
    [1280, 600, CHROME.softkeysFine, 48, 42],
  ])('%i×%i (softkeys %i, max %i) → cell %i', (width, height, softkeys, cellMax, cell) => {
    expect(cellSize(availableSpace({ width, height }, softkeys), GRID, cellMax)).toBe(cell);
  });

  it('gives the reference board sizes', () => {
    const cell = cellSize(availableSpace({ width: 360, height: 640 }, 44), GRID, 72);
    expect([cell * GRID.columns, cell * GRID.rows]).toEqual([352, 384]);
  });

  it('always returns a whole number, never below 0', () => {
    expect(cellSize({ width: 100.9, height: 500 }, GRID, 72)).toBe(9);
    expect(cellSize({ width: -10, height: 500 }, GRID, 72)).toBe(0);
  });
});

describe('windowSize (desktop app window)', () => {
  it('is 536 × 668 for 48 px cells with the 32 px desktop softkeys', () => {
    expect(windowSize(GRID, 48, CHROME.softkeysFine)).toEqual({ width: 536, height: 668 });
  });

  it('fits exactly one 48 px board', () => {
    const window = windowSize(GRID, 48, CHROME.softkeysFine);
    expect(cellSize(availableSpace(window, CHROME.softkeysFine), GRID, 48)).toBe(48);
    expect(
      cellSize(availableSpace({ ...window, height: 667 }, CHROME.softkeysFine), GRID, 48),
    ).toBe(47);
  });
});

describe('parseCellMax', () => {
  it('reads the token value and falls back to 72', () => {
    expect(parseCellMax(' 48px')).toBe(48);
    expect(parseCellMax('')).toBe(72);
    expect(parseCellMax('0px')).toBe(72);
  });
});

describe('cellAt', () => {
  it('maps a point to the cell under it; the whole cell is the hit area', () => {
    expect(cellAt(0, 0, 32)).toEqual({ row: 0, col: 0 });
    expect(cellAt(31.9, 31.9, 32)).toEqual({ row: 0, col: 0 });
    expect(cellAt(32, 383, 32)).toEqual({ row: 11, col: 1 });
  });

  it('gives off-board cells outside the board or before the first measure', () => {
    expect(cellAt(352, 10, 32)).toEqual({ row: 0, col: 11 });
    expect(cellAt(-1, 10, 32)).toEqual({ row: 0, col: -1 });
    expect(cellAt(10, 10, 0)).toEqual(OFF_BOARD);
  });
});

describe('translate', () => {
  it('places an element on a cell', () => {
    expect(translate({ row: 2, col: 3 }, 32)).toBe('translate(96px, 64px)');
  });
});

describe('bubblePlacement (handoff §2)', () => {
  it('sits above the tapped ball', () => {
    expect(bubblePlacement({ row: 5, col: 5 }, 32, GRID)).toEqual({ x: 176, y: 158, below: false });
  });

  it('hangs below a ball in the top row', () => {
    expect(bubblePlacement({ row: 0, col: 5 }, 32, GRID)).toEqual({ x: 176, y: 34, below: true });
  });

  it('keeps its centre 34 px from the board edges', () => {
    expect(bubblePlacement({ row: 3, col: 0 }, 32, GRID).x).toBe(34);
    expect(bubblePlacement({ row: 3, col: 10 }, 32, GRID).x).toBe(352 - 34);
  });
});
