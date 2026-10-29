// Checks a running container (or the live site) against 06-deployment "nginx": health,
// caching, routing, security headers, and an index.html that the CSP can run. CI's `docker`
// job runs it against the container started from deploy/compose.yml:
//   node scripts/check-container.mjs http://127.0.0.1:18080
// Add --public to also require HSTS (set by the DSM reverse proxy, not by the container).
const args = process.argv.slice(2);
const base = (args.find((arg) => !arg.startsWith('--')) ?? 'http://127.0.0.1:18080').replace(
  /\/$/,
  '',
);
const isPublic = args.includes('--public');

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "base-uri 'self'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ');
const SECURITY = {
  'content-security-policy': CSP,
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'cross-origin-opener-policy': 'same-origin',
};
const NO_CACHE = 'no-cache';
const IMMUTABLE = 'public, max-age=31536000, immutable';
const WEEK = 'public, max-age=604800';

const errors = [];
let checks = 0;
const check = (ok, message) => {
  checks++;
  if (!ok) {
    errors.push(message);
  }
};

async function get(path) {
  const response = await fetch(base + path, { redirect: 'manual' });
  return { path, status: response.status, headers: response.headers, body: await response.text() };
}

function expectHeader(res, name, value) {
  const actual = res.headers.get(name);
  check(actual === value, `${res.path}: ${name} is ${String(actual)}, not ${value}`);
}

function expectSecurityHeaders(res) {
  for (const [name, value] of Object.entries(SECURITY)) {
    expectHeader(res, name, value);
  }
}

function expectFile(res, cacheControl, type) {
  check(res.status === 200, `${res.path}: status ${String(res.status)}, not 200`);
  expectHeader(res, 'cache-control', cacheControl);
  if (type !== undefined) {
    const actual = res.headers.get('content-type') ?? '';
    check(actual.startsWith(type), `${res.path}: content-type is ${actual}, not ${type}`);
  }
}

function expectMissing(res) {
  check(res.status === 404, `${res.path}: status ${String(res.status)}, not 404`);
  check(!res.body.includes('<bb-root'), `${res.path}: a missing file must not serve index.html`);
  check(!res.headers.has('cache-control'), `${res.path}: a 404 must not be cacheable`);
  expectSecurityHeaders(res);
}

const health = await get('/health');
check(health.status === 200, `/health: status ${String(health.status)}, not 200`);
check(health.body.trim() === 'ok', `/health: body is ${JSON.stringify(health.body)}, not "ok"`);
check(
  (health.headers.get('content-type') ?? '').startsWith('text/plain'),
  '/health: content-type is not text/plain',
);

const root = await get('/');
expectFile(root, NO_CACHE, 'text/html');
expectSecurityHeaders(root);
check(root.body.includes('<bb-root'), '/: does not serve index.html');
check(
  root.headers.get('server') === 'nginx',
  `/: server header is ${String(root.headers.get('server'))}, not nginx (server_tokens off)`,
);
if (isPublic) {
  check(
    (root.headers.get('strict-transport-security') ?? '').includes('max-age='),
    '/: no Strict-Transport-Security header (enable HSTS on the DSM reverse proxy)',
  );
}

// script-src 'self' blocks inline scripts and event-handler attributes in index.html.
const inline = [...root.body.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>/g)].map((m) => m[0]);
check(inline.length === 0, `index.html has inline scripts the CSP blocks: ${inline.join(' ')}`);
check(!/<[^>]+\son[a-z]+=/i.test(root.body), 'index.html has event-handler attributes');

for (const route of ['/about', '/options', '/statistics']) {
  const res = await get(route);
  expectFile(res, NO_CACHE, 'text/html');
  check(res.body === root.body, `${route}: does not serve index.html`);
}

for (const file of [
  '/index.html',
  '/ngsw.json',
  '/ngsw-worker.js',
  '/safety-worker.js',
  '/worker-basic.min.js',
]) {
  expectFile(await get(file), NO_CACHE);
}
expectFile(await get('/manifest.webmanifest'), NO_CACHE, 'application/manifest+json');

const hashed = root.body.matchAll(/(?:src|href)="([\w-]+-[A-Z0-9]{8}\.(?:js|css))"/g);
const bundles = [...new Set([...hashed].map((m) => `/${m[1]}`))];
check(
  bundles.some((b) => b.endsWith('.js')) && bundles.some((b) => b.endsWith('.css')),
  'no hashed bundles in index.html',
);
for (const bundle of bundles) {
  const res = await get(bundle);
  expectFile(res, IMMUTABLE);
  check(res.headers.get('content-encoding') === 'gzip', `${bundle}: not gzipped`);
}

for (const file of [
  '/fonts/noto-sans-latin-400-normal.woff2',
  '/icons/icon-192.png',
  '/favicon.ico',
]) {
  expectFile(await get(file), WEEK);
}

for (const missing of ['/missing.js', '/main-AAAAAAAA.js', '/icons/missing.png', '/about.txt']) {
  expectMissing(await get(missing));
}

if (errors.length > 0) {
  console.error(
    `Container check failed for ${base} (${String(errors.length)} of ${String(checks)} checks):\n- ${errors.join('\n- ')}`,
  );
  process.exit(1);
}
console.log(`Container check passed for ${base} (${String(checks)} checks)`);
