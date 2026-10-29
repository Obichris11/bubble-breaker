import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { createFakePlatform } from '../../platform/testing/fakes';
import { GameStore } from '../../state/game.store';
import { KEYS } from '../../state/persistence';
import { recordFrom } from '../../state/testing/records';
import { Shell } from './shell';

describe('Shell', () => {
  const setup = async () => {
    const platform = createFakePlatform();
    platform.storage.set(KEYS.game, recordFrom(['........b..', '........brr']));
    TestBed.configureTestingModule({
      providers: [
        ...platform.providers,
        provideRouter([
          { path: '', children: [] },
          { path: 'statistics', children: [] },
        ]),
      ],
    });
    const shell = TestBed.inject(Shell);
    const store = TestBed.inject(GameStore);
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/');
    TestBed.tick();
    store.resume();
    return { shell, store, router };
  };

  const button = (): HTMLButtonElement => {
    const element = document.createElement('button');
    document.body.append(element);
    return element;
  };

  afterEach(() => {
    document.body.replaceChildren();
  });

  it('covers the board while another screen shows', async () => {
    const { shell, store, router } = await setup();
    expect(shell.onGame()).toBe(true);
    expect(store.covered()).toBe(false);
    await router.navigateByUrl('/statistics');
    TestBed.tick();
    expect(shell.onGame()).toBe(false);
    expect(store.covered()).toBe(true);
    expect(store.timeText()).toBe('‖ 1:05');
    await router.navigateByUrl('/?seed=4');
    TestBed.tick();
    expect(shell.onGame()).toBe(true);
    expect(store.covered()).toBe(false);
  });

  it('covers the board while the menu is open and gives focus back on close', async () => {
    const { shell, store } = await setup();
    const menuKey = button();
    shell.toggleMenu(menuKey);
    TestBed.tick();
    expect(shell.menuOpen()).toBe(true);
    expect(store.covered()).toBe(true);
    shell.toggleMenu(menuKey);
    TestBed.tick();
    expect(shell.menuOpen()).toBe(false);
    expect(store.covered()).toBe(false);
    expect(menuKey).toHaveFocus();
  });

  it('keeps focus where it is when a menu choice changes the screen', async () => {
    const { shell } = await setup();
    const menuKey = button();
    const other = button();
    shell.openMenu(menuKey);
    other.focus();
    shell.closeMenu(false);
    expect(other).toHaveFocus();
    shell.closeMenu();
    expect(other).toHaveFocus();
  });

  it('counts open dialogs; each release counts once', async () => {
    const { shell, store } = await setup();
    const releaseFirst = shell.openDialog();
    const releaseSecond = shell.openDialog();
    releaseFirst();
    releaseFirst();
    TestBed.tick();
    expect(store.covered()).toBe(true);
    releaseSecond();
    TestBed.tick();
    expect(store.covered()).toBe(false);
  });
});
