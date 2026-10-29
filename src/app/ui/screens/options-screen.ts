import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import type { Color } from '../../engine';
import type { BreakerSet } from '../../state/persistence';
import { SettingsStore } from '../../state/settings.store';
import { STRINGS } from '../../strings';
import { ballLook } from '../board/ball-look';
import { Screen } from './screen';

const COLORS: readonly Color[] = [0, 1, 2, 3, 4];

/**
 * Breaker Set, shape hints and sound (02-ux "Screens"), stored by `SettingsStore` on every
 * change. Shape hints apply to the Colorful set only, so the box is disabled on Greyscale.
 */
@Component({
  selector: 'bb-options-screen',
  imports: [Screen],
  templateUrl: './options-screen.html',
  styleUrl: './options-screen.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OptionsScreen {
  protected readonly settings = inject(SettingsStore);
  protected readonly strings = STRINGS;
  protected readonly greyscale = computed(() => this.settings.breakerSet() === 'greyscale');
  protected readonly sets = (['colorful', 'greyscale'] as const).map((set: BreakerSet) => ({
    set,
    label: STRINGS.options[set],
    looks: COLORS.map((color) => ballLook(color, set)),
  }));
}
