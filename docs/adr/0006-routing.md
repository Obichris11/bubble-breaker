---
aliases:
  - ADR-0006
  - Angular Router for screens, overlays for menu/dialogs
tags:
  - bubble-breaker/adr
status: accepted
created: 2026-09-27
---
# ADR-0006: Angular Router for screens, overlays for menu/dialogs

## Context
Screens: game, scoring, statistics, options, how-to-play, about. Android back gesture and browser back must behave.

## Options
- Single component with a view signal
- Angular Router routes

## Decision
Router with eager routes; softkey Done navigates home. Menu, dialogs, toasts are overlays (not routes). `scoring` only reachable via game over (guard redirects otherwise). nginx SPA fallback required.

## Consequences
Native back behavior for free; deep links to static screens. Game state lives in root stores, so navigation never loses the board.
