# Bubble Breaker

A tribute to the pocket-computer puzzle classic Jawbreaker / Bubble Breaker, rebuilt as an installable, offline web app.

> Status: rewrite in progress (v2). Legacy version: tag `v0-legacy`.

## Rules in one breath

Tap a group of two or more touching balls of the same color to highlight it, tap again to burst it. Points = n × (n − 1). Balls fall down, empty columns close up to the right. The game ends when no two touching balls share a color.

## Development

Requires Node ≥ 24.15 (see `.nvmrc`).

    npm ci
    npm start          # dev server on http://localhost:4200
    npm run check      # lint, format check, typecheck, unit tests
    npm run test:ci    # unit tests with coverage gates

## Docs

Planning, rules, UX, architecture and decisions live in [`docs/`](docs/README.md).

## License

MIT. Not affiliated with any original publisher.
