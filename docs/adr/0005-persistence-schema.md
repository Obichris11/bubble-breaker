# ADR-0005: Versioned localStorage schema with guards

Status: Accepted · 2026-09-27

## Context
Game in progress, stats and settings must survive reloads and app updates; corrupted or old data must never crash the game.

## Options
- localStorage + versioned keys + hand guards
- IndexedDB
- localStorage + zod

## Decision
`localStorage` via a Storage port. Keys `bb:v1:settings`, `bb:v1:stats`, `bb:v1:game`. Every read validated by hand-written type guards; invalid → defaults. Schema changes add `v2` keys plus a one-time migration.

## Consequences
Tiny data (< 2 kB), synchronous API is fine. No validation dependency. Data is per device (as stated in the UI).
