import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { fireEvent, screen } from '@testing-library/angular';
import { createFakePlatform, type FakePlatform } from '../../platform/testing/fakes';
import { GameStore } from '../../state/game.store';
import { KEYS, type GameRecord } from '../../state/persistence';
import { recordFrom } from '../../state/testing/records';
import { GameScreen } from './game-screen';

// Restored with time on the clock, so it opens Paused (03-architecture "Persistence").
const STARTED = recordFrom(['........b..', '........brr']);
const FRESH = recordFrom(['........b..', '........brr'], { elapsedMs: 0 });

describe('GameScreen', () => {
  let platform: FakePlatform;

  const setup = async (saved: GameRecord, url = '/') => {
    platform = createFakePlatform();
    platform.storage.set(KEYS.game, saved);
    TestBed.configureTestingModule({
      providers: [
        ...platform.providers,
        provideRouter([
          { path: '', component: GameScreen },
          { path: 'statistics', children: [] },
        ]),
      ],
    });
    const harness = await RouterTestingHarness.create(url);
    return { harness, store: TestBed.inject(GameStore) };
  };

  const boardArea = () => screen.getByRole('application').closest('bb-board-area');

  it('shows the status strip above the board', async () => {
    await setup(FRESH);
    expect(screen.getByText('Score').nextElementSibling).toHaveTextContent('100');
    expect(screen.getByRole('application')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(boardArea()).not.toHaveAttribute('inert');
  });

  it('opens Paused over an inert board for a restored game, and Resume goes back to the board', async () => {
    const { store, harness } = await setup(STARTED);
    expect(screen.getByRole('dialog', { name: 'Paused' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Resume' })).toHaveFocus();
    expect(boardArea()).toHaveAttribute('inert');
    fireEvent.click(screen.getByRole('button', { name: 'Resume' }));
    await harness.fixture.whenStable();
    expect(store.paused()).toBe(false);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(boardArea()).not.toHaveAttribute('inert');
    expect(screen.getByRole('application')).toHaveFocus();
  });

  it('opens Paused when the page is hidden after the first tap', async () => {
    const { store, harness } = await setup(FRESH);
    store.tap({ row: 11, col: 9 });
    platform.visibility.hidden.set(true);
    await harness.fixture.whenStable();
    expect(store.paused()).toBe(true);
    expect(screen.getByRole('dialog', { name: 'Paused' })).toBeInTheDocument();
  });

  it('focuses the board when the player comes back from another screen', async () => {
    const { harness } = await setup(FRESH, '/statistics');
    await harness.navigateByUrl('/');
    expect(screen.getByRole('application')).toHaveFocus();
  });

  it('shows PWA notices above the board, under the Paused dialog', async () => {
    const { harness } = await setup(STARTED);
    platform.pwa.offlineReady.set(true);
    TestBed.tick();
    await harness.fixture.whenStable();
    const notice = screen.getByText('Ready to play offline.').closest('bb-pwa-notice')!;
    expect(notice.compareDocumentPosition(boardArea()!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(notice).toHaveAttribute('inert');
  });

  it.each([
    ['is dismissed', () => fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))],
    [
      'hides itself',
      () => {
        platform.clock.advance(4_000);
      },
    ],
  ])('gives focus back to the board when a focused notice %s', async (_, hide) => {
    const { harness } = await setup(FRESH);
    platform.pwa.offlineReady.set(true);
    TestBed.tick();
    await harness.fixture.whenStable();
    screen.getByRole('button', { name: 'Dismiss' }).focus();
    hide();
    await harness.fixture.whenStable();
    expect(screen.queryByText('Ready to play offline.')).toBeNull();
    expect(screen.getByRole('application')).toHaveFocus();
  });

  it('leaves focus alone on the first page load', async () => {
    await setup(FRESH);
    expect(screen.getByRole('application')).not.toHaveFocus();
  });
});
