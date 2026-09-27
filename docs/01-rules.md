---
aliases:
  - Ruleset
tags:
  - bubble-breaker/planning
  - bubble-breaker/phase-1
  - bubble-breaker/rules
status: accepted
created: 2026-09-27
---
# 01 — Ruleset

Rules for v1 (Standard style only).

**Normative source:** [W] Wikipedia, *Jawbreaker (Windows Mobile game)*. Bubble Breaker is the Windows Mobile 5/6 name of Jawbreaker (oopdreams). Where [W] is silent, the gap is filled by an explicit user decision, citing the supporting secondary source if one exists.

Status legend: **W** = stated in [W] · **Gap** = [W] silent, decided by user · **Ours** = not an original rule, app-level behavior.

## Rules

| # | Rule | Status | Value | Basis |
|---|---|---|---|---|
| R1 | Board | W | Matrix of balls, fully filled at start | [W] "a screen of differently-colored balls arranged in a matrix" |
| R2 | Board size | Gap | 11 columns × 12 rows, portrait | User decision; standard 240×320 Pocket PC reported 12×11 portrait [S2] |
| R3 | Colors | W | 5: red, blue, green, yellow, purple | [W] |
| R4 | Initial fill | Gap | Each cell independently uniform-random color | SameGame convention ([W]: "a port of SameGame") |
| R5 | RNG | Ours | Seeded PRNG; seed stored with game → reproducible games, deterministic tests | — |
| R6 | Adjacency | W | Orthogonal neighbours (up/down/left/right) | [W] "connecting … adjacent to each other" |
| R7 | Minimum group | W | 2 | [W] "any two or more connecting similarly-colored balls" |
| R8 | Selection | Gap | First tap highlights the group and shows its potential points; tapping the highlighted group again bursts it | User decision; Windows Mobile help file [S1] |
| R9 | Re-selection | Ours | Tap another group → selection moves to it. Tap a lone ball or outside board → selection cleared | — |
| R10 | Score per burst | W | `Y = X(X − 1)`, X = balls in group (16 → 240) | [W] |
| R11 | Gravity | W (implied) | After a burst, balls above removed cells fall straight down | SameGame port [W]; [S1] "All bubbles above … will now fall down" |
| R12 | Column collapse | W (implied) | Empty columns close up to the **right**; empty space accumulates on the left | [W] balls "move to the right of the screen", new columns "appear from the leftmost side" |
| R13 | Game over | W | No two adjacent balls share a color | [W] "no more like-colored balls adjacent to each other" |
| R14 | End bonus | Gap | **None.** Final score = sum of burst scores | User decision (stick to [W]) |
| R15 | Undo | Gap | **None.** Every burst is final | User decision |
| R16 | Scoring screen | W | On game over, go to scoring screen showing statistics and a New Game button | [W] "The screen immediately goes to the scoring screen …" |
| R17 | Statistics | W + Ours | Average Score, Total Score, Games Played [W]; plus High Score (ours). Stored locally, resettable | [W] |
| R18 | Breaker Set | W | Option: **Colorful Breakers** (default) or **Greyscale Breakers** — distinct greyscale patterns instead of colors, for monochrome displays / colorblind players | [W] "Breaker Set" |
| R19 | Time | Ours | Elapsed time shown, not scored; pausing keeps accumulated time | — |
| R20 | Game styles | W (scope) | v1: Standard only. Engine keeps gravity / collapse / refill as separate steps so other styles can be added later | Scope decision |
| R21 | New game | Ours | New game = new seed. Abandoned games are not counted in statistics | — |

### Reference: other styles (post-v1, engine design only)

From [W]:
- **Continuous**: clearing an entire column brings a new column in from the left; the next column is previewed at the bottom of the screen.
- **MegaShift**: like Continuous; balls always move to the right if there is space.
- **Shifter**: balls gravitate to the right; finite balls, no replenishment.

## Engine defaults

```ts
export const STANDARD_RULES = {
  columns: 11,
  rows: 12,
  colors: 5,
  minGroup: 2,
  score: (x: number) => x * (x - 1),
  collapseDirection: 'right',
} as const;
```

## Invariants (become property tests)

1. Total balls after a burst = before − X.
2. After gravity, no ball has an empty cell below it.
3. After collapse, no empty column lies to the right of a non-empty column.
4. Score never decreases; each burst adds exactly X(X − 1).
5. Same seed + same move list ⇒ identical board and score.
6. Game over ⇔ no two orthogonally adjacent cells share a color.

## Sources

- **[W]** Wikipedia, *Jawbreaker (Windows Mobile game)* — https://en.wikipedia.org/wiki/Jawbreaker_(Windows_Mobile_game) — normative
- [S1] Windows Mobile *Bubble Breaker Help* (device dump) — https://www.hands.com/~lkcl/hp6915/Dump/Files/BubbleBreaker.htm — supports R8, R11
- [S2] frankiii's blog, *Bubble Breaker Game High Scores* (player comments, 2006) — http://frankiii.blogspot.com/2006/07/bubble-breaker-game-high-scores.html — supports R2
