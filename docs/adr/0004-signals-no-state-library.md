---
aliases:
  - ADR-0004
  - Signal stores, no state library
tags:
  - bubble-breaker/adr
status: accepted
created: 2026-09-27
---
# ADR-0004: Signal stores, no state library

## Context
State is small: one game, stats, settings. Legacy had RxJS subjects with manual subscriptions.

## Options
- NgRx Store
- NgRx SignalStore
- Plain injectable services with signals

## Decision
Plain `@Injectable({providedIn:'root'})` stores exposing readonly signals + intent methods. RxJS only where an API demands it (SwUpdate), converted with `toSignal`.

## Consequences
Zero extra dependency, minimal boilerplate. If state grows (multiple styles, online features), revisit SignalStore.
