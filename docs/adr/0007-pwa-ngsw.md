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
