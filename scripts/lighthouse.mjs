// Lighthouse gate on the production build (04-quality): 3 runs of `/` on a mobile profile, the
// median by Performance is asserted, reports go to lighthouse/. CI runs it after `npm run build`:
//   node scripts/lighthouse.mjs dist/bubble-breaker/browser
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { launch } from 'chrome-launcher';
import lighthouse from 'lighthouse';
import { startServer } from './serve.mjs';

const dir = process.argv[2] ?? 'dist/bubble-breaker/browser';
const PORT = 4301;
const RUNS = 3;
const GATES = { performance: 0.9, accessibility: 1, 'best-practices': 0.95, seo: 0.9 };

const server = await startServer(dir, PORT);
const chrome = await launch({
  chromePath: chromium.executablePath(),
  chromeFlags: ['--headless=new', '--no-sandbox'],
});
let failed = false;
try {
  const runs = [];
  for (let run = 0; run < RUNS; run += 1) {
    runs.push(
      await lighthouse(`http://127.0.0.1:${String(PORT)}/`, {
        port: chrome.port,
        output: ['html', 'json'],
        logLevel: 'error',
        onlyCategories: Object.keys(GATES),
      }),
    );
  }
  runs.sort((a, b) => a.lhr.categories.performance.score - b.lhr.categories.performance.score);
  const { lhr, report } = runs[Math.floor(RUNS / 2)];
  mkdirSync('lighthouse', { recursive: true });
  writeFileSync('lighthouse/report.html', report[0]);
  writeFileSync('lighthouse/report.json', report[1]);

  for (const [id, gate] of Object.entries(GATES)) {
    const category = lhr.categories[id];
    const passed = category.score >= gate;
    console.log(`${id} ${category.score.toFixed(2)} ${passed ? '≥' : '<'} ${gate.toFixed(2)}`);
    if (!passed) {
      failed = true;
      for (const { id: audit } of category.auditRefs) {
        const result = lhr.audits[audit];
        if (result.score !== null && result.score < 1) {
          console.log(`  ${audit}: ${result.title} (${String(result.score)})`);
        }
      }
    }
  }
} finally {
  chrome.kill();
  server.closeAllConnections();
  server.close();
}
process.exit(failed ? 1 : 0);
