/** All user-visible copy (ADR-0008). Components never hard-code text. */
export const STRINGS = {
  appTitle: 'Bubble Breaker',
  status: {
    score: 'Score',
    selected: 'Selected',
    time: 'Time',
    /** "Selected" field when nothing is selected. */
    noSelection: '–',
    /** Prefix of the time field while the timer is stopped by Paused or an open menu/screen. */
    pausedPrefix: '‖ ',
  },
  softkeys: {
    newGame: 'New Game',
    /** Left softkey on every screen except the Game screen: back to the game. */
    done: 'Done',
    menu: 'Menu',
  },
  toast: {
    /** `aria-label` of the × button on a notice. */
    dismiss: 'Dismiss',
  },
  howToPlay: {
    title: 'How to Play',
    select:
      'Tap a group of two or more touching balls of the same color. The group is highlighted and shows the points it is worth.',
    burst:
      'Tap the group again to burst it. Balls above fall down, and empty columns close up to the right.',
    formula: 'Points = n × (n − 1)',
    balls: (count: number) => `${String(count)} balls`,
    plan: 'Big groups score far more, so plan ahead. The game ends when no two touching balls share a color. There is no undo.',
    keyboard:
      'Keyboard: arrow keys move, Enter or Space selects and bursts, Esc clears the selection, N starts a new game and M opens the menu.',
  },
  about: {
    title: 'About',
    version: (version: string) => `Version ${version}`,
    tribute:
      'A tribute to the pocket-computer puzzle classic Jawbreaker by oopdreams. Not affiliated with any original publisher.',
    privacy: 'Works offline once loaded. No accounts, no tracking. Statistics stay on this device.',
  },
  board: {
    /** `aria-label` of the board (`role="application"`): what it is and its keys. */
    label:
      'Bubble Breaker board, 11 columns by 12 rows. Arrow keys move, Enter or Space selects and bursts, Escape clears, N starts a new game.',
    /** Spoken ball names per Breaker Set, indexed by engine `Color` (red, blue, green, yellow, purple). */
    colorNames: {
      colorful: ['red', 'blue', 'green', 'yellow', 'purple'],
      greyscale: ['diagonal', 'solid', 'dotted', 'banded', 'checkered'],
    },
    /** Points bubble. A group has at least 2 balls, so it is always worth at least 2 points. */
    points: (points: string) => `${points} points`,
    cursorEmpty: (row: number, col: number) => `Row ${String(row)}, column ${String(col)}, empty`,
    cursorBall: (row: number, col: number, color: string, groupSize: number) =>
      groupSize > 0
        ? `Row ${String(row)}, column ${String(col)}, ${color}, group of ${String(groupSize)}`
        : `Row ${String(row)}, column ${String(col)}, ${color}, no group`,
    selected: (size: number, color: string, points: string) =>
      `${String(size)} ${color} balls selected, ${points} points. Press Enter again to burst.`,
    cleared: 'Selection cleared.',
    burst: (points: string, score: string) => `+${points}, score ${score}`,
    gameOver: (score: string) => `Game over. No groups left. Score ${score}.`,
    newGame: 'New game.',
  },
} as const;
