---
aliases:
  - ADR-0007
  - Angular service worker for PWA
tags:
  - bubble-breaker/adr
status: accepted
created: 2026-09-27
---
# ADR-0007: Angular service worker for PWA

## Context
Must be installable and fully offline; must tell users about updates without silently reloading.

## Options
- `@angular/service-worker`
- Workbox custom SW

## Decision
Angular service worker with asset groups only (no data groups). `SwUpdate.versionUpdates` drives the "New version" toast; reload only on user tap after saving. nginx serves `ngsw.json`, `ngsw-worker.js`, `index.html`, manifest with `no-cache`.

## Consequences
First-party, well integrated with the build. Less flexible than Workbox, sufficient for a static game.

## Implementation (Plan 06)
- Package: `@angular/service-worker` ^22.2, on the Angular release train (Dependabot's `angular` group bumps it with `@angular/core`). It is the only runtime dependency the PWA adds; this ADR covers it (DoD item 5).
- Registered in `providePlatform()` with `provideServiceWorker('ngsw-worker.js', { enabled: !isDevMode(), registrationStrategy: 'registerWhenStable:30000' })`, so only production builds run a worker; `ng serve` and the unit tests never do.
- Only `platform/pwa.ts` (`PwaPort`, `BrowserPwa`) touches `SwUpdate`, `beforeinstallprompt` and Cache Storage (ADR-0002). `state/pwa.store.ts` picks the notice and saves the game before every reload, including the forced one after `SwUpdate.unrecoverable`.
- ngsw sends no event when a first install has cached the app, and outside `localhost` it caches in an idle task after activation. "Offline ready" therefore checks Cache Storage against the `prefetch` URLs of `ngsw.json`.
- Cost, measured in Plan 06: the initial bundle grows from 284.2 to 307.6 kB raw (76.8 → 82.4 kB transfer), within the 350 kB warning budget.
