import { TestBed } from '@angular/core/testing';
import { allGroups, ballAt, groupAt, newGame, scoreFor, type Cell, type Game } from '../engine';
import { createFakePlatform, type FakePlatform } from '../platform/testing/fakes';
import { GameStore } from './game.store';
import { KEYS, type GameRecord } from './persistence';
import { SettingsStore } from './settings.store';
import { StatsStore } from './stats.store';
import { recordFrom } from './testing/records';

// Bottom of the board: a vertical blue pair at column 8 and a red pair to its right.
// Bursting the reds empties columns 9 and 10, so the blues slide right; the game goes on.
const SLIDE = recordFrom(['........b..', '........brr']);
// Only one red pair: bursting it clears the board (game over).
const LAST_PAIR = recordFrom(['.........rr']);
// Two lone balls: a saved game without moves.
const NO_MOVES = recordFrom(['.........rb']);

function firstGroup(game: Game): readonly Cell[] {
  return allGroups(game)[0]!;
}

function loneCell(game: Game): Cell {
  for (let row = 0; row < game.board.rows; row++) {
    for (let col = 0; col < game.board.columns; col++) {
      const cell = { row, col };
      if (ballAt(game.board, cell) !== null && groupAt(game, cell).length === 0) {
        return cell;
      }
    }
  }
  throw new Error('no lone ball on this board');
}

