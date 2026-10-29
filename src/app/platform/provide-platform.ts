import {
  DOCUMENT,
  inject,
  isDevMode,
  type EnvironmentProviders,
  type Provider,
} from '@angular/core';
import { provideServiceWorker, SwUpdate } from '@angular/service-worker';
import { AudioPort, BrowserAudio } from './audio';
import { BrowserClock, ClockPort } from './clock';
import { BrowserPwa, browserPwaHost, PwaPort } from './pwa';
import { BrowserReducedMotion, REDUCED_MOTION_QUERY, ReducedMotionPort } from './reduced-motion';
import { BrowserStorage, StoragePort } from './storage';
import { BrowserVisibility, VisibilityPort } from './visibility';

/**
 * Binds the browser implementations of the platform ports (used in `app.config.ts`). The
 * service worker runs in production builds only (ADR-0007).
 */
export function providePlatform(): (Provider | EnvironmentProviders)[] {
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
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
    {
      provide: PwaPort,
      useFactory: () => new BrowserPwa(inject(SwUpdate), browserPwaHost(window), inject(ClockPort)),
    },
  ];
}
