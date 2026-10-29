import { TestBed } from '@angular/core/testing';
import { fireEvent, render, screen } from '@testing-library/angular';
import { createFakePlatform, FakeClock, type FakePlatform } from '../../platform/testing/fakes';
import { DEFAULT_STATS, KEYS } from '../../state/persistence';
import { PwaNotice } from './pwa-notice';

describe('PwaNotice', () => {
  let platform: FakePlatform;

  const setup = async () => {
    platform = createFakePlatform();
    platform.storage.set(KEYS.stats, { ...DEFAULT_STATS, played: 1 });
    const { fixture } = await render(PwaNotice, { providers: platform.providers });
    const show = (change: () => void) => {
      change();
      TestBed.tick();
      fixture.detectChanges();
    };
    return { show };
  };

  it('shows nothing while there is no notice', async () => {
    await setup();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('offers Reload for a new version, or dismisses it', async () => {
    const { show } = await setup();
    show(() => {
      platform.pwa.updateAvailable.set(true);
    });
    expect(screen.getByRole('status')).toHaveTextContent(
      'New version available. Reload to update. Your game and statistics are kept.',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
    expect(platform.pwa.reloads).toBe(1);
    show(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    });
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('tells the player the game works offline', async () => {
    const { show } = await setup();
    show(() => {
      platform.pwa.offlineReady.set(true);
    });
    expect(screen.getByRole('status')).toHaveTextContent(
      'Ready to play offline. The game now works without a connection.',
    );
    show(() => {
      platform.clock.advance(4_000);
    });
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('offers to install, with Not now', async () => {
    const { show } = await setup();
    show(() => {
      platform.pwa.installAvailable.set(true);
    });
    expect(screen.getByRole('status')).toHaveTextContent(
      'Install Bubble Breaker Add it to your home screen to play full screen and offline.',
    );
    show(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
    });
    expect(screen.queryByRole('status')).toBeNull();
    expect(platform.storage.get(KEYS.settings)).toMatchObject({
      installDismissedAt: FakeClock.EPOCH,
    });
  });

  it('opens the browser prompt on Install', async () => {
    const { show } = await setup();
    show(() => {
      platform.pwa.installAvailable.set(true);
    });
    show(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Install' }));
    });
    expect(platform.pwa.installs).toBe(1);
    expect(screen.queryByRole('status')).toBeNull();
  });
});
