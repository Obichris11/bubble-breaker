import { expect, type Locator, type Page } from '@playwright/test';
import { newGame, STANDARD_RULES, type Cell, type Game } from '../../src/app/engine';

export const SEED = 42;

/** Opens a game dealt from `seed` and returns the engine's model of it. */
export async function openSeeded(page: Page, seed = SEED): Promise<Game> {
  await page.goto(`/?seed=${String(seed)}`);
  await expect(page.locator('.cell')).toHaveCount(STANDARD_RULES.columns * STANDARD_RULES.rows);
  return newGame(seed);
}

export async function cellCenter(page: Page, cell: Cell): Promise<{ x: number; y: number }> {
  const box = await page.locator('.board').boundingBox();
  if (box === null) {
    throw new Error('the board is not visible');
  }
  const size = box.width / STANDARD_RULES.columns;
  return { x: box.x + (cell.col + 0.5) * size, y: box.y + (cell.row + 0.5) * size };
}

export async function clickCell(page: Page, cell: Cell): Promise<void> {
  const { x, y } = await cellCenter(page, cell);
  await page.mouse.click(x, y);
}

/** The value next to a label in a `dl`: the `dd` after the `dt` with that text. */
export function field(page: Page, label: string): Locator {
  return page.locator(`dt:text-is("${label}") + dd`);
}
