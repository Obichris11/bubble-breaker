import { TestBed } from '@angular/core/testing';
import { fireEvent, render, screen } from '@testing-library/angular';
import { createFakePlatform, type FakePlatform } from '../../platform/testing/fakes';
import { GameStore } from '../../state/game.store';
import { KEYS, type GameRecord } from '../../state/persistence';
import { SettingsStore } from '../../state/settings.store';
import { recordFrom } from '../../state/testing/records';
import { Shell } from '../chrome/shell';
import { GameBoard } from './board';

const CELL = 32;
// Ball ids are cell indexes: blue 118 above blue 129, red pair 130 + 131 to the right.
// Bursting the reds empties columns 9 and 10, so the blue pair falls (no move) and slides right.
const SLIDE = recordFrom(['........b..', '........brr'], { elapsedMs: 0 });
// The last pair on the board: bursting it ends the game.
const LAST_PAIR = recordFrom(['.........rr'], { elapsedMs: 0 });

describe('GameBoard', () => {
  let platform: FakePlatform;

  const setup = async (saved: GameRecord = SLIDE) => {
    platform = createFakePlatform();
    platform.storage.set(KEYS.game, saved);
    const view = await render(GameBoard, {
      inputs: { cell: CELL },
      providers: platform.providers,
    });
    const board = screen.getByRole('application');
    // jsdom has no layout: put the board at the viewport origin.
    board.getBoundingClientRect = () => new DOMRect(0, 0, 11 * CELL, 12 * CELL);
    return {
      ...view,
      board,
      store: TestBed.inject(GameStore),
      settings: TestBed.inject(SettingsStore),
      ball: (id: number) => board.querySelector<HTMLElement>(`[data-ball="${String(id)}"]`),
      spots: () => [...board.querySelectorAll<HTMLElement>('.spot')].map((s) => s.style.transform),
      advance: (ms: number) => {
        platform.clock.advance(ms);
        view.fixture.detectChanges();
      },
    };
  };

  describe('view', () => {
    it('is one focusable application sized to whole cells', async () => {
      const { board } = await setup();
      expect(board).toHaveAttribute('tabindex', '0');
      expect(board).toHaveAccessibleName(/^Bubble Breaker board, 11 columns by 12 rows/);
      expect(board).toHaveStyle({ width: '352px', height: '384px' });
    });

    it('draws each ball in its cell with the Colorful look, in id order', async () => {
      const { board, ball } = await setup();
      const ids = [...board.querySelectorAll('[data-ball]')].map((el) =>
        el.getAttribute('data-ball'),
      );
      expect(ids).toEqual(['118', '129', '130', '131']);
      expect(ball(118)!.style.transform).toBe('translate(256px, 320px)');
      expect(ball(130)!.firstElementChild).toHaveClass('bb-ball', 'bb-ball--red');
      expect(ball(129)!.firstElementChild).toHaveClass('bb-ball', 'bb-ball--blue');
    });

    it('switches to the Greyscale look and shows shape hints only on Colorful', async () => {
      const { ball, settings, fixture, board } = await setup();
      settings.setShapeHints(true);
      fixture.detectChanges();
      expect(ball(130)).toHaveTextContent('▲');
      settings.setBreakerSet('greyscale');
      fixture.detectChanges();
      expect(ball(130)!.firstElementChild).toHaveClass('bb-ball', 'bb-ball--g1');
      expect(ball(130)).toHaveTextContent('');
      expect(board).toHaveClass('board--grey');
    });

    it('highlights the selected group and shows its points above the tapped ball', async () => {
      const { store, fixture, spots } = await setup();
      store.tap({ row: 11, col: 9 });
      fixture.detectChanges();
      expect(spots()).toEqual(['translate(288px, 352px)', 'translate(320px, 352px)']);
      const bubble = screen.getByText('2 points');
      expect(bubble).toHaveStyle({ left: '304px', top: '350px' });
    });
  });

  describe('burst animation', () => {
    it('pops on the old board, then falls and slides with the same ball nodes', async () => {
      const { store, fixture, board, ball, spots, advance } = await setup();
      const blue = ball(129);
      store.tap({ row: 11, col: 9 });
      store.tap({ row: 11, col: 9 });
      fixture.detectChanges();
      expect(ball(130)).toHaveClass('cell--popping');
      expect(ball(129)).not.toHaveClass('cell--popping');
      expect(spots()).toHaveLength(2);
      expect(screen.queryByText('2 points')).toBeNull();

      advance(160);
      expect(board).toHaveClass('board--fall');
      expect(ball(130)).toBeNull();
      expect(spots()).toEqual([]);

      advance(240);
      expect(board).toHaveClass('board--slide');
      expect(ball(129)!.style.transform).toBe('translate(320px, 352px)');
      expect(ball(129)).toBe(blue);

      advance(200);
      expect(board).not.toHaveClass('board--slide');
    });

    it('keeps the node of every remaining ball when lower ids leave', async () => {
      const { store, fixture, ball, advance } = await setup();
      const red = ball(130);
      store.tap({ row: 11, col: 8 });
      store.tap({ row: 11, col: 8 });
      fixture.detectChanges();
      advance(160);
      expect(ball(118)).toBeNull();
      expect(ball(130)).toBe(red);
    });
  });

  describe('pointer', () => {
    it('maps a click to the cell under it: select, then burst', async () => {
      const { board, store, fixture } = await setup();
      fireEvent.click(board, { clientX: 9 * CELL + 5, clientY: 11 * CELL + 5 });
      fixture.detectChanges();
      expect(store.selection()?.anchor).toEqual({ row: 11, col: 9 });
      fireEvent.click(board, { clientX: 10 * CELL + 31, clientY: 11 * CELL + 31 });
      expect(store.phase()).toBe('pop');
    });

    it('clears the selection on an empty cell', async () => {
      const { board, store } = await setup();
      fireEvent.click(board, { clientX: 9 * CELL + 5, clientY: 11 * CELL + 5 });
      expect(store.selection()).not.toBeNull();
      fireEvent.click(board, { clientX: 5, clientY: 5 });
      expect(store.selection()).toBeNull();
    });
  });

  describe('keyboard', () => {
    const press = (board: HTMLElement, key: string, init: KeyboardEventInit = {}) =>
      fireEvent.keyDown(board, { key, ...init });

    it('shows the focus ring on keyboard focus and moves it with the cursor', async () => {
      const { board, fixture } = await setup();
      board.focus();
      fixture.detectChanges();
      expect(screen.getByTestId('focus-ring').style.transform).toBe('translate(160px, 352px)');
      press(board, 'ArrowUp');
      press(board, 'ArrowRight');
      fixture.detectChanges();
      expect(screen.getByTestId('focus-ring').style.transform).toBe('translate(192px, 320px)');
      expect(screen.getByRole('status')).toHaveTextContent('Row 11, column 7, empty');
    });

    it('hides the ring for pointer focus and on blur', async () => {
      const { board, fixture } = await setup();
      fireEvent.pointerDown(board);
      board.focus();
      fixture.detectChanges();
      expect(screen.queryByTestId('focus-ring')).toBeNull();
      press(board, 'ArrowUp');
      fixture.detectChanges();
      expect(screen.getByTestId('focus-ring')).toBeInTheDocument();
      board.blur();
      fixture.detectChanges();
      expect(screen.queryByTestId('focus-ring')).toBeNull();
    });

    it('selects and bursts with Enter or Space, and announces both', async () => {
      const { board, store, fixture } = await setup();
      for (let i = 0; i < 4; i++) press(board, 'ArrowRight');
      fixture.detectChanges();
      expect(screen.getByRole('status')).toHaveTextContent('Row 12, column 10, red, group of 2');
      press(board, 'Enter');
      fixture.detectChanges();
      expect(screen.getByRole('status')).toHaveTextContent(
        '2 red balls selected, 2 points. Press Enter again to burst.',
      );
      press(board, ' ');
      fixture.detectChanges();
      expect(store.phase()).toBe('pop');
      expect(screen.getByRole('status')).toHaveTextContent('+2, score 102');
    });

    it('clears the selection with Escape', async () => {
      const { board, store, fixture } = await setup();
      store.tap({ row: 11, col: 9 });
      press(board, 'Escape');
      fixture.detectChanges();
      expect(store.selection()).toBeNull();
      expect(screen.getByRole('status')).toHaveTextContent('Selection cleared.');
    });

    it('starts a new game with N, but not with a modifier', async () => {
      const { board, store, fixture } = await setup();
      press(board, 'n', { ctrlKey: true });
      expect(store.gameId()).toBe('saved-game');
      press(board, 'N');
      fixture.detectChanges();
      expect(store.gameId()).not.toBe('saved-game');
      expect(screen.getByRole('status')).toHaveTextContent('New game.');
    });

    it('opens and closes the menu with M, then gives focus back to the board', async () => {
      const { board } = await setup();
      const shell = TestBed.inject(Shell);
      board.focus();
      press(board, 'm', { altKey: true });
      expect(shell.menuOpen()).toBe(false);
      press(board, 'M');
      expect(shell.menuOpen()).toBe(true);
      board.blur();
      press(board, 'm');
      expect(shell.menuOpen()).toBe(false);
      expect(board).toHaveFocus();
    });

    it('leaves other keys alone', async () => {
      const { board } = await setup();
      expect(press(board, 'Tab')).toBe(true);
      expect(press(board, 'ArrowDown')).toBe(false);
    });
  });

  it('announces a new game dealt from outside the board (softkey or menu)', async () => {
    const { store, fixture } = await setup();
    store.newGame(3);
    fixture.detectChanges();
    expect(screen.getByRole('status')).toHaveTextContent('New game.');
  });

  it('announces game over', async () => {
    const { store, advance } = await setup(LAST_PAIR);
    store.tap({ row: 11, col: 9 });
    store.tap({ row: 11, col: 9 });
    advance(400);
    expect(store.phase()).toBe('over');
    expect(screen.getByRole('status')).toHaveTextContent('Game over. No groups left. Score 102.');
  });
});
