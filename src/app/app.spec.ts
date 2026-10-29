import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { fireEvent, render, screen } from '@testing-library/angular';
import { App } from './app';
import { routes } from './app.routes';
import { createFakePlatform, type FakePlatform } from './platform/testing/fakes';
import { GameStore } from './state/game.store';
import { KEYS, type GameRecord } from './state/persistence';
import { recordFrom } from './state/testing/records';
import { STRINGS } from './strings';

// Not started (no time yet), so no Paused dialog. Bursting the red pair of LAST_PAIR ends the game.
const FRESH = recordFrom(['........b..', '........brr'], { elapsedMs: 0 });
const LAST_PAIR = recordFrom(['.........rr'], { elapsedMs: 0 });

describe('App shell', () => {
  let platform: FakePlatform;

  const setup = async (saved: GameRecord = FRESH, url = '/') => {
    platform = createFakePlatform();
    platform.storage.set(KEYS.game, saved);
    const view = await render(App, { providers: [...platform.providers, provideRouter(routes)] });
    const router = TestBed.inject(Router);
    await router.navigateByUrl(url);
    await view.fixture.whenStable();
    return { ...view, router, store: TestBed.inject(GameStore) };
  };

  const button = (name: string) => screen.getByRole('button', { name });

  /** Opens the menu with the Menu softkey and picks an item. */
  const choose = async (fixture: { whenStable(): Promise<unknown> }, item: string) => {
    fireEvent.click(button('Menu'));
    await fixture.whenStable();
    fireEvent.click(screen.getByRole('menuitem', { name: item }));
    await fixture.whenStable();
  };

  it('uses "Bubble Breaker" as the app title', () => {
    expect(STRINGS.appTitle).toBe('Bubble Breaker');
  });

  it('shows the title bar, the game screen in the main area and the softkeys', async () => {
    await setup();
    expect(screen.getByRole('banner')).toHaveTextContent('Bubble Breaker');
    expect(screen.getByRole('main')).toContainElement(screen.getByRole('application'));
    expect(screen.getByText('Score')).toBeInTheDocument();
    expect(button('New Game')).toBeInTheDocument();
    expect(button('Menu')).toHaveAttribute('aria-expanded', 'false');
    expect(document.title).toBe('Bubble Breaker');
    expect(screen.getByText(STRINGS.keyHint)).toHaveAttribute('aria-hidden', 'true');
  });

  it('deals a new game with the New Game softkey', async () => {
    const { store } = await setup();
    fireEvent.click(button('New Game'));
    expect(store.gameId()).not.toBe('saved-game');
  });

  it('opens the menu over the game and stops the timer while it is open', async () => {
    const { store, fixture } = await setup();
    fireEvent.click(button('Menu'));
    await fixture.whenStable();
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent.trim())).toEqual([
      'New Game',
      'Statistics',
      'Options',
      'How to Play',
      'About',
    ]);
    expect(screen.getByRole('menuitem', { name: 'New Game' })).toHaveFocus();
    expect(button('Menu')).toHaveAttribute('aria-expanded', 'true');
    expect(store.covered()).toBe(true);
  });

  it('closes the menu with Escape and gives focus back to the Menu softkey', async () => {
    const { store, fixture } = await setup();
    fireEvent.click(button('Menu'));
    await fixture.whenStable();
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    await fixture.whenStable();
    expect(screen.queryByRole('menu')).toBeNull();
    expect(button('Menu')).toHaveFocus();
    expect(store.covered()).toBe(false);
  });

  it('opens a screen from the menu; Done goes back to the board', async () => {
    const { router, store, fixture } = await setup();
    await choose(fixture, 'Statistics');
    expect(router.url).toBe('/statistics');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Statistics' })).toHaveFocus();
    expect(document.title).toBe('Statistics – Bubble Breaker');
    expect(store.covered()).toBe(true);
    fireEvent.click(button('Done'));
    await fixture.whenStable();
    expect(router.url).toBe('/');
    expect(screen.getByRole('application')).toHaveFocus();
    expect(store.covered()).toBe(false);
  });

  it.each([
    ['Options', '/options'],
    ['How to Play', '/how-to-play'],
    ['About', '/about'],
  ])('opens %s from the menu', async (item, url) => {
    const { router, fixture } = await setup();
    await choose(fixture, item);
    expect(router.url).toBe(url);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(item);
  });

  it('deals a new game from the menu on another screen and shows the board', async () => {
    const { router, store, fixture } = await setup(FRESH, '/about');
    await choose(fixture, 'New Game');
    expect(router.url).toBe('/');
    expect(store.gameId()).not.toBe('saved-game');
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('opens Scoring by itself after game over (rule R16)', async () => {
    const { router, store, fixture } = await setup(LAST_PAIR);
    store.tap({ row: 11, col: 9 });
    store.tap({ row: 11, col: 9 });
    platform.clock.advance(1000);
    await fixture.whenStable();
    expect(router.url).toBe('/scoring');
    expect(screen.getByRole('heading', { name: 'Game over' })).toHaveFocus();
    expect(button('Done')).toBeInTheDocument();
  });

  it.each(['/scoring', '/no-such-screen'])('sends %s to the game screen', async (url) => {
    const { router } = await setup(FRESH, url);
    expect(router.url).toBe('/');
  });
});
