import { TestBed } from '@angular/core/testing';
import { createFakePlatform, FakeClock, type FakePlatform } from '../platform/testing/fakes';
import { GameStore } from './game.store';
import { DEFAULT_SETTINGS, DEFAULT_STATS, KEYS, type GameRecord } from './persistence';
import { INSTALL_SNOOZE_MS, OFFLINE_NOTICE_MS, PwaStore } from './pwa.store';
import { SettingsStore } from './settings.store';
import { StatsStore } from './stats.store';
import { recordFrom } from './testing/records';

const DAY = 24 * 60 * 60 * 1_000;

describe('PwaStore', () => {
  let platform: FakePlatform;

  const create = () => {
    TestBed.configureTestingModule({ providers: platform.providers });
    const store = TestBed.inject(PwaStore);
    TestBed.tick();
    return store;
  };
  /** The player has finished a game before (the install notice needs one). */
  const finishedOneGame = () => {
    platform.storage.set(KEYS.stats, { ...DEFAULT_STATS, played: 1 });
  };

  beforeEach(() => {
    platform = createFakePlatform();
  });

  it('shows no notice by default', () => {
    expect(create().notice()).toBeNull();
  });

  describe('update', () => {
    it('shows "New version" until the player dismisses it', () => {
      const store = create();
      platform.pwa.updateAvailable.set(true);
      expect(store.notice()).toBe('update');
      store.dismiss();
      expect(store.notice()).toBeNull();
      expect(platform.pwa.reloads).toBe(0);
    });

    it('saves the game before it reloads', () => {
      platform.storage.set(KEYS.game, recordFrom(['........brr'], { elapsedMs: 0 }));
      const store = create();
      const game = TestBed.inject(GameStore);
      game.tap({ row: 11, col: 9 });
      platform.clock.advance(5_000);
      store.reload();
      expect(platform.storage.get(KEYS.game)).toMatchObject({ elapsedMs: 5_000 });
      expect(platform.pwa.reloads).toBe(1);
    });

    it('comes before offline ready and install', () => {
      finishedOneGame();
      const store = create();
      platform.pwa.installAvailable.set(true);
      platform.pwa.offlineReady.set(true);
      platform.pwa.updateAvailable.set(true);
      TestBed.tick();
      expect(store.notice()).toBe('update');
      store.dismiss();
      expect(store.notice()).toBe('offline');
      store.dismiss();
      expect(store.notice()).toBe('install');
    });

    it('checks for a new version when the page comes back', () => {
      create();
      expect(platform.pwa.updateChecks).toBe(0);
      platform.visibility.hidden.set(true);
      TestBed.tick();
      expect(platform.pwa.updateChecks).toBe(0);
      platform.visibility.hidden.set(false);
      TestBed.tick();
      expect(platform.pwa.updateChecks).toBe(1);
    });

    it('saves and reloads when the service worker is unrecoverable', () => {
      const saved: GameRecord = recordFrom(['........brr'], { elapsedMs: 0 });
      platform.storage.set(KEYS.game, saved);
      create();
      platform.storage.remove(KEYS.game);
      platform.pwa.unrecoverable.set(true);
      TestBed.tick();
      expect(platform.storage.get(KEYS.game)).toMatchObject({ gameId: saved.gameId });
      expect(platform.pwa.reloads).toBe(1);
    });
  });

  describe('offline ready', () => {
    it('shows once and hides itself after 4 seconds', () => {
      const store = create();
      platform.pwa.offlineReady.set(true);
      TestBed.tick();
      expect(store.notice()).toBe('offline');
      platform.clock.advance(OFFLINE_NOTICE_MS - 1);
      expect(store.notice()).toBe('offline');
      platform.clock.advance(1);
      expect(store.notice()).toBeNull();
    });

    it('hides at once when dismissed', () => {
      const store = create();
      platform.pwa.offlineReady.set(true);
      TestBed.tick();
      store.dismiss();
      expect(store.notice()).toBeNull();
      expect(platform.clock.pending).toBe(0);
    });
  });

  describe('install', () => {
    it('waits for the first finished game', () => {
      const store = create();
      platform.pwa.installAvailable.set(true);
      expect(store.notice()).toBeNull();
      TestBed.inject(StatsStore).recordFinished('game-1', 120, 60_000);
      expect(store.notice()).toBe('install');
    });

    it('needs the browser to offer installation', () => {
      finishedOneGame();
      const store = create();
      expect(store.notice()).toBeNull();
      platform.pwa.installAvailable.set(true);
      expect(store.notice()).toBe('install');
    });

    it('shows the browser prompt on Install', async () => {
      finishedOneGame();
      const store = create();
      platform.pwa.installAvailable.set(true);
      store.install();
      await Promise.resolve();
      expect(platform.pwa.installs).toBe(1);
      expect(store.notice()).toBeNull();
      expect(TestBed.inject(SettingsStore).installDismissedAt()).toBeNull();
    });

    it('treats a declined browser prompt like Not now', async () => {
      finishedOneGame();
      platform.pwa.installAccepted = false;
      const store = create();
      platform.pwa.installAvailable.set(true);
      store.install();
      await Promise.resolve();
      expect(TestBed.inject(SettingsStore).installDismissedAt()).toBe(FakeClock.EPOCH);
    });

    it('stays away for 30 days after Not now', () => {
      finishedOneGame();
      const store = create();
      platform.pwa.installAvailable.set(true);
      store.notNow();
      expect(store.notice()).toBeNull();
      expect(platform.storage.get(KEYS.settings)).toMatchObject({
        installDismissedAt: FakeClock.EPOCH,
      });
    });

    it.each([
      [29, null],
      [30, 'install'],
    ])('after Not now %i days ago shows %s', (days, notice) => {
      finishedOneGame();
      platform.storage.set(KEYS.settings, {
        ...DEFAULT_SETTINGS,
        installDismissedAt: FakeClock.EPOCH - days * DAY,
      });
      const store = create();
      platform.pwa.installAvailable.set(true);
      expect(store.notice()).toBe(notice);
      expect(INSTALL_SNOOZE_MS).toBe(30 * DAY);
    });
  });
});
