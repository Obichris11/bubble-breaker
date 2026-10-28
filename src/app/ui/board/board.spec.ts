import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import { createFakePlatform, type FakePlatform } from '../../platform/testing/fakes';
import { GameStore } from '../../state/game.store';
import { KEYS, type GameRecord } from '../../state/persistence';
import { SettingsStore } from '../../state/settings.store';
import { recordFrom } from '../../state/testing/records';
import { GameBoard } from './board';

const CELL = 32;
// Ball ids are cell indexes: blue 118 above blue 129, red pair 130 + 131 to the right.
// Bursting the reds empties columns 9 and 10, so the blue pair falls (no move) and slides right.
const SLIDE = recordFrom(['........b..', '........brr'], { elapsedMs: 0 });

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
});
