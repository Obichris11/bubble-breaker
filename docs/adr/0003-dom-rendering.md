---
aliases:
  - ADR-0003
  - DOM + CSS rendering
tags:
  - bubble-breaker/adr
status: accepted
created: 2026-09-27
---
# ADR-0003: DOM + CSS rendering

## Context
Board is 11×12 = 132 balls. Need animations, accessibility, testability.

## Options
- DOM + CSS transforms
- Canvas / PixiJS
- Hybrid

## Decision
DOM. Each ball is an absolutely positioned element keyed by stable `BallId`, moved via `transform: translate()`, animated with CSS transitions whose durations come from design tokens.

## Consequences
Free accessibility and DOM testing; no rendering library. Particle-style effects are out of scope.