describe('GameStore', () => {
  let platform: FakePlatform;

  const start = (saved?: GameRecord): GameStore => {
    if (saved !== undefined) {
      platform.storage.set(KEYS.game, saved);
    }
    TestBed.configureTestingModule({ providers: platform.providers });
    return TestBed.inject(GameStore);
  };

  /** Simulates a page reload: new injector, same storage and clock. */
  const reload = (): GameStore => {
    TestBed.resetTestingModule();
    return start();
  };

  const stored = (): unknown => platform.storage.get(KEYS.game);

  /** Resumes a restored SLIDE or LAST_PAIR game and bursts its bottom-right red pair. */
  const burstRedPair = (store: GameStore): void => {
    store.resume();
    store.tap({ row: 11, col: 9 });
    store.tap({ row: 11, col: 9 });
  };

  beforeEach(() => {
    platform = createFakePlatform();
  });

  describe('start-up', () => {
    it('deals a new game when nothing is saved, and saves it at once', () => {
      const store = start();
      expect(store.game().board.cells).toHaveLength(132);
      expect(store.game().score).toBe(0);
      expect(store.phase()).toBe('idle');
      expect(store.paused()).toBe(false);
      expect(store.gameId()).toMatch(/^[0-9a-f-]{36}$/);
      expect(stored()).toMatchObject({ gameId: store.gameId(), seed: store.game().seed });
    });

    it('restores a saved game in the Paused state', () => {
      const store = start(SLIDE);
      expect(store.gameId()).toBe('saved-game');
      expect(store.game().score).toBe(100);
      expect(store.game().board.cells).toEqual(SLIDE.cells);
      expect(store.paused()).toBe(true);
      expect(store.elapsedMs()).toBe(65_000);
      expect(store.timeText()).toBe('‖ 1:05');
      platform.clock.advance(5000);
      expect(store.elapsedMs()).toBe(65_000);
    });

    it('restores a save whose timer never started as not paused, until a tap starts it', () => {
      const store = start(recordFrom(['........b..', '........brr'], { elapsedMs: 0 }));
      expect(store.gameId()).toBe('saved-game');
      expect(store.paused()).toBe(false);
      expect(store.canInteract()).toBe(true);
      expect(store.timeText()).toBe('0:00');
      platform.clock.advance(5000);
      expect(store.elapsedMs()).toBe(0);
      store.tap({ row: 0, col: 0 });
      platform.clock.advance(5000);
      expect(store.elapsedMs()).toBe(0);
      store.tap({ row: 11, col: 9 });
      platform.clock.advance(1000);
      expect(store.elapsedMs()).toBe(1000);
    });

    it('deals a new game when the saved game has no moves left', () => {
      const store = start(NO_MOVES);
      expect(store.gameId()).not.toBe('saved-game');
      expect(store.paused()).toBe(false);
    });

    it('deals a new game when the save is corrupt', () => {
      platform.storage.data.set(KEYS.game, '{"gameId":');
      const store = start();
      expect(store.game().score).toBe(0);
      expect(store.paused()).toBe(false);
    });
  });

  describe('newGame', () => {
    it('deals the given seed with a fresh game id', () => {
      const store = start();
      const firstId = store.gameId();
      store.newGame(1);
      expect(store.game()).toEqual(newGame(1));
      expect(store.gameId()).not.toBe(firstId);
      expect(stored()).toMatchObject({ gameId: store.gameId(), seed: 1, score: 0, elapsedMs: 0 });
    });

    it('resets selection, cursor, pause and time', () => {
      const store = start(SLIDE);
      store.resume();
      store.moveCursor('down');
      platform.clock.advance(3000);
      store.newGame(1);
      expect(store.selection()).toBeNull();
      expect(store.cursor()).toEqual({ row: 0, col: 0 });
      expect(store.paused()).toBe(false);
      expect(store.elapsedMs()).toBe(0);
      platform.clock.advance(1000);
      expect(store.elapsedMs()).toBe(0);
      store.tap(firstGroup(store.game())[0]!);
      platform.clock.advance(1000);
      expect(store.elapsedMs()).toBe(1000);
    });
  });

  describe('tap (rules R8/R9)', () => {
    let store: GameStore;

    beforeEach(() => {
      store = start();
      store.newGame(1);
    });

    it('selects a group, anchors it on the tapped cell and shows its points', () => {
      const group = firstGroup(store.game());
      const cell = group[0]!;
      store.tap(cell);
      expect(store.selection()).toEqual({ cells: groupAt(store.game(), cell), anchor: cell });
      expect(store.selectedPoints()).toBe(scoreFor(group.length));
      expect(store.selectedText()).toBe(String(scoreFor(group.length)));
      expect(platform.audio.played).toEqual(['select']);
    });

    it('moves the selection to another group', () => {
      const [first, second] = allGroups(store.game());
      store.tap(first![0]!);
      store.tap(second![0]!);
      expect(store.selection()?.anchor).toEqual(second![0]);
    });

    it('clears the selection on a lone ball or a cell off the board', () => {
      const cell = firstGroup(store.game())[0]!;
      store.tap(cell);
      store.tap(loneCell(store.game()));
      expect(store.selection()).toBeNull();
      expect(store.selectedText()).toBe('–');
      expect(store.selectedPoints()).toBe(0);
      store.tap(cell);
      store.tap({ row: -1, col: 3 });
      expect(store.selection()).toBeNull();
    });

    it('bursts when any cell of the selected group is tapped again', () => {
      const group = firstGroup(store.game());
      store.tap(group[0]!);
      store.tap(group[group.length - 1]!);
      expect(store.phase()).toBe('pop');
      expect(store.selection()).toBeNull();
      expect(store.game().score).toBe(scoreFor(group.length));
      expect(store.scoreText()).toBe(String(scoreFor(group.length)));
      expect(store.popping().size).toBe(group.length);
      expect(platform.audio.played).toEqual(['select', 'pop']);
    });
  });

  describe('burst animation', () => {
    let store: GameStore;

    beforeEach(() => {
      store = start(SLIDE);
      burstRedPair(store);
    });

    it('steps pop → fall → slide → idle while positions lag the engine board', () => {
      expect(store.phase()).toBe('pop');
      expect(store.game().score).toBe(102);
      expect(store.positions().get(130)).toEqual({ row: 11, col: 9 });
      expect(store.popping()).toEqual(new Set([130, 131]));
      platform.clock.advance(160);
      expect(store.phase()).toBe('fall');
      expect(store.positions().has(130)).toBe(false);
      expect(store.positions().get(129)).toEqual({ row: 11, col: 8 });
      platform.clock.advance(240);
      expect(store.phase()).toBe('slide');
      expect(store.positions().get(129)).toEqual({ row: 11, col: 10 });
      platform.clock.advance(200);
      expect(store.phase()).toBe('idle');
      expect(store.canInteract()).toBe(true);
    });

    it('ignores taps while the animation runs', () => {
      expect(store.canInteract()).toBe(false);
      store.tap({ row: 11, col: 8 });
      expect(store.selection()).toBeNull();
    });

    it('saves the final game once the animation settles', () => {
      platform.clock.advance(599);
      expect(stored()).toMatchObject({ score: 100 });
      platform.clock.advance(1);
      expect(stored()).toMatchObject({ gameId: 'saved-game', score: 102, elapsedMs: 65_600 });
    });

    it('a new game cancels the running animation', () => {
      store.newGame(1);
      platform.clock.advance(1000);
      expect(store.phase()).toBe('idle');
      expect(store.positions().size).toBe(132);
    });
  });

  describe('game over (rules R13, R16, R17)', () => {
    let store: GameStore;

    beforeEach(() => {
      store = start(LAST_PAIR);
      burstRedPair(store);
    });

    it('enters "over" after pop and fall, records statistics and drops the save', () => {
      platform.clock.advance(399);
      expect(TestBed.inject(StatsStore).played()).toBe(0);
      platform.clock.advance(1);
      expect(store.phase()).toBe('over');
      const stats = TestBed.inject(StatsStore);
      expect(stats.played()).toBe(1);
      expect(stats.last()).toEqual({ score: 102, timeMs: 65_400 });
      expect(stored()).toBeUndefined();
      expect(platform.audio.played).toEqual(['select', 'pop', 'gameOver']);
    });

    it('stops the timer at game over', () => {
      platform.clock.advance(400);
      platform.clock.advance(10_000);
      expect(store.elapsedMs()).toBe(65_400);
    });

    it('holds the board for 500 ms, then asks for the Scoring screen', () => {
      platform.clock.advance(400);
      expect(store.showScoring()).toBe(false);
      platform.clock.advance(499);
      expect(store.showScoring()).toBe(false);
      platform.clock.advance(1);
      expect(store.showScoring()).toBe(true);
    });

    it('clears Paused when the page was hidden during the final burst', () => {
      platform.clock.advance(100);
      store.pause();
      expect(store.paused()).toBe(true);
      platform.clock.advance(300);
      expect(store.phase()).toBe('over');
      expect(store.paused()).toBe(false);
      expect(store.timeText()).toBe('1:05');
      platform.clock.advance(500);
      expect(store.showScoring()).toBe(true);
    });

    it('ignores pause and save after game over', () => {
      platform.clock.advance(400);
      store.pause();
      store.save();
      expect(store.paused()).toBe(false);
      expect(stored()).toBeUndefined();
    });

    it('starts a new game after a reload at game over, without counting twice', () => {
      platform.clock.advance(400);
      const reloaded = reload();
      expect(reloaded.paused()).toBe(false);
      expect(reloaded.gameId()).not.toBe('saved-game');
      expect(TestBed.inject(StatsStore).played()).toBe(1);
    });

    it('counts a replayed game once even if the save could not be cleared', () => {
      platform.clock.advance(900);
      platform.storage.set(KEYS.game, LAST_PAIR);
      store = reload();
      burstRedPair(store);
      platform.clock.advance(900);
      expect(store.phase()).toBe('over');
      expect(TestBed.inject(StatsStore).played()).toBe(1);
    });
  });

  describe('timer, pause and cover (rule R19)', () => {
    let store: GameStore;

    beforeEach(() => {
      store = start();
      store.newGame(1);
      store.tap(firstGroup(store.game())[0]!);
      store.clearSelection();
    });

    it('does not run before the first tap', () => {
      store.newGame(1);
      platform.clock.advance(61_000);
      expect(store.timeText()).toBe('0:00');
    });

    it('starts on the first tap and shows m:ss', () => {
      platform.clock.advance(61_000);
      expect(store.timeText()).toBe('1:01');
    });

    it('ignores pause and a hidden page before the first tap', () => {
      store.newGame(1);
      store.pause();
      expect(store.paused()).toBe(false);
      platform.visibility.hidden.set(true);
      TestBed.tick();
      expect(store.paused()).toBe(false);
      expect(store.canInteract()).toBe(true);
    });

    it('pause stops the timer, saves and blocks taps until resume', () => {
      platform.clock.advance(2000);
      store.pause();
      expect(store.paused()).toBe(true);
      expect(stored()).toMatchObject({ elapsedMs: 2000 });
      platform.clock.advance(5000);
      expect(store.timeText()).toBe('‖ 0:02');
      store.tap(firstGroup(store.game())[0]!);
      expect(store.selection()).toBeNull();
      store.resume();
      store.resume();
      platform.clock.advance(1000);
      expect(store.elapsedMs()).toBe(3000);
    });

    it('pauses when the page is hidden and stays paused when it is visible again', () => {
      platform.clock.advance(1000);
      platform.visibility.hidden.set(true);
      TestBed.tick();
      expect(store.paused()).toBe(true);
      expect(stored()).toMatchObject({ elapsedMs: 1000 });
      platform.visibility.hidden.set(false);
      TestBed.tick();
      expect(store.paused()).toBe(true);
    });

    it('stops the timer while covered, without the Paused state', () => {
      platform.clock.advance(1000);
      store.setCovered(true);
      store.setCovered(true);
      expect(store.covered()).toBe(true);
      expect(store.paused()).toBe(false);
      expect(stored()).toMatchObject({ elapsedMs: 1000 });
      platform.clock.advance(5000);
      expect(store.timeText()).toBe('‖ 0:01');
      store.setCovered(false);
      platform.clock.advance(1000);
      expect(store.timeText()).toBe('0:02');
    });

    it('keeps the timer stopped when the cover closes while paused', () => {
      store.setCovered(true);
      store.pause();
      store.setCovered(false);
      platform.clock.advance(5000);
      expect(store.elapsedMs()).toBe(0);
    });
  });

  describe('keyboard', () => {
    let store: GameStore;

    beforeEach(() => {
      store = start();
      store.newGame(1);
    });

    it('moves the cursor without wrapping', () => {
      expect(store.cursor()).toEqual({ row: 0, col: 0 });
      store.moveCursor('up');
      store.moveCursor('left');
      expect(store.cursor()).toEqual({ row: 0, col: 0 });
      store.moveCursor('down');
      store.moveCursor('right');
      expect(store.cursor()).toEqual({ row: 1, col: 1 });
      for (let i = 0; i < 20; i++) {
        store.moveCursor('down');
        store.moveCursor('right');
      }
      expect(store.cursor()).toEqual({ row: 11, col: 10 });
    });

    it('activates the cursor cell like a tap, and Esc clears the selection', () => {
      const cell = firstGroup(store.game())[0]!;
      for (let i = 0; i < cell.row; i++) store.moveCursor('down');
      for (let i = 0; i < cell.col; i++) store.moveCursor('right');
      store.activateCursor();
      expect(store.selection()?.anchor).toEqual(cell);
      store.clearSelection();
      expect(store.selection()).toBeNull();
      store.activateCursor();
      store.activateCursor();
      expect(store.phase()).toBe('pop');
    });
  });

  describe('cursor group', () => {
    it('is the group under the cursor, or [] on an empty cell', () => {
      const store = start(SLIDE);
      expect(store.cursorGroup()).toEqual([]);
      for (let i = 0; i < 11; i++) store.moveCursor('down');
      for (let i = 0; i < 9; i++) store.moveCursor('right');
      expect(store.cursorGroup()).toEqual(groupAt(store.game(), { row: 11, col: 9 }));
      expect(store.cursorGroup()).toHaveLength(2);
    });
  });

  describe('sound', () => {
    it('plays nothing when sound is off', () => {
      const store = start();
      store.newGame(1);
      TestBed.inject(SettingsStore).setSound(false);
      const cell = firstGroup(store.game())[0]!;
      store.tap(cell);
      store.tap(cell);
      expect(platform.audio.played).toEqual([]);
    });
  });

  describe('reduced motion', () => {
    beforeEach(() => {
      platform.motion.reduced.set(true);
    });

    it('jumps to the end state after the 80 ms pop fade', () => {
      const store = start(SLIDE);
      burstRedPair(store);
      platform.clock.advance(79);
      expect(store.phase()).toBe('pop');
      platform.clock.advance(1);
      expect(store.phase()).toBe('idle');
      expect(store.positions().get(129)).toEqual({ row: 11, col: 10 });
    });

    it('opens Scoring without the game-over hold', () => {
      const store = start(LAST_PAIR);
      burstRedPair(store);
      platform.clock.advance(80);
      expect(store.phase()).toBe('over');
      expect(store.showScoring()).toBe(true);
    });
  });
});
