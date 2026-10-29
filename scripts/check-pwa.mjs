// Checks a production build for what makes the app installable and offline-capable
// (06-deployment "PWA deployment requirements"). CI runs it after `npm run build`:
//   node scripts/check-pwa.mjs dist/bubble-breaker/browser
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const dist = process.argv[2] ?? 'dist/bubble-breaker/browser';
const errors = [];
const check = (ok, message) => {
  if (!ok) {
    errors.push(message);
  }
};
const read = (file) => readFileSync(join(dist, file));

/** Width and height from a PNG's IHDR chunk, or null for a file that is not a PNG. */
function pngSize(file) {
  const data = read(file);
  const signature = '89504e470d0a1a0a';
  return data.subarray(0, 8).toString('hex') === signature
    ? `${String(data.readUInt32BE(16))}x${String(data.readUInt32BE(20))}`
    : null;
}

for (const file of ['index.html', 'manifest.webmanifest', 'ngsw.json', 'ngsw-worker.js']) {
  check(existsSync(join(dist, file)), `${file} is missing`);
}
if (errors.length === 0) {
  const manifest = JSON.parse(read('manifest.webmanifest').toString());
  const expected = {
    name: 'Bubble Breaker',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    theme_color: '#0A246A',
    background_color: '#D4D0C8',
  };
  for (const [key, value] of Object.entries(expected)) {
    check(manifest[key] === value, `manifest ${key} is ${String(manifest[key])}, not ${value}`);
  }
  check(
    typeof manifest.short_name === 'string' && manifest.short_name.length <= 12,
    'manifest short_name must have at most 12 characters',
  );
  for (const [sizes, purpose] of [
    ['192x192', 'any'],
    ['512x512', 'any'],
    ['512x512', 'maskable'],
  ]) {
    const icon = manifest.icons?.find((i) => i.sizes === sizes && i.purpose === purpose);
    check(icon !== undefined, `manifest has no ${sizes} ${purpose} icon`);
    if (icon !== undefined) {
      check(existsSync(join(dist, icon.src)), `${icon.src} is missing`);
      if (existsSync(join(dist, icon.src))) {
        check(pngSize(icon.src) === sizes, `${icon.src} is not a ${sizes} PNG`);
      }
    }
  }

  const index = read('index.html').toString();
  // The build writes void tags as `<link …>` or `<link …/>`, depending on its HTML optimizer.
  check(/<link rel="manifest" href="manifest\.webmanifest"\/?>/.test(index), 'no manifest link');
  check(
    index.includes(`<meta name="theme-color" content="${expected.theme_color}"`),
    'no theme-color',
  );

  const ngsw = JSON.parse(read('ngsw.json').toString());
  check(ngsw.dataGroups.length === 0, 'ngsw.json must not have data groups (ADR-0007)');
  const prefetch = ngsw.assetGroups
    .filter((g) => g.installMode === 'prefetch')
    .flatMap((g) => g.urls);
  for (const url of ['/index.html', '/manifest.webmanifest']) {
    check(prefetch.includes(url), `${url} is not prefetched`);
  }
  check(
    prefetch.some((url) => /^\/main-\w+\.js$/.test(url)),
    'the main bundle is not prefetched',
  );
  check(
    prefetch.filter((url) => url.startsWith('/fonts/')).length === 2,
    'fonts are not prefetched',
  );
  for (const url of Object.keys(ngsw.hashTable)) {
    check(existsSync(join(dist, url)), `ngsw.json lists ${url}, which is not in the build`);
  }
}

if (errors.length > 0) {
  console.error(`PWA check failed for ${dist}:\n- ${errors.join('\n- ')}`);
  process.exit(1);
}
console.log(`PWA check passed for ${dist}`);
