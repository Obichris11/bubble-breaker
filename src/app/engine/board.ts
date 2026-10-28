/** Stable identity of one ball for the whole game (used for animation tracking). */
export type BallId = number;

export interface Cell {
  readonly row: number;
  readonly col: number;
}

/** Immutable grid. Row 0 is the top row; `cells` is row-major (index = row·columns + col). */
export interface Board {
  readonly columns: number;
  readonly rows: number;
  readonly cells: readonly (BallId | null)[];
}

/** Index access that fails loudly instead of returning `undefined`. */
export function itemAt<T>(items: readonly T[], index: number): T {
  const item = items[index];
  if (item === undefined) {
    throw new RangeError(`Index ${String(index)} is out of range (length ${String(items.length)})`);
  }
  return item;
}

export function isInside(board: Board, cell: Cell): boolean {
  return (
    Number.isInteger(cell.row) &&
    Number.isInteger(cell.col) &&
    cell.row >= 0 &&
    cell.row < board.rows &&
    cell.col >= 0 &&
    cell.col < board.columns
  );
}

export function ballAt(board: Board, cell: Cell): BallId | null {
  if (!isInside(board, cell)) {
    throw new RangeError(
      `Cell (${String(cell.row)}, ${String(cell.col)}) is outside the ${String(board.rows)}×${String(board.columns)} board`,
    );
  }
  return itemAt(board.cells, cell.row * board.columns + cell.col);
}

export function countBalls(board: Board): number {
  return board.cells.filter((id) => id !== null).length;
}

/** Columns left to right, each ordered top to bottom. */
export function columnsOf(board: Board): (BallId | null)[][] {
  return Array.from({ length: board.columns }, (_, col) =>
    board.cells.filter((_, index) => index % board.columns === col),
  );
}

export function fromColumns(columns: readonly (readonly (BallId | null)[])[], rows: number): Board {
  const width = columns.length;
  const cells = new Array<BallId | null>(width * rows).fill(null);
  columns.forEach((column, col) => {
    column.forEach((id, row) => {
      cells[row * width + col] = id;
    });
  });
  return { columns: width, rows, cells };
}
