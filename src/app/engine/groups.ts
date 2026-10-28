import { ballAt, isInside, type Cell } from './board';
import { colorOf, type Game } from './game';

const NEIGHBOURS: readonly Cell[] = [
  { row: -1, col: 0 },
  { row: 1, col: 0 },
  { row: 0, col: -1 },
  { row: 0, col: 1 },
];

/** Breadth-first flood fill over orthogonal neighbours of the same colour (rule R6). */
function floodFill(game: Game, start: Cell): Cell[] {
  const startId = ballAt(game.board, start);
  if (startId === null) {
    return [];
  }
  const color = colorOf(game, startId);
  const keyOf = (cell: Cell): number => cell.row * game.board.columns + cell.col;
  const seen = new Set<number>([keyOf(start)]);
  const queue: Cell[] = [start];
  const group: Cell[] = [];
  for (let current = queue.shift(); current !== undefined; current = queue.shift()) {
    group.push(current);
    for (const step of NEIGHBOURS) {
      const next = { row: current.row + step.row, col: current.col + step.col };
      if (!isInside(game.board, next) || seen.has(keyOf(next))) {
        continue;
      }
      const id = ballAt(game.board, next);
      if (id !== null && colorOf(game, id) === color) {
        seen.add(keyOf(next));
        queue.push(next);
      }
    }
  }
  return group;
}

/** Rules R6/R7: the group at `cell`, or [] if the cell is empty or the group is too small. */
export function groupAt(game: Game, cell: Cell): readonly Cell[] {
  const group = floodFill(game, cell);
  return group.length >= game.rules.minGroup ? group : [];
}

export function allGroups(game: Game): readonly (readonly Cell[])[] {
  const { columns, rows } = game.board;
  const visited = new Set<number>();
  const groups: Cell[][] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      if (visited.has(row * columns + col)) {
        continue;
      }
      const group = floodFill(game, { row, col });
      group.forEach((cell) => visited.add(cell.row * columns + cell.col));
      if (group.length >= game.rules.minGroup) {
        groups.push(group);
      }
    }
  }
  return groups;
}

/** Rule R13: the game is over when no group of `minGroup` or more remains. */
export function hasMoves(game: Game): boolean {
  return allGroups(game).length > 0;
}
