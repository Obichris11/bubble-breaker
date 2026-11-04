import { expect, test, type Locator, type Page } from '@playwright/test';
import { allGroups } from '../src/app/engine';
import { STRINGS } from '../src/app/strings';
import { clickCell, field, openSeeded, playToEnd } from './support/game';

async function openOptions(page: Page): Promise<void> {
  await page.getByRole('button', { name: STRINGS.softkeys.menu }).click();
  await page.getByRole('menuitem', { name: STRINGS.menu.options }).click();
  await expect(page.getByRole('heading', { name: STRINGS.options.title })).toBeVisible();
}

for (const viewport of [
  { width: 1280, height: 800 },
  { width: 360, height: 640 },
]) {
  test.describe(`${String(viewport.width)} wide`, () => {
    test.use({ viewport });

    const shot = (name: string): string => `${name}-${String(viewport.width)}.png`;
    /** The clock is the only value that differs between runs. */
    const time = (page: Page): Locator[] => [field(page, STRINGS.status.time)];

    test('game idle', async ({ page }) => {
      await openSeeded(page);
      await expect(page).toHaveScreenshot(shot('game-idle'), { mask: time(page) });
    });

    test('game with a selection', async ({ page }) => {
      const game = await openSeeded(page);
      await clickCell(page, allGroups(game)[0]![0]!);
      await expect(field(page, STRINGS.status.selected)).not.toHaveText(STRINGS.status.noSelection);
      await expect(page).toHaveScreenshot(shot('game-selected'), { mask: time(page) });
    });

    test('Scoring', async ({ page }) => {
      await playToEnd(page, await openSeeded(page));
      await expect(page.getByRole('heading', { name: STRINGS.scoring.title })).toBeVisible();
      await expect(page).toHaveScreenshot(shot('scoring'), {
        mask: [page.getByText(/^Time /)],
      });
    });

    test('Options', async ({ page }) => {
      await openSeeded(page);
      await openOptions(page);
      await expect(page).toHaveScreenshot(shot('options'));
    });

    test('game idle in Greyscale', async ({ page }) => {
      await openSeeded(page);
      await openOptions(page);
      await page.getByRole('radio', { name: STRINGS.options.greyscale }).check();
      await page.getByRole('button', { name: STRINGS.softkeys.done }).click();
      await expect(page.locator('.board--grey')).toBeVisible();
      await expect(page).toHaveScreenshot(shot('game-greyscale'), { mask: time(page) });
    });
  });
}
