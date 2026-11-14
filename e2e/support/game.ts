import { expect, type Locator, type Page } from '@playwright/test';
import {
  allGroups,
  burst,
  countBalls,
  newGame,
  scoreFor,
  STANDARD_RULES,
  type Cell,
  type Game,
  type MoveResult,
} from '../../src/app/engine';
import { formatNumber } from '../../src/app/state/format';
import { STRINGS } from '../../src/app/strings';

export const SEED = 42;

/** Opens a game dealt from `seed` and returns the engine's model of it. */
export async function openSeeded(page: Page, seed = SEED): Promise<Game> {
  await page.goto(`/?seed=${String(seed)}`);
  await expect(page.locator('.cell')).toHaveCount(STANDARD_RULES.columns * STANDARD_RULES.rows);
  return newGame(seed);
}

export async function cellCenter(page: Page, cell: Cell): Promise<{ x: number; y: number }> {
  // The board is 0 × 0 until its first ResizeObserver callback.
  const board = page.locator('.board');
  await expect.poll(async () => (await board.boundingBox())?.width ?? 0).toBeGreaterThan(0);
  const box = await board.boundingBox();
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

/** Selects and bursts the engine's first group, and waits for the board to settle. */
export async function playMove(page: Page, game: Game): Promise<MoveResult> {
  const group = allGroups(game)[0];
  const cell = group?.[0];
  const result = cell === undefined ? null : burst(game, cell);
  if (group === undefined || cell === undefined || result === null) {
    throw new Error('no move left');
  }
  await clickCell(page, cell);
  await expect(field(page, STRINGS.status.selected)).toHaveText(
    formatNumber(scoreFor(group.length)),
  );
  await clickCell(page, cell);
  if (result.gameOver) {
    // Game over opens Scoring at once with reduced motion, so there is no board to wait for.
    await expect(page).toHaveURL(/\/scoring$/);
  } else {
    await expect(field(page, STRINGS.status.score)).toHaveText(formatNumber(result.game.score));
    await expect(page.locator('.cell')).toHaveCount(countBalls(result.game.board));
  }
  return result;
}

/** Plays the first group until the game ends; returns the final game. */
export async function playToEnd(page: Page, game: Game): Promise<Game> {
  let current = game;
  for (;;) {
    const result = await playMove(page, current);
    current = result.game;
    if (result.gameOver) {
      return current;
    }
  }
}
