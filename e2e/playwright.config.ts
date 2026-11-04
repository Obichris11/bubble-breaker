import { defineConfig, devices } from '@playwright/test';

const shared = { reducedMotion: 'reduce', serviceWorkers: 'block' } as const;
const mobile = {
  viewport: { width: 360, height: 640 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
};

export default defineConfig({
  testDir: '.',
  outputDir: '../test-results',
  snapshotPathTemplate: '{testDir}/{testFileName}-snapshots/{arg}-{projectName}-{platform}{ext}',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI']
    ? [['list'], ['html', { outputFolder: '../playwright-report', open: 'never' }]]
    : 'list',
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.001, animations: 'disabled' } },
  use: { baseURL: 'http://127.0.0.1:4300', trace: 'retain-on-failure', ...shared },
  webServer: {
    command: 'node scripts/serve.mjs dist/e2e/browser 4300',
    cwd: '..',
    url: 'http://127.0.0.1:4300/favicon.ico',
    reuseExistingServer: !process.env['CI'],
  },
  projects: [
    {
      name: 'chromium-desktop',
      testIgnore: /visual/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
    {
      name: 'chromium-mobile',
      testIgnore: /visual/,
      use: { ...devices['Desktop Chrome'], ...mobile },
    },
    {
      name: 'webkit-desktop',
      testIgnore: /visual|pwa/,
      use: { ...devices['Desktop Safari'], viewport: { width: 1280, height: 800 } },
    },
    { name: 'webkit-mobile', testIgnore: /visual|pwa/, use: { ...devices['iPhone 15'] } },
    { name: 'visual', testMatch: /visual/, use: { ...devices['Desktop Chrome'] } },
  ],
});
