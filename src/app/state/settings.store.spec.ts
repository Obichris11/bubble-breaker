import { TestBed } from '@angular/core/testing';
import { createFakePlatform, type FakePlatform } from '../platform/testing/fakes';
import { DEFAULT_SETTINGS, KEYS } from './persistence';
import { SettingsStore } from './settings.store';

describe('SettingsStore', () => {
  let platform: FakePlatform;

  const create = (): SettingsStore => {
    TestBed.configureTestingModule({ providers: platform.providers });
    return TestBed.inject(SettingsStore);
  };

  beforeEach(() => {
    platform = createFakePlatform();
  });

  it('starts with Colorful Breakers, no shape hints and sound on', () => {
    const settings = create();
    expect(settings.breakerSet()).toBe('colorful');
    expect(settings.shapeHints()).toBe(false);
    expect(settings.sound()).toBe(true);
    expect(settings.installDismissedAt()).toBeNull();
  });

  it('loads stored settings', () => {
    platform.storage.set(KEYS.settings, {
      breakerSet: 'greyscale',
      shapeHints: true,
      sound: false,
    });
    const settings = create();
    expect(settings.breakerSet()).toBe('greyscale');
    expect(settings.shapeHints()).toBe(true);
    expect(settings.sound()).toBe(false);
  });

  it('falls back to defaults for invalid stored settings', () => {
    platform.storage.set(KEYS.settings, { breakerSet: 'neon' });
    const settings = create();
    expect(settings.breakerSet()).toBe(DEFAULT_SETTINGS.breakerSet);
  });

  it('persists every change', () => {
    const settings = create();
    settings.setBreakerSet('greyscale');
    settings.setShapeHints(true);
    settings.setSound(false);
    settings.setInstallDismissedAt(1_700_000_000_000);
    expect(settings.breakerSet()).toBe('greyscale');
    expect(settings.shapeHints()).toBe(true);
    expect(settings.sound()).toBe(false);
    expect(settings.installDismissedAt()).toBe(1_700_000_000_000);
    expect(platform.storage.get(KEYS.settings)).toEqual({
      breakerSet: 'greyscale',
      shapeHints: true,
      sound: false,
      installDismissedAt: 1_700_000_000_000,
    });
  });
});
