---
aliases:
  - ADR-0002
  - "Layered architecture: engine / state / platform / ui"
tags:
  - bubble-breaker/adr
status: accepted
created: 2026-09-27
---
# ADR-0002: Layered architecture: engine / state / platform / ui

## Context
Legacy mixed rules, DOM and state in services; tests could not reach the real logic.

## Options
- Feature folders only
- Strict layers with lint-enforced dependency rule

## Decision
Four layers. `engine` is pure TypeScript with no Angular or DOM imports. Dependency direction ui → state → engine/platform. Enforced by ESLint (`no-restricted-imports` per folder, or `eslint-plugin-boundaries`).

## Consequences
Rules are testable in plain Vitest without TestBed. Adding game styles touches only `engine`. Slight ceremony for a small app, accepted for clarity.
