import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { providePlatform } from './platform/provide-platform';
import { PwaStore } from './state/pwa.store';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    providePlatform(),
    // Update checks and the unrecoverable-state reload run on every screen.
    provideAppInitializer(() => {
      inject(PwaStore);
    }),
  ],
};
