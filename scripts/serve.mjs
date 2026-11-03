// Static server with the nginx rules that matter to the app (06-deployment): SPA fallback, real
// 404s for missing files, no-cache on the entry and worker files. Used by Playwright and Lighthouse:
//   node scripts/serve.mjs dist/e2e/browser 4300
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

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
    res.writeHead(200, {
      'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream',
      'Cache-Control': NO_CACHE.has(url) ? 'no-cache' : 'public, max-age=31536000, immutable',
    });
    createReadStream(file).pipe(res);
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
