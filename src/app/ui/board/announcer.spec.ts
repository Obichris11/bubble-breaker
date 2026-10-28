import { burst, groupAt, type Cell, type Game } from '../../engine';
import { gameFrom } from '../../engine/testing/fixtures';
import type { Selection } from '../../state/game.store';
import { announcement, cursorText, gameOverText, type BoardSnapshot } from './announcer';

// Row 0: a blue pair and a lone red; row 1: three greens.
const GAME = gameFrom(['bb.r', 'ggg.']);

function select(game: Game, anchor: Cell): Selection {
  return { cells: groupAt(game, anchor), anchor };
}

function snapshot(change: Partial<BoardSnapshot> = {}): BoardSnapshot {
  return {
    gameId: 'game-1',
    game: GAME,
    selection: null,
    cursor: { row: 0, col: 0 },
    cursorGroupSize: 2,
    ...change,
  };
}

describe('cursorText', () => {
  it('names the cell from 1, top left, with the ball and its group', () => {
    expect(cursorText(snapshot(), 'colorful')).toBe('Row 1, column 1, blue, group of 2');
  });

  it('says "no group" on a lone ball and "empty" on an empty cell', () => {
    const lone = snapshot({ cursor: { row: 0, col: 3 }, cursorGroupSize: 0 });
    expect(cursorText(lone, 'colorful')).toBe('Row 1, column 4, red, no group');
    const empty = snapshot({ cursor: { row: 1, col: 3 }, cursorGroupSize: 0 });
    expect(cursorText(empty, 'colorful')).toBe('Row 2, column 4, empty');
  });

  it('names patterns in the Greyscale set', () => {
    expect(cursorText(snapshot(), 'greyscale')).toBe('Row 1, column 1, solid, group of 2');
  });
});

describe('announcement', () => {
  it('announces a cursor move', () => {
    const after = snapshot({ cursor: { row: 1, col: 0 }, cursorGroupSize: 3 });
    expect(announcement(snapshot(), after, 'colorful')).toBe('Row 2, column 1, green, group of 3');
  });

  it('announces a new selection with its points', () => {
    const after = snapshot({ selection: select(GAME, { row: 1, col: 2 }) });
    expect(announcement(snapshot(), after, 'colorful')).toBe(
      '3 green balls selected, 6 points. Press Enter again to burst.',
    );
  });

  it('announces a selection that moved to another group', () => {
    const before = snapshot({ selection: select(GAME, { row: 0, col: 0 }) });
    const after = snapshot({ selection: select(GAME, { row: 1, col: 0 }) });
    expect(announcement(before, after, 'colorful')).toMatch(/^3 green balls selected/);
  });

  it('announces a cleared selection', () => {
    const before = snapshot({ selection: select(GAME, { row: 0, col: 0 }) });
    expect(announcement(before, snapshot(), 'colorful')).toBe('Selection cleared.');
  });

  it('announces a burst with the points gained and the new score', () => {
    const before = snapshot({
      game: { ...GAME, score: 1230 },
      selection: select(GAME, { row: 1, col: 0 }),
    });
    const result = burst(before.game, { row: 1, col: 0 })!;
    expect(announcement(before, snapshot({ game: result.game }), 'colorful')).toBe(
      '+6, score 1,236',
    );
  });

  it('announces a new game', () => {
    expect(announcement(snapshot(), snapshot({ gameId: 'game-2' }), 'colorful')).toBe('New game.');
  });

  it('stays silent when nothing changed', () => {
    expect(announcement(snapshot(), snapshot(), 'colorful')).toBeNull();
  });
});

describe('gameOverText', () => {
  it('reports the final score', () => {
    expect(gameOverText(1234)).toBe('Game over. No groups left. Score 1,234.');
  });
});
