import { expect, test, type Page } from '@playwright/test';
import { allGroups, type Game } from '../src/app/engine';
import { STRINGS } from '../src/app/strings';
import { expectNoSeriousViolations } from './support/axe';
import { clickCell, field, openSeeded, playMove, playToEnd } from './support/game';

async function openMenu(page: Page): Promise<void> {
  await page.getByRole('button', { name: STRINGS.softkeys.menu }).click();
}

async function openFromMenu(page: Page, item: string, heading: string): Promise<void> {
  await openMenu(page);
  await page.getByRole('menuitem', { name: item }).click();
  await expect(page.getByRole('heading', { name: heading })).toBeVisible();
}

for (const set of ['colorful', 'greyscale'] as const) {
  test.describe(set, () => {
    let game: Game;

    test.beforeEach(async ({ page }) => {
      game = await openSeeded(page);
      if (set === 'greyscale') {
        await openFromMenu(page, STRINGS.menu.options, STRINGS.options.title);
        await page.getByRole('radio', { name: STRINGS.options.greyscale }).check();
        await page.getByRole('button', { name: STRINGS.softkeys.done }).click();
        await expect(page.locator('.board--grey')).toBeVisible();
      }
    });

    test('game idle', async ({ page }, testInfo) => {
      await expectNoSeriousViolations(page, testInfo, `game-${set}`);
    });

    test('game with a selection', async ({ page }, testInfo) => {
      await clickCell(page, allGroups(game)[0]![0]!);
      await expect(field(page, STRINGS.status.selected)).not.toHaveText(STRINGS.status.noSelection);
      await expectNoSeriousViolations(page, testInfo, `selection-${set}`);
    });

    test('menu open', async ({ page }, testInfo) => {
      await openMenu(page);
      await expect(page.getByRole('menu')).toBeVisible();
      await expectNoSeriousViolations(page, testInfo, `menu-${set}`);
    });

    test('Paused', async ({ page }, testInfo) => {
      await playMove(page, game);
      await page.reload();
      await expect(page.getByRole('dialog', { name: STRINGS.paused.title })).toBeVisible();
      await expectNoSeriousViolations(page, testInfo, `paused-${set}`);
    });

    test('Scoring', async ({ page }, testInfo) => {
      await playToEnd(page, game);
      await expect(page.getByRole('heading', { name: STRINGS.scoring.title })).toBeVisible();
      await expectNoSeriousViolations(page, testInfo, `scoring-${set}`);
    });

    test('Statistics', async ({ page }, testInfo) => {
      await openFromMenu(page, STRINGS.menu.statistics, STRINGS.stats.title);
      await expectNoSeriousViolations(page, testInfo, `statistics-${set}`);
    });

    test('reset dialog', async ({ page }, testInfo) => {
      await openFromMenu(page, STRINGS.menu.statistics, STRINGS.stats.title);
      await page.getByRole('button', { name: STRINGS.stats.reset }).click();
      await expect(page.getByRole('alertdialog', { name: STRINGS.stats.resetTitle })).toBeVisible();
      await expectNoSeriousViolations(page, testInfo, `reset-${set}`);
    });

    test('Options', async ({ page }, testInfo) => {
      await openFromMenu(page, STRINGS.menu.options, STRINGS.options.title);
      await expectNoSeriousViolations(page, testInfo, `options-${set}`);
    });

    test('How to Play', async ({ page }, testInfo) => {
      await openFromMenu(page, STRINGS.menu.howToPlay, STRINGS.howToPlay.title);
      await expectNoSeriousViolations(page, testInfo, `how-to-play-${set}`);
    });

    test('About', async ({ page }, testInfo) => {
      await openFromMenu(page, STRINGS.menu.about, STRINGS.about.title);
      await expectNoSeriousViolations(page, testInfo, `about-${set}`);
    });
  });
}
