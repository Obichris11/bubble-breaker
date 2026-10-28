import { columnsOf, fromColumns, type BallId, type Board } from './board';

/** Rule R11: balls above removed cells fall straight down. */
export function applyGravity(board: Board): Board {
  const settled = columnsOf(board).map((column) => {
    const balls = column.filter((id): id is BallId => id !== null);
    return [...new Array<null>(board.rows - balls.length).fill(null), ...balls];
  });
  return fromColumns(settled, board.rows);
}

/**
 * Rule R12: empty columns close up to the right, so empty space collects on the left.
 * Expects gravity to have been applied. Returns `board` itself when no column moves.
 */
export function collapseRight(board: Board): Board {
  const columns = columnsOf(board);
  const isEmpty = columns.map((column) => column.every((id) => id === null));
  const firstFilled = isEmpty.indexOf(false);
  const alreadyCollapsed =
    firstFilled === -1 || isEmpty.slice(firstFilled).every((empty) => !empty);
  if (alreadyCollapsed) {
    return board;
  }
  const filled = columns.filter((_, col) => !isEmpty[col]);
  const empties = Array.from({ length: columns.length - filled.length }, () =>
    new Array<null>(board.rows).fill(null),
  );
  return fromColumns([...empties, ...filled], board.rows);
}
