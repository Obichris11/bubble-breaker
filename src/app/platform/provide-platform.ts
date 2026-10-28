import { DOCUMENT, inject, type Provider } from '@angular/core';
import { AudioPort, BrowserAudio } from './audio';
import { BrowserClock, ClockPort } from './clock';
import { BrowserReducedMotion, REDUCED_MOTION_QUERY, ReducedMotionPort } from './reduced-motion';
import { BrowserStorage, StoragePort } from './storage';
import { BrowserVisibility, VisibilityPort } from './visibility';

/** Binds the browser implementations of the platform ports (used in `app.config.ts`). */
export function providePlatform(): Provider[] {
  return [
    { provide: ClockPort, useFactory: () => new BrowserClock() },
    { provide: StoragePort, useFactory: () => new BrowserStorage(() => window.localStorage) },
    { provide: VisibilityPort, useFactory: () => new BrowserVisibility(inject(DOCUMENT)) },
    {
      provide: ReducedMotionPort,
      useFactory: () =>
        new BrowserReducedMotion(
          typeof window.matchMedia === 'function' ? window.matchMedia(REDUCED_MOTION_QUERY) : null,
        ),
    },
    { provide: AudioPort, useFactory: () => new BrowserAudio(() => new AudioContext()) },
  ];
}
