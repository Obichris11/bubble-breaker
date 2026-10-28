/** All user-visible copy (ADR-0008). Components never hard-code text. */
export const STRINGS = {
  appTitle: 'Bubble Breaker',
  status: {
    /** "Selected" field when nothing is selected. */
    noSelection: '–',
    /** Prefix of the time field while the timer is stopped by Paused or an open menu/screen. */
    pausedPrefix: '‖ ',
  },
} as const;
