import { expect, test, type Page } from '@playwright/test';
import { STRINGS } from '../src/app/strings';

test.use({ serviceWorkers: 'allow' });

/** Waits for the worker to install and take over the page. */
async function controlled(page: Page): Promise<void> {
  await page.goto('/');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null))
    .toBe(true);
}

interface Icon {
  readonly src: string;
  readonly sizes: string;
  readonly purpose?: string;
}

test('manifest is linked and complete', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    'href',
    'manifest.webmanifest',
  );
  const response = await page.request.get('/manifest.webmanifest');
  const manifest = (await response.json()) as Record<string, unknown> & { icons: Icon[] };
  expect(manifest).toMatchObject({
    name: 'Bubble Breaker',
    short_name: 'Bubbles',
    start_url: '/',
    display: 'standalone',
  });
  const sizes = manifest.icons.map((icon) => icon.sizes);
  expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512']));
  expect(manifest.icons.some((icon) => icon.purpose === 'maskable')).toBe(true);
  for (const icon of manifest.icons) {
    const file = await page.request.get(`/${icon.src}`);
    expect(file.status()).toBe(200);
    expect(file.headers()['content-type']).toBe('image/png');
  }
});

test('service worker controls the page after a reload', async ({ page }) => {
  await controlled(page);
});

test('reload and a deep link work offline', async ({ page, context }) => {
  await page.goto('/');
  // The notice shows on the visit that finishes the first cache, not after a reload.
  await expect(page.getByText(STRINGS.pwa.offlineTitle)).toBeVisible();
  await controlled(page);
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('.cell')).toHaveCount(132);
  await page.goto('/statistics');
  await expect(page.getByRole('heading', { name: STRINGS.stats.title })).toBeVisible();
});

test('Chromium reports no installability errors', async ({ page, context }) => {
  await controlled(page);
  const cdp = await context.newCDPSession(page);
  const { installabilityErrors } = await cdp.send('Page.getInstallabilityErrors');
  expect(installabilityErrors).toEqual([]);
});
