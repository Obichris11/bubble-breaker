import { signal, type Signal } from '@angular/core';
import type { SwUpdate } from '@angular/service-worker';
import type { ClockPort } from './clock';

/** Service worker and install prompt, seen from the page (ADR-0007). */
export abstract class PwaPort {
  /** A new version is downloaded and ready; the next page load runs it. */
  abstract readonly updateAvailable: Signal<boolean>;
  /** First visit only: the service worker has cached every app-shell file. */
  abstract readonly offlineReady: Signal<boolean>;
  /** The browser offers to install the app (a `beforeinstallprompt` was kept). */
  abstract readonly installAvailable: Signal<boolean>;
  /** The service worker can no longer serve this version; only a reload helps. */
  abstract readonly unrecoverable: Signal<boolean>;
  /** Asks the service worker to look for a new version. */
  abstract checkForUpdate(): void;
  /** Shows the browser's install prompt; resolves true when the player accepts. */
  abstract install(): Promise<boolean>;
  abstract reload(): void;
}

/** The parts of `SwUpdate` the port uses. */
export type ServiceWorkerSource = Pick<
  SwUpdate,
  'isEnabled' | 'versionUpdates' | 'unrecoverable' | 'checkForUpdate'
>;

/** `beforeinstallprompt` (Chromium only, so not in lib.dom). */
export interface InstallPromptEvent extends Event {
  prompt(): Promise<unknown>;
  readonly userChoice: Promise<{ readonly outcome: 'accepted' | 'dismissed' }>;
}

/** The page around the port; `browserPwaHost(window)` in the app. */
export interface PwaHost {
  /** A service worker controlled the page when it loaded, so this is not a first visit. */
  readonly controlled: boolean;
  addEventListener(
    type: 'beforeinstallprompt' | 'appinstalled',
    listener: (event: Event) => void,
  ): void;
  /** True once every file the service worker prefetches is in Cache Storage. */
  appShellCached(): Promise<boolean>;
  reload(): void;
}

/** How often, and how long, a first visit looks for the finished app-shell cache (2 min). */
const CACHE_POLL_MS = 2_000;
const CACHE_POLL_TRIES = 60;

export class BrowserPwa extends PwaPort {
  private readonly update = signal(false);
  private readonly offline = signal(false);
  private readonly installable = signal(false);
  private readonly broken = signal(false);
  private prompt: InstallPromptEvent | null = null;

  readonly updateAvailable = this.update.asReadonly();
  readonly offlineReady = this.offline.asReadonly();
  readonly installAvailable = this.installable.asReadonly();
  readonly unrecoverable = this.broken.asReadonly();

  constructor(
    private readonly sw: ServiceWorkerSource,
    private readonly host: PwaHost,
    private readonly clock: ClockPort,
  ) {
    super();
    if (sw.isEnabled) {
      sw.versionUpdates.subscribe((event) => {
        if (event.type === 'VERSION_READY') {
          this.update.set(true);
        }
      });
      sw.unrecoverable.subscribe(() => {
        this.broken.set(true);
      });
      if (!host.controlled) {
        this.watchFirstCache(CACHE_POLL_TRIES);
      }
    }
    // Keep the prompt for the install notice instead of the browser's own mini-infobar.
    host.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      this.prompt = event as InstallPromptEvent;
      this.installable.set(true);
    });
    host.addEventListener('appinstalled', () => {
      this.prompt = null;
      this.installable.set(false);
    });
  }

  checkForUpdate(): void {
    if (this.sw.isEnabled) {
      this.sw.checkForUpdate().catch((error: unknown) => {
        console.warn('Update check failed', error);
      });
    }
  }

  async install(): Promise<boolean> {
    const prompt = this.prompt;
    if (prompt === null) {
      return false;
    }
    // A prompt can be shown only once.
    this.prompt = null;
    this.installable.set(false);
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    return outcome === 'accepted';
  }

  reload(): void {
    this.host.reload();
  }

  /**
   * ngsw sends no event when a first install has cached the app (and caches in an idle task
   * after activation), so a first visit checks Cache Storage until the app shell is complete.
   */
  private watchFirstCache(triesLeft: number): void {
    void this.host.appShellCached().then((cached) => {
      if (cached) {
        this.offline.set(true);
      } else if (triesLeft > 1) {
        this.clock.setTimeout(() => {
          this.watchFirstCache(triesLeft - 1);
        }, CACHE_POLL_MS);
      }
    });
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The URLs of the `prefetch` asset groups in an `ngsw.json` manifest. */
function prefetchUrls(manifest: unknown): string[] {
  const groups = isRecord(manifest) ? manifest['assetGroups'] : undefined;
  if (!Array.isArray(groups)) {
    return [];
  }
  return groups.flatMap((group: unknown) =>
    isRecord(group) && group['installMode'] === 'prefetch' && Array.isArray(group['urls'])
      ? group['urls'].filter((url: unknown): url is string => typeof url === 'string')
      : [],
  );
}

/** Whether every app-shell file listed in `ngsw.json` is in Cache Storage. Never throws. */
export async function appShellCached(
  fetchFn: typeof fetch,
  cacheStorage: Pick<CacheStorage, 'match'>,
): Promise<boolean> {
  try {
    const response = await fetchFn('ngsw.json', { cache: 'no-store' });
    if (!response.ok) {
      return false;
    }
    const urls = prefetchUrls(await response.json());
    // ngsw stores its asset groups with `ignoreVary`.
    const hits = await Promise.all(
      urls.map((url) => cacheStorage.match(url, { ignoreVary: true })),
    );
    return urls.length > 0 && hits.every((hit) => hit !== undefined);
  } catch {
    return false;
  }
}

export function browserPwaHost(win: Window): PwaHost {
  return {
    controlled: 'serviceWorker' in win.navigator && win.navigator.serviceWorker.controller !== null,
    addEventListener: (type, listener) => {
      win.addEventListener(type, listener);
    },
    appShellCached: () =>
      'caches' in win ? appShellCached(win.fetch.bind(win), win.caches) : Promise.resolve(false),
    reload: () => {
      win.location.reload();
    },
  };
}
