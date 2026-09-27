# ADR-0001: Angular 22, zoneless, signals

Status: Accepted · 2026-09-27

## Context
Rewrite needs a modern, portfolio-grade frontend. User chose to stay on Angular.

## Options
- Angular 22 with zone.js (legacy style)
- Angular 22 zoneless + signals + OnPush
- Switch framework (rejected by user)

## Decision
Angular 22, standalone components, `provideZonelessChangeDetection()`, signals for all state, `OnPush` everywhere, new control flow (`@if`/`@for`).

## Consequences
No zone.js in bundle; change detection is explicit and predictable. Third-party libs relying on zone.js are excluded (none needed).
