# Bubble Breaker

A tribute to the pocket-computer puzzle classic Jawbreaker / Bubble Breaker, rebuilt as an installable, offline web app. Not affiliated with any original publisher.

The legacy version is kept at tag `v0-legacy`.

## Play

There is no public instance: self-host it (see below). Once it is running, install it from your browser's menu (on iOS: Share → Add to Home Screen). After the first load it works offline. There are no accounts and no tracking; statistics stay on your device.

## Rules in one breath

Tap a group of two or more touching balls of the same color to highlight it, tap again to burst it. Points = n × (n − 1). Balls fall down, empty columns close up to the right. The game ends when no two touching balls share a color.

## Keyboard

Arrow keys move · Enter selects and bursts · Esc clears · N new game · M menu

## Self-hosting

Every release is published as `ghcr.io/obichris11/bubble-breaker:latest` (and `:X.Y.Z`). [`deploy/compose.yml`](deploy/compose.yml) runs it on `127.0.0.1:18080` behind your reverse proxy, which must serve HTTPS for the service worker. [`deploy/update.sh`](deploy/update.sh) creates the container on its first run and redeploys it when the image changed, health-gated. Schedule it with cron or DSM Task Scheduler.

The full setup, for a Synology NAS in the DSM web UI, is in [`docs/06-deployment.md`](docs/06-deployment.md).

## Development

Requires Node ≥ 24.15 (see `.nvmrc`).

    npm ci
    npm start          # dev server on http://localhost:4200
    npm run check      # lint, format check, typecheck, unit tests
    npm run test:ci    # unit tests with coverage gates

End-to-end, accessibility and visual tests (Playwright; `npx playwright install chromium webkit` once):

    npm run build:e2e && npm run e2e
    npm run e2e:docker -- --project=visual --update-snapshots   # baselines, in the CI image

Lighthouse gate on the production build:

    npm run build && npm run lh

## Docs

Planning, rules, UX, architecture and decisions live in [`docs/`](docs/README.md).

## License

MIT. Not affiliated with any original publisher.
