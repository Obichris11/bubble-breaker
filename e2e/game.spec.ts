import { expect, test } from '@playwright/test';
import { STRINGS } from '../src/app/strings';
import { field, openSeeded } from './support/game';

test('deals the seeded board', async ({ page }) => {
  const game = await openSeeded(page);
  for (const id of game.board.cells) {
    if (id !== null) {
      const color = STRINGS.board.colorNames.colorful[game.colors[id]!];
      await expect(page.locator(`.cell[data-ball="${String(id)}"] .bb-ball`)).toHaveClass(
        new RegExp(`bb-ball--${color}`),
      );
    }
  }
  await expect(field(page, STRINGS.status.score)).toHaveText('0');
  await expect(page).toHaveTitle(STRINGS.appTitle);
});
