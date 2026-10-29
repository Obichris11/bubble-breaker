import { TestBed } from '@angular/core/testing';
import { fireEvent, render, screen } from '@testing-library/angular';
import { createFakePlatform } from '../../platform/testing/fakes';
import { KEYS } from '../../state/persistence';
import { SettingsStore } from '../../state/settings.store';
import { OptionsScreen } from './options-screen';

describe('OptionsScreen', () => {
  const setup = async () => {
    const platform = createFakePlatform();
    const view = await render(OptionsScreen, { providers: platform.providers });
    return { ...view, platform, settings: TestBed.inject(SettingsStore) };
  };

  const hints = () => screen.getByRole('checkbox', { name: /^Shape hints on Colorful Breakers/ });

  it('shows the defaults: Colorful, shape hints off, sound on', async () => {
    await setup();
    expect(screen.getByRole('heading', { name: 'Options' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Breaker Set' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Colorful Breakers' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Greyscale Breakers' })).not.toBeChecked();
    expect(hints()).not.toBeChecked();
    expect(hints()).toBeEnabled();
    expect(hints()).toHaveAccessibleDescription(
      'Adds a small symbol to each color. Off by default.',
    );
    expect(screen.getByRole('checkbox', { name: 'Sound' })).toBeChecked();
  });

  it('previews each set with its five ball looks', async () => {
    const { fixture } = await setup();
    const previews = (fixture.nativeElement as HTMLElement).querySelectorAll('.preview');
    expect(previews[0]?.querySelectorAll('.bb-ball--red, .bb-ball--purple')).toHaveLength(2);
    expect(previews[1]?.querySelectorAll('.bb-ball')).toHaveLength(5);
    expect(previews[1]?.firstElementChild).toHaveClass('bb-ball--g1');
  });

  it('switches to Greyscale, persists it and disables the shape hints', async () => {
    const { settings, platform, fixture } = await setup();
    fireEvent.click(screen.getByRole('radio', { name: 'Greyscale Breakers' }));
    fixture.detectChanges();
    expect(settings.breakerSet()).toBe('greyscale');
    expect(platform.storage.get(KEYS.settings)).toMatchObject({ breakerSet: 'greyscale' });
    expect(hints()).toBeDisabled();
    fireEvent.click(screen.getByRole('radio', { name: 'Colorful Breakers' }));
    fixture.detectChanges();
    expect(settings.breakerSet()).toBe('colorful');
    expect(hints()).toBeEnabled();
  });

  it('toggles shape hints and sound, and persists both', async () => {
    const { settings, platform, fixture } = await setup();
    fireEvent.click(hints());
    fireEvent.click(screen.getByRole('checkbox', { name: 'Sound' }));
    fixture.detectChanges();
    expect(settings.shapeHints()).toBe(true);
    expect(settings.sound()).toBe(false);
    expect(platform.storage.get(KEYS.settings)).toEqual({
      breakerSet: 'colorful',
      shapeHints: true,
      sound: false,
    });
    expect(hints()).toBeChecked();
  });
});
