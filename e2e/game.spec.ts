import { expect, test } from '@playwright/test';
import { allGroups, burst, countBalls, groupAt, scoreFor } from '../src/app/engine';
import { formatNumber } from '../src/app/state/format';
import { STRINGS } from '../src/app/strings';
import { clickCell, field, openSeeded, playMove, playToEnd } from './support/game';

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

test('select shows the group, a second tap bursts it', async ({ page }) => {
  const game = await openSeeded(page);
  const group = allGroups(game)[0]!;
  await clickCell(page, group[0]!);
  await expect(field(page, STRINGS.status.selected)).toHaveText(
    formatNumber(scoreFor(group.length)),
  );
  await clickCell(page, group[0]!);
  const points = burst(game, group[0]!)!.points;
  await expect(field(page, STRINGS.status.score)).toHaveText(formatNumber(points));
  await expect(page.locator('.cell')).toHaveCount(132 - group.length);
});

test('keyboard: Enter selects and bursts, Esc clears, N deals', async ({ page }) => {
  const game = await openSeeded(page);
  await page.getByRole('application', { name: STRINGS.board.label }).focus();
  let col = 5;
  while (groupAt(game, { row: 11, col }).length === 0) {
    col -= 1;
    await page.keyboard.press('ArrowLeft');
  }
  const cursor = { row: 11, col };
  const selected = field(page, STRINGS.status.selected);
  await page.keyboard.press('Enter');
  await expect(selected).toHaveText(formatNumber(scoreFor(groupAt(game, cursor).length)));
  await page.keyboard.press('Escape');
  await expect(selected).toHaveText(STRINGS.status.noSelection);
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  const points = burst(game, cursor)!.points;
  await expect(field(page, STRINGS.status.score)).toHaveText(formatNumber(points));
  await page.keyboard.press('n');
  await expect(field(page, STRINGS.status.score)).toHaveText('0');
  await expect(page.locator('.cell')).toHaveCount(132);
});

test('a scripted game ends on Scoring with the engine score', async ({ page }) => {
  const final = await playToEnd(page, await openSeeded(page));
  await expect(page).toHaveURL(/\/scoring$/);
  await expect(page.getByRole('heading', { name: STRINGS.scoring.title })).toBeVisible();
  await expect(page.locator('.score')).toHaveText(formatNumber(final.score));
});

test('statistics count a game once', async ({ page }) => {
  const final = await playToEnd(page, await openSeeded(page));
  await expect(page).toHaveURL(/\/scoring$/);
  await page.reload();
  await page.getByRole('button', { name: STRINGS.softkeys.menu }).click();
  await page.getByRole('menuitem', { name: STRINGS.menu.statistics }).click();
  await expect(field(page, STRINGS.stats.played)).toHaveText('1');
  await expect(field(page, STRINGS.stats.high)).toHaveText(formatNumber(final.score));
});

test('reload mid-game restores the board, paused', async ({ page }) => {
  const game = await openSeeded(page);
  const moved = await playMove(page, game);
  await page.reload();
  await expect(page.getByRole('dialog', { name: STRINGS.paused.title })).toBeVisible();
  await expect(field(page, STRINGS.status.score)).toHaveText(formatNumber(moved.game.score));
  await expect(page.locator('.cell')).toHaveCount(countBalls(moved.game.board));
  await page.getByRole('button', { name: STRINGS.paused.resume }).click();
  await expect(page.getByRole('dialog', { name: STRINGS.paused.title })).toBeHidden();
  await playMove(page, moved.game);
});
