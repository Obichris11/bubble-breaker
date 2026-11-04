// Static server with the nginx rules that matter to the app (06-deployment): SPA fallback, real
// 404s for missing files, no-cache on the entry and worker files, gzip. Used by Playwright and
// Lighthouse:
//   node scripts/serve.mjs dist/e2e/browser 4300
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createGzip } from 'node:zlib';

const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain',
  '.svg': 'image/svg+xml',
};
// nginx/default.conf: gzip_types (text/html is always on) and gzip_min_length.
const GZIP = new Set(['.html', '.js', '.css', '.json', '.webmanifest', '.svg', '.ico', '.txt']);
const GZIP_MIN_LENGTH = 1024;
const NO_CACHE = new Set([
  '/index.html',
  '/ngsw.json',
  '/ngsw-worker.js',
  '/safety-worker.js',
  '/worker-basic.min.js',
  '/manifest.webmanifest',
]);

export function startServer(root, port) {
  const dir = resolve(root);
  const server = createServer((req, res) => {
    let url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file = join(dir, url);
    if (!existsSync(file) || statSync(file).isDirectory()) {
      if (extname(url) !== '') {
        res.writeHead(404).end('not found');
        return;
      }
      url = '/index.html';
      file = join(dir, url);
    }
    const compressible = GZIP.has(extname(file)) && statSync(file).size >= GZIP_MIN_LENGTH;
    const gzip = compressible && /\bgzip\b/.test(req.headers['accept-encoding'] ?? '');
    res.writeHead(200, {
      'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream',
      'Cache-Control': NO_CACHE.has(url) ? 'no-cache' : 'public, max-age=31536000, immutable',
      ...(compressible && { Vary: 'Accept-Encoding' }),
      ...(gzip && { 'Content-Encoding': 'gzip' }),
    });
    const body = createReadStream(file);
    (gzip ? body.pipe(createGzip()) : body).pipe(res);
  });
  return new Promise((done) => {
    server.listen(port, '127.0.0.1', () => {
      done(server);
    });
  });
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [, , root, port = '4300'] = process.argv;
  await startServer(root, Number(port));
  console.log(`serving ${root} on ${port}`);
}
