# ADR-0008: English only, centralized strings

Status: Accepted · 2026-09-27

## Context
Original was English. User wants English only for v1 but may add languages later.

## Options
- Angular i18n now
- Runtime translation library
- English only, strings in one module

## Decision
All user-visible text (UI and live-region announcements) lives in `app/strings.ts`; components never hard-code copy. Number formatting via `Intl.NumberFormat('en-US')`.

## Consequences
No i18n tooling now. Adding a language later = swap the strings module or adopt Angular i18n with a single extraction pass.
